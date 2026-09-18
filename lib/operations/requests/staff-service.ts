import { z } from "zod";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";
import {
  founderRequestCommandSchema,
  type FounderRequestCommand,
} from "./validation";
import { runRequestCommand } from "./founder-service";
import type { RequestCommandResult } from "./types";
import { translateRequestError } from "./errors";

// Staff Admins run the identical operational command set as the founder. The
// transaction rechecks the active staff grant and the audit actor is the
// stable staff hash, so existing RLS policies pass unchanged.
export async function executeStaffRequestCommand(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<RequestCommandResult> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = founderRequestCommandSchema.parse(raw);
  try {
    return await withFssAdminTransaction(db, admin, (tx) =>
      runRequestCommand(tx, organisationId, command, correlationId),
    );
  } catch (error) {
    translateRequestError(error);
  }
}

export type StaffRequestCommand = FounderRequestCommand;
