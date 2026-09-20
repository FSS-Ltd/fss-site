import { z } from "zod";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";
import {
  toWorkspaceCollectionPage,
  workspacePageOffset,
  workspacePageSize,
  type WorkspaceCollectionPage,
} from "./pagination";

const projectStatusSchema = z.enum([
  "planned",
  "active",
  "waiting_for_us",
  "waiting_for_you",
  "completed",
  "paused",
]);

const notificationDeliveryStatusSchema = z.enum([
  "pending",
  "succeeded",
  "held",
]);

export type StaffProject = {
  id: string;
  organisationId: string;
  organisationName: string;
  title: string;
  status: z.infer<typeof projectStatusSchema>;
  targetDate: string | null;
  milestoneCount: number;
  documentCount: number;
};

export type StaffDocument = {
  id: string;
  organisationId: string;
  organisationName: string;
  projectId: string;
  projectTitle: string;
  title: string;
  kind: "link" | "file";
  visibility: "internal" | "client";
  scanStatus: "quarantined" | "cleared" | "rejected";
  createdAt: string;
};

export type StaffBillingException = {
  id: string;
  organisationId: string | null;
  organisationName: string | null;
  category: string;
  mode: "test" | "live";
  createdAt: string;
  lastSeenAt: string;
};

export type StaffNotificationDelivery = {
  id: string;
  organisationId: string;
  organisationName: string;
  requestId: string;
  requestTitle: string;
  kind: "review_requested" | "accepted";
  status: z.infer<typeof notificationDeliveryStatusSchema>;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export async function listStaffProjects(
  db: OperationsDb,
  admin: FssAdminContext,
  input: { organisationId?: string; status?: string; page: number },
): Promise<WorkspaceCollectionPage<StaffProject>> {
  const organisationId = input.organisationId
    ? z.uuid().parse(input.organisationId)
    : null;
  const status = input.status ? projectStatusSchema.parse(input.status) : null;
  const offset = workspacePageOffset(input.page);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const rows = await tx<StaffProject[]>`
      select p.id, p.organisation_id as "organisationId",
        o.display_name as "organisationName", p.title, p.status,
        p.target_date::text as "targetDate",
        (select count(*)::integer from operations.milestones m
          where m.organisation_id = p.organisation_id and m.project_id = p.id
        ) as "milestoneCount",
        (select count(*)::integer from operations.documents d
          where d.organisation_id = p.organisation_id and d.project_id = p.id
        ) as "documentCount"
      from operations.projects p
      join operations.organisations o on o.id = p.organisation_id
      where (${organisationId}::uuid is null or p.organisation_id = ${organisationId}::uuid)
        and (${status}::text is null or p.status = ${status}::text)
      order by p.created_at desc, p.id desc
      limit ${workspacePageSize + 1} offset ${offset}
    `;
    return toWorkspaceCollectionPage(rows, input.page);
  });
}

export async function listStaffDocuments(
  db: OperationsDb,
  admin: FssAdminContext,
  input: { organisationId?: string; page: number },
): Promise<WorkspaceCollectionPage<StaffDocument>> {
  const organisationId = input.organisationId
    ? z.uuid().parse(input.organisationId)
    : null;
  const offset = workspacePageOffset(input.page);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const rows = await tx<StaffDocument[]>`
      select d.id, d.organisation_id as "organisationId",
        o.display_name as "organisationName", d.project_id as "projectId",
        p.title as "projectTitle", d.title, d.kind, d.visibility,
        d.scan_status as "scanStatus", d.created_at::text as "createdAt"
      from operations.documents d
      join operations.projects p
        on p.organisation_id = d.organisation_id and p.id = d.project_id
      join operations.organisations o on o.id = d.organisation_id
      where (${organisationId}::uuid is null or d.organisation_id = ${organisationId}::uuid)
      order by d.created_at desc, d.id desc
      limit ${workspacePageSize + 1} offset ${offset}
    `;
    return toWorkspaceCollectionPage(rows, input.page);
  });
}

export async function listStaffBillingExceptions(
  db: OperationsDb,
  admin: FssAdminContext,
  input: { organisationId?: string; page: number },
): Promise<WorkspaceCollectionPage<StaffBillingException>> {
  const organisationId = input.organisationId
    ? z.uuid().parse(input.organisationId)
    : null;
  const offset = workspacePageOffset(input.page);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const rows = await tx<StaffBillingException[]>`
      select e.id, e.organisation_id as "organisationId",
        o.display_name as "organisationName", e.category, e.environment as mode,
        e.created_at::text as "createdAt", e.last_seen_at::text as "lastSeenAt"
      from operations.billing_exceptions e
      left join operations.organisations o on o.id = e.organisation_id
      where e.resolved_at is null
        and (${organisationId}::uuid is null or e.organisation_id = ${organisationId}::uuid)
      order by e.last_seen_at desc, e.id desc
      limit ${workspacePageSize + 1} offset ${offset}
    `;
    return toWorkspaceCollectionPage(rows, input.page);
  });
}

export async function listStaffNotificationDeliveries(
  db: OperationsDb,
  admin: FssAdminContext,
  input: { status?: string; page: number },
): Promise<WorkspaceCollectionPage<StaffNotificationDelivery>> {
  const status = input.status
    ? notificationDeliveryStatusSchema.parse(input.status)
    : null;
  const offset = workspacePageOffset(input.page);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const rows = await tx<StaffNotificationDelivery[]>`
      select d.id, d.organisation_id as "organisationId",
        o.display_name as "organisationName", d.request_id as "requestId",
        r.title as "requestTitle", d.kind, d.status, d.attempts,
        d.created_at::text as "createdAt", d.updated_at::text as "updatedAt"
      from operations.request_email_deliveries d
      join operations.organisations o on o.id = d.organisation_id
      join operations.requests r
        on r.organisation_id = d.organisation_id and r.id = d.request_id
      where (${status}::text is null or d.status = ${status}::text)
      order by d.updated_at desc, d.id desc
      limit ${workspacePageSize + 1} offset ${offset}
    `;
    return toWorkspaceCollectionPage(rows, input.page);
  });
}
