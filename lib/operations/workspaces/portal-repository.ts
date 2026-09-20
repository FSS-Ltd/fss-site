import { z } from "zod";
import { hasPortalCapability } from "../auth/permissions";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";
import { withProjectAccess } from "../projects/repository";
import {
  toWorkspaceCollectionPage,
  workspacePageOffset,
  workspacePageSize,
  type WorkspaceCollectionPage,
} from "./pagination";
import type {
  PortalNotification,
  PortalNotificationFilter,
  PortalNotificationPreferences,
  PortalTeamMember,
  PortalWorkspaceDocument,
} from "./types";

type DocumentRow = { document: PortalWorkspaceDocument };

export async function listPortalWorkspaceDocuments(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
  page: number,
): Promise<WorkspaceCollectionPage<PortalWorkspaceDocument>> {
  const offset = workspacePageOffset(page);
  return withProjectAccess(
    db,
    identity,
    organisationId,
    correlationId,
    "documents.read",
    async (tx, context) => {
      const rows = await tx<DocumentRow[]>`
        select case when d.kind = 'link' then
          jsonb_build_object(
            'id', d.id,
            'projectId', d.project_id,
            'projectTitle', p.title,
            'title', d.title,
            'kind', d.kind,
            'url', d.url
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
            'sizeBytes', d.size_bytes
          ) end as document
        from operations.documents d
        join operations.projects p
          on p.organisation_id = d.organisation_id and p.id = d.project_id
        where d.organisation_id = ${context.organisationId}
        order by d.created_at desc, d.id desc
        limit ${workspacePageSize + 1} offset ${offset}
      `;
      return toWorkspaceCollectionPage(
        rows.map((row) => row.document),
        page,
      );
    },
  );
}

export async function listPortalTeamMembers(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<PortalTeamMember[]> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "team.read"))
        throw new PortalAccessDenied();
      return [
        ...(await tx<PortalTeamMember[]>`
          select name, role, joined_at::text as "joinedAt"
          from operations.portal_team_members(${context.organisationId})
        `),
      ];
    },
  );
}

export async function listPortalNotifications(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
  filter: PortalNotificationFilter,
  page: number,
): Promise<WorkspaceCollectionPage<PortalNotification>> {
  const offset = workspacePageOffset(page);
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "notifications.read"))
        throw new PortalAccessDenied();
      const rows = await tx<PortalNotification[]>`
        select id, kind, title, body, request_id as "requestId",
          request_version as "requestVersion", created_at::text as "createdAt",
          read_at::text as "readAt"
        from operations.request_notifications
        where organisation_id = ${context.organisationId}
          and (${filter}::text = 'all' or read_at is null)
        order by created_at desc, id desc
        limit ${workspacePageSize + 1} offset ${offset}
      `;
      return toWorkspaceCollectionPage(rows, page);
    },
  );
}

export async function readPortalNotificationPreferences(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<PortalNotificationPreferences> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "settings.manage"))
        throw new PortalAccessDenied();
      const [preferences] = await tx<PortalNotificationPreferences[]>`
        select request_email_enabled as "requestEmailEnabled"
        from operations.portal_notification_preferences(${context.organisationId})
      `;
      if (!preferences) throw new PortalAccessDenied();
      return preferences;
    },
  );
}

export async function updatePortalNotificationPreferences(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
  input: unknown,
): Promise<PortalNotificationPreferences> {
  const command = z
    .strictObject({ requestEmailEnabled: z.boolean() })
    .parse(input);
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "settings.manage"))
        throw new PortalAccessDenied();
      const [preferences] = await tx<PortalNotificationPreferences[]>`
        select request_email_enabled as "requestEmailEnabled"
        from operations.set_portal_notification_preferences(
          ${context.organisationId},
          ${command.requestEmailEnabled}
        )
      `;
      if (!preferences) throw new PortalAccessDenied();
      return preferences;
    },
  );
}
