import { createHash } from "node:crypto";

import sharp from "sharp";

export type EmailAssetKind = "cold_first_email" | "newsletter" | "site_email";

export type StoreEmailAssetInput = {
  prospectId: string;
  runId: string;
  bytes: Uint8Array;
  declaredContentType: string;
  altText: string;
  promptSummary: string;
  assetKind: EmailAssetKind;
};

export type StoredEmailAsset = {
  id: string;
  blobUrl: string;
  contentType: "image/webp";
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  reviewStatus: "pending";
};

export type NormalisedEmailImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

export type PersistEmailAssetInput = StoredEmailAsset & {
  prospectId: string;
  runId: string;
  assetKind: EmailAssetKind;
  altText: string;
  promptSummary: string;
  createdBy: "agent_ingestion";
};

export type EmailAssetDependencies = {
  createId: () => string;
  normaliseImage: (bytes: Uint8Array) => Promise<NormalisedEmailImage>;
  putBlob: (input: {
    pathname: string;
    bytes: Uint8Array;
    contentType: "image/webp";
  }) => Promise<{ url: string }>;
  deleteBlob: (url: string) => Promise<void>;
  persistAsset: (input: PersistEmailAssetInput) => Promise<void>;
};

export class EmailAssetValidationError extends Error {
  constructor(
    public readonly code:
      | "invalid_image"
      | "invalid_dimensions"
      | "invalid_alt_text"
      | "invalid_prompt"
      | "too_large",
    message: string,
  ) {
    super(message);
    this.name = "EmailAssetValidationError";
  }
}

const COLD_EMAIL_MAX_BYTES = 180 * 1024;
const MIN_ALT_TEXT_LENGTH = 20;
const MAX_ALT_TEXT_LENGTH = 1000;
const MAX_PROMPT_SUMMARY_LENGTH = 2000;
const MAX_INPUT_PIXELS = 10_000_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AcceptedImageContentType = "image/jpeg" | "image/png" | "image/webp";

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function detectImageContentType(
  bytes: Uint8Array,
): AcceptedImageContentType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
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

function validateText(input: StoreEmailAssetInput): void {
  const altTextLength = input.altText.trim().length;
  if (
    altTextLength < MIN_ALT_TEXT_LENGTH ||
    altTextLength > MAX_ALT_TEXT_LENGTH
  ) {
    throw new EmailAssetValidationError(
      "invalid_alt_text",
      "Image alt text must contain between 20 and 1000 characters.",
    );
  }

  const promptLength = input.promptSummary.trim().length;
  if (promptLength === 0 || promptLength > MAX_PROMPT_SUMMARY_LENGTH) {
    throw new EmailAssetValidationError(
      "invalid_prompt",
      "Image prompt summary is required and must not exceed 2000 characters.",
    );
  }
}

function validateDimensions(
  assetKind: EmailAssetKind,
  width: number,
  height: number,
): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new EmailAssetValidationError(
      "invalid_dimensions",
      "Image dimensions must be positive integers.",
    );
  }

  if (
    assetKind === "cold_first_email" &&
    (width * 100 < height * 185 || width * 100 > height * 195)
  ) {
    throw new EmailAssetValidationError(
      "invalid_dimensions",
      "Cold-email images must use an aspect ratio between 1.85 and 1.95.",
    );
  }
}

export async function normaliseEmailImage(
  bytes: Uint8Array,
): Promise<NormalisedEmailImage> {
  const result = await sharp(bytes, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .rotate()
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    bytes: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

export async function storeEmailAsset(
  input: StoreEmailAssetInput,
  dependencies: EmailAssetDependencies,
): Promise<StoredEmailAsset> {
  validateText(input);

  const detectedContentType = detectImageContentType(input.bytes);
  if (
    detectedContentType === null ||
    detectedContentType !== input.declaredContentType
  ) {
    throw new EmailAssetValidationError(
      "invalid_image",
      "Image bytes do not match the declared content type.",
    );
  }

  let normalised: NormalisedEmailImage;
  try {
    normalised = await dependencies.normaliseImage(input.bytes);
  } catch {
    throw new EmailAssetValidationError(
      "invalid_image",
      "Image processing failed.",
    );
  }

  validateDimensions(input.assetKind, normalised.width, normalised.height);
  if (
    input.assetKind === "cold_first_email" &&
    normalised.bytes.byteLength > COLD_EMAIL_MAX_BYTES
  ) {
    throw new EmailAssetValidationError(
      "too_large",
      "Cold-email images must not exceed 180 KB after normalisation.",
    );
  }

  const id = dependencies.createId();
  if (!UUID_PATTERN.test(id)) {
    throw new Error("Email asset ID generator returned an invalid UUID.");
  }

  const pathname = `growth-email-assets/${id}.webp`;
  const sha256 = createHash("sha256").update(normalised.bytes).digest("hex");
  const blob = await dependencies.putBlob({
    pathname,
    bytes: normalised.bytes,
    contentType: "image/webp",
  });
  const stored: StoredEmailAsset = {
    id,
    blobUrl: blob.url,
    contentType: "image/webp",
    byteSize: normalised.bytes.byteLength,
    width: normalised.width,
    height: normalised.height,
    sha256,
    reviewStatus: "pending",
  };

  try {
    await dependencies.persistAsset({
      ...stored,
      prospectId: input.prospectId,
      runId: input.runId,
      assetKind: input.assetKind,
      altText: input.altText.trim(),
      promptSummary: input.promptSummary.trim(),
      createdBy: "agent_ingestion",
    });
  } catch (persistenceError) {
    try {
      await dependencies.deleteBlob(blob.url);
    } catch (cleanupError) {
      throw new AggregateError(
        [persistenceError, cleanupError],
        "Email asset persistence and blob cleanup both failed.",
      );
    }
    throw persistenceError;
  }

  return stored;
}
