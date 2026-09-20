import { z } from "zod";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";
import {
  parseWorkspacePage,
  toWorkspaceCollectionPage,
  workspacePageOffset,
  workspacePageSize,
  type WorkspaceCollectionPage,
} from "../workspaces/pagination";
import {
  loadRequestDetail,
  loadRequests,
  type FounderRequestDetail,
} from "./repository";
import type { ClientRequest, RequestComment, RequestPriority } from "./types";

export type StaffClientContext = {
  id: string;
  displayName: string;
  legalName: string;
  timezone: string;
  lifecycle: "active" | "archived";
  engagementCount: number;
  projectCount: number;
  openRequestCount: number;
  requestCount: number;
};

export async function getStaffClientContext(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
): Promise<StaffClientContext | null> {
  const id = z.uuid().parse(organisationId);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const [organisation] = await tx<StaffClientContext[]>`
      select id, display_name as "displayName", legal_name as "legalName",
        timezone, lifecycle,
        (select count(*)::integer from operations.engagement_links e
          where e.organisation_id = o.id) as "engagementCount",
        (select count(*)::integer from operations.projects p
          where p.organisation_id = o.id) as "projectCount",
        (select count(*)::integer from operations.requests r
          where r.organisation_id = o.id
            and r.status not in ('done', 'cancelled')) as "openRequestCount",
        (select count(*)::integer from operations.requests r
          where r.organisation_id = o.id) as "requestCount"
      from operations.organisations o
      where o.id = ${id}
    `;
    return organisation ?? null;
  });
}

export async function listStaffClientRequests(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  input: { page?: number } = {},
): Promise<WorkspaceCollectionPage<ClientRequest>> {
  const id = z.uuid().parse(organisationId);
  const page = parseWorkspacePage(input.page ?? 1);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const requests = await loadRequests(tx, id, null, true, {
      limit: workspacePageSize + 1,
      offset: workspacePageOffset(page),
      status: null,
      query: null,
    });
    return toWorkspaceCollectionPage(requests, page);
  });
}

export async function getStaffClientRequest(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  requestId: string,
): Promise<FounderRequestDetail | null> {
  const clientId = z.uuid().parse(organisationId);
  const id = z.uuid().parse(requestId);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const request = await loadRequestDetail(tx, clientId, id, true);
    if (!request) return null;
    const [priority] = await tx<{ priority: RequestPriority }[]>`
      select priority from operations.requests
      where organisation_id = ${clientId} and id = ${id}
    `;
    const internalComments = await tx<RequestComment[]>`
      select id, body, author_label as "authorLabel", created_at::text as "createdAt"
      from operations.request_comments
      where organisation_id = ${clientId} and request_id = ${id}
        and visibility = 'internal'
      order by created_at desc, id desc
      limit 200
    `;
    if (!priority) return null;
    return {
      ...request,
      priority: priority.priority,
      internalComments: [...internalComments].reverse(),
    };
  });
}
