import {
  held,
  reservationLeaseSchema,
  type ReservationOutcome as Outcome,
} from "./reservation-shared";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import { renderGmailMime } from "../email/gmail/mime";
import { CAMPAIGN_FOUNDER_EMAIL } from "./authorization";
import { loadReservationAccount } from "./account-repository";
import {
  loadCanonicalOutreachPreparation,
  type CanonicalOutreachPreparation,
  type SendWindow,
} from "./dispatch-authority";
import {
  intersectAuthorityBounds,
  type AuthorityBounds,
} from "./authority-bounds";
import { authorityGate, gateFailure, type GateResult } from "./authority-gate";
import { assessReservationBudget } from "./reservation-budget";
import { campaignPolicyDefinitionSchema } from "./schemas";
import { londonDayKey } from "./time";

export type ReservedOutreach = {
  reservationId: string;
  fence: number;
  rfcMessageId: string;
  preparation: CanonicalOutreachPreparation;
};
type Identity = {
  messageId: string;
  sequenceId: string;
  prospectId: string;
  contactId: string;
  businessId: string;
  campaignId: string | null;
  policyVersion: number | null;
  membershipId: string | null;
  connectionId: string;
};
type Pending = {
  state: "reserved" | "submitting" | "uncertain" | "accepted";
  providerId: string | null;
  recipientCount: number;
};

async function preliminary(
  tx: GrowthTransaction,
  messageId: string,
): Promise<Identity | null> {
  const rows = await tx<Identity[]>`
    select em.id as "messageId",se.id as "sequenceId",p.id as "prospectId",ct.id as "contactId",p.business_id as "businessId",
      m.campaign_id as "campaignId",m.policy_version as "policyVersion",m.id as "membershipId",ic.id as "connectionId"
    from growth.email_messages em join growth.sequence_enrollments se on se.id=em.sequence_enrollment_id
    join growth.prospects p on p.id=se.prospect_id join growth.contacts ct on ct.id=se.contact_id
    left join growth.campaign_memberships m on m.sequence_id=se.id
    join growth.integration_connections ic on ic.provider='gmail' and ic.subject_email=${CAMPAIGN_FOUNDER_EMAIL}
    where em.id=${messageId}
  `;
  return rows.length === 1 ? (rows[0] ?? null) : null;
}
async function lockKey(tx: GrowthTransaction, key: string): Promise<void> {
  await tx`select pg_advisory_xact_lock(hashtextextended(${key},0))`;
}
async function lockedPreparation(
  tx: GrowthTransaction,
  identity: Identity,
  leaseToken: string,
  day: string,
): Promise<
  Outcome<{
    preparation: CanonicalOutreachPreparation;
    account: Extract<
      Awaited<ReturnType<typeof loadReservationAccount>>,
      { status: "ready" }
    >["account"];
    now: Date;
    bounds: AuthorityBounds;
    window: SendWindow | null;
  }>
> {
  await lockKey(tx, `growth:outreach-day:${day}`);
  await lockKey(
    tx,
    `growth:outreach-account-day:${identity.connectionId}:${day}`,
  );
  if (identity.campaignId)
    await lockKey(
      tx,
      `growth:outreach-campaign-day:${identity.campaignId}:${day}`,
    );
  if (identity.campaignId)
    await lockKey(tx, `growth:campaign:${identity.campaignId}`);
  await lockKey(tx, `growth:outreach-business:${identity.businessId}`);
  const account = await loadReservationAccount(tx, identity.connectionId);
  if (account.status === "held") return account;
  if (identity.campaignId)
    await tx`select id from growth.campaigns where id=${identity.campaignId} and version=${identity.policyVersion} for share`;
  if (identity.membershipId)
    await tx`select id from growth.campaign_memberships where id=${identity.membershipId} for share`;
  await tx`select id from growth.prospects where id=${identity.prospectId} for share`;
  await tx`select id from growth.businesses where id=${identity.businessId} for share`;
  await tx`select id from growth.contacts where id=${identity.contactId} for share`;
  await tx`select id from growth.sequence_enrollments where id=${identity.sequenceId} for share`;
  await tx`select id from growth.email_messages where id=${identity.messageId} for update`;
  const [clock] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
  if (!clock || londonDayKey(clock.now) !== day) return held("day_changed");
  const current = await preliminary(tx, identity.messageId);
  if (!current || JSON.stringify(current) !== JSON.stringify(identity))
    return held("identity_changed");
  const preparation = await loadCanonicalOutreachPreparation(tx, {
    messageId: identity.messageId,
    leaseToken,
    connectionId: identity.connectionId,
    grantEpoch: account.account.grantEpoch,
    now: clock.now,
  });
  if (preparation.status === "held") return preparation;
  return {
    status: "ready",
    value: {
      preparation: preparation.preparation,
      account: account.account,
      bounds: intersectAuthorityBounds(
        account.account.bounds,
        preparation.bounds,
      ),
      window: preparation.window,
      now: clock.now,
    },
  };
}
async function checkBudget(
  tx: GrowthTransaction,
  identity: Identity,
  day: string,
  account: Extract<
    Awaited<ReturnType<typeof loadReservationAccount>>,
    { status: "ready" }
  >["account"],
  now: Date,
  excluding: string | null,
): Promise<string> {
  const [unbound] = await tx<
    { found: boolean }[]
  >`select exists(select 1 from growth.outreach_reservations where connection_id is null and status <> 'cancelled') as found`;
  if (unbound?.found) return "legacy_usage_unreconciled";
  const [counts] = await tx<
    { globalUsed: number; accountUsed: number; campaignUsed: number }[]
  >`
    select count(*)::int as "globalUsed",count(*) filter(where connection_id=${identity.connectionId} or account_id=${account.usage.accountId})::int as "accountUsed",count(*) filter(where campaign_id=${identity.campaignId})::int as "campaignUsed"
    from growth.outreach_reservations where london_day=${day}::date and status <> 'cancelled' and (${excluding}::uuid is null or id<>${excluding}::uuid)
  `;
  if (!counts) return "invalid_budget";
  const outstanding = await tx<
    Pending[]
  >`select status as state,provider_message_id as "providerId",recipient_count as "recipientCount" from growth.outreach_reservations where connection_id=${identity.connectionId} and status in ('reserved','submitting','uncertain','accepted') and (status in ('reserved','submitting','uncertain') or coalesce(actual_sent_at,completed_at,submitted_at,reserved_at) > ${new Date(now.getTime() - 86400000)}) and (${excluding}::uuid is null or id<>${excluding}::uuid)`;
  let campaignCeiling: number | null = null;
  if (identity.campaignId) {
    const [policy] = await tx<
      { policy: unknown }[]
    >`select policy from growth.campaigns where id=${identity.campaignId} and version=${identity.policyVersion}`;
    const parsed = campaignPolicyDefinitionSchema.safeParse(policy?.policy);
    if (!parsed.success) return "policy_not_authorized";
    campaignCeiling = parsed.data.dailyLimit;
  }
  return assessReservationBudget({
    ...counts,
    campaignUsed: campaignCeiling === null ? null : counts.campaignUsed,
    campaignCeiling,
    accountRamp: account.ramp,
    messages: account.usage.messages,
    recipients: account.usage.recipients,
    messageLimit: account.limits.messages,
    recipientLimits: account.limits.recipients,
    perMessage: account.limits.perMessage,
    messageReserve: account.limits.messageReserve,
    recipientReserve: account.limits.recipientReserve,
    providerIds: account.usage.providerIds,
    outstanding,
    recipientCount: 1,
  });
}

export async function reserveOutreachAttempt(
  db: GrowthDb,
  input: { messageId: string; leaseToken: string; attemptKey: string },
): Promise<Outcome<ReservedOutreach>> {
  if (
    !z
      .strictObject({
        messageId: z.uuid(),
        leaseToken: z.uuid(),
        attemptKey: z
          .string()
          .min(1)
          .max(256)
          .refine((value) => value === value.trim()),
      })
      .safeParse(input).success
  )
    return held("invalid_input");
  return withGrowthTransaction(db, async (tx) => {
    await lockKey(tx, `growth:outreach-attempt:${input.attemptKey}`);
    const identity = await preliminary(tx, input.messageId);
    if (!identity) return held("identity_unknown");
    const [clock] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
    if (!clock) return held("invalid_time");
    const day = londonDayKey(clock.now);
    const locked = await lockedPreparation(tx, identity, input.leaseToken, day);
    if (locked.status === "held") return locked;
    const { preparation, account, now, bounds, window } = locked.value;
    const [existing] = await tx<
      {
        id: string;
        fingerprint: string | null;
        status: string;
        fence: number;
        rfc: string | null;
        leaseUntil: Date | null;
        leaseToken: string | null;
        connectionId: string | null;
        grantEpoch: number | null;
        day: string;
      }[]
    >`select london_day::text as day,id,authority_fingerprint as fingerprint,status,fence,rfc_message_id as rfc,lease_until as "leaseUntil",lease_token as "leaseToken",connection_id as "connectionId",grant_epoch as "grantEpoch" from growth.outreach_reservations where idempotency_key=${input.attemptKey} for update`;
    if (existing) {
      if (
        existing.status !== "reserved" ||
        existing.fingerprint !== preparation.fingerprint ||
        existing.leaseToken !== input.leaseToken ||
        !existing.leaseUntil ||
        existing.leaseUntil <= now ||
        existing.connectionId !== identity.connectionId ||
        existing.grantEpoch !== account.grantEpoch ||
        !existing.rfc
      )
        return held("attempt_conflict");
      if (existing.day !== day) return held("day_changed");
      const [message] = await tx<
        { rfc: string | null }[]
      >`select rfc_message_id as rfc from growth.email_messages where id=${identity.messageId}`;
      if (!message || message.rfc !== existing.rfc)
        return held("rfc_message_id_changed");
      const replayBounds = intersectAuthorityBounds(bounds, {
        validatedAt: now,
        expiresAt: existing.leaseUntil,
        validThrough: null,
      });
      const [gate] = await tx<
        GateResult[]
      >`with ${authorityGate(tx, day, replayBounds, window)}
        select day_ok as "dayOk", interval_ok as "intervalOk", window_ok as "windowOk", 0::int as writes from authority_gate`;
      const failure = gateFailure(gate);
      if (failure) return held(failure);
      return {
        status: "ready",
        value: {
          reservationId: existing.id,
          fence: existing.fence,
          rfcMessageId: existing.rfc,
          preparation,
        },
      };
    }
    const [history] = await tx<
      {
        attempts: number;
        previousStatus: string | null;
        ledgerExists: boolean;
      }[]
    >`select em.attempt_count as attempts,em.outreach_claim_previous_status as "previousStatus",exists(select 1 from growth.outreach_reservations r where r.email_message_id=em.id) as "ledgerExists" from growth.email_messages em where em.id=${identity.messageId}`;
    if (!history || !history.previousStatus)
      return held("claim_provenance_unknown");
    if (
      !history.ledgerExists &&
      (history.previousStatus !== "queued" || history.attempts > 1)
    )
      return held("legacy_attempt_unreconciled");
    const [unresolved] = await tx<
      { found: boolean }[]
    >`select exists(select 1 from growth.outreach_reservations where email_message_id=${identity.messageId} and (connection_id is null or status not in ('rejected','cancelled'))) as found`;
    if (unresolved?.found) return held("attempt_unresolved");
    const budget = await checkBudget(tx, identity, day, account, now, null);
    if (budget !== "ready") return held(budget);
    const parentMessageId = preparation.references.at(-1);
    const rendered = renderGmailMime({
      id: preparation.messageId,
      from: CAMPAIGN_FOUNDER_EMAIL,
      replyTo: CAMPAIGN_FOUNDER_EMAIL,
      to: preparation.recipient,
      subject: preparation.subject,
      html: preparation.html,
      text: preparation.text,
      ...(preparation.gmailThreadId && parentMessageId
        ? {
            thread: {
              gmailThreadId: preparation.gmailThreadId,
              parentMessageId,
              references: preparation.references,
            },
          }
        : {}),
    });
    const [message] = await tx<
      { rfc: string | null }[]
    >`select rfc_message_id as rfc from growth.email_messages where id=${identity.messageId}`;
    if (
      !message ||
      (message.rfc !== null && message.rfc !== rendered.rfcMessageId)
    )
      return held("rfc_message_id_changed");
    const [fence] = await tx<
      { value: number }[]
    >`select coalesce(max(fence),0)::int+1 as value from growth.outreach_reservations where email_message_id=${identity.messageId}`;
    if (!fence) return held("fence_unavailable");
    const reservationId = randomUUID();
    const [gate] = await tx<
      GateResult[]
    >`with ${authorityGate(tx, day, bounds, window)},
      inserted as (
        insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence,reserved_at)
        select ${reservationId},${input.attemptKey},${identity.campaignId},${identity.policyVersion},${identity.membershipId},${identity.messageId},${identity.sequenceId},${account.usage.accountId},${day}::date,${identity.connectionId},${account.grantEpoch},${rendered.rfcMessageId},1,${preparation.fingerprint},${input.leaseToken},at + interval '5 minutes',${fence.value},at
        from authority_gate where day_ok and interval_ok and window_ok returning id
      ), message_write as (
        update growth.email_messages set rfc_message_id=coalesce(rfc_message_id,${rendered.rfcMessageId})
        where id=${identity.messageId} and (rfc_message_id is null or rfc_message_id=${rendered.rfcMessageId}) and exists(select 1 from inserted) returning id
      ), audit_write as (
        insert into growth.audit_log(correlation_id,actor_type,actor_id,action,entity_type,entity_id,metadata)
        select ${reservationId},'system','outreach-dispatch','outreach_reservation.reserved','outreach_reservation',${reservationId},'{}'::jsonb
        from inserted where exists(select 1 from message_write) returning id
      )
      select day_ok as "dayOk",interval_ok as "intervalOk",window_ok as "windowOk", (select count(*)::int from audit_write) as writes from authority_gate`;
    const failure = gateFailure(gate);
    if (failure) return held(failure);
    if (gate?.writes !== 1) throw new Error("reservation_write_failed");
    return {
      status: "ready",
      value: {
        reservationId,
        fence: fence.value,
        rfcMessageId: rendered.rfcMessageId,
        preparation,
      },
    };
  });
}

export async function beginOutreachSubmission(
  db: GrowthDb,
  input: {
    reservationId: string;
    leaseToken: string;
    fence: number;
    fingerprint: string;
  },
): Promise<Outcome<ReservedOutreach>> {
  if (
    !reservationLeaseSchema
      .extend({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/) })
      .safeParse(input).success
  )
    return held("invalid_input");
  return withGrowthTransaction(db, async (tx) => {
    const [initial] = await tx<
      { messageId: string; attemptKey: string; day: string }[]
    >`select email_message_id as "messageId",idempotency_key as "attemptKey",london_day::text as day from growth.outreach_reservations where id=${input.reservationId}`;
    if (!initial) return held("reservation_unknown");
    await lockKey(tx, `growth:outreach-attempt:${initial.attemptKey}`);
    const identity = await preliminary(tx, initial.messageId);
    if (!identity) return held("identity_unknown");
    const locked = await lockedPreparation(
      tx,
      identity,
      input.leaseToken,
      initial.day,
    );
    if (locked.status === "held") return locked;
    const { preparation, account, now, bounds, window } = locked.value;
    const [reservation] = await tx<
      {
        status: string;
        fence: number;
        fingerprint: string | null;
        rfc: string | null;
        leaseToken: string | null;
        leaseUntil: Date | null;
        grantEpoch: number | null;
        connectionId: string | null;
      }[]
    >`select status,fence,authority_fingerprint as fingerprint,rfc_message_id as rfc,lease_token as "leaseToken",lease_until as "leaseUntil",grant_epoch as "grantEpoch",connection_id as "connectionId" from growth.outreach_reservations where id=${input.reservationId} for update`;
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
      !reservation.rfc ||
      reservation.fingerprint !== input.fingerprint ||
      preparation.fingerprint !== input.fingerprint ||
      reservation.grantEpoch !== account.grantEpoch ||
      reservation.connectionId !== identity.connectionId
    )
      return held("authority_changed");
    const [message] = await tx<
      { rfc: string | null }[]
    >`select rfc_message_id as rfc from growth.email_messages where id=${identity.messageId}`;
    if (!message || message.rfc !== reservation.rfc)
      return held("rfc_message_id_changed");
    const budget = await checkBudget(
      tx,
      identity,
      initial.day,
      account,
      now,
      input.reservationId,
    );
    if (budget !== "ready") return held(budget);
    const submissionBounds = intersectAuthorityBounds(bounds, {
      validatedAt: now,
      expiresAt: reservation.leaseUntil,
      validThrough: null,
    });
    const [gate] = await tx<
      GateResult[]
    >`with ${authorityGate(tx, initial.day, submissionBounds, window)},
      updated as (
        update growth.outreach_reservations r set status='submitting',submitted_at=g.at
        from authority_gate g where g.day_ok and g.interval_ok and g.window_ok
          and r.id=${input.reservationId} and r.status='reserved' and r.fence=${input.fence}
          and r.lease_token=${input.leaseToken} and r.connection_id=${identity.connectionId}
          and r.grant_epoch=${account.grantEpoch} and r.authority_fingerprint=${input.fingerprint}
          and r.rfc_message_id=${reservation.rfc} and r.london_day=${initial.day}::date
        returning r.id
      ), audit_write as (
        insert into growth.audit_log(correlation_id,actor_type,actor_id,action,entity_type,entity_id,metadata)
        select ${input.reservationId},'system','outreach-dispatch','outreach_reservation.submitting','outreach_reservation',${input.reservationId},'{}'::jsonb
        from updated returning id
      )
      select day_ok as "dayOk",interval_ok as "intervalOk",window_ok as "windowOk",(select count(*)::int from audit_write) as writes from authority_gate`;
    const failure = gateFailure(gate);
    if (failure) return held(failure);
    if (gate?.writes !== 1) throw new Error("submission_write_failed");
    return {
      status: "ready",
      value: {
        reservationId: input.reservationId,
        fence: input.fence,
        rfcMessageId: reservation.rfc,
        preparation,
      },
    };
  });
}
