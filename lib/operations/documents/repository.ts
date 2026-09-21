import { z } from "zod";
import type { VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb } from "../db/client";
import { withProjectAccess } from "../projects/repository";
import type {
  ClientDocument,
  ClientDocumentDetail,
  PrivateDocumentDownload,
} from "./types";

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
      const rows = await tx<{ document: ClientDocument }[]>`
        select case when d.kind = 'link' then
          jsonb_build_object(
            'id', d.id,
            'projectId', d.project_id,
            'title', d.title,
            'kind', d.kind,
            'url', d.url
          )
        else
          jsonb_build_object(
            'id', d.id,
            'projectId', d.project_id,
            'title', d.title,
            'kind', d.kind,
            'filename', d.filename,
            'mimeType', d.mime_type,
            'sizeBytes', d.size_bytes
          )
        end as document
        from operations.documents d
        join operations.projects p
          on p.organisation_id = d.organisation_id and p.id = d.project_id
        where d.organisation_id = ${context.organisationId}
          and d.project_id = ${projectId}
          and p.visibility = 'client'
          and d.visibility = 'client'
          and d.scan_status = 'cleared'
          and d.revoked_at is null
          and (d.expires_at is null or d.expires_at > clock_timestamp())
        order by d.created_at desc, d.id
        limit 100
      `;
      return rows.map(({ document }) => document);
    },
  );
}

export async function getPortalDocumentDetail(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  documentId: string,
  correlationId: string,
): Promise<ClientDocumentDetail | null> {
  z.uuid().parse(documentId);
  return withProjectAccess(
    db,
    identity,
    organisationId,
    correlationId,
    "documents.read",
    async (tx, context) => {
      const [row] = await tx<{ document: ClientDocumentDetail }[]>`
        select case when d.kind = 'link' then
          jsonb_build_object(
            'id', d.id,
            'projectId', d.project_id,
            'projectTitle', p.title,
            'title', d.title,
            'kind', d.kind,
            'url', d.url,
            'version', d.version,
            'createdAt', d.created_at::text,
            'expiresAt', d.expires_at::text
          )
        else
          jsonb_build_object(
            'id', d.id,
            'projectId', d.project_id,
            'projectTitle', p.title,
            'title', d.title,
            'kind', d.kind,
            'filename', d.filename,
            'mimeType', d.mime_type,
            'sizeBytes', d.size_bytes,
            'version', d.version,
            'createdAt', d.created_at::text,
            'expiresAt', d.expires_at::text
          )
        end as document
        from operations.documents d
        join operations.projects p
          on p.organisation_id = d.organisation_id and p.id = d.project_id
        where d.organisation_id = ${context.organisationId}
          and d.id = ${documentId}
          and p.visibility = 'client'
          and d.visibility = 'client'
          and d.scan_status = 'cleared'
          and d.revoked_at is null
          and (d.expires_at is null or d.expires_at > clock_timestamp())
      `;
      return row?.document ?? null;
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
      const [row] = await tx<PrivateDocumentDownload[]>`
        select
          d.id,
          d.project_id as "projectId",
          d.title,
          d.object_key as "objectKey",
          d.filename,
          d.mime_type as "mimeType",
          d.size_bytes as "sizeBytes",
          d.content_hash as "contentHash",
          d.expires_at::text as "expiresAt"
        from operations.documents d
        join operations.projects p
          on p.organisation_id = d.organisation_id and p.id = d.project_id
        where d.organisation_id = ${context.organisationId}
          and d.id = ${documentId}
          and d.kind = 'file'
          and p.visibility = 'client'
          and d.visibility = 'client'
          and d.scan_status = 'cleared'
          and d.revoked_at is null
          and (d.expires_at is null or d.expires_at > clock_timestamp())
      `;
      return row ?? null;
    },
  );
}
