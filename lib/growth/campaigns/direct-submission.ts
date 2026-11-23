import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";
import type {
  GmailGuardedSendOutcome,
  GuardedGmailClient,
} from "../integrations/gmail/types";
import {
  lockGmailRouting,
  lockGmailThread,
} from "../sequences/gmail-thread-association";
import {
  beginOutreachSubmission,
  type IssuedSnapshot,
} from "./reservation-repository";
import { auditReservation, providerIdSchema } from "./reservation-shared";
import { withinSubmissionClock } from "./submission-clock";

export type DirectSubmissionResult =
  | { status: "accepted" }
  | {
      status: "not_invoked";
      reason:
        | "invalid_input"
        | "guard_rejected"
        | "credential_preparation_failed";
    }
  | {
      status: "uncertain";
      reason: "binding_changed" | "transport_unknown" | "persistence_failed";
    }
  | { status: "held"; reason: string };

type Input = {
  reservationId: string;
  leaseToken: string;
  fence: number;
  fingerprint: string;
  bound: {
    binding: GmailGrantBinding;
    client: Pick<GuardedGmailClient, "sendMessageOnce">;
  };
};

type ActualOutcome = GmailGuardedSendOutcome | { status: "threw" };

async function haltOnIncident(
  tx: GrowthTransaction,
  input: Input,
  outcome: ActualOutcome,
): Promise<void> {
  const reason =
    outcome.status === "invoked_unknown" &&
    [401, 403, 429].includes(outcome.providerStatus ?? 0)
      ? `provider_${outcome.providerStatus}`
      : outcome.status === "not_invoked" &&
          outcome.reason === "credential_preparation_failed" &&
          outcome.errorCode === "AUTHENTICATION_FAILED"
        ? "credential_authentication_failed"
        : null;
  if (!reason) return;
  const [connection] = await tx<
    { id: string }[]
  >`select id from growth.integration_connections where id=${input.bound.binding.connectionId} for update`;
  if (!connection) throw new Error("incident_account_missing");
  const [control] = await tx<
    { state: string }[]
  >`select state from growth.outreach_account_controls where connection_id=${connection.id} for update`;
  if (!control) throw new Error("incident_control_missing");
  await tx`update growth.outreach_account_controls set state='halted',version=version+1,updated_at=clock_timestamp() where connection_id=${connection.id}`;
  await appendAuditEvent(tx, {
    correlationId: input.reservationId,
    actorType: "system",
    actorId: "outreach-dispatch",
    action: "outreach_account.provider_halt",
    entityType: "outreach_account",
    entityId: connection.id,
    metadata: { reasonCode: reason },
  });
}

async function persistOutcome(
  db: GrowthDb,
  input: Input,
  snapshot: IssuedSnapshot,
  outcome: ActualOutcome,
): Promise<DirectSubmissionResult> {
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    await haltOnIncident(tx, input, outcome);
    if (outcome.status === "accepted")
      await lockGmailThread(tx, outcome.result.gmailThreadId);
    const [row] = await tx<
      {
        accountId: string;
        status: string;
        fence: number;
        leaseToken: string | null;
        snapshotMatches: boolean;
        hash: string | null;
      }[]
    >`select account_id as "accountId",status,fence,lease_token as "leaseToken",issued_snapshot=${tx.json(snapshot)} as "snapshotMatches",issued_snapshot_hash as hash from growth.outreach_reservations where id=${input.reservationId} for update`;
    if (
      !row ||
      row.status !== "submitting" ||
      row.fence !== input.fence ||
      row.leaseToken !== input.leaseToken ||
      row.hash !== snapshot.rawSha256 ||
      !row.snapshotMatches
    )
      throw new Error("submission_identity_changed");
    if (outcome.status === "accepted") {
      const proof = {
        version: 1,
        kind: "gmail_api_send_message_v1",
        reservationId: input.reservationId,
        accountId: row.accountId,
        connectionId: snapshot.connectionId,
        googleSubject: snapshot.googleSubject,
        grantEpoch: snapshot.grantEpoch,
        rfcMessageId: snapshot.rfcMessageId,
        rawSha256: snapshot.rawSha256,
        providerMessageId: outcome.result.messageId,
        providerThreadId: outcome.result.gmailThreadId,
      };
      await tx`update growth.outreach_reservations set status='accepted',completed_at=clock_timestamp(),provider_message_id=${outcome.result.messageId},provider_thread_id=${outcome.result.gmailThreadId},direct_submission_evidence=${tx.json(proof)} where id=${input.reservationId}`;
      await auditReservation(tx, input.reservationId, "accepted");
      return { status: "accepted" };
    }
    if (outcome.status === "not_invoked") {
      const evidence = {
        version: 1,
        kind: "gmail_send_not_invoked_v1",
        reservationId: input.reservationId,
        reason: outcome.reason,
      };
      await tx`update growth.outreach_reservations set status='rejected',completed_at=clock_timestamp(),direct_noninvocation_evidence=${tx.json(evidence)} where id=${input.reservationId}`;
      await auditReservation(tx, input.reservationId, "not_invoked");
      return { status: "not_invoked", reason: outcome.reason };
    }
    await tx`update growth.outreach_reservations set status='uncertain',completed_at=clock_timestamp() where id=${input.reservationId}`;
    await auditReservation(tx, input.reservationId, "uncertain");
    return { status: "uncertain", reason: "transport_unknown" };
  });
}

export async function submitReservedOutreach(
  db: GrowthDb,
  input: Input,
): Promise<DirectSubmissionResult> {
  const issued = await beginOutreachSubmission(db, {
    reservationId: input.reservationId,
    leaseToken: input.leaseToken,
    fence: input.fence,
    fingerprint: input.fingerprint,
  });
  if (issued.status !== "ready") return issued;
  const { issuedSnapshot: snapshot, submissionClock } = issued.value;
  const { binding, client } = input.bound;
  if (
    snapshot.connectionId !== binding.connectionId ||
    snapshot.googleSubject !== binding.googleSubject ||
    snapshot.grantEpoch !== binding.grantEpoch
  )
    return { status: "uncertain", reason: "binding_changed" };
  let raw: string;
  try {
    const [stored] = await db<
      { raw: string | null }[]
    >`select issued_snapshot->>'raw' as raw from growth.outreach_reservations where id=${input.reservationId} and status='submitting' and fence=${input.fence} and lease_token=${input.leaseToken} and issued_snapshot=${db.json(snapshot)} and issued_snapshot_hash=${snapshot.rawSha256}`;
    if (!stored?.raw || stored.raw !== snapshot.raw)
      return { status: "uncertain", reason: "persistence_failed" };
    raw = stored.raw;
  } catch {
    return { status: "uncertain", reason: "persistence_failed" };
  }
  let outcome: ActualOutcome;
  try {
    outcome = await client.sendMessageOnce(
      {
        raw,
        ...(snapshot.gmailThreadId
          ? { gmailThreadId: snapshot.gmailThreadId }
          : {}),
      },
      () => withinSubmissionClock(submissionClock, new Date()),
    );
  } catch {
    outcome = { status: "threw" };
  }
  if (
    outcome.status === "accepted" &&
    (!providerIdSchema.safeParse(outcome.result.messageId).success ||
      !providerIdSchema.safeParse(outcome.result.gmailThreadId).success)
  )
    outcome = { status: "threw" };
  try {
    return await persistOutcome(db, input, snapshot, outcome);
  } catch {
    return { status: "uncertain", reason: "persistence_failed" };
  }
}
