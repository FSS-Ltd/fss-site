import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { FssAdminContext } from "../auth/staff-types";
import type { OrganisationPage } from "./types";
import {
  parseWorkspacePage,
  workspacePageOffset,
  workspacePageSize,
} from "../workspaces/pagination";

const clientRegisterQuerySchema = z.string().trim().max(100);

function parseClientRegisterQuery(value: unknown): string {
  if (Array.isArray(value)) throw new Error("Only one client search is allowed.");
  return clientRegisterQuerySchema.parse(value ?? "");
}

export async function listStaffOrganisations(
  db: OperationsDb,
  context: FssAdminContext,
  input: { page?: unknown; query?: unknown } = {},
): Promise<OrganisationPage> {
  const page = parseWorkspacePage(input.page);
  const query = parseClientRegisterQuery(input.query);
  const offset = workspacePageOffset(page);
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.user_id', ${context.userId}, true)`;
    const rows = await tx<OrganisationPage["rows"]>`
      select id, legal_name as "legalName", display_name as "displayName",
        trading_status as "tradingStatus", timezone, lifecycle, engagement_count as "engagementCount"
      from operations.staff_client_register() as client_register
      where (
        ${query}::text = ''
        or lower(client_register.display_name) like '%' || lower(${query}) || '%'
        or lower(client_register.legal_name) like '%' || lower(${query}) || '%'
      )
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
