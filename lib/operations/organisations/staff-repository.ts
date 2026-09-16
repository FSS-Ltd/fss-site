import type { OperationsDb } from "../db/client";
import type { FssAdminContext } from "../auth/staff-types";
import type { OrganisationPage } from "./types";

export async function listStaffOrganisations(
  db: OperationsDb,
  context: FssAdminContext,
): Promise<OrganisationPage> {
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.user_id', ${context.userId}, true)`;
    const rows = await tx<OrganisationPage["rows"]>`
      select id, legal_name as "legalName", display_name as "displayName",
        trading_status as "tradingStatus", timezone, lifecycle, engagement_count as "engagementCount"
      from operations.staff_client_register()
    `;
    return { value: { rows, nextCursor: null } };
  });
  return result.value;
}
