import assert from "node:assert/strict";
import test from "node:test";

import { createVercelPreviewBlobAdapter } from "./vercel-blob";

test("uploads source-backed preview assets as private WebP blobs", async () => {
  const calls: unknown[][] = [];
  const adapter = createVercelPreviewBlobAdapter({
    put: async (...args) => {
      calls.push(args);
      return {
        url: "https://blob.example.test/growth-prospect-preview-assets/id.webp",
      };
    },
    del: async () => undefined,
    get: async () => null,
  });
  const bytes = Uint8Array.from([1, 2, 3]);

  const result = await adapter.putPrivateBlob({
    pathname: "growth-prospect-preview-assets/id.webp",
    bytes,
    contentType: "image/webp",
  });

  assert.deepEqual(result, {
    url: "https://blob.example.test/growth-prospect-preview-assets/id.webp",
  });
  assert.equal(calls[0]?.[0], "growth-prospect-preview-assets/id.webp");
  assert.deepEqual(calls[0]?.[1], Buffer.from(bytes));
  assert.deepEqual(calls[0]?.[2], {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "image/webp",
  });
});

test("deletes a private blob by its returned URL", async () => {
  const deleted: string[] = [];
  const adapter = createVercelPreviewBlobAdapter({
    put: async () => ({ url: "https://blob.example.test/unused.webp" }),
    del: async (url) => {
      deleted.push(url);
    },
    get: async () => null,
  });

  await adapter.deleteBlob("https://blob.example.test/asset.webp");

  assert.deepEqual(deleted, ["https://blob.example.test/asset.webp"]);
});

test("reads private preview blobs through authenticated Blob access", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
  const calls: unknown[][] = [];
  const adapter = createVercelPreviewBlobAdapter({
    put: async () => ({ url: "https://blob.example.test/unused.webp" }),
    del: async () => undefined,
    get: async (...args) => {
      calls.push(args);
      return {
        statusCode: 200,
        stream,
        blob: { contentType: "image/webp" },
      };
    },
  });

  const result = await adapter.getPrivateBlob(
    "https://blob.example.test/private-preview-asset.webp",
  );

  assert.deepEqual(result, { stream, contentType: "image/webp" });
  assert.deepEqual(calls[0], [
    "https://blob.example.test/private-preview-asset.webp",
    { access: "private" },
  ]);
});
