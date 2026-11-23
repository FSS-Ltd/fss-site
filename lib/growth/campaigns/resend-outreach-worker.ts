import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { withGrowthTransaction } from "../db/client";
import { appendAuditEvent } from "../audit/service";
import type { GrowthDb } from "../db/types";
import { hasRequiredGmailScopes } from "../integrations/google-oauth";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import { postgresSequenceDispatchRepository } from "../sequences/dispatcher-repository";
import { CAMPAIGN_FOUNDER_EMAIL } from "./authorization";
import {
  runFirstPreparationBatch,
  type FirstPreparationBatchSummary,
} from "./first-preparation-worker";
import { cancelOutreachReservation } from "./reservation-settlement";
import { resendBindingSchema } from "./resend-account-readiness";
import {
  loadResendAccountReadiness,
  refreshResendAccountUsage,
} from "./resend-account-repository";
import { readResendOutreachRuntime } from "./resend-account-runtime";
import type { ResendRuntimeConfiguration } from "./resend-account-control";
import { reserveResendOutreachAttempt } from "./resend-reservation-repository";
import { submitReservedResendOutreach } from "./resend-direct-submission";

const MAX_BATCH = 25;
const MESSAGE_HOLDS = new Set([
  "attempt_conflict",
  "attempt_unresolved",
  "claim_history_unproven",
  "claim_provenance_unknown",
  "controlled_variant_unproven",
  "first_message_already_threaded",
  "identity_changed",
  "identity_unknown",
  "lease_invalid",
  "legacy_approval_unbound",
  "membership_ambiguous",
  "message_unprepared",
  "outreach_excluded",
  "permission_invalid",
  "research_permission_changed",
  "verification_required",
]);
type Context = { connectionId: string; runtime: ResendRuntimeConfiguration };
type Decision = { status: "ready" } | { status: "held"; reason: string };
type Claim = { id: string };
type Reservation = Awaited<ReturnType<typeof reserveResendOutreachAttempt>>;
type Submission = Awaited<ReturnType<typeof submitReservedResendOutreach>>;
type Ports = {
  context: (db: GrowthDb) => Promise<Context | null>;
  due: (db: GrowthDb, connectionId: string) => Promise<boolean>;
  refresh: (
    db: GrowthDb,
    context: Context,
  ) => Promise<{ status: "complete" } | { status: "held"; reason: string }>;
  readiness: (db: GrowthDb, context: Context) => Promise<Decision>;
  first: (
    db: GrowthDb,
    input: {
      binding: {
        provider: "resend";
        connectionId: string;
        runtime: ResendRuntimeConfiguration;
      };
      workerId: string;
      limit: number;
    },
  ) => Promise<FirstPreparationBatchSummary>;
  dispatch?: {
    available: (db: GrowthDb, context: Context) => Promise<Decision>;
    next: (
      db: GrowthDb,
      connectionId: string,
      excluded: readonly string[],
    ) => Promise<string | null>;
    claim: (
      db: GrowthDb,
      input: {
        messageId: string;
        leaseToken: string;
        now: Date;
        leaseExpiresAt: Date;
      },
    ) => Promise<Claim | null>;
    reserve: (
      db: GrowthDb,
      input: { messageId: string; leaseToken: string; attemptKey: string },
    ) => Promise<Reservation>;
    submit: (
      db: GrowthDb,
      input: {
        reservationId: string;
        leaseToken: string;
        fence: number;
        fingerprint: string;
      },
    ) => Promise<Submission>;
    cancelReservation: typeof cancelOutreachReservation;
    closeClaim: (
      db: GrowthDb,
      input: {
        messageId: string;
        leaseToken: string;
        disposition: "cancel" | "release";
        reason: string;
      },
    ) => Promise<boolean>;
  };
  workerId: string;
};
export type ResendWorkerSummary = {
  status: "idle" | "complete" | "held";
  reason?: string;
  first: FirstPreparationBatchSummary;
  claimed: number;
  accepted: number;
  notInvoked: number;
  uncertain: number;
  held: number;
};
const emptyFirst = (): FirstPreparationBatchSummary => ({
  claimed: 0,
  prepared: 0,
  held: 0,
  retry: 0,
});

/** Dependency-injected orchestration; the live factory supplies the fixed production gate. */
export function createResendOutreachWorker(ports: Ports) {
  return async (db: GrowthDb): Promise<ResendWorkerSummary> => {
    const summary: ResendWorkerSummary = {
      status: "idle",
      first: emptyFirst(),
      claimed: 0,
      accepted: 0,
      notInvoked: 0,
      uncertain: 0,
      held: 0,
    };
    const context = await ports.context(db);
    if (!context)
      return { ...summary, status: "held", reason: "account_binding_unknown" };
    if (!(await ports.due(db, context.connectionId))) return summary;
    const usage = await ports.refresh(db, context);
    if (usage.status === "held")
      return { ...summary, status: "held", reason: usage.reason };
    const readiness = await ports.readiness(db, context);
    if (readiness.status === "held")
      return { ...summary, status: "held", reason: readiness.reason };
    const first = await ports.first(db, {
      binding: {
        provider: "resend",
        connectionId: context.connectionId,
        runtime: {
          binding: context.runtime.binding,
          sendCredential: context.runtime.sendCredential,
          usageCredential: context.runtime.usageCredential,
        },
      },
      workerId: ports.workerId,
      limit: MAX_BATCH,
    });
    if (
      [first.claimed, first.prepared, first.held, first.retry].some(
        (value) => !Number.isInteger(value) || value < 0,
      ) ||
      first.claimed > MAX_BATCH ||
      first.prepared + first.held + first.retry !== first.claimed
    )
      throw new Error("invalid_first_batch_count");
    summary.first = first;
    const dispatch = ports.dispatch;
    if (!dispatch)
      return {
        ...summary,
        status: "held",
        reason: "delivery_path_unavailable",
      };
    const availability = await dispatch.available(db, context);
    if (availability.status === "held")
      return { ...summary, status: "held", reason: availability.reason };
    const excluded: string[] = [];
    for (let i = first.claimed; i < MAX_BATCH; i++) {
      const messageId = await dispatch.next(db, context.connectionId, excluded);
      if (!messageId) break;
      excluded.push(messageId);
      const now = new Date(),
        leaseToken = randomUUID();
      const claim = await dispatch.claim(db, {
        messageId,
        leaseToken,
        now,
        leaseExpiresAt: new Date(now.getTime() + 300000),
      });
      if (!claim) continue;
      summary.claimed++;
      let reserved: Reservation;
      try {
        reserved = await dispatch.reserve(db, {
          messageId,
          leaseToken,
          attemptKey: `outreach/${messageId}/${leaseToken}`,
        });
      } catch {
        return { ...summary, status: "held", reason: "reservation_unknown" };
      }
      if (reserved.status === "held") {
        const individual = MESSAGE_HOLDS.has(reserved.reason);
        const closed = await dispatch.closeClaim(db, {
          messageId,
          leaseToken,
          disposition: individual ? "cancel" : "release",
          reason: reserved.reason,
        });
        summary.held++;
        if (!closed)
          return { ...summary, status: "held", reason: "claim_release_failed" };
        if (!individual)
          return { ...summary, status: "held", reason: reserved.reason };
        continue;
      }
      let submitted: Submission;
      try {
        submitted = await dispatch.submit(db, {
          reservationId: reserved.value.reservationId,
          leaseToken,
          fence: reserved.value.fence,
          fingerprint: reserved.value.preparation.fingerprint,
        });
      } catch {
        summary.uncertain++;
        return { ...summary, status: "held", reason: "submission_uncertain" };
      }
      if (submitted.status === "accepted") {
        summary.accepted++;
        continue;
      }
      if (submitted.status === "uncertain") {
        summary.uncertain++;
        return { ...summary, status: "held", reason: submitted.reason };
      }
      if (submitted.status === "not_invoked") {
        summary.notInvoked++;
        if (
          !(await dispatch.closeClaim(db, {
            messageId,
            leaseToken,
            disposition: "cancel",
            reason: "not_invoked",
          }))
        )
          return { ...summary, status: "held", reason: "claim_release_failed" };
        return { ...summary, status: "held", reason: "not_invoked" };
      }
      const cancelled = await dispatch.cancelReservation(db, {
        reservationId: reserved.value.reservationId,
        leaseToken,
        fence: reserved.value.fence,
      });
      if (cancelled.status !== "ready")
        return {
          ...summary,
          status: "held",
          reason: "reservation_release_failed",
        };
      const individual = MESSAGE_HOLDS.has(submitted.reason);
      const closed = await dispatch.closeClaim(db, {
        messageId,
        leaseToken,
        disposition: individual ? "cancel" : "release",
        reason: submitted.reason,
      });
      summary.held++;
      if (!closed)
        return { ...summary, status: "held", reason: "claim_release_failed" };
      if (!individual)
        return { ...summary, status: "held", reason: submitted.reason };
    }
    return { ...summary, status: "complete" };
  };
}

async function loadContext(db: GrowthDb): Promise<Context | null> {
  const runtime = readResendOutreachRuntime();
  if (!runtime?.binding.webhookGeneration || !runtime.webhookSecret?.trim())
    return null;
  const rows = await db<
    {
      connectionId: string;
      binding: unknown;
      review: unknown;
      gmailSubject: string | null;
      gmailStatus: string | null;
      gmailScopes: string[] | null;
    }[]
  >`
    select c.connection_id as "connectionId",c.resend_binding as binding,r.evidence as review,
      g.google_subject as "gmailSubject",g.status as "gmailStatus",g.granted_scopes as "gmailScopes"
    from growth.outreach_account_controls c
    join growth.integration_connections ic on ic.id=c.connection_id and ic.provider='resend' and ic.subject_email=${runtime.binding.sender}
    join growth.outreach_account_reviews r on r.id=c.resend_binding_review_id and r.connection_id=c.connection_id and r.kind='resend_configure' and r.actor_id=${createHash("sha256").update(CAMPAIGN_FOUNDER_EMAIL).digest("hex")}
    left join growth.integration_connections g on g.provider='gmail' and g.subject_email=${runtime.binding.replyTo}
    where c.provider='resend' and c.state='active' and c.resend_team=${runtime.binding.team} and c.resend_environment=${runtime.binding.environment} limit 2`;
  if (rows.length !== 1) return null;
  const row = rows[0];
  const binding = resendBindingSchema.safeParse(row?.binding);
  const review = z
    .object({ binding: resendBindingSchema })
    .safeParse(row?.review);
  if (
    !row ||
    !binding.success ||
    !review.success ||
    JSON.stringify(binding.data) !== JSON.stringify(runtime.binding) ||
    JSON.stringify(binding.data) !== JSON.stringify(review.data.binding) ||
    row.gmailStatus !== "connected" ||
    !row.gmailSubject ||
    !row.gmailScopes ||
    !hasRequiredGmailScopes(row.gmailScopes)
  )
    return null;
  return { connectionId: row.connectionId, runtime };
}

async function hasDueWork(
  db: GrowthDb,
  connectionId: string,
): Promise<boolean> {
  const [row] = await db<{ due: boolean }[]>`select exists(
    select 1 from growth.outreach_jobs j join growth.campaigns c on c.id=j.campaign_id and c.version=j.policy_version
    where j.job_type='first_preparation' and c.account_connection_id=${connectionId} and c.policy->>'provider'='resend'
      and j.due_at<=clock_timestamp() and (j.status='pending' or (j.status='leased' and j.lease_until<=clock_timestamp()))
    union all
    select 1 from growth.email_messages em join growth.campaign_memberships m on m.sequence_id=em.sequence_enrollment_id
    join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
    where em.channel='resend' and em.direction='outbound' and em.step_number=0 and c.account_connection_id=${connectionId} and c.policy->>'provider'='resend'
      and ((em.status in ('queued','retry') and em.scheduled_for<=clock_timestamp()) or (em.status='sending' and em.lease_expires_at<=clock_timestamp()))
  ) as due`;
  return row?.due === true;
}

async function nextMessage(
  db: GrowthDb,
  connectionId: string,
  excluded: readonly string[],
): Promise<string | null> {
  const [row] = await db<
    { id: string }[]
  >`select em.id from growth.email_messages em join growth.campaign_memberships m on m.sequence_id=em.sequence_enrollment_id
    join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
    where em.channel='resend' and em.direction='outbound' and em.step_number=0 and c.account_connection_id=${connectionId} and c.policy->>'provider'='resend'
      and not (em.id=any(${excluded}::uuid[])) and ((em.status in ('queued','retry') and em.scheduled_for<=clock_timestamp()) or (em.status='sending' and em.lease_expires_at<=clock_timestamp()))
    order by coalesce(em.scheduled_for,em.lease_expires_at),em.id limit 1`;
  return row?.id ?? null;
}

async function closeClaim(
  db: GrowthDb,
  input: {
    messageId: string;
    leaseToken: string;
    disposition: "cancel" | "release";
    reason: string;
  },
): Promise<boolean> {
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    const reason =
      input.reason.length <= 64 &&
      /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(input.reason)
        ? input.reason
        : "preparation_unavailable";
    const rows = await tx<
      { id: string }[]
    >`update growth.email_messages em set status=${input.disposition === "cancel" ? "cancelled" : "queued"},last_error_code=${reason},lease_token=null,lease_expires_at=null,
      scheduled_for=case when ${input.disposition}='release' then clock_timestamp()+interval '15 minutes' else scheduled_for end,updated_at=clock_timestamp()
      where em.id=${input.messageId} and em.channel='resend' and em.status='sending' and em.lease_token=${input.leaseToken} and em.lease_expires_at>clock_timestamp()
      and not exists(select 1 from growth.outreach_reservations r where r.email_message_id=em.id and (r.connection_id is null or not ((r.status='cancelled' and r.submitted_at is null and r.issued_snapshot is null) or (r.status='rejected' and r.direct_noninvocation_evidence is not null)))) returning em.id`;
    if (rows.length !== 1) return false;
    await appendAuditEvent(tx, {
      correlationId: input.leaseToken,
      actorType: "system",
      actorId: "outreach-dispatch",
      action:
        input.disposition === "cancel"
          ? "outreach_message.cancelled"
          : "outreach_message.released",
      entityType: "email_message",
      entityId: input.messageId,
      metadata: { reasonCode: reason },
    });
    return true;
  });
}

function runtimeIsCurrent(context: Context): boolean {
  const current = readResendOutreachRuntime();
  return (
    !!current &&
    JSON.stringify(current.binding) ===
      JSON.stringify(context.runtime.binding) &&
    current.sendCredential === context.runtime.sendCredential &&
    current.usageCredential === context.runtime.usageCredential &&
    current.webhookSecret === context.runtime.webhookSecret
  );
}

/** Actual server ports are constructed here; no route calls this factory yet. */
export function createLiveResendOutreachWorker() {
  return createResendOutreachWorker({
    context: loadContext,
    due: hasDueWork,
    refresh: (db, context) =>
      runtimeIsCurrent(context)
        ? refreshResendAccountUsage(db, context.connectionId, context.runtime)
        : Promise.resolve({ status: "held", reason: "binding_changed" }),
    readiness: (db, context) =>
      runtimeIsCurrent(context)
        ? withGrowthTransaction(db, (tx) =>
            loadResendAccountReadiness(
              tx,
              context.connectionId,
              context.runtime,
            ),
          )
        : Promise.resolve({ status: "held", reason: "binding_changed" }),
    first: runFirstPreparationBatch,
    workerId: randomUUID(),
    dispatch: {
      // The route and monitored-reply coverage are not wired, so the real worker cannot send.
      available: async () => ({
        status: "held",
        reason: "delivery_path_unavailable",
      }),
      next: nextMessage,
      claim: (db, input) =>
        postgresSequenceDispatchRepository.claimDueMessage(db, {
          ...input,
          channel: "resend",
        }),
      reserve: reserveResendOutreachAttempt,
      submit: submitReservedResendOutreach,
      cancelReservation: cancelOutreachReservation,
      closeClaim,
    },
  });
}
