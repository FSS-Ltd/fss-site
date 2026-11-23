import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import { authorityGate, gateFailure, type GateResult } from "./authority-gate";
import {
  intersectAuthorityBounds,
  type AuthorityBounds,
} from "./authority-bounds";
import {
  loadCanonicalOutreachPreparation,
  type CanonicalOutreachPreparation,
  type SendWindow,
} from "./dispatch-authority";
import { loadControlledPreparation } from "./controlled-preparation";
import { loadResendAccountReadiness } from "./resend-account-repository";
import { readResendOutreachRuntime } from "./resend-account-runtime";
import type { ResendRuntimeConfiguration } from "./resend-account-control";
import type { ResendBinding } from "./resend-account-readiness";
import { lockKey, validReservedHistory } from "./reservation-repository";
import {
  held,
  reservationLeaseSchema,
  type ReservationOutcome,
} from "./reservation-shared";
import { loadSharedOutreachBudget } from "./shared-outreach-budget";
import { campaignPolicyDefinitionSchema } from "./schemas";
import type { SubmissionClock } from "./submission-clock";
import { londonDayKey } from "./time";

type Identity = {
  messageId: string;
  sequenceId: string;
  prospectId: string;
  contactId: string;
  businessId: string;
  campaignId: string;
  policyVersion: number;
  membershipId: string;
  connectionId: string;
};
type ReadyAccount = Extract<
  Awaited<ReturnType<typeof loadResendAccountReadiness>>,
  { status: "ready" }
>;
type Locked = {
  preparation: CanonicalOutreachPreparation;
  account: ReadyAccount;
  bounds: AuthorityBounds;
  now: Date;
  window: SendWindow | null;
};
type Campaign = NonNullable<
  Awaited<ReturnType<typeof loadControlledPreparation>>
>;
export type ResendIssuedSnapshot = {
  version: 1;
  kind: "resend_json";
  rawBody: string;
  bodySha256: string;
  accountId: string;
  connectionId: string;
  sendGeneration: string;
  idempotencyKey: string;
  messageId: string;
  sequenceId: string;
  membershipId: string;
  from: string;
  replyTo: string;
  recipient: string;
  campaign: Campaign;
};
export type ResendReservation = {
  reservationId: string;
  fence: number;
  preparation: CanonicalOutreachPreparation;
};
export type ResendIssuance = ResendReservation & {
  issuedSnapshot: ResendIssuedSnapshot;
  runtimeBinding: ResendBinding;
  submissionClock: SubmissionClock;
};

async function identify(
  tx: GrowthTransaction,
  messageId: string,
): Promise<Identity | null> {
  const rows = await tx<
    Identity[]
  >`select em.id as "messageId",se.id as "sequenceId",p.id as "prospectId",ct.id as "contactId",p.business_id as "businessId",m.campaign_id as "campaignId",m.policy_version as "policyVersion",m.id as "membershipId",c.account_connection_id as "connectionId"
    from growth.email_messages em join growth.sequence_enrollments se on se.id=em.sequence_enrollment_id
    join growth.prospects p on p.id=se.prospect_id join growth.contacts ct on ct.id=se.contact_id
    join growth.campaign_memberships m on m.sequence_id=se.id
    join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
    join growth.integration_connections ic on ic.id=c.account_connection_id and ic.provider='resend'
    where em.id=${messageId} and em.channel='resend' and em.direction='outbound' and em.step_number=0 and em.rfc_message_id is null and em.provider_message_id is null and c.policy->>'provider'='resend'`;
  return rows.length === 1 ? (rows[0] ?? null) : null;
}

async function lockedPreparation(
  tx: GrowthTransaction,
  identity: Identity,
  token: string,
  day: string,
  runtime: ResendRuntimeConfiguration,
  terminal: boolean,
): Promise<ReservationOutcome<Locked>> {
  await lockKey(tx, `growth:outreach-day:${day}`);
  await lockKey(
    tx,
    `growth:outreach-account-day:${identity.connectionId}:${day}`,
  );
  await lockKey(
    tx,
    `growth:outreach-campaign-day:${identity.campaignId}:${day}`,
  );
  await lockKey(tx, `growth:campaign:${identity.campaignId}`);
  await lockKey(tx, `growth:outreach-business:${identity.businessId}`);
  const account = await loadResendAccountReadiness(
    tx,
    identity.connectionId,
    runtime,
  );
  if (account.status === "held") return account;
  const [exposure] = await tx<
    { unresolved: boolean }[]
  >`select exists(select 1 from growth.outreach_reservations r where r.connection_id=${identity.connectionId} and r.issued_snapshot is not null and (r.status in ('submitting','uncertain','sent') or (r.status='accepted' and r.direct_submission_evidence is null) or (r.status='rejected' and r.direct_noninvocation_evidence is null) or (r.status='cancelled' and (r.submitted_at is not null or r.issued_snapshot is not null)))) as unresolved`;
  if (!exposure || exposure.unresolved)
    return held("account_submission_unresolved");
  await tx`select id from growth.campaigns where id=${identity.campaignId} and version=${identity.policyVersion} for share`;
  await tx`select id from growth.campaign_memberships where id=${identity.membershipId} for share`;
  await tx`select id from growth.prospects where id=${identity.prospectId} for share`;
  await tx`select id from growth.businesses where id=${identity.businessId} for share`;
  await tx`select id from growth.contacts where id=${identity.contactId} for share`;
  await tx`select id from growth.sequence_enrollments where id=${identity.sequenceId} for share`;
  await tx`select id from growth.email_messages where id=${identity.messageId} for update`;
  if (terminal) {
    const [fence] = await tx<
      { acquired: boolean }[]
    >`select growth.try_outreach_terminal_fence() as acquired`;
    if (!fence?.acquired) return held("terminal_fence_busy");
  }
  const [clock] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
  if (!clock || londonDayKey(clock.now) !== day) return held("day_changed");
  const current = await identify(tx, identity.messageId);
  if (!current || JSON.stringify(current) !== JSON.stringify(identity))
    return held("identity_changed");
  const preparation = await loadCanonicalOutreachPreparation(tx, {
    messageId: identity.messageId,
    leaseToken: token,
    connectionId: identity.connectionId,
    grantEpoch: null,
    now: clock.now,
    resendRuntime: runtime,
  });
  if (preparation.status === "held") return preparation;
  return {
    status: "ready",
    value: {
      preparation: preparation.preparation,
      account,
      now: clock.now,
      bounds: intersectAuthorityBounds(preparation.bounds, {
        validatedAt: clock.now,
        expiresAt: account.expiresAt,
        validThrough: null,
      }),
      window: preparation.window,
    },
  };
}

const usageSchema = z.object({
  observedAt: z.iso.datetime({ offset: true }),
  daily: z.object({
    used: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative().nullable(),
  }),
  monthly: z.object({
    used: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative().nullable(),
  }),
});
async function checkBudget(
  tx: GrowthTransaction,
  identity: Identity,
  day: string,
  account: ReadyAccount,
  excluding: string | null,
): Promise<ReservationOutcome<AuthorityBounds>> {
  const [unbound] = await tx<
    { found: boolean }[]
  >`select exists(select 1 from growth.outreach_reservations where connection_id is null and status <> 'cancelled') as found`;
  if (!unbound || unbound.found) return held("legacy_usage_unreconciled");
  const [counts] = await tx<
    { globalUsed: number; accountUsed: number; campaignUsed: number }[]
  >`select count(*)::int as "globalUsed",count(*) filter(where connection_id=${identity.connectionId})::int as "accountUsed",count(*) filter(where campaign_id=${identity.campaignId})::int as "campaignUsed" from growth.outreach_reservations where london_day=${day}::date and not (connection_id is not null and ((status='cancelled' and submitted_at is null and issued_snapshot is null) or (status='rejected' and direct_noninvocation_evidence is not null))) and (${excluding}::uuid is null or id<>${excluding}::uuid)`;
  const [row] = await tx<
    { usage: unknown; policy: unknown }[]
  >`select u.resend_usage as usage,c.policy from growth.outreach_provider_usage u join growth.campaigns c on c.id=${identity.campaignId} and c.version=${identity.policyVersion} where u.connection_id=${identity.connectionId} and u.account_id=${identity.connectionId}`;
  const usage = usageSchema.safeParse(row?.usage),
    policy = campaignPolicyDefinitionSchema.safeParse(row?.policy);
  if (!counts || !usage.success || !policy.success)
    return held("usage_unknown");
  const [pending] = await tx<
    { count: number }[]
  >`select count(*)::int as count from growth.outreach_reservations where connection_id=${identity.connectionId} and (status in ('reserved','submitting','uncertain') or (status='accepted' and (confirmation_observed_at is null or confirmation_observed_at >= ${new Date(usage.data.observedAt)})) or (status='rejected' and direct_noninvocation_evidence is null)) and (${excluding}::uuid is null or id<>${excluding}::uuid)`;
  if (!pending) return held("usage_unknown");
  // Until the full Resend delivery path is active, only a separately ready Gmail account can set the shared ceiling.
  const shared = await loadSharedOutreachBudget(tx, {
    resendDelivery: "unavailable",
  });
  if (shared.status === "held") return shared;
  if (counts.globalUsed >= shared.ramp) return held("global_limit");
  if (counts.accountUsed >= account.ramp) return held("account_limit");
  if (counts.campaignUsed >= policy.data.dailyLimit)
    return held("campaign_limit");
  for (const window of [usage.data.daily, usage.data.monthly]) {
    if (window.limit !== null && window.used + pending.count + 1 > window.limit)
      return held("provider_limit");
  }
  return { status: "ready", value: shared.bounds };
}

const reserveInputSchema = z.strictObject({
  messageId: z.uuid(),
  leaseToken: z.uuid(),
  attemptKey: z.string().regex(/^[A-Za-z0-9_/-]{1,256}$/),
});
export async function reserveResendOutreachAttempt(
  db: GrowthDb,
  input: z.infer<typeof reserveInputSchema>,
): Promise<ReservationOutcome<ResendReservation>> {
  if (!reserveInputSchema.safeParse(input).success)
    return held("invalid_input");
  const runtime = readResendOutreachRuntime();
  if (!runtime) return held("identity_or_configuration_unknown");
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    await lockKey(tx, `growth:outreach-attempt:${input.attemptKey}`);
    const identity = await identify(tx, input.messageId);
    if (!identity) return held("identity_unknown");
    const [clock] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
    if (!clock) return held("invalid_time");
    const day = londonDayKey(clock.now);
    const locked = await lockedPreparation(
      tx,
      identity,
      input.leaseToken,
      day,
      runtime,
      false,
    );
    if (locked.status === "held") return locked;
    const { preparation, account, now, bounds, window } = locked.value;
    const [existing] = await tx<
      {
        id: string;
        messageId: string;
        status: string;
        fence: number;
        fingerprint: string | null;
        leaseToken: string | null;
        leaseUntil: Date | null;
        connectionId: string | null;
        generation: string | null;
        day: string;
      }[]
    >`select id,email_message_id as "messageId",status,fence,authority_fingerprint as fingerprint,lease_token as "leaseToken",lease_until as "leaseUntil",connection_id as "connectionId",resend_send_generation as generation,london_day::text as day from growth.outreach_reservations where idempotency_key=${input.attemptKey} for update`;
    if (existing) {
      if (
        !(await validReservedHistory(tx, identity.messageId, input.leaseToken))
      )
        return held("claim_history_unproven");
      if (
        existing.messageId !== identity.messageId ||
        existing.status !== "reserved" ||
        existing.fingerprint !== preparation.fingerprint ||
        existing.leaseToken !== input.leaseToken ||
        !existing.leaseUntil ||
        existing.leaseUntil <= now ||
        existing.connectionId !== identity.connectionId ||
        existing.generation !== runtime.binding.sendGeneration ||
        existing.day !== day
      )
        return held("attempt_conflict");
      const replayBounds = intersectAuthorityBounds(bounds, {
        validatedAt: now,
        expiresAt: existing.leaseUntil,
        validThrough: null,
      });
      const [gate] = await tx<
        GateResult[]
      >`with ${authorityGate(tx, day, replayBounds, window)} select day_ok as "dayOk",interval_ok as "intervalOk",window_ok as "windowOk",0::int as writes from authority_gate`;
      const failure = gateFailure(gate);
      if (failure) return held(failure);
      return {
        status: "ready",
        value: {
          reservationId: existing.id,
          fence: existing.fence,
          preparation,
        },
      };
    }
    const [history] = await tx<
      {
        attempts: number;
        previousStatus: string | null;
        guarded: boolean;
        total: number;
        leases: number;
        current: boolean;
        unsafe: boolean;
      }[]
    >`select em.attempt_count as attempts,em.outreach_claim_previous_status as "previousStatus",em.outreach_guarded_claim as guarded,(select count(*)::int from growth.outreach_reservations where email_message_id=em.id) as total,(select count(distinct lease_token)::int from growth.outreach_reservations where email_message_id=em.id) as leases,exists(select 1 from growth.outreach_reservations where email_message_id=em.id and lease_token=${input.leaseToken}) as current,exists(select 1 from growth.outreach_reservations where email_message_id=em.id and (connection_id is null or not ((status='cancelled' and submitted_at is null and issued_snapshot is null) or (status='rejected' and direct_noninvocation_evidence is not null)))) as unsafe from growth.email_messages em where em.id=${identity.messageId}`;
    if (!history || !history.previousStatus || !history.guarded)
      return held("claim_provenance_unknown");
    if (
      history.current ||
      history.unsafe ||
      history.total !== history.leases ||
      history.leases !== history.attempts
    )
      return held("claim_history_unproven");
    const budget = await checkBudget(tx, identity, day, account, null);
    if (budget.status === "held") return budget;
    const [fence] = await tx<
      { value: number }[]
    >`select coalesce(max(fence),0)::int+1 as value from growth.outreach_reservations where email_message_id=${identity.messageId}`;
    if (!fence) return held("fence_unavailable");
    const reservationId = randomUUID();
    const [gate] = await tx<
      GateResult[]
    >`with ${authorityGate(tx, day, intersectAuthorityBounds(bounds, budget.value), window)},
      inserted as (insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,outreach_provider,resend_send_generation,recipient_count,authority_fingerprint,lease_token,lease_until,fence,reserved_at)
        select ${reservationId},${input.attemptKey},${identity.campaignId},${identity.policyVersion},${identity.membershipId},${identity.messageId},${identity.sequenceId},${identity.connectionId},${day}::date,${identity.connectionId},'resend',${runtime.binding.sendGeneration},1,${preparation.fingerprint},${input.leaseToken},at+interval '5 minutes',${fence.value},at from authority_gate where day_ok and interval_ok and window_ok returning id),
      message_write as (update growth.email_messages set attempt_count=attempt_count+1 where id=${identity.messageId} and exists(select 1 from inserted) returning id),
      audit_write as (insert into growth.audit_log(correlation_id,actor_type,actor_id,action,entity_type,entity_id,metadata) select ${reservationId},'system','outreach-dispatch','outreach_reservation.reserved','outreach_reservation',${reservationId},'{}'::jsonb from inserted where exists(select 1 from message_write) returning id)
      select day_ok as "dayOk",interval_ok as "intervalOk",window_ok as "windowOk",(select count(*)::int from audit_write) as writes from authority_gate`;
    const failure = gateFailure(gate);
    if (failure) return held(failure);
    if (gate?.writes !== 1) throw new Error("reservation_write_failed");
    return {
      status: "ready",
      value: { reservationId, fence: fence.value, preparation },
    };
  });
}

const beginInputSchema = reservationLeaseSchema.extend({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export async function beginResendOutreachSubmission(
  db: GrowthDb,
  input: z.infer<typeof beginInputSchema>,
): Promise<ReservationOutcome<ResendIssuance>> {
  if (!beginInputSchema.safeParse(input).success) return held("invalid_input");
  const runtime = readResendOutreachRuntime();
  if (!runtime) return held("identity_or_configuration_unknown");
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    const [initial] = await tx<
      { messageId: string; attemptKey: string; day: string }[]
    >`select email_message_id as "messageId",idempotency_key as "attemptKey",london_day::text as day from growth.outreach_reservations where id=${input.reservationId} and outreach_provider='resend'`;
    if (!initial) return held("reservation_unknown");
    await lockKey(tx, `growth:outreach-attempt:${initial.attemptKey}`);
    const identity = await identify(tx, initial.messageId);
    if (!identity) return held("identity_unknown");
    const locked = await lockedPreparation(
      tx,
      identity,
      input.leaseToken,
      initial.day,
      runtime,
      true,
    );
    if (locked.status === "held") return locked;
    const { preparation, account, now, bounds, window } = locked.value;
    if (!(await validReservedHistory(tx, identity.messageId, input.leaseToken)))
      return held("claim_history_unproven");
    const [reservation] = await tx<
      {
        status: string;
        fence: number;
        fingerprint: string | null;
        leaseToken: string | null;
        leaseUntil: Date | null;
        connectionId: string | null;
        generation: string | null;
      }[]
    >`select status,fence,authority_fingerprint as fingerprint,lease_token as "leaseToken",lease_until as "leaseUntil",connection_id as "connectionId",resend_send_generation as generation from growth.outreach_reservations where id=${input.reservationId} and outreach_provider='resend' for update`;
    if (
      !reservation ||
      reservation.status !== "reserved" ||
      reservation.fence !== input.fence ||
      reservation.leaseToken !== input.leaseToken ||
      !reservation.leaseUntil ||
      reservation.leaseUntil <= now
    )
      return held("reservation_lease_invalid");
    if (
      reservation.fingerprint !== input.fingerprint ||
      preparation.fingerprint !== input.fingerprint ||
      reservation.connectionId !== identity.connectionId ||
      reservation.generation !== runtime.binding.sendGeneration
    )
      return held("authority_changed");
    const campaign = await loadControlledPreparation(tx, {
      membershipId: identity.membershipId,
      connectionId: identity.connectionId,
      preparation,
      resendRuntime: runtime,
    });
    if (!campaign?.copyFamilyVersion || !campaign.copyFamilySha256)
      return held("controlled_variant_unproven");
    const recipient = preparation.recipient.trim().toLowerCase();
    const rawBody = JSON.stringify({
      from: runtime.binding.sender,
      to: [recipient],
      reply_to: runtime.binding.replyTo,
      subject: preparation.subject,
      html: preparation.html,
      text: preparation.text,
    });
    if (Buffer.byteLength(rawBody, "utf8") > 1048576)
      return held("issued_payload_too_large");
    const bodySha256 = createHash("sha256").update(rawBody).digest("hex");
    const issuedSnapshot: ResendIssuedSnapshot = {
      version: 1,
      kind: "resend_json",
      rawBody,
      bodySha256,
      accountId: identity.connectionId,
      connectionId: identity.connectionId,
      sendGeneration: runtime.binding.sendGeneration,
      idempotencyKey: initial.attemptKey,
      messageId: identity.messageId,
      sequenceId: identity.sequenceId,
      membershipId: identity.membershipId,
      from: runtime.binding.sender,
      replyTo: runtime.binding.replyTo,
      recipient,
      campaign,
    };
    const budget = await checkBudget(
      tx,
      identity,
      initial.day,
      account,
      input.reservationId,
    );
    if (budget.status === "held") return budget;
    const submissionBounds = intersectAuthorityBounds(bounds, budget.value, {
      validatedAt: now,
      expiresAt: reservation.leaseUntil,
      validThrough: null,
    });
    const [gate] = await tx<
      GateResult[]
    >`with ${authorityGate(tx, initial.day, submissionBounds, window)},
      updated as (update growth.outreach_reservations r set status='submitting',submitted_at=g.at,issued_snapshot=${tx.json(issuedSnapshot)},issued_snapshot_hash=${bodySha256} from authority_gate g where g.day_ok and g.interval_ok and g.window_ok and r.id=${input.reservationId} and r.status='reserved' and r.fence=${input.fence} and r.lease_token=${input.leaseToken} and r.connection_id=${identity.connectionId} and r.outreach_provider='resend' and r.resend_send_generation=${runtime.binding.sendGeneration} and r.authority_fingerprint=${input.fingerprint} and r.london_day=${initial.day}::date returning r.id),
      audit_write as (insert into growth.audit_log(correlation_id,actor_type,actor_id,action,entity_type,entity_id,metadata) select ${input.reservationId},'system','outreach-dispatch','outreach_reservation.submitting','outreach_reservation',${input.reservationId},'{}'::jsonb from updated returning id)
      select day_ok as "dayOk",interval_ok as "intervalOk",window_ok as "windowOk",(select count(*)::int from audit_write) as writes from authority_gate`;
    const failure = gateFailure(gate);
    if (failure) return held(failure);
    if (gate?.writes !== 1) throw new Error("submission_write_failed");
    return {
      status: "ready",
      value: {
        reservationId: input.reservationId,
        fence: input.fence,
        preparation,
        issuedSnapshot,
        runtimeBinding: runtime.binding,
        submissionClock: {
          londonDay: initial.day,
          bounds: submissionBounds,
          window,
        },
      },
    };
  });
}
