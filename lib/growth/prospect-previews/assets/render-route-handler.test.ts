import assert from "node:assert/strict";
import test from "node:test";

import {
  createProspectPreviewAssetGetHandler,
  type ProspectPreviewAssetGetRouteDependencies,
} from "./render-route-handler";

const ASSET_ID = "c5b2e617-f78d-4d0d-9841-9c240c663be2";

function streamFor(value: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

function createHandler(
  overrides: Partial<ProspectPreviewAssetGetRouteDependencies> = {},
) {
  return createProspectPreviewAssetGetHandler({
    loadRenderableAsset: async () => ({
      blobUrl: "https://blob.example.test/private-preview-asset.webp",
      contentType: "image/webp",
    }),
    readPrivateBlob: async () => ({
      stream: streamFor("private-webp"),
      contentType: "image/webp",
    }),
    createCorrelationId: () => "corr-preview-asset-read-1",
    reportUnexpectedError: () => undefined,
    ...overrides,
  });
}

test("streams a renderable private asset without exposing its Blob URL", async () => {
  const response = await createHandler()(ASSET_ID);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(response.headers.get("location"), null);
  assert.equal(await response.text(), "private-webp");
});

test("returns the same opaque response for an unknown or disallowed asset", async () => {
  const response = await createHandler({
    loadRenderableAsset: async () => null,
  })(ASSET_ID);

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "Not found");
});

test("does not serve a Blob whose content type conflicts with the approved record", async () => {
  const response = await createHandler({
    readPrivateBlob: async () => ({
      stream: streamFor("unexpected"),
      contentType: "image/png",
    }),
  })(ASSET_ID);

  assert.equal(response.status, 404);
});
