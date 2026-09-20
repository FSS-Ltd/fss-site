import type { OperationsDb } from "../db/client";
import type { FssAdminContext } from "../auth/staff-types";
import type { OrganisationPage } from "./types";
import {
  parseWorkspacePage,
  workspacePageOffset,
  workspacePageSize,
} from "../workspaces/pagination";

export async function listStaffOrganisations(
  db: OperationsDb,
  context: FssAdminContext,
  input: { page?: number } = {},
): Promise<OrganisationPage> {
  const page = parseWorkspacePage(input.page ?? 1);
  const offset = workspacePageOffset(page);
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.user_id', ${context.userId}, true)`;
    const rows = await tx<OrganisationPage["rows"]>`
      select id, legal_name as "legalName", display_name as "displayName",
        trading_status as "tradingStatus", timezone, lifecycle, engagement_count as "engagementCount"
      from operations.staff_client_register()
      order by "displayName", id
      limit ${workspacePageSize + 1} offset ${offset}
    `;
    return {
      value: {
        rows: rows.slice(0, workspacePageSize),
        nextCursor: null,
        page,
        hasNext: rows.length > workspacePageSize,
      },
    };
  });
  return result.value;
}
