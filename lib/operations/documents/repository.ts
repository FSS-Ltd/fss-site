import { z } from "zod";
import type { VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb } from "../db/client";
import { withProjectAccess } from "../projects/repository";
import type { ClientDocument, PrivateDocumentDownload } from "./types";

export async function listProjectDocuments(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  projectId: string,
  correlationId: string,
): Promise<ClientDocument[]> {
  z.uuid().parse(projectId);
  return withProjectAccess(
    db,
    identity,
    organisationId,
    correlationId,
    "documents.read",
    async (tx, context) => {
      const rows = await tx<
        { document: ClientDocument }[]
      >`select case when kind='link' then jsonb_build_object('id',id,'projectId',project_id,'title',title,'kind',kind,'url',url) else jsonb_build_object('id',id,'projectId',project_id,'title',title,'kind',kind,'filename',filename,'mimeType',mime_type,'sizeBytes',size_bytes) end as document from operations.documents where organisation_id=${context.organisationId} and project_id=${projectId} order by created_at desc,id limit 100`;
      return rows.map(({ document }) => document);
    },
  );
}
export async function getAuthorisedDocumentDownload(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  documentId: string,
  correlationId: string,
): Promise<PrivateDocumentDownload | null> {
  z.uuid().parse(documentId);
  return withProjectAccess(
    db,
    identity,
    organisationId,
    correlationId,
    "documents.read",
    async (tx, context) => {
      const [row] = await tx<
        PrivateDocumentDownload[]
      >`select id,project_id as "projectId",title,object_key as "objectKey",filename,mime_type as "mimeType",size_bytes as "sizeBytes",content_hash as "contentHash",expires_at::text as "expiresAt" from operations.documents where organisation_id=${context.organisationId} and id=${documentId} and kind='file'`;
      return row ?? null;
    },
  );
}
