import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { FssAdminContext } from "../auth/staff-types";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import { AgreementConflict } from "./types";

export const agreementLifecycleCommandSchema = z.strictObject({
  action: z.enum(["delete", "withdraw", "archive", "restore"]),
  expectedVersion: z.number().int().positive(),
});
export type AgreementLifecycleCommand = z.infer<
  typeof agreementLifecycleCommandSchema
>;

export async function changeStaffAgreementLifecycle(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  agreementId: string,
  command: AgreementLifecycleCommand,
  correlationId: string,
): Promise<void> {
  z.uuid().parse(organisationId);
  z.uuid().parse(agreementId);
  z.uuid().parse(correlationId);
  try {
    await withFssAdminTransaction(db, admin, async (tx) => {
      await tx`
        select operations.change_agreement_lifecycle(
          ${organisationId},${agreementId},${command.expectedVersion},
          ${command.action},${correlationId}
        )
      `;
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["P0001", "23503", "23514"].includes(String(error.code))
    ) {
      throw new AgreementConflict(
        "This agreement has changed or has dependent records. Refresh it before trying again.",
      );
    }
    throw error;
  }
}
