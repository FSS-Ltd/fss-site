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
import { CAMPAIGN_FOUNDER_EMAIL } from "./authorization";
import { hasRequiredGmailScopes } from "../integrations/google-oauth";
import { sameAccountScopes } from "./account-repository";

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
      grantEpoch: number | null;
      rfc: string | null;
      status: string;
    }[]
  >`select connection_id as "connectionId",grant_epoch as "grantEpoch",rfc_message_id as rfc,status from growth.outreach_reservations where id=${input.reservationId}`;
  if (
    !initial?.connectionId ||
    !initial.grantEpoch ||
    !initial.rfc ||
    !["submitting", "uncertain", "accepted"].includes(initial.status)
  )
    return held("reservation_not_reconcilable");
  const profile = await input.gmailClient.getProfile();
  if (profile.emailAddress.trim().toLowerCase() !== CAMPAIGN_FOUNDER_EMAIL)
    return held("account_identity_changed");
  const found = await input.gmailClient.findByRfcMessageId(initial.rfc);
  if (
    !found ||
    found.rfcMessageId !== initial.rfc ||
    !found.labelIds.includes("SENT")
  )
    return held("submission_uncertain");
  const actualSentAt = new Date(found.receivedAt);
  if (
    !Number.isFinite(actualSentAt.getTime()) ||
    !providerIdSchema.safeParse(found.messageId).success ||
    !providerIdSchema.safeParse(found.gmailThreadId).success
  )
    return held("provider_evidence_invalid");
  return withGrowthTransaction(db, async (tx) => {
    const [clock] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
    if (!clock || actualSentAt > clock.now)
      return held("provider_evidence_invalid");
    const [connection] = await tx<
      {
        version: number;
        status: string;
        subject: string | null;
        scopes: string[];
      }[]
    >`select version,status,google_subject as subject,granted_scopes as scopes from growth.integration_connections where id=${initial.connectionId} and provider='gmail' and subject_email=${CAMPAIGN_FOUNDER_EMAIL} for share`;
    if (
      !connection ||
      connection.version !== initial.grantEpoch ||
      connection.status !== "connected"
    )
      return held("grant_changed");
    const [control] = await tx<
      { subject: string; scopes: string[] }[]
    >`select verified_subject as subject,verified_scopes as scopes from growth.outreach_account_controls where connection_id=${initial.connectionId} for share`;
    if (
      !control ||
      !connection.subject ||
      connection.subject !== control.subject ||
      !hasRequiredGmailScopes(connection.scopes) ||
      !sameAccountScopes(connection.scopes, control.scopes)
    )
      return held("account_identity_changed");
    const [current] = await tx<
      {
        status: string;
        connectionId: string | null;
        grantEpoch: number | null;
        rfc: string | null;
        providerId: string | null;
        threadId: string | null;
        actualSentAt: Date | null;
        submittedAt: Date | null;
      }[]
    >`select status,connection_id as "connectionId",grant_epoch as "grantEpoch",rfc_message_id as rfc,provider_message_id as "providerId",provider_thread_id as "threadId",actual_sent_at as "actualSentAt",submitted_at as "submittedAt" from growth.outreach_reservations where id=${input.reservationId} for update`;
    if (
      !current ||
      current.connectionId !== initial.connectionId ||
      current.grantEpoch !== initial.grantEpoch ||
      current.rfc !== initial.rfc ||
      !current.submittedAt ||
      actualSentAt < current.submittedAt ||
      !["submitting", "uncertain", "accepted"].includes(current.status)
    )
      return held("reservation_changed");
    if (
      (current.providerId && current.providerId !== found.messageId) ||
      (current.threadId && current.threadId !== found.gmailThreadId) ||
      (current.actualSentAt &&
        current.actualSentAt.getTime() !== actualSentAt.getTime())
    )
      return held("provider_evidence_conflict");
    if (current.status === "accepted" && current.actualSentAt)
      return { status: "ready", value: { state: "accepted", actualSentAt } };
    await tx`update growth.outreach_reservations set status='accepted',provider_message_id=${found.messageId},provider_thread_id=${found.gmailThreadId},actual_sent_at=${actualSentAt},completed_at=coalesce(completed_at,clock_timestamp()) where id=${input.reservationId}`;
    await auditReservation(tx, input.reservationId, "reconciled");
    return { status: "ready", value: { state: "accepted", actualSentAt } };
  });
}
