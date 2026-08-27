import { createHash } from "node:crypto";

import sharp from "sharp";

export type ProspectPreviewSourceAssetKind = "logo" | "on-site-image";

export type StoreProspectPreviewAssetInput = {
  prospectId: string;
  runId: string;
  evidenceId: string;
  assetKind: ProspectPreviewSourceAssetKind;
  bytes: Uint8Array;
  declaredContentType: string;
  altText: string;
};

export type StoredProspectPreviewAsset = {
  id: string;
  blobUrl: string;
  contentType: "image/webp";
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  reviewStatus: "source_verified";
};

export type NormalisedProspectPreviewImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

export type PersistProspectPreviewAssetInput = StoredProspectPreviewAsset & {
  prospectId: string;
  runId: string;
  evidenceId: string;
  assetKind: ProspectPreviewSourceAssetKind;
  altText: string;
  createdBy: "agent_ingestion";
};

export type ProspectPreviewAssetDependencies = {
  createId: () => string;
  normaliseImage: (
    bytes: Uint8Array,
  ) => Promise<NormalisedProspectPreviewImage>;
  putPrivateBlob: (input: {
    pathname: string;
    bytes: Uint8Array;
    contentType: "image/webp";
  }) => Promise<{ url: string }>;
  deleteBlob: (url: string) => Promise<void>;
  persistAsset: (input: PersistProspectPreviewAssetInput) => Promise<void>;
};

export class ProspectPreviewAssetValidationError extends Error {
  constructor(
    public readonly code:
      | "invalid_image"
      | "invalid_dimensions"
      | "invalid_alt_text"
      | "too_large",
    message: string,
  ) {
    super(message);
    this.name = "ProspectPreviewAssetValidationError";
  }
}

const MAX_ASSET_BYTES = 1024 * 1024;
const MAX_INPUT_PIXELS = 10_000_000;
const MIN_ALT_TEXT_LENGTH = 20;
const MAX_ALT_TEXT_LENGTH = 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AcceptedImageContentType = "image/jpeg" | "image/png" | "image/webp";

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function detectImageContentType(
  bytes: Uint8Array,
): AcceptedImageContentType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function validateAltText(altText: string): string {
  const trimmed = altText.trim();
  if (
    trimmed.length < MIN_ALT_TEXT_LENGTH ||
    trimmed.length > MAX_ALT_TEXT_LENGTH
  ) {
    throw new ProspectPreviewAssetValidationError(
      "invalid_alt_text",
      "Preview asset alt text must contain between 20 and 1000 characters.",
    );
  }
  return trimmed;
}

function validateImageDimensions(width: number, height: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new ProspectPreviewAssetValidationError(
      "invalid_dimensions",
      "Preview asset dimensions must be positive integers.",
    );
  }
}

export async function normaliseProspectPreviewImage(
  bytes: Uint8Array,
): Promise<NormalisedProspectPreviewImage> {
  const result = await sharp(bytes, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .rotate()
    .webp({ quality: 84, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    bytes: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

export async function storeProspectPreviewAsset(
  input: StoreProspectPreviewAssetInput,
  dependencies: ProspectPreviewAssetDependencies,
): Promise<StoredProspectPreviewAsset> {
  const altText = validateAltText(input.altText);
  const detectedContentType = detectImageContentType(input.bytes);
  if (
    detectedContentType === null ||
    detectedContentType !== input.declaredContentType
  ) {
    throw new ProspectPreviewAssetValidationError(
      "invalid_image",
      "Image bytes do not match the declared content type.",
    );
  }

  let normalised: NormalisedProspectPreviewImage;
  try {
    normalised = await dependencies.normaliseImage(input.bytes);
  } catch {
    throw new ProspectPreviewAssetValidationError(
      "invalid_image",
      "Image processing failed.",
    );
  }
  validateImageDimensions(normalised.width, normalised.height);
  if (normalised.bytes.byteLength > MAX_ASSET_BYTES) {
    throw new ProspectPreviewAssetValidationError(
      "too_large",
      "Preview assets must not exceed 1 MB after normalisation.",
    );
  }

  const id = dependencies.createId();
  if (!UUID_PATTERN.test(id)) {
    throw new Error("Prospect preview asset ID generator returned an invalid UUID.");
  }

  const blob = await dependencies.putPrivateBlob({
    pathname: `growth-prospect-preview-assets/${id}.webp`,
    bytes: normalised.bytes,
    contentType: "image/webp",
  });
  const asset: StoredProspectPreviewAsset = {
    id,
    blobUrl: blob.url,
    contentType: "image/webp",
    byteSize: normalised.bytes.byteLength,
    width: normalised.width,
    height: normalised.height,
    sha256: createHash("sha256").update(normalised.bytes).digest("hex"),
    reviewStatus: "source_verified",
  };

  try {
    await dependencies.persistAsset({
      ...asset,
      prospectId: input.prospectId,
      runId: input.runId,
      evidenceId: input.evidenceId,
      assetKind: input.assetKind,
      altText,
      createdBy: "agent_ingestion",
    });
  } catch (persistenceError) {
    try {
      await dependencies.deleteBlob(blob.url);
    } catch (cleanupError) {
      throw new AggregateError(
        [persistenceError, cleanupError],
        "Preview asset persistence and blob cleanup both failed.",
      );
    }
    throw persistenceError;
  }

  return asset;
}
