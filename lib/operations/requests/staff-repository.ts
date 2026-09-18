import type { OperationsDb } from "../db/client";
import type { FssAdminContext } from "../auth/staff-types";
import type { RequestPriority, RequestScope, RequestStatus } from "./types";
import { withFssAdminTransaction } from "../auth/staff-transaction";

export type StaffDeliveryRequest = {
  id: string;
  organisationId: string;
  organisationName: string;
  title: string;
  status: RequestStatus;
  ownerDisplay: string;
  nextAction: string;
  targetDate: string | null;
  createdAt: string;
};

export type StaffDeliveryBoardRequest = StaffDeliveryRequest & {
  version: number;
  priority: RequestPriority;
  scope: RequestScope;
  blocked: boolean;
};

export async function listStaffDeliveryQueue(
  db: OperationsDb,
  context: FssAdminContext,
): Promise<StaffDeliveryRequest[]> {
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.user_id', ${context.userId}, true)`;
    return tx<StaffDeliveryRequest[]>`
      select id, organisation_id as "organisationId", organisation_name as "organisationName",
        title, status, owner_display as "ownerDisplay", next_action as "nextAction",
        nullif(target_date, '') as "targetDate", created_at as "createdAt"
      from operations.staff_delivery_queue()
    `;
  });
  return result;
}

// Interactive board source: cross-client rows with the version needed for
// server-validated transitions. Rechecked staff transaction, founder RLS.
export async function listStaffDeliveryBoard(
  db: OperationsDb,
  context: FssAdminContext,
  filters: { organisationId?: string; status?: string } = {},
): Promise<StaffDeliveryBoardRequest[]> {
  const organisationId =
    filters.organisationId && filters.organisationId !== "all"
      ? filters.organisationId
      : null;
  const status =
    filters.status && filters.status !== "all" ? filters.status : null;
  return withFssAdminTransaction(db, context, (tx) =>
    tx<StaffDeliveryBoardRequest[]>`
      select r.id, r.organisation_id as "organisationId", o.display_name as "organisationName",
        r.title, r.status, r.owner_display as "ownerDisplay", r.next_action as "nextAction",
        r.target_date::text as "targetDate", r.created_at::text as "createdAt",
        r.version, r.priority, r.scope, r.blocked_since is not null as blocked
      from operations.requests r
      join operations.organisations o on o.id = r.organisation_id and o.lifecycle = 'active'
      where (${organisationId}::uuid is null or r.organisation_id = ${organisationId}::uuid)
        and (${status}::text is null or r.status = ${status}::text)
      order by case when r.status in ('done', 'cancelled') then 1 else 0 end,
        case r.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
        r.created_at desc, r.id desc
      limit 200
    `,
  );
}

export async function listStaffDeliveryClients(
  db: OperationsDb,
  context: FssAdminContext,
): Promise<Array<{ id: string; displayName: string }>> {
  return withFssAdminTransaction(db, context, (tx) =>
    tx<Array<{ id: string; displayName: string }>>`
      select id, display_name as "displayName"
      from operations.organisations
      where lifecycle = 'active'
      order by display_name, id
      limit 200
    `,
  );
}
