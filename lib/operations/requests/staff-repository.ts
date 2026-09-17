import type { OperationsDb } from "../db/client";
import type { FssAdminContext } from "../auth/staff-types";
import type { RequestStatus } from "./types";

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
