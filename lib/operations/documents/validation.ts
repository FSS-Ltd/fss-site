import { z } from "zod";
import { documentMimeTypes } from "./types";
import { MAX_DOCUMENT_BYTES } from "./uploads";
const shared = {
  projectId: z.uuid(),
  milestoneId: z.uuid().nullable(),
  title: z.string().trim().min(1).max(160),
  visibility: z.enum(["internal", "client"]),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
};
const httpsUrl = z
  .url()
  .max(2000)
  .refine((value) => {
    const url = URL.parse(value);
    return (
      url !== null &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password
    );
  }, "An HTTPS link without credentials is required.");
export const documentMetadataSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...shared, kind: z.literal("link"), url: httpsUrl }),
  z
    .strictObject({
      ...shared,
      kind: z.literal("file"),
      filename: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .refine(
          (value) => !/[\x00-\x1f\x7f/\\]/.test(value),
          "Use a filename without paths or control characters.",
        ),
      mimeType: z.enum(documentMimeTypes),
      sizeBytes: z.number().int().min(1).max(MAX_DOCUMENT_BYTES),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      scanStatus: z.enum(["quarantined", "cleared", "rejected"]),
      scanContentHash: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable(),
      scanEvidence: z.string().trim().min(1).max(2000).nullable(),
    })
    .refine(
      (file) =>
        file.scanStatus !== "cleared" ||
        (file.scanEvidence !== null &&
          file.scanContentHash === file.contentHash),
      "Cleared files require recorded scan evidence for this content hash.",
    ),
]);
const review = { reviewReference: z.string().trim().min(1).max(200) };
export const documentCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("create"),
    documentId: z.uuid(),
    metadata: documentMetadataSchema,
    ...review,
  }),
  z.strictObject({
    action: z.literal("update"),
    documentId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    metadata: documentMetadataSchema,
    ...review,
  }),
  z.strictObject({
    action: z.literal("revoke"),
    documentId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    ...review,
  }),
]);
