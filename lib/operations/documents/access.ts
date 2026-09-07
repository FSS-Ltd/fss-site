import { z } from "zod";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import type { PrivateDocumentDownload } from "./types";

type DownloadDependencies = {
  enabled: boolean;
  getIdentity: () => Promise<VerifiedPortalIdentity | null>;
  lookup: (
    identity: VerifiedPortalIdentity,
    organisationId: string,
    documentId: string,
  ) => Promise<PrivateDocumentDownload | null>;
  read: (
    document: PrivateDocumentDownload,
    organisationId: string,
    signal: AbortSignal,
  ) => Promise<ArrayBuffer>;
  reportError: (errorName: string) => void;
};
const identifiers = z.strictObject({
  organisationId: z.uuid(),
  documentId: z.uuid(),
});
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export function createDocumentDownloadHandler(
  deps: DownloadDependencies,
): (request: Request, input: unknown) => Promise<Response> {
  return async (request, input) => {
    const unavailable = (status: number) =>
      Response.json(
        {
          message:
            "This document is unavailable. Return to your project and try again.",
        },
        { status, headers },
      );
    if (!deps.enabled) return unavailable(404);
    const parsed = identifiers.safeParse(input);
    if (!parsed.success) return unavailable(404);
    try {
      const identity = await deps.getIdentity();
      if (!identity) return unavailable(401);
      const { organisationId, documentId } = parsed.data;
      const document = await deps.lookup(identity, organisationId, documentId);
      if (!document) return unavailable(404);
      const body = await deps.read(document, organisationId, request.signal);
      // A slow storage fetch must not preserve revoked access or an expired approval.
      const current = await deps.lookup(identity, organisationId, documentId);
      if (
        !current ||
        current.objectKey !== document.objectKey ||
        current.contentHash !== document.contentHash ||
        current.filename !== document.filename ||
        current.mimeType !== document.mimeType ||
        current.sizeBytes !== document.sizeBytes
      )
        return unavailable(404);
      const filename = encodeURIComponent(current.filename).replace(
        /['()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
      );
      return new Response(body, {
        headers: {
          ...headers,
          "Content-Type": current.mimeType,
          "Content-Length": String(body.byteLength),
          "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${filename}`,
          "Content-Security-Policy": "sandbox",
        },
      });
    } catch (error) {
      if (error instanceof PortalAccessDenied) return unavailable(404);
      const name = error instanceof Error ? error.name : "UnknownError";
      deps.reportError(/^[A-Za-z]{1,80}$/.test(name) ? name : "UnknownError");
      return unavailable(503);
    }
  };
}
