import {
  auditReservation,
  held,
  providerIdSchema,
  reservationLeaseSchema,
  type ReservationOutcome as Outcome,
} from "./reservation-shared";
import { z } from "zod";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import {
  lockGmailRouting,
  lockGmailThread,
} from "../sequences/gmail-thread-association";

type Settlement =
  | { kind: "accepted"; providerMessageId: string; providerThreadId: string }
  | { kind: "rejected" }
  | { kind: "uncertain" };
export async function settleOutreachAttempt(
  db: GrowthDb,
  input: {
    reservationId: string;
    leaseToken: string;
    fence: number;
    outcome: Settlement;
  },
): Promise<Outcome<{ state: Settlement["kind"] }>> {
  const outcome = z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("accepted"),
      providerMessageId: providerIdSchema,
      providerThreadId: providerIdSchema,
    }),
    z.strictObject({ kind: z.literal("rejected") }),
    z.strictObject({ kind: z.literal("uncertain") }),
  ]);
  if (!reservationLeaseSchema.extend({ outcome }).safeParse(input).success)
    return held("invalid_input");
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    if (input.outcome.kind === "accepted")
      await lockGmailThread(tx, input.outcome.providerThreadId);
    const [reservation] = await tx<
      {
        status: string;
        fence: number;
        leaseToken: string | null;
        providerId: string | null;
        threadId: string | null;
      }[]
    >`select status,fence,lease_token as "leaseToken",provider_message_id as "providerId",provider_thread_id as "threadId" from growth.outreach_reservations where id=${input.reservationId} for update`;
    if (
      !reservation ||
      reservation.fence !== input.fence ||
      reservation.leaseToken !== input.leaseToken
    )
      return held("reservation_lease_invalid");
    if (reservation.status === input.outcome.kind) {
      if (
        input.outcome.kind === "accepted" &&
        (reservation.providerId !== input.outcome.providerMessageId ||
          reservation.threadId !== input.outcome.providerThreadId)
      )
        return held("settlement_conflict");
      return { status: "ready", value: { state: input.outcome.kind } };
    }
    if (reservation.status !== "submitting") return held("settlement_conflict");
    if (
      input.outcome.kind === "accepted" &&
      (!input.outcome.providerMessageId.trim() ||
        !input.outcome.providerThreadId.trim())
    )
      return held("invalid_provider_response");
    await tx`update growth.outreach_reservations set status=${input.outcome.kind},completed_at=clock_timestamp(),provider_message_id=${input.outcome.kind === "accepted" ? input.outcome.providerMessageId : null},provider_thread_id=${input.outcome.kind === "accepted" ? input.outcome.providerThreadId : null} where id=${input.reservationId}`;
    await auditReservation(tx, input.reservationId, input.outcome.kind);
    return { status: "ready", value: { state: input.outcome.kind } };
  });
}

export async function cancelOutreachReservation(
  db: GrowthDb,
  input: { reservationId: string; leaseToken: string; fence: number },
): Promise<Outcome<{ state: "cancelled" }>> {
  if (!reservationLeaseSchema.safeParse(input).success)
    return held("invalid_input");
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    const [row] = await tx<
      { status: string; fence: number; leaseToken: string | null }[]
    >`select status,fence,lease_token as "leaseToken" from growth.outreach_reservations where id=${input.reservationId} for update`;
    if (
      !row ||
      row.fence !== input.fence ||
      row.leaseToken !== input.leaseToken
    )
      return held("reservation_lease_invalid");
    if (row.status === "cancelled")
      return { status: "ready", value: { state: "cancelled" } };
    if (row.status !== "reserved") return held("submission_uncertain");
    await tx`update growth.outreach_reservations set status='cancelled',completed_at=clock_timestamp() where id=${input.reservationId}`;
    await auditReservation(tx, input.reservationId, "cancelled");
    return { status: "ready", value: { state: "cancelled" } };
  });
}

export async function reconcileOutreachAttempt(
  db: GrowthDb,
  input: {
    reservationId: string;
    gmailClient: Pick<
      import("../integrations/gmail/types").GmailClient,
      "getProfile" | "findByRfcMessageId"
    >;
  },
): Promise<Outcome<{ state: "accepted"; actualSentAt: Date }>> {
  if (!z.uuid().safeParse(input.reservationId).success)
    return held("invalid_input");
  const [initial] = await db<
    {
      connectionId: string | null;
      campaignId: string | null;
      grantEpoch: number | null;
      rfc: string | null;
      status: string;
    }[]
  >`select connection_id as "connectionId",campaign_id as "campaignId",grant_epoch as "grantEpoch",rfc_message_id as rfc,status from growth.outreach_reservations where id=${input.reservationId}`;
  if (
    !initial?.connectionId ||
    !initial.grantEpoch ||
    !initial.rfc ||
    !["submitting", "uncertain", "accepted"].includes(initial.status)
  )
    return held("reservation_not_reconcilable");
  if (initial.campaignId) return held("campaign_receipt_pending");
  return held("actual_send_time_unproven");
}
