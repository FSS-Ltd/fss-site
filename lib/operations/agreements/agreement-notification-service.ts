import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { FssAdminContext } from "../auth/staff-types";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import { AgreementConflict } from "./types";

export async function resendStaffAgreementNotification(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  sourceId: string,
  notificationId: string,
  expectedVersion: number,
  requestId: string,
  correlationId: string,
): Promise<void> {
  z.uuid().parse(organisationId);
  z.uuid().parse(sourceId);
  z.uuid().parse(notificationId);
  z.uuid().parse(requestId);
  z.uuid().parse(correlationId);
  try {
    await withFssAdminTransaction(
      db,
      admin,
      (tx) => tx`
      select operations.resend_agreement_notification(
        ${organisationId},${sourceId},${notificationId},${expectedVersion},${requestId},${correlationId}
      )
    `,
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      String(error.code) === "P0001"
    )
      throw new AgreementConflict(
        "Delivery changed or the signer has already signed. Refresh the agreement before trying again.",
      );
    throw error;
  }
}
