import assert from "node:assert/strict";
import test from "node:test";

import { createVercelBlobAdapter } from "./vercel-blob";

test("uploads immutable public WebP assets with explicit cache metadata", async () => {
  const calls: unknown[][] = [];
  const adapter = createVercelBlobAdapter({
    put: async (...args) => {
      calls.push(args);
      return { url: "https://blob.example.test/growth-email-assets/id.webp" };
    },
    del: async () => undefined,
  });
  const bytes = Uint8Array.from([1, 2, 3]);

  const result = await adapter.putBlob({
    pathname: "growth-email-assets/id.webp",
    bytes,
    contentType: "image/webp",
  });

  assert.deepEqual(result, {
    url: "https://blob.example.test/growth-email-assets/id.webp",
  });
  assert.equal(calls[0]?.[0], "growth-email-assets/id.webp");
  assert.deepEqual(calls[0]?.[1], Buffer.from(bytes));
  assert.deepEqual(calls[0]?.[2], {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    cacheControlMaxAge: 31_536_000,
    contentType: "image/webp",
  });
});

test("deletes a blob by its returned URL", async () => {
  const deleted: string[] = [];
  const adapter = createVercelBlobAdapter({
    put: async () => ({ url: "https://blob.example.test/unused.webp" }),
    del: async (url) => {
      deleted.push(url);
    },
  });

  await adapter.deleteBlob("https://blob.example.test/asset.webp");

  assert.deepEqual(deleted, ["https://blob.example.test/asset.webp"]);
});
