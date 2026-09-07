import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { GetBlobResult, GetCommandOptions } from "@vercel/blob";
import { readPrivateDocumentBlob } from "./storage";

const organisationId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const content = "Approved synthetic deliverable";
const contentHash = createHash("sha256").update(content).digest("hex");
const reference = {
  organisationId,
  id,
  contentHash,
  objectKey: `operations/${organisationId}/${id}/${contentHash}`,
  mimeType: "text/plain",
  sizeBytes: Buffer.byteLength(content),
};
const env = {
  OPERATIONS_BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_synthetic_secret",
};
function blob(
  body = content,
  mimeType = "text/plain",
  size = reference.sizeBytes,
): GetBlobResult {
  return {
    statusCode: 200,
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    headers: new Headers(),
    blob: {
      url: "https://synthetic.private.blob.vercel-storage.com/file",
      downloadUrl: "unused",
      pathname: reference.objectKey,
      contentDisposition: "",
      cacheControl: "",
      uploadedAt: new Date(),
      etag: "synthetic",
      contentType: mimeType,
      size,
    },
  };
}

test("private download verifies bounded content and passes only dedicated private-store options", async () => {
  let pathname = "";
  let options: GetCommandOptions | undefined;
  const fetchBlob = async (path: string, input: GetCommandOptions) => {
    pathname = path;
    options = input;
    return blob();
  };
  const result = await readPrivateDocumentBlob(
    reference,
    new AbortController().signal,
    env,
    fetchBlob,
  );
  assert.equal(new TextDecoder().decode(result), content);
  assert.equal(pathname, reference.objectKey);
  assert.equal(options?.access, "private");
  assert.equal(options?.useCache, false);
  assert.equal(options?.token, env.OPERATIONS_BLOB_READ_WRITE_TOKEN);
  await assert.rejects(
    readPrivateDocumentBlob(
      { ...reference, organisationId: id },
      new AbortController().signal,
      env,
      fetchBlob,
    ),
  );
  await assert.rejects(
    readPrivateDocumentBlob(
      reference,
      new AbortController().signal,
      { BLOB_READ_WRITE_TOKEN: env.OPERATIONS_BLOB_READ_WRITE_TOKEN },
      fetchBlob,
    ),
    /unavailable/,
  );
});

test("private download rejects missing, altered, mismatched and oversized files", async () => {
  let response: () => GetBlobResult | null = () => null;
  const read = () =>
    readPrivateDocumentBlob(
      reference,
      new AbortController().signal,
      env,
      async () => response(),
    );
  await assert.rejects(read, /unavailable/);
  response = () => blob(content, "text/html");
  await assert.rejects(read, /unavailable/);
  response = () => blob("x".repeat(reference.sizeBytes));
  await assert.rejects(read, /unavailable/);
  response = () => blob(content.repeat(2));
  await assert.rejects(read, /unavailable/);
  response = () => blob(content, "text/plain", 10485761);
  await assert.rejects(read, /unavailable/);
  response = () => blob("");
  await assert.rejects(read, /unavailable/);
});

test("a correctly hashed file still cannot bypass its declared content type", async () => {
  const html = "<html><script>unsafe()</script></html>";
  const hash = createHash("sha256").update(html).digest("hex");
  const input = {
    ...reference,
    contentHash: hash,
    objectKey: `operations/${organisationId}/${id}/${hash}`,
    mimeType: "application/pdf",
    sizeBytes: Buffer.byteLength(html),
  };
  await assert.rejects(
    readPrivateDocumentBlob(
      input,
      new AbortController().signal,
      env,
      async () => blob(html, "application/pdf", input.sizeBytes),
    ),
    /unavailable/,
  );
});
