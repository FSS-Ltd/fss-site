import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { documentMetadataSchema } from "./validation";
import {
  documentUploadConfiguration,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_ATTACHMENTS,
} from "./uploads";
import { isDocumentObjectKey } from "./types";
const file = {
  kind: "file",
  projectId: randomUUID(),
  milestoneId: null,
  title: "Reviewed file",
  visibility: "client",
  expiresAt: null,
  filename: "delivery.pdf",
  mimeType: "application/pdf",
  sizeBytes: 50,
  contentHash: "a".repeat(64),
  scanStatus: "cleared",
  scanContentHash: "a".repeat(64),
  scanEvidence: "Independent scanner report matching SHA256",
};
test("document metadata accepts bounded reviewed files and safe links", () => {
  assert.equal(documentMetadataSchema.safeParse(file).success, true);
  assert.equal(
    documentMetadataSchema.safeParse({
      kind: "link",
      projectId: file.projectId,
      milestoneId: null,
      title: "Preview",
      visibility: "client",
      expiresAt: null,
      url: "https://example.test/review",
    }).success,
    true,
  );
  for (const change of [
    { sizeBytes: 0 },
    { sizeBytes: MAX_DOCUMENT_BYTES + 1 },
    { mimeType: "text/html" },
    { filename: "../secret.pdf" },
    { filename: "evil\r\n.pdf" },
    { scanEvidence: null },
    { scanContentHash: "b".repeat(64) },
    { contentHash: "invalid" },
  ])
    assert.equal(
      documentMetadataSchema.safeParse({ ...file, ...change }).success,
      false,
    );
  for (const url of [
    "not a url",
    "javascript:alert(1)",
    "http://example.test",
    "https://user:password@example.test",
  ])
    assert.equal(
      documentMetadataSchema.safeParse({
        kind: "link",
        projectId: file.projectId,
        milestoneId: null,
        title: "Preview",
        visibility: "client",
        expiresAt: null,
        url,
      }).success,
      false,
    );
});
test("uploads remain gated without an approved scanner and keys stay tenant-scoped", () => {
  assert.equal(documentUploadConfiguration().enabled, false);
  assert.equal(MAX_DOCUMENT_ATTACHMENTS, 5);
  const org = randomUUID();
  const document = randomUUID();
  const key = `operations/${org}/${document}/${file.contentHash}`;
  assert.equal(isDocumentObjectKey(key, org, document), true);
  assert.equal(isDocumentObjectKey(key, randomUUID(), document), false);
  assert.equal(isDocumentObjectKey(`${key}/..`, org, document), false);
});
