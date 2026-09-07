import { createHash } from "node:crypto";
import { get } from "@vercel/blob";
import { z } from "zod";
import { matchesDocumentContentType } from "./content-type";

type PrivateBlobReference = {
  organisationId: string;
  id: string;
  objectKey: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
};
const maximumBytes = 10 * 1024 * 1024;
const referenceSchema = z.object({
  organisationId: z.uuid(),
  id: z.uuid(),
  objectKey: z.string(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  mimeType: z.enum([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/plain",
  ]),
  sizeBytes: z.number().int().min(1).max(maximumBytes),
});

export async function readPrivateDocumentBlob(
  input: PrivateBlobReference,
  signal: AbortSignal,
  env: Readonly<Record<string, string | undefined>> = process.env,
  fetchBlob: typeof get = get,
): Promise<ArrayBuffer> {
  const reference = referenceSchema.safeParse(input);
  const token = env.OPERATIONS_BLOB_READ_WRITE_TOKEN;
  if (!reference.success || !token?.startsWith("vercel_blob_rw_"))
    throw new Error("The document is unavailable.");
  const file = reference.data;
  if (
    file.objectKey !==
    `operations/${file.organisationId}/${file.id}/${file.contentHash}`
  )
    throw new Error("The document is unavailable.");
  const blob = await fetchBlob(file.objectKey, {
    access: "private",
    useCache: false,
    token,
    abortSignal: signal,
  });
  if (!blob || blob.statusCode !== 200)
    throw new Error("The document is unavailable.");
  if (
    blob.blob.size !== file.sizeBytes ||
    blob.blob.contentType.split(";")[0].trim().toLowerCase() !== file.mimeType
  ) {
    await blob.stream.cancel();
    throw new Error("The document is unavailable.");
  }
  const reader = blob.stream.getReader();
  const bytes = new Uint8Array(file.sizeBytes);
  let offset = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (signal.aborted || offset + chunk.value.byteLength > bytes.byteLength)
        throw new Error("The document is unavailable.");
      bytes.set(chunk.value, offset);
      offset += chunk.value.byteLength;
    }
    if (
      offset !== file.sizeBytes ||
      createHash("sha256").update(bytes).digest("hex") !== file.contentHash
    )
      throw new Error("The document is unavailable.");
    if (!matchesDocumentContentType(bytes, file.mimeType))
      throw new Error("The document is unavailable.");
    return bytes.buffer;
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
