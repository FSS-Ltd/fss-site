import { randomUUID } from "node:crypto";
import { operationsEnabled } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { createDocumentDownloadHandler } from "@/lib/operations/documents/access";
import { getAuthorisedDocumentDownload } from "@/lib/operations/documents/repository";
import { readPrivateDocumentBlob } from "@/lib/operations/documents/storage";

export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ organisationId: string; documentId: string }> },
): Promise<Response> {
  const correlationId = randomUUID();
  return createDocumentDownloadHandler({
    enabled: operationsEnabled(),
    getIdentity: getPortalIdentity,
    lookup: (identity, organisationId, documentId) =>
      getAuthorisedDocumentDownload(
        getPortalDb(),
        identity,
        organisationId,
        documentId,
        correlationId,
      ),
    read: (document, organisationId, signal) =>
      readPrivateDocumentBlob({ ...document, organisationId }, signal),
    reportError: (errorName) =>
      console.error("Portal document download failed.", {
        correlationId,
        errorName,
      }),
  })(request, await context.params);
}
