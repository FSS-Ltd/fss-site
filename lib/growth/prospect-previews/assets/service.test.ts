import assert from "node:assert/strict";
import test from "node:test";

import {
  ProspectPreviewAssetValidationError,
  storeProspectPreviewAsset,
  type ProspectPreviewAssetDependencies,
} from "./service";

const ASSET_ID = "c5b2e617-f78d-4d0d-9841-9c240c663be2";
const PROSPECT_ID = "6322f2e9-a320-4e3c-8fbf-b2f137949e2c";
const RUN_ID = "d0f57e79-413f-41dc-b15f-1b609fb29db2";
const EVIDENCE_ID = "bdac107a-2991-4c5e-a6ae-65933c2427cc";
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);

function dependencies(): {
  dependencies: ProspectPreviewAssetDependencies;
  persisted: unknown[];
  deletedUrls: string[];
} {
  const persisted: unknown[] = [];
  const deletedUrls: string[] = [];

  return {
    dependencies: {
      createId: () => ASSET_ID,
      normaliseImage: async () => ({
        bytes: WEBP_BYTES,
        width: 960,
        height: 480,
      }),
      putPrivateBlob: async ({ pathname }) => ({
        url: `https://blob.example.test/${pathname}`,
      }),
      deleteBlob: async (url) => {
        deletedUrls.push(url);
      },
      persistAsset: async (input) => {
        persisted.push(input);
      },
    },
    persisted,
    deletedUrls,
  };
}

test("stores a first-party logo as a private, source-verified preview asset", async () => {
  const { dependencies: assetDependencies, persisted } = dependencies();

  const asset = await storeProspectPreviewAsset(
    {
      prospectId: PROSPECT_ID,
      runId: RUN_ID,
      evidenceId: EVIDENCE_ID,
      assetKind: "logo",
      bytes: PNG_BYTES,
      declaredContentType: "image/png",
      altText: "Example Services wordmark used on the business website header.",
    },
    assetDependencies,
  );

  assert.deepEqual(asset, {
    id: ASSET_ID,
    blobUrl: `https://blob.example.test/growth-prospect-preview-assets/${ASSET_ID}.webp`,
    contentType: "image/webp",
    byteSize: WEBP_BYTES.byteLength,
    width: 960,
    height: 480,
    sha256: "44e65465e5e82733c8e5499cdd2fb106b8b703ea3f28da3b7da7f3a661267d6e",
    reviewStatus: "source_verified",
  });
  assert.deepEqual(persisted, [
    {
      ...asset,
      prospectId: PROSPECT_ID,
      runId: RUN_ID,
      evidenceId: EVIDENCE_ID,
      assetKind: "logo",
      altText: "Example Services wordmark used on the business website header.",
      createdBy: "agent_ingestion",
    },
  ]);
});

test("rejects an upload whose declared type does not match the bytes", async () => {
  const { dependencies: assetDependencies } = dependencies();

  await assert.rejects(
    () =>
      storeProspectPreviewAsset(
        {
          prospectId: PROSPECT_ID,
          runId: RUN_ID,
          evidenceId: EVIDENCE_ID,
          assetKind: "logo",
          bytes: PNG_BYTES,
          declaredContentType: "image/jpeg",
          altText: "Example Services wordmark used on the business website header.",
        },
        assetDependencies,
      ),
    (error: unknown) => {
      assert.ok(error instanceof ProspectPreviewAssetValidationError);
      assert.equal(error.code, "invalid_image");
      return true;
    },
  );
});

test("deletes the private blob when metadata persistence fails", async () => {
  const { dependencies: assetDependencies, deletedUrls } = dependencies();
  assetDependencies.persistAsset = async () => {
    throw new Error("database unavailable");
  };

  await assert.rejects(
    () =>
      storeProspectPreviewAsset(
        {
          prospectId: PROSPECT_ID,
          runId: RUN_ID,
          evidenceId: EVIDENCE_ID,
          assetKind: "on-site-image",
          bytes: PNG_BYTES,
          declaredContentType: "image/png",
          altText: "Example Services workshop exterior shown on the business website.",
        },
        assetDependencies,
      ),
    /database unavailable/i,
  );

  assert.deepEqual(deletedUrls, [
    `https://blob.example.test/growth-prospect-preview-assets/${ASSET_ID}.webp`,
  ]);
});
