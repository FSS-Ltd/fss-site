import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import sharp from "sharp";

import {
  EmailAssetValidationError,
  normaliseEmailImage,
  storeEmailAsset,
  type EmailAssetDependencies,
  type PersistEmailAssetInput,
  type StoreEmailAssetInput,
} from "./service";

const ASSET_ID = "c5b2e617-f78d-4d0d-9841-9c240c663be2";
const PNG_HEADER = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const validInput: StoreEmailAssetInput = {
  prospectId: "6322f2e9-a320-4e3c-8fbf-b2f137949e2c",
  runId: "d0f57e79-413f-41dc-b15f-1b609fb29db2",
  bytes: PNG_HEADER,
  declaredContentType: "image/png",
  altText:
    "Concept showing a customer enquiry moving into an organised service workflow.",
  promptSummary: "A generic service workflow concept with no personal data.",
  assetKind: "cold_first_email",
};

type TestHarness = {
  dependencies: EmailAssetDependencies;
  uploadedPathnames: string[];
  deletedUrls: string[];
  persistedAssets: PersistEmailAssetInput[];
  normaliseCalls: Uint8Array[];
};

function createHarness(
  overrides: Partial<EmailAssetDependencies> = {},
): TestHarness {
  const uploadedPathnames: string[] = [];
  const deletedUrls: string[] = [];
  const persistedAssets: PersistEmailAssetInput[] = [];
  const normaliseCalls: Uint8Array[] = [];
  const dependencies: EmailAssetDependencies = {
    createId: () => ASSET_ID,
    normaliseImage: async (bytes) => {
      normaliseCalls.push(bytes);
      return {
        bytes: Uint8Array.from([1, 2, 3]),
        width: 1200,
        height: 630,
      };
    },
    putBlob: async ({ pathname }) => {
      uploadedPathnames.push(pathname);
      return { url: `https://blob.example.test/${pathname}` };
    },
    deleteBlob: async (url) => {
      deletedUrls.push(url);
    },
    persistAsset: async (asset) => {
      persistedAssets.push(asset);
    },
    ...overrides,
  };

  return {
    dependencies,
    uploadedPathnames,
    deletedUrls,
    persistedAssets,
    normaliseCalls,
  };
}

async function expectValidationCode(
  promise: Promise<unknown>,
  code: EmailAssetValidationError["code"],
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof EmailAssetValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

test("normalises and stores one valid 1200 by 630 image", async () => {
  const harness = createHarness();

  const stored = await storeEmailAsset(validInput, harness.dependencies);

  const pathname = `growth-email-assets/${ASSET_ID}.webp`;
  const blobUrl = `https://blob.example.test/${pathname}`;
  assert.deepEqual(stored, {
    id: ASSET_ID,
    blobUrl,
    contentType: "image/webp",
    byteSize: 3,
    width: 1200,
    height: 630,
    sha256: createHash("sha256")
      .update(Uint8Array.from([1, 2, 3]))
      .digest("hex"),
    reviewStatus: "pending",
  });
  assert.deepEqual(harness.uploadedPathnames, [pathname]);
  assert.equal(harness.persistedAssets[0]?.prospectId, validInput.prospectId);
  assert.equal(harness.persistedAssets[0]?.runId, validInput.runId);
});

test("normalises to WebP without retaining EXIF metadata", async () => {
  const input = await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: "#ffffff",
    },
  })
    .jpeg()
    .withExif({ IFD0: { Copyright: "Sensitive source metadata" } })
    .toBuffer();

  const normalised = await normaliseEmailImage(input);
  const metadata = await sharp(normalised.bytes).metadata();

  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  assert.equal(normalised.width, 1200);
  assert.equal(normalised.height, 630);
});

test("rejects a compressed source above the image pixel ceiling", async () => {
  const oversizedInput = await sharp({
    create: {
      width: 4000,
      height: 3000,
      channels: 3,
      background: "#ffffff",
    },
  })
    .png()
    .toBuffer();

  await assert.rejects(normaliseEmailImage(oversizedInput), /pixel limit/i);
});

test("rejects a cold-email visual over 180 KB after normalisation", async () => {
  const harness = createHarness({
    normaliseImage: async () => ({
      bytes: new Uint8Array(184_321),
      width: 1200,
      height: 630,
    }),
  });

  await expectValidationCode(
    storeEmailAsset(validInput, harness.dependencies),
    "too_large",
  );
  assert.deepEqual(harness.uploadedPathnames, []);
});

test("rejects invalid magic bytes before image processing", async () => {
  const harness = createHarness();

  await expectValidationCode(
    storeEmailAsset(
      { ...validInput, bytes: Uint8Array.from([1, 2, 3, 4]) },
      harness.dependencies,
    ),
    "invalid_image",
  );
  assert.deepEqual(harness.normaliseCalls, []);
});

test("rejects a declared MIME type that does not match the image bytes", async () => {
  const harness = createHarness();

  await expectValidationCode(
    storeEmailAsset(
      { ...validInput, declaredContentType: "image/jpeg" },
      harness.dependencies,
    ),
    "invalid_image",
  );
  assert.deepEqual(harness.normaliseCalls, []);
});

test("rejects dimensions outside the approved cold-email aspect ratio", async () => {
  const harness = createHarness({
    normaliseImage: async () => ({
      bytes: Uint8Array.from([1, 2, 3]),
      width: 1200,
      height: 800,
    }),
  });

  await expectValidationCode(
    storeEmailAsset(validInput, harness.dependencies),
    "invalid_dimensions",
  );
  assert.deepEqual(harness.uploadedPathnames, []);
});

test("rejects missing or too-short alt text", async () => {
  const harness = createHarness();

  for (const altText of ["", "Too short"]) {
    await expectValidationCode(
      storeEmailAsset({ ...validInput, altText }, harness.dependencies),
      "invalid_alt_text",
    );
  }
  assert.deepEqual(harness.normaliseCalls, []);
});

test("rejects missing or oversized prompt summaries", async () => {
  const harness = createHarness();

  for (const promptSummary of ["", "x".repeat(2001)]) {
    await expectValidationCode(
      storeEmailAsset({ ...validInput, promptSummary }, harness.dependencies),
      "invalid_prompt",
    );
  }
  assert.deepEqual(harness.normaliseCalls, []);
});

test("uses an opaque UUID blob path without prospect metadata", async () => {
  const harness = createHarness();

  await storeEmailAsset(validInput, harness.dependencies);

  assert.deepEqual(harness.uploadedPathnames, [
    `growth-email-assets/${ASSET_ID}.webp`,
  ]);
  assert.ok(!harness.uploadedPathnames[0]?.includes(validInput.prospectId));
  assert.ok(!harness.uploadedPathnames[0]?.includes(validInput.runId));
});

test("rejects a non-UUID value from the asset ID generator", async () => {
  const harness = createHarness({ createId: () => "prospect-name" });

  await assert.rejects(
    storeEmailAsset(validInput, harness.dependencies),
    /invalid UUID/i,
  );
  assert.deepEqual(harness.uploadedPathnames, []);
});

test("deletes the uploaded blob when metadata persistence fails", async () => {
  const persistenceError = new Error("database unavailable");
  const harness = createHarness({
    persistAsset: async () => {
      throw persistenceError;
    },
  });

  await assert.rejects(
    storeEmailAsset(validInput, harness.dependencies),
    persistenceError,
  );
  assert.deepEqual(harness.deletedUrls, [
    `https://blob.example.test/growth-email-assets/${ASSET_ID}.webp`,
  ]);
});
