export const documentMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
] as const;
export type DocumentMimeType = (typeof documentMimeTypes)[number];
type DocumentSummary = { id: string; projectId: string; title: string };
export type ClientDocument = DocumentSummary &
  (
    | { kind: "link"; url: string }
    | {
        kind: "file";
        filename: string;
        mimeType: DocumentMimeType;
        sizeBytes: number;
      }
  );

/**
 * The only document metadata that may cross the portal read boundary for a
 * document-detail page. Storage, integrity and review fields remain server-only.
 */
export type ClientDocumentDetail = ClientDocument &
  Readonly<{
    createdAt: string;
    expiresAt: string | null;
    projectTitle: string;
    version: number;
  }>;

// Server-only download resolution. Never serialize this object into a client page.
export type PrivateDocumentDownload = DocumentSummary & {
  objectKey: string;
  contentHash: string;
  filename: string;
  mimeType: DocumentMimeType;
  sizeBytes: number;
  expiresAt: string | null;
};
export function isDocumentObjectKey(
  key: string,
  organisationId: string,
  documentId: string,
): boolean {
  return (
    key.startsWith(`operations/${organisationId}/${documentId}/`) &&
    /^operations\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-f0-9]{64}$/.test(key)
  );
}
