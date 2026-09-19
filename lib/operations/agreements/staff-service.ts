import { z } from "zod";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";
import { agreementCommandSchema, runAgreementCommand } from "./service";
import type { AgreementRecord } from "./types";

export async function executeStaffAgreementCommand(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<AgreementRecord> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = agreementCommandSchema.parse(raw);
  return withFssAdminTransaction(db, admin, (tx) =>
    runAgreementCommand(
      tx,
      organisationId,
      command,
      admin.actorId,
      correlationId,
    ),
  );
}
