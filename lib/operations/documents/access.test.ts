import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentDownloadHandler } from "./access";
import { PortalAccessDenied } from "../auth/types";
import type { PrivateDocumentDownload } from "./types";
const organisationId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";
const document: PrivateDocumentDownload = {
  id: documentId,
  projectId: documentId,
  title: "Deliverable",
  filename: "Client's delivery.txt",
  objectKey: "private",
  contentHash: "a".repeat(64),
  mimeType: "text/plain",
  sizeBytes: 2,
  expiresAt: null,
};
const identity = {
  userId: documentId,
  email: "client@example.test",
  emailVerified: true as const,
};
const request = new Request(
  "https://portal.example.test/api/portal/documents/download",
);
const input = { organisationId, documentId };

test("download checks membership before storage and again before returning private bytes", async () => {
  const sequence: string[] = [];
  const handler = createDocumentDownloadHandler({
    enabled: true,
    getIdentity: async () => identity,
    lookup: async () => {
      sequence.push("lookup");
      return document;
    },
    read: async () => {
      sequence.push("read");
      return new TextEncoder().encode("ok").buffer;
    },
    reportError: () => assert.fail("unexpected error"),
  });
  const response = await handler(request, input);
  assert.equal(await response.text(), "ok");
  assert.deepEqual(sequence, ["lookup", "read", "lookup"]);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    response.headers.get("content-disposition") ?? "",
    /Client%27s%20delivery.txt/,
  );
});

test("revoked, missing, malformed and failed downloads never disclose storage details", async () => {
  let lookups = 0;
  let reads = 0;
  let mode: "revoked" | "missing" | "failure" = "missing";
  const errors: string[] = [];
  const handler = createDocumentDownloadHandler({
    enabled: true,
    getIdentity: async () => identity,
    lookup: async () => {
      lookups++;
      if (mode === "missing") return null;
      if (mode === "revoked" && lookups > 1) throw new PortalAccessDenied();
      return document;
    },
    read: async () => {
      reads++;
      if (mode === "failure") throw new Error("secret-provider-url");
      return new ArrayBuffer(2);
    },
    reportError: (name) => errors.push(name),
  });
  assert.equal(
    (await handler(request, { ...input, documentId: "bad" })).status,
    404,
  );
  assert.equal((await handler(request, input)).status, 404);
  assert.equal(reads, 0);
  mode = "revoked";
  lookups = 0;
  assert.equal((await handler(request, input)).status, 404);
  mode = "failure";
  const failed = await handler(request, input);
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /secret-provider/);
  assert.deepEqual(errors, ["Error"]);
});
