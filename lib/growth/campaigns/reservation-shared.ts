import { z } from "zod";
import { appendAuditEvent } from "../audit/service";
import type { GrowthTransaction } from "../db/types";

export const reservationLeaseSchema = z.strictObject({
  reservationId: z.uuid(),
  leaseToken: z.uuid(),
  fence: z.number().int().positive().max(2147483647),
});
export const providerIdSchema = z
  .string()
  .min(1)
  .max(256)
  .refine(
    (value) => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value),
  );

export type ReservationOutcome<T> =
  | { status: "ready"; value: T }
  | { status: "held"; reason: string };

export const held = (reason: string): ReservationOutcome<never> => ({
  status: "held",
  reason,
});

export async function auditReservation(
  tx: GrowthTransaction,
  reservationId: string,
  action: string,
): Promise<void> {
  await appendAuditEvent(tx, {
    correlationId: reservationId,
    actorType: "system",
    actorId: "outreach-dispatch",
    action: `outreach_reservation.${action}`,
    entityType: "outreach_reservation",
    entityId: reservationId,
  });
}
