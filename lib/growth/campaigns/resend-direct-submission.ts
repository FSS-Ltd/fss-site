import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { sameAccountScopes } from "../integrations/google-oauth";
import {
  createResendOutreachTransport,
  type ResendOutreachResult,
} from "../integrations/resend/outreach-transport";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import { readResendOutreachRuntime } from "./resend-account-runtime";
import { auditReservation } from "./reservation-shared";
import {
  beginResendOutreachSubmission,
  type ResendIssuedSnapshot,
} from "./resend-reservation-repository";
import { withinSubmissionClock } from "./submission-clock";

type Input = {
  reservationId: string;
  leaseToken: string;
  fence: number;
  fingerprint: string;
  coverageId?: string;
};
type Result =
  | { status: "accepted" }
  | { status: "not_invoked" }
  | {
      status: "uncertain";
      reason: "binding_changed" | "transport_unknown" | "persistence_failed";
    }
  | { status: "held"; reason: string };
type Transport = ReturnType<typeof createResendOutreachTransport>;

async function persistOutcome(
  db: GrowthDb,
  input: Input,
  snapshot: ResendIssuedSnapshot,
  outcome: ResendOutreachResult,
): Promise<Result> {
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    const [row] = await tx<
      {
        status: string;
        fence: number;
        leaseToken: string | null;
        snapshotMatches: boolean;
        hash: string | null;
      }[]
    >`select status,fence,lease_token as "leaseToken",issued_snapshot=${tx.json(snapshot)} as "snapshotMatches",issued_snapshot_hash as hash from growth.outreach_reservations where id=${input.reservationId} and outreach_provider='resend' for update`;
    if (
      !row ||
      row.status !== "submitting" ||
      row.fence !== input.fence ||
      row.leaseToken !== input.leaseToken ||
      row.hash !== snapshot.bodySha256 ||
      !row.snapshotMatches
    )
      throw new Error("submission_identity_changed");
    if (outcome.status === "accepted") {
      const evidence = {
        version: 1,
        kind: "resend_api_send_email_v1",
        reservationId: input.reservationId,
        accountId: snapshot.accountId,
        connectionId: snapshot.connectionId,
        sendGeneration: snapshot.sendGeneration,
        idempotencyKey: snapshot.idempotencyKey,
        bodySha256: snapshot.bodySha256,
        providerMessageId: outcome.providerMessageId,
      };
      await tx`update growth.outreach_reservations set status='accepted',completed_at=clock_timestamp(),provider_message_id=${outcome.providerMessageId},direct_submission_evidence=${tx.json(evidence)} where id=${input.reservationId}`;
      await auditReservation(tx, input.reservationId, "accepted");
      return { status: "accepted" };
    }
    if (outcome.status === "not_invoked") {
      const evidence = {
        version: 1,
        kind: "resend_send_not_invoked_v1",
        reservationId: input.reservationId,
        reason: "guard_or_input_rejected",
      };
      await tx`update growth.outreach_reservations set status='rejected',completed_at=clock_timestamp(),direct_noninvocation_evidence=${tx.json(evidence)} where id=${input.reservationId}`;
      await auditReservation(tx, input.reservationId, "not_invoked");
      return { status: "not_invoked" };
    }
    await tx`update growth.outreach_reservations set status='uncertain',completed_at=clock_timestamp() where id=${input.reservationId}`;
    await auditReservation(tx, input.reservationId, "uncertain");
    return { status: "uncertain", reason: "transport_unknown" };
  });
}

// The production caller is intentionally not wired until authenticated delivery receipts exist.
export async function submitReservedResendOutreach(
  db: GrowthDb,
  input: Input,
  transportFactory: (
    credential: string,
  ) => Transport = createResendOutreachTransport,
): Promise<Result> {
  const issued = await beginResendOutreachSubmission(db, input);
  if (issued.status !== "ready") return issued;
  const {
    issuedSnapshot: snapshot,
    submissionClock,
    runtimeBinding,
  } = issued.value;
  const runtime = readResendOutreachRuntime();
  if (
    !runtime ||
    JSON.stringify(runtime.binding) !== JSON.stringify(runtimeBinding) ||
    runtime.binding.sendGeneration !== snapshot.sendGeneration ||
    runtime.binding.sender !== snapshot.from ||
    runtime.binding.replyTo !== snapshot.replyTo
  )
    return { status: "uncertain", reason: "binding_changed" };
  try {
    const [stored] = await db<
      {
        matches: boolean;
        monitorId: string | null;
        status: string | null;
        subject: string | null;
        epoch: number | null;
        address: string | null;
        scopes: string[] | null;
      }[]
    >`select r.issued_snapshot=${db.json(snapshot)} and r.issued_snapshot_hash=${snapshot.bodySha256} as matches,
      g.id as "monitorId",g.status,g.google_subject as subject,g.version as epoch,g.subject_email as address,g.granted_scopes as scopes
      from growth.outreach_reservations r left join growth.integration_connections g on g.id=${snapshot.monitoredMailbox.connectionId} and g.provider='gmail'
      where r.id=${input.reservationId} and r.status='submitting' and r.fence=${input.fence} and r.lease_token=${input.leaseToken} and r.outreach_provider='resend'`;
    if (!stored?.matches)
      return { status: "uncertain", reason: "persistence_failed" };
    const monitor = snapshot.monitoredMailbox;
    if (
      stored.monitorId !== monitor.connectionId ||
      stored.status !== "connected" ||
      stored.subject !== monitor.googleSubject ||
      stored.epoch !== monitor.grantEpoch ||
      stored.address !== monitor.address ||
      !stored.scopes ||
      !sameAccountScopes(stored.scopes, monitor.grantedScopes)
    )
      return { status: "uncertain", reason: "binding_changed" };
  } catch {
    return { status: "uncertain", reason: "persistence_failed" };
  }
  let outcome: ResendOutreachResult;
  try {
    const transport = transportFactory(runtime.sendCredential);
    outcome = await transport.sendOnce(
      { rawBody: snapshot.rawBody, idempotencyKey: snapshot.idempotencyKey },
      () => {
        const current = readResendOutreachRuntime();
        return (
          !!current &&
          JSON.stringify(current.binding) === JSON.stringify(runtime.binding) &&
          current.sendCredential === runtime.sendCredential &&
          current.usageCredential === runtime.usageCredential &&
          withinSubmissionClock(submissionClock, new Date())
        );
      },
    );
  } catch {
    outcome = { status: "invoked_unknown", httpStatus: null };
  }
  try {
    return await persistOutcome(db, input, snapshot, outcome);
  } catch {
    return { status: "uncertain", reason: "persistence_failed" };
  }
}
