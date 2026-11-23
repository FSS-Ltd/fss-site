import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { createGmailClient } from "../../../lib/growth/integrations/gmail/client";
import type postgres from "postgres";
import { submitReservedOutreach } from "../../../lib/growth/campaigns/direct-submission";
import { exerciseConfirmationCapacity } from "./reservation-capacity-assertions";
import { exerciseLegacyConfirmation } from "./gmail-legacy-confirmation";
import { exerciseConfirmationDueFairness } from "./gmail-confirmation-due";
import { withTransitionClock } from "./reservation-clock";
import { createGmailConfirmation } from "../../../lib/growth/campaigns/gmail-confirmation";
import type { GrowthDb } from "../../../lib/growth/db/types";
import {
  reserveOutreachAttempt,
  beginOutreachSubmission,
} from "../../../lib/growth/campaigns/reservation-repository";
import {
  settleOutreachAttempt,
  cancelOutreachReservation,
  reconcileOutreachAttempt,
} from "../../../lib/growth/campaigns/reservation-settlement";

export async function exerciseLegacyReservation(
  admin: GrowthDb,
  db: GrowthDb,
  input: { id: string; email: string },
): Promise<void> {
  const { id, email } = input;
  const businessId = randomUUID(),
    contactId = randomUUID(),
    prospectId = randomUUID(),
    sequenceId = randomUUID(),
    messageId = randomUUID(),
    messageId2 = randomUUID(),
    messageId3 = randomUUID(),
    haltMessage = randomUUID(),
    credentialMessage = randomUUID(),
    failureMessage = randomUUID(),
    waitingMessage = randomUUID(),
    freshMessage = randomUUID(),
    prooflessMessage = randomUUID(),
    largeMessage = randomUUID(),
    expiryMessage = randomUUID(),
    leaseToken = randomUUID(),
    leaseToken2 = randomUUID(),
    otherAccount = randomUUID(),
    otherConnection = randomUUID();
  const contactEmail = `${randomUUID()}@example.test`;
  try {
    await admin`insert into growth.businesses(id,legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values (${businessId},'Reservation test','limited_company','active','Test','Test','https://example.test','GB')`;
    await admin`insert into growth.contacts(id,business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${contactId},${businessId},${contactEmail},'https://example.test',now(),'corporate','consent')`;
    await admin`insert into growth.prospects(id,business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${prospectId},${businessId},${contactId},'ready_for_email_review',0,'test','test',0,0,${email})`;
    await admin`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status) values (${sequenceId},${prospectId},${contactId},'active')`;
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,outreach_guarded_claim) values (${messageId},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'sending',${randomUUID()},${leaseToken},now()+interval '5 minutes','queued',true)`;
    const missing = await reserveOutreachAttempt(db, {
      messageId,
      leaseToken,
      attemptKey: randomUUID(),
    });
    assert.deepEqual(missing, { status: "held", reason: "message_unprepared" });
    await admin`update growth.email_messages set subject_snapshot='Subject',html_snapshot='<p>Body</p>',text_snapshot='Body' where id=${messageId}`;
    assert.deepEqual(
      await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      }),
      { status: "held", reason: "legacy_approval_unbound" },
    );
    await admin`update growth.sequence_enrollments set template_snapshot=${admin.json({ approvedRecipient: contactEmail })} where id=${sequenceId}`;
    assert.deepEqual(
      await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      }),
      { status: "held", reason: "legacy_approval_unbound" },
    );
    await admin`update growth.sequence_enrollments set template_snapshot=${admin.json({ approvedRecipient: contactEmail, effectiveRecipient: { email: contactEmail, contactId, contactVersion: 1, prospectVersion: 1 } })} where id=${sequenceId}`;
    await admin`update growth.email_messages set outreach_claim_previous_status=null where id=${messageId}`;
    assert.deepEqual(
      await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      }),
      { status: "held", reason: "claim_provenance_unknown" },
    );
    await admin`update growth.email_messages set outreach_claim_previous_status='retry',attempt_count=1 where id=${messageId}`;
    await admin`update growth.email_messages set outreach_guarded_claim=false where id=${messageId}`;
    assert.deepEqual(
      await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      }),
      { status: "held", reason: "claim_provenance_unknown" },
    );
    await admin`update growth.email_messages set outreach_guarded_claim=true where id=${messageId}`;
    assert.deepEqual(
      await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      }),
      { status: "held", reason: "legacy_attempt_unreconciled" },
    );
    await admin`update growth.email_messages set outreach_claim_previous_status='queued',attempt_count=0 where id=${messageId}`;

    // Move only synthetic fixture times to the next London midnight, after all checks.
    const [clockFixture] = await admin<
      {
        captured: Date;
        expires: Date;
        windowStart: Date;
        lease: Date;
        midnight: Date;
      }[]
    >`
      select u.captured_at as captured,u.fresh_until as expires,u.window_start as "windowStart",m.lease_expires_at as lease,
        (((clock_timestamp() at time zone 'Europe/London')::date + 1)::timestamp at time zone 'Europe/London') as midnight
      from growth.outreach_provider_usage u cross join growth.email_messages m where u.connection_id=${id} and m.id=${messageId}`;
    assert.ok(clockFixture);
    const [healthFixture] = await admin<
      { id: string; evidence: postgres.JSONValue }[]
    >`select r.id,r.evidence from growth.outreach_account_reviews r join growth.outreach_account_controls c on c.health_review_id=r.id where c.connection_id=${id}`;
    assert.ok(healthFixture);
    const beforeMidnight = new Date(clockFixture.midnight.getTime() - 100);
    await admin`update growth.outreach_account_reviews set evidence=jsonb_set(jsonb_set(jsonb_set(evidence,'{evidence,observedFrom}',to_jsonb(${new Date(beforeMidnight.getTime() - 3600000).toISOString()}::text)),'{evidence,observedUntil}',to_jsonb(${new Date(beforeMidnight.getTime() - 1000).toISOString()}::text)),'{evidence,expiresAt}',to_jsonb(${new Date(clockFixture.midnight.getTime() + 3600000).toISOString()}::text)) where id=${healthFixture.id}`;
    await admin`update growth.outreach_provider_usage set captured_at=${beforeMidnight},fresh_until=${new Date(clockFixture.midnight.getTime() + 60000)},window_start=${new Date(beforeMidnight.getTime() - 86400000)} where connection_id=${id}`;
    await admin`update growth.email_messages set lease_expires_at=${new Date(clockFixture.midnight.getTime() + 60000)} where id=${messageId}`;
    try {
      const crossing = await reserveOutreachAttempt(
        withTransitionClock(db, beforeMidnight, clockFixture.midnight),
        { messageId, leaseToken, attemptKey: randomUUID() },
      );
      assert.deepEqual(crossing, { status: "held", reason: "day_changed" });
      const [unchanged] = await admin<
        { count: number; rfc: string | null }[]
      >`select (select count(*)::int from growth.outreach_reservations where email_message_id=${messageId}) as count,rfc_message_id as rfc from growth.email_messages where id=${messageId}`;
      assert.equal(unchanged?.count, 0);
      assert.equal(unchanged?.rfc, null);
      const nextDay = await reserveOutreachAttempt(
        withTransitionClock(db, clockFixture.midnight, clockFixture.midnight),
        { messageId, leaseToken, attemptKey: randomUUID() },
      );
      assert.ok(nextDay.status === "ready");
      const [nextState] = await admin<
        { day: string; reserved: Date }[]
      >`select london_day::text as day,reserved_at as reserved from growth.outreach_reservations where id=${nextDay.value.reservationId}`;
      assert.equal(
        nextState?.reserved.getTime(),
        clockFixture.midnight.getTime(),
      );
      assert.notEqual(
        nextState?.day,
        (
          await admin<
            { day: string }[]
          >`select (${beforeMidnight}::timestamptz at time zone 'Europe/London')::date::text as day`
        )[0]?.day,
      );
      await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id=${nextDay.value.reservationId}`;
      await admin`delete from growth.outreach_reservations where id=${nextDay.value.reservationId}`;
      await admin`update growth.email_messages set rfc_message_id=null,attempt_count=0 where id=${messageId}`;
      const attemptKey = randomUUID();
      const reserved = await reserveOutreachAttempt(
        withTransitionClock(db, beforeMidnight, beforeMidnight),
        { messageId, leaseToken, attemptKey },
      );
      assert.equal(reserved.status, "ready");
      assert.ok(reserved.status === "ready");
      const replay = await reserveOutreachAttempt(
        withTransitionClock(db, beforeMidnight, beforeMidnight, false),
        { messageId, leaseToken, attemptKey },
      );
      assert.deepEqual(replay, reserved);
      await admin`update growth.email_messages set outreach_guarded_claim=false where id=${messageId}`;
      assert.deepEqual(
        await reserveOutreachAttempt(
          withTransitionClock(
            db,
            beforeMidnight,
            beforeMidnight,
            false,
            3,
            false,
          ),
          { messageId, leaseToken, attemptKey },
        ),
        { status: "held", reason: "claim_history_unproven" },
      );
      assert.deepEqual(
        await beginOutreachSubmission(
          withTransitionClock(
            db,
            beforeMidnight,
            beforeMidnight,
            false,
            3,
            false,
          ),
          {
            reservationId: reserved.value.reservationId,
            leaseToken,
            fence: reserved.value.fence,
            fingerprint: reserved.value.preparation.fingerprint,
          },
        ),
        { status: "held", reason: "claim_history_unproven" },
      );
      await admin`update growth.email_messages set outreach_guarded_claim=true where id=${messageId}`;
      const [replayState] = await admin<
        { attempts: number }[]
      >`select attempt_count as attempts from growth.email_messages where id=${messageId}`;
      assert.equal(replayState?.attempts, 1);
      const expiredReplay = await reserveOutreachAttempt(
        withTransitionClock(db, beforeMidnight, clockFixture.midnight, false),
        { messageId, leaseToken, attemptKey },
      );
      assert.deepEqual(expiredReplay, {
        status: "held",
        reason: "day_changed",
      });
      const begin = {
        reservationId: reserved.value.reservationId,
        leaseToken,
        fence: reserved.value.fence,
        fingerprint: reserved.value.preparation.fingerprint,
      };
      assert.deepEqual(
        await beginOutreachSubmission(
          withTransitionClock(db, beforeMidnight, clockFixture.midnight),
          begin,
        ),
        { status: "held", reason: "day_changed" },
      );
      const [state] = await admin<
        {
          status: string;
          submitted: Date | null;
          reserved: Date;
          audits: number;
        }[]
      >`select status,submitted_at as submitted,reserved_at as reserved,(select count(*)::int from growth.audit_log where entity_id=${begin.reservationId}) as audits from growth.outreach_reservations where id=${begin.reservationId}`;
      assert.equal(state?.status, "reserved");
      assert.equal(state?.submitted, null);
      assert.equal(state?.reserved.getTime(), beforeMidnight.getTime());
      assert.equal(state?.audits, 1);
      assert.equal(
        (
          await cancelOutreachReservation(db, {
            reservationId: begin.reservationId,
            leaseToken,
            fence: begin.fence,
          })
        ).status,
        "ready",
      );
      await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id=${begin.reservationId}`;
      await admin`delete from growth.outreach_reservations where id=${begin.reservationId}`;
      await admin`update growth.email_messages set rfc_message_id=null,attempt_count=0 where id=${messageId}`;
    } finally {
      await admin`update growth.outreach_account_reviews set evidence=${admin.json(healthFixture.evidence)} where id=${healthFixture.id}`;
      await admin`update growth.outreach_provider_usage set captured_at=${clockFixture.captured},fresh_until=${clockFixture.expires},window_start=${clockFixture.windowStart} where connection_id=${id}`;
      await admin`update growth.email_messages set lease_expires_at=${clockFixture.lease} where id=${messageId}`;
    }

    const [boundaryClock] = await admin<
      { now: Date }[]
    >`select clock_timestamp() as now`;
    assert.ok(boundaryClock);
    const t0 = boundaryClock.now;
    const t1 = new Date(t0.getTime() + 1000);
    const [limitsFixture] = await admin<
      { id: string; evidence: postgres.JSONValue }[]
    >`select r.id,r.evidence from growth.outreach_account_reviews r join growth.outreach_account_controls c on c.limits_review_id=r.id where c.connection_id=${id}`;
    assert.ok(limitsFixture);
    for (const bound of ["message", "limits", "health", "usage"] as const) {
      try {
        if (bound === "message")
          await admin`update growth.email_messages set lease_expires_at=${t1} where id=${messageId}`;
        if (bound === "usage")
          await admin`update growth.outreach_provider_usage set fresh_until=${t1} where connection_id=${id}`;
        if (bound === "limits")
          await admin`update growth.outreach_account_reviews set evidence=jsonb_set(jsonb_set(evidence,'{evidence,expiresAt}',to_jsonb(${t1.toISOString()}::text)),'{evidence,visibility,expiresAt}',to_jsonb(${t1.toISOString()}::text)) where id=${limitsFixture.id}`;
        if (bound === "health")
          await admin`update growth.outreach_account_reviews set evidence=jsonb_set(evidence,'{evidence,expiresAt}',to_jsonb(${t1.toISOString()}::text)) where id=${healthFixture.id}`;
        assert.deepEqual(
          await reserveOutreachAttempt(withTransitionClock(db, t0, t1), {
            messageId,
            leaseToken,
            attemptKey: randomUUID(),
          }),
          { status: "held", reason: "authority_expired" },
          bound,
        );
        const [writes] = await admin<
          { count: number; rfc: string | null }[]
        >`select (select count(*)::int from growth.outreach_reservations where email_message_id=${messageId}) as count,rfc_message_id as rfc from growth.email_messages where id=${messageId}`;
        assert.equal(writes?.count, 0, bound);
        assert.equal(writes?.rfc, null, bound);
      } finally {
        await admin`update growth.email_messages set lease_expires_at=${clockFixture.lease} where id=${messageId}`;
        await admin`update growth.outreach_provider_usage set fresh_until=${clockFixture.expires} where connection_id=${id}`;
        await admin`update growth.outreach_account_reviews set evidence=${admin.json(limitsFixture.evidence)} where id=${limitsFixture.id}`;
        await admin`update growth.outreach_account_reviews set evidence=${admin.json(healthFixture.evidence)} where id=${healthFixture.id}`;
      }
    }

    const [usageFixture] = await admin<
      { ids: postgres.JSONValue }[]
    >`select provider_message_ids as ids from growth.outreach_provider_usage where connection_id=${id}`;
    assert.ok(usageFixture);
    const capture = new Date(t1.getTime() - 300000);
    await admin`update growth.outreach_provider_usage set captured_at=${capture},window_start=${new Date(capture.getTime() - 86400000)},provider_message_ids=(select jsonb_agg(jsonb_set(jsonb_set(value,'{observedUpperBound}',to_jsonb(${new Date(capture.getTime() - 1000).toISOString()}::text)),'{internalDate}',to_jsonb(${new Date(capture.getTime() - 2000).toISOString()}::text))) from jsonb_array_elements(provider_message_ids)) where connection_id=${id}`;
    try {
      const expired = await reserveOutreachAttempt(
        withTransitionClock(db, t0, new Date(t1.getTime() + 1)),
        { messageId, leaseToken, attemptKey: randomUUID() },
      );
      assert.deepEqual(expired, {
        status: "held",
        reason: "authority_expired",
      });
      const valid = await reserveOutreachAttempt(
        withTransitionClock(db, t0, t1),
        { messageId, leaseToken, attemptKey: randomUUID() },
      );
      assert.ok(valid.status === "ready");
      await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id=${valid.value.reservationId}`;
      await admin`delete from growth.outreach_reservations where id=${valid.value.reservationId}`;
      await admin`update growth.email_messages set rfc_message_id=null,attempt_count=0 where id=${messageId}`;
    } finally {
      await admin`update growth.outreach_provider_usage set captured_at=${clockFixture.captured},fresh_until=${clockFixture.expires},window_start=${clockFixture.windowStart},provider_message_ids=${admin.json(usageFixture.ids)} where connection_id=${id}`;
    }

    assert.deepEqual(
      await reserveOutreachAttempt(
        withTransitionClock(db, t0, new Date(t0.getTime() - 1)),
        { messageId, leaseToken, attemptKey: randomUUID() },
      ),
      { status: "held", reason: "authority_expired" },
    );

    const fiveMinutes = new Date(t0.getTime() + 300000);
    await admin`update growth.outreach_provider_usage set captured_at=${t0},fresh_until=${new Date(t0.getTime() + 600000)},window_start=${new Date(t0.getTime() - 86400000)} where connection_id=${id}`;
    await admin`update growth.email_messages set lease_expires_at=${new Date(t0.getTime() + 600000)} where id=${messageId}`;
    try {
      const key = randomUUID();
      const reserve = await reserveOutreachAttempt(
        withTransitionClock(db, t0, t0),
        { messageId, leaseToken, attemptKey: key },
      );
      assert.ok(reserve.status === "ready");
      const expected = { status: "held", reason: "authority_expired" };
      assert.deepEqual(
        await reserveOutreachAttempt(
          withTransitionClock(db, t0, fiveMinutes, false),
          { messageId, leaseToken, attemptKey: key },
        ),
        expected,
      );
      assert.deepEqual(
        await beginOutreachSubmission(
          withTransitionClock(db, t0, fiveMinutes),
          {
            reservationId: reserve.value.reservationId,
            leaseToken,
            fence: reserve.value.fence,
            fingerprint: reserve.value.preparation.fingerprint,
          },
        ),
        expected,
      );
      const [state] = await admin<
        { status: string; submitted: Date | null; audits: number }[]
      >`select status,submitted_at as submitted,(select count(*)::int from growth.audit_log where entity_id=${reserve.value.reservationId}) as audits from growth.outreach_reservations where id=${reserve.value.reservationId}`;
      assert.equal(state?.status, "reserved");
      assert.equal(state?.submitted, null);
      assert.equal(state?.audits, 1);
      await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id=${reserve.value.reservationId}`;
      await admin`delete from growth.outreach_reservations where id=${reserve.value.reservationId}`;
      await admin`update growth.email_messages set rfc_message_id=null,attempt_count=0 where id=${messageId}`;
    } finally {
      await admin`update growth.outreach_provider_usage set captured_at=${clockFixture.captured},fresh_until=${clockFixture.expires},window_start=${clockFixture.windowStart} where connection_id=${id}`;
      await admin`update growth.email_messages set lease_expires_at=${clockFixture.lease} where id=${messageId}`;
    }

    await admin`create function growth.test_reject_reservation_audit() returns trigger language plpgsql as $$ begin if new.action = 'outreach_reservation.reserved' then raise exception 'reservation audit failure'; end if; return new; end $$`;
    await admin`create trigger test_reject_reservation_audit before insert on growth.audit_log for each row execute function growth.test_reject_reservation_audit()`;
    try {
      await admin`update growth.email_messages set lease_expires_at=${t1} where id=${messageId}`;
      assert.deepEqual(
        await reserveOutreachAttempt(withTransitionClock(db, t0, t1), {
          messageId,
          leaseToken,
          attemptKey: randomUUID(),
        }),
        { status: "held", reason: "authority_expired" },
      );
      await admin`update growth.email_messages set lease_expires_at=${clockFixture.lease} where id=${messageId}`;
      await assert.rejects(
        reserveOutreachAttempt(db, {
          messageId,
          leaseToken,
          attemptKey: randomUUID(),
        }),
        /reservation audit failure/,
      );
      const [rolledBack] =
        await admin`select count(*)::int as count from growth.outreach_reservations where email_message_id=${messageId}`;
      assert.equal(rolledBack?.count, 0);
      const [rolledBackMessage] =
        await admin`select rfc_message_id from growth.email_messages where id=${messageId}`;
      assert.equal(rolledBackMessage?.rfc_message_id, null);
    } finally {
      await admin`drop trigger test_reject_reservation_audit on growth.audit_log`;
      await admin`drop function growth.test_reject_reservation_audit()`;
    }
    const attemptKeys = [randomUUID(), randomUUID()];
    const attempts = await Promise.all(
      attemptKeys.map((attemptKey) =>
        reserveOutreachAttempt(db, { messageId, leaseToken, attemptKey }),
      ),
    );

    const ready = attempts.find((result) => result.status === "ready");
    assert.equal(
      attempts.filter((result) => result.status === "ready").length,
      1,
    );
    assert.ok(ready && ready.status === "ready");
    const winningKey =
      attemptKeys[attempts.findIndex((result) => result.status === "ready")]!;
    const replay = await reserveOutreachAttempt(db, {
      messageId,
      leaseToken,
      attemptKey: winningKey,
    });
    assert.ok(replay.status === "ready");
    assert.equal(replay.value.reservationId, ready.value.reservationId);
    await admin`update growth.email_messages set rfc_message_id='<changed@example.test>' where id=${messageId}`;
    assert.deepEqual(
      await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: winningKey,
      }),
      { status: "held", reason: "rfc_message_id_changed" },
    );
    await admin`update growth.email_messages set rfc_message_id=${ready.value.rfcMessageId} where id=${messageId}`;
    await assert.rejects(
      db`update growth.outreach_reservations set authority_fingerprint=${"b".repeat(64)} where id=${ready.value.reservationId}`,
      /reservation authority is immutable/,
    );
    await assert.rejects(
      db`update growth.outreach_reservations set status='accepted' where id=${ready.value.reservationId}`,
      /invalid reservation transition/,
    );
    const begin = {
      reservationId: ready.value.reservationId,
      leaseToken,
      fence: ready.value.fence,
      fingerprint: ready.value.preparation.fingerprint,
    };
    await admin.begin(async (writer) => {
      await writer`lock table operations.contacts in row exclusive mode`;
      assert.deepEqual(await beginOutreachSubmission(db, begin), {
        status: "held",
        reason: "terminal_fence_busy",
      });
    });
    await admin`update growth.contacts set version=version+1 where id=${contactId}`;
    assert.deepEqual(await beginOutreachSubmission(db, begin), {
      status: "held",
      reason: "legacy_approval_unbound",
    });
    await admin`update growth.contacts set version=1 where id=${contactId}`;
    await admin`update growth.prospects set version=version+1 where id=${prospectId}`;
    assert.deepEqual(await beginOutreachSubmission(db, begin), {
      status: "held",
      reason: "legacy_approval_unbound",
    });
    await admin`update growth.prospects set version=1 where id=${prospectId}`;
    await admin`update growth.outreach_account_controls set state='paused' where connection_id=${id}`;
    assert.deepEqual(await beginOutreachSubmission(db, begin), {
      status: "held",
      reason: "account_not_active",
    });
    await admin`update growth.outreach_account_controls set state='active' where connection_id=${id}`;
    await admin`insert into growth.suppressions(normalised_email,business_id,reason,source,created_by) select normalised_email,${businessId},'opt_out','manual','test' from growth.contacts where id=${contactId}`;
    assert.deepEqual(await beginOutreachSubmission(db, begin), {
      status: "held",
      reason: "outreach_excluded",
    });
    await admin`delete from growth.suppressions where business_id=${businessId}`;
    const clientId = randomUUID();
    try {
      await admin`insert into operations.organisations(id,legal_name,display_name,trading_status,timezone,created_by,review_reference) values (${clientId},'Reservation test','Reservation test','active','Europe/London',${"a".repeat(64)},'synthetic test')`;
      assert.deepEqual(await beginOutreachSubmission(db, begin), {
        status: "held",
        reason: "outreach_excluded",
      });
    } finally {
      await admin`delete from operations.audit_events where organisation_id=${clientId}`;
      await admin`delete from operations.organisations where id=${clientId}`;
    }

    await admin`update growth.email_messages set lease_expires_at=now()-interval '1 second' where id=${messageId}`;
    assert.deepEqual(await beginOutreachSubmission(db, begin), {
      status: "held",
      reason: "lease_invalid",
    });
    await admin`update growth.email_messages set lease_expires_at=now()+interval '5 minutes' where id=${messageId}`;
    assert.deepEqual(
      await beginOutreachSubmission(db, { ...begin, fence: begin.fence + 1 }),
      { status: "held", reason: "reservation_lease_invalid" },
    );
    const priorDayId = randomUUID();
    await admin`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence) select ${priorDayId},${randomUUID()},campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day-1,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence from growth.outreach_reservations where id=${begin.reservationId}`;
    assert.deepEqual(
      await beginOutreachSubmission(db, {
        ...begin,
        reservationId: priorDayId,
      }),
      { status: "held", reason: "day_changed" },
    );
    await admin`delete from growth.outreach_reservations where id=${priorDayId}`;
    await admin`update growth.email_messages set text_snapshot='Changed' where id=${messageId}`;
    assert.deepEqual(
      await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: winningKey,
      }),
      { status: "held", reason: "attempt_conflict" },
    );
    assert.deepEqual(await beginOutreachSubmission(db, begin), {
      status: "held",
      reason: "authority_changed",
    });
    await admin`update growth.email_messages set text_snapshot='Body' where id=${messageId}`;
    await admin`update growth.contacts set email=${`${randomUUID()}@example.test`},version=version+1 where id=${contactId}`;
    assert.deepEqual(await beginOutreachSubmission(db, begin), {
      status: "held",
      reason: "legacy_approval_unbound",
    });
    assert.equal(
      (
        await cancelOutreachReservation(db, {
          reservationId: begin.reservationId,
          leaseToken,
          fence: begin.fence,
        })
      ).status,
      "ready",
    );
    await admin`update growth.contacts set email=${contactEmail},version=1 where id=${contactId}`;
    await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id=${begin.reservationId}`;
    await admin`delete from growth.outreach_reservations where id=${begin.reservationId}`;
    await admin`update growth.email_messages set outreach_claim_previous_status='queued',attempt_count=0 where id=${messageId}`;
    const next = await reserveOutreachAttempt(db, {
      messageId,
      leaseToken,
      attemptKey: randomUUID(),
    });
    assert.ok(next.status === "ready");
    const second = {
      reservationId: next.value.reservationId,
      leaseToken,
      fence: next.value.fence,
      fingerprint: next.value.preparation.fingerprint,
    };
    await admin`create function growth.test_reject_submitting_audit() returns trigger language plpgsql as $$ begin if new.action = 'outreach_reservation.submitting' then raise exception 'submitting audit failure'; end if; return new; end $$`;
    await admin`create trigger test_reject_submitting_audit before insert on growth.audit_log for each row execute function growth.test_reject_submitting_audit()`;
    try {
      await assert.rejects(
        beginOutreachSubmission(db, second),
        /submitting audit failure/,
      );
      const [rolledBack] = await admin<
        { status: string; submitted: Date | null }[]
      >`select status,submitted_at as submitted from growth.outreach_reservations where id=${second.reservationId}`;
      assert.equal(rolledBack?.status, "reserved");
      assert.equal(rolledBack?.submitted, null);
    } finally {
      await admin`drop trigger test_reject_submitting_audit on growth.audit_log`;
      await admin`drop function growth.test_reject_submitting_audit()`;
    }
    const begins = await Promise.all([
      beginOutreachSubmission(db, second),
      beginOutreachSubmission(db, second),
    ]);
    assert.equal(begins.filter((entry) => entry.status === "ready").length, 1);
    const legacyConfirmation = createGmailConfirmation(db, async () => {
      throw new Error("proofless legacy called provider");
    });
    assert.deepEqual(await legacyConfirmation(second.reservationId), {
      status: "held",
      reason: "direct_submission_unproven",
    });
    const [issued] = await admin<
      { snapshot: { raw?: string } | null; hash: string | null }[]
    >`
      select issued_snapshot as snapshot,issued_snapshot_hash as hash
      from growth.outreach_reservations where id=${second.reservationId}`;
    assert.ok(issued?.snapshot?.raw);
    assert.match(issued.hash ?? "", /^[a-f0-9]{64}$/);
    const [auditCount] = await admin<
      { count: number }[]
    >`select count(*)::int as count from growth.audit_log where entity_id=${second.reservationId} and action='outreach_reservation.submitting'`;
    assert.equal(auditCount?.count, 1);
    assert.equal(
      (
        await settleOutreachAttempt(db, {
          reservationId: second.reservationId,
          leaseToken,
          fence: second.fence,
          outcome: { kind: "uncertain" },
        })
      ).status,
      "ready",
    );
    assert.equal(
      (
        await settleOutreachAttempt(db, {
          reservationId: second.reservationId,
          leaseToken,
          fence: second.fence,
          outcome: { kind: "uncertain" },
        })
      ).status,
      "ready",
    );
    assert.equal(
      (
        await cancelOutreachReservation(db, {
          reservationId: second.reservationId,
          leaseToken,
          fence: second.fence,
        })
      ).status,
      "held",
    );
    assert.deepEqual(
      await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      }),
      { status: "held", reason: "account_submission_unresolved" },
    );
    const gmailClient = {
      getProfile: async () => ({ emailAddress: email, historyId: "1" }),
      findByRfcMessageId: async () => null,
    };
    assert.deepEqual(
      await reconcileOutreachAttempt(db, {
        reservationId: second.reservationId,
        gmailClient,
      }),
      { status: "held", reason: "actual_send_time_unproven" },
    );
    const [providerClock] = await admin<
      { now: Date }[]
    >`select clock_timestamp() as now`;
    assert.ok(providerClock);
    const metadata = {
      messageId: "test-provider-message",
      gmailThreadId: "test-thread",
      historyId: "1",
      labelIds: ["SENT"],
      receivedAt: providerClock.now.toISOString(),
      from: email,
      subject: "Subject",
      rfcMessageId: next.value.rfcMessageId,
      autoSubmitted: null,
      precedence: null,
      returnPath: null,
      autoResponseSuppress: null,
      to: null,
      cc: null,
      bcc: null,
      inReplyTo: null,
      references: null,
    };
    const reconciled = await reconcileOutreachAttempt(db, {
      reservationId: second.reservationId,
      gmailClient: { ...gmailClient, findByRfcMessageId: async () => metadata },
    });
    assert.deepEqual(reconciled, {
      status: "held",
      reason: "actual_send_time_unproven",
    });
    const [sentEvidence] =
      await admin`select status,actual_sent_at from growth.outreach_reservations where id=${second.reservationId}`;
    assert.equal(sentEvidence?.status, "uncertain");
    assert.equal(sentEvidence?.actual_sent_at, null);
    await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id in (select id::text from growth.outreach_reservations where email_message_id=${messageId})`;
    await admin`delete from growth.outreach_reservations where email_message_id=${messageId}`;
    await admin`update growth.email_messages set outreach_claim_previous_status='queued',attempt_count=0 where id=${messageId}`;
    await admin`update growth.outreach_account_controls set ramp=25 where connection_id=${id}`;
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,outreach_guarded_claim,subject_snapshot,html_snapshot,text_snapshot) values (${messageId2},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'sending',${randomUUID()},${leaseToken2},now()+interval '5 minutes','queued',true,'Second','<p>Second</p>','Second')`;
    await admin`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) select gen_random_uuid()::text,${messageId},${sequenceId},${id},(now() at time zone 'Europe/London')::date,'rejected',${id},1,'<synthetic@example.test>',1,${"a".repeat(64)},${leaseToken},now()+interval '5 minutes',now() from generate_series(1,24)`;
    const lastSlot = await Promise.all([
      reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      }),
      reserveOutreachAttempt(db, {
        messageId: messageId2,
        leaseToken: leaseToken2,
        attemptKey: randomUUID(),
      }),
    ]);
    assert.equal(
      lastSlot.filter((entry) => entry.status === "ready").length,
      1,
    );
    assert.ok(
      lastSlot.some(
        (entry) =>
          entry.status === "held" && entry.reason === "attempt_unresolved",
      ),
    );
    await admin`delete from growth.audit_log where action='outreach_account.provider_halt' and correlation_id in (select id::text from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3},${haltMessage},${credentialMessage},${failureMessage},${waitingMessage},${freshMessage},${prooflessMessage},${largeMessage},${expiryMessage}))`;
    await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id in (select id::text from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3},${haltMessage},${credentialMessage},${failureMessage},${waitingMessage},${freshMessage},${prooflessMessage},${largeMessage},${expiryMessage}))`;
    await admin`delete from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3},${haltMessage},${credentialMessage},${failureMessage},${waitingMessage},${freshMessage},${prooflessMessage},${largeMessage},${expiryMessage})`;
    await admin`update growth.email_messages set attempt_count=0 where id in (${messageId},${messageId2})`;
    await admin`update growth.outreach_account_controls set ramp=150 where connection_id=${id}`;
    await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject) values (${otherConnection},'gmail',${`${randomUUID()}@example.test`},'connected','other-subject')`;
    await admin`insert into growth.outreach_provider_usage(account_id,complete,health,connection_id) values (${otherAccount},false,'unknown',${otherConnection})`;
    await assert.rejects(
      db`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until) values (${randomUUID()},${messageId},${sequenceId},${otherAccount},(now() at time zone 'Europe/London')::date,${id},1,'<cross@example.test>',1,${"a".repeat(64)},${leaseToken},now()+interval '5 minutes')`,
      /outreach_reservation_usage_connection_fk/,
    );
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key) values (${messageId3},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'failed',${randomUUID()})`;
    await admin`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) select gen_random_uuid()::text,${messageId3},${sequenceId},${otherAccount},(now() at time zone 'Europe/London')::date,'rejected',${otherConnection},1,'<other@example.test>',1,${"a".repeat(64)},${leaseToken},now()+interval '5 minutes',now() from generate_series(1,149)`;
    const globalSlot = await Promise.all([
      reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      }),
      reserveOutreachAttempt(db, {
        messageId: messageId2,
        leaseToken: leaseToken2,
        attemptKey: randomUUID(),
      }),
    ]);
    assert.equal(
      globalSlot.filter((entry) => entry.status === "ready").length,
      1,
    );
    assert.ok(
      globalSlot.some(
        (entry) => entry.status === "held" && entry.reason === "global_limit",
      ),
    );
    await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id in (select id::text from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3},${haltMessage},${credentialMessage},${failureMessage},${waitingMessage},${freshMessage},${prooflessMessage},${largeMessage},${expiryMessage}))`;
    await admin`delete from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3},${haltMessage},${credentialMessage},${failureMessage},${waitingMessage},${freshMessage},${prooflessMessage},${largeMessage},${expiryMessage})`;
    await admin`update growth.email_messages set attempt_count=0 where id in (${messageId},${messageId2})`;
    await admin`update growth.outreach_account_controls set ramp=50 where connection_id=${id}`;
    const [limits] = await admin<
      { reviewId: string; evidence: postgres.JSONValue }[]
    >`select c.limits_review_id as "reviewId",r.evidence from growth.outreach_account_controls c join growth.outreach_account_reviews r on r.id=c.limits_review_id where c.connection_id=${id}`;
    assert.ok(limits);
    try {
      await admin`update growth.outreach_account_reviews set evidence=jsonb_set(evidence,'{evidence,messages}','62'::jsonb) where id=${limits.reviewId}`;
      await admin`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at,provider_message_id,provider_thread_id) values (${randomUUID()},${messageId3},${sequenceId},${id},(now() at time zone 'Europe/London')::date,'accepted',${id},1,'<matched@example.test>',1,${"a".repeat(64)},${leaseToken},now()+interval '5 minutes',now()-interval '2 days','0','thread')`;
      await admin`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) values (${randomUUID()},${messageId3},${sequenceId},${id},(now() at time zone 'Europe/London')::date,'uncertain',${id},1,'<uncertain@example.test>',1,${"a".repeat(64)},${leaseToken},now()+interval '5 minutes',now())`;
      const overlap = await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      });
      assert.deepEqual(overlap, { status: "held", reason: "provider_limit" });
      await admin`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) values (${randomUUID()},${messageId3},${sequenceId},${id},(now() at time zone 'Europe/London')::date,'uncertain',${id},1,'<uncertain2@example.test>',1,${"a".repeat(64)},${leaseToken},now()+interval '5 minutes',now())`;
      assert.deepEqual(
        await reserveOutreachAttempt(db, {
          messageId: messageId2,
          leaseToken: leaseToken2,
          attemptKey: randomUUID(),
        }),
        { status: "held", reason: "provider_limit" },
      );
      await admin`delete from growth.outreach_reservations where email_message_id=${messageId3}`;
      await admin`update growth.outreach_account_reviews set evidence=jsonb_set(evidence,'{evidence,messages}','61'::jsonb) where id=${limits.reviewId}`;
      await exerciseConfirmationCapacity(admin, db, {
        connectionId: id,
        sequenceId,
        existingMessageId: messageId3,
        candidateMessageId: messageId2,
        leaseToken: leaseToken2,
      });
    } finally {
      await admin`update growth.outreach_account_reviews set evidence=${admin.json(limits.evidence)} where id=${limits.reviewId}`;
    }
    const rejectedAttempt = await reserveOutreachAttempt(db, {
      messageId: messageId2,
      leaseToken: leaseToken2,
      attemptKey: randomUUID(),
    });
    assert.ok(rejectedAttempt.status === "ready");
    const rejectedLease = {
      reservationId: rejectedAttempt.value.reservationId,
      leaseToken: leaseToken2,
      fence: rejectedAttempt.value.fence,
    };
    const binding = {
      connectionId: id,
      googleSubject: "test-subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    };
    assert.deepEqual(
      await submitReservedOutreach(db, {
        ...rejectedLease,
        fingerprint: rejectedAttempt.value.preparation.fingerprint,
        bound: {
          binding,
          client: {
            sendMessageOnce: async () => ({
              status: "not_invoked",
              reason: "guard_rejected",
            }),
          },
        },
      }),
      { status: "not_invoked", reason: "guard_rejected" },
    );
    const [safe] = await admin<
      { evidence: { kind: string } | null }[]
    >`select direct_noninvocation_evidence as evidence from growth.outreach_reservations where id=${rejectedLease.reservationId}`;
    assert.equal(safe?.evidence?.kind, "gmail_send_not_invoked_v1");
    await assert.rejects(
      admin`update growth.outreach_reservations set direct_noninvocation_evidence=null where id=${rejectedLease.reservationId}`,
      /immutable/,
    );
    const nextLease = randomUUID();
    await admin`update growth.email_messages set attempt_count=2,lease_token=${nextLease},outreach_claim_previous_status='sending' where id=${messageId2}`;
    assert.deepEqual(
      await reserveOutreachAttempt(db, {
        messageId: messageId2,
        leaseToken: nextLease,
        attemptKey: randomUUID(),
      }),
      { status: "held", reason: "claim_history_unproven" },
    );
    await admin`update growth.email_messages set attempt_count=1,lease_token=${nextLease} where id=${messageId2}`;
    await admin`update growth.email_messages set outreach_claim_previous_status='retry' where id=${messageId2}`;
    const retried = await reserveOutreachAttempt(db, {
      messageId: messageId2,
      leaseToken: nextLease,
      attemptKey: randomUUID(),
    });
    assert.ok(retried.status === "ready");
    assert.notEqual(
      retried.value.reservationId,
      rejectedAttempt.value.reservationId,
    );
    const [attemptCount] =
      await admin`select count(*)::int as count from growth.outreach_reservations where email_message_id=${messageId2} and status in ('rejected','reserved')`;
    assert.equal(attemptCount?.count, 2);
    const acceptedLease = {
      reservationId: retried.value.reservationId,
      leaseToken: nextLease,
      fence: retried.value.fence,
    };
    let calls = 0;
    const direct = await submitReservedOutreach(db, {
      ...acceptedLease,
      fingerprint: retried.value.preparation.fingerprint,
      bound: {
        binding,
        client: {
          sendMessageOnce: async (payload, gate) => {
            calls++;
            assert.equal(gate(), true);
            const [stored] = await admin<
              { raw: string }[]
            >`select issued_snapshot->>'raw' as raw from growth.outreach_reservations where id=${acceptedLease.reservationId}`;
            assert.equal(payload.raw, stored?.raw);
            return {
              status: "accepted",
              result: {
                messageId: "accepted-provider",
                gmailThreadId: "accepted-thread",
              },
            };
          },
        },
      },
    });
    assert.deepEqual(direct, { status: "accepted" });
    assert.equal(calls, 1);
    const [proof] = await admin<
      {
        evidence: { providerMessageId: string; rawSha256: string };
        hash: string;
      }[]
    >`select direct_submission_evidence as evidence,issued_snapshot_hash as hash from growth.outreach_reservations where id=${acceptedLease.reservationId}`;
    assert.equal(proof?.evidence.providerMessageId, "accepted-provider");
    assert.equal(proof?.evidence.rawSha256, proof?.hash);
    const [acceptedState] =
      await admin`select status,actual_sent_at from growth.outreach_reservations where id=${acceptedLease.reservationId}`;
    assert.equal(acceptedState?.status, "accepted");
    assert.equal(acceptedState?.actual_sent_at, null);
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,outreach_guarded_claim,subject_snapshot,html_snapshot,text_snapshot) values (${haltMessage},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'sending',${randomUUID()},${leaseToken},now()+interval '5 minutes','queued',true,'Halt','<p>Halt</p>','Halt')`;
    const haltReservation = await reserveOutreachAttempt(db, {
      messageId: haltMessage,
      leaseToken,
      attemptKey: randomUUID(),
    });
    assert.ok(haltReservation.status === "ready");
    const [beforeHalt] = await admin<
      { version: number }[]
    >`select version from growth.outreach_account_controls where connection_id=${id}`;
    assert.ok(beforeHalt);
    const halted = await submitReservedOutreach(db, {
      reservationId: haltReservation.value.reservationId,
      leaseToken,
      fence: haltReservation.value.fence,
      fingerprint: haltReservation.value.preparation.fingerprint,
      bound: {
        binding,
        client: {
          sendMessageOnce: async (_payload, gate) => {
            assert.equal(gate(), true);
            return {
              status: "invoked_unknown",
              errorCode: "AUTHENTICATION_FAILED",
              providerStatus: 401,
            };
          },
        },
      },
    });
    assert.deepEqual(halted, {
      status: "uncertain",
      reason: "transport_unknown",
    });
    const [haltedState] = await admin<
      { state: string; status: string; evidence: unknown }[]
    >`select c.state,r.status,r.direct_noninvocation_evidence as evidence from growth.outreach_account_controls c join growth.outreach_reservations r on r.connection_id=c.connection_id where r.id=${haltReservation.value.reservationId}`;
    assert.deepEqual(haltedState, {
      state: "halted",
      status: "uncertain",
      evidence: null,
    });
    const [haltAudit] = await admin<
      { actor: string; reason: string }[]
    >`select actor_type as actor,metadata->>'reasonCode' as reason from growth.audit_log where correlation_id=${haltReservation.value.reservationId} and action='outreach_account.provider_halt'`;
    assert.deepEqual(haltAudit, { actor: "system", reason: "provider_401" });
    await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id=${haltReservation.value.reservationId}`;
    await admin`delete from growth.outreach_reservations where id=${haltReservation.value.reservationId}`;
    await admin`update growth.outreach_account_controls set state='active',version=${beforeHalt.version} where connection_id=${id}`;
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,outreach_guarded_claim,subject_snapshot,html_snapshot,text_snapshot) values (${credentialMessage},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'sending',${randomUUID()},${leaseToken},now()+interval '5 minutes','queued',true,'Credential','<p>Credential</p>','Credential')`;
    const credentialReservation = await reserveOutreachAttempt(db, {
      messageId: credentialMessage,
      leaseToken,
      attemptKey: randomUUID(),
    });
    assert.ok(credentialReservation.status === "ready");
    const credentialResult = await submitReservedOutreach(db, {
      reservationId: credentialReservation.value.reservationId,
      leaseToken,
      fence: credentialReservation.value.fence,
      fingerprint: credentialReservation.value.preparation.fingerprint,
      bound: {
        binding,
        client: {
          sendMessageOnce: async () => ({
            status: "not_invoked",
            reason: "credential_preparation_failed",
            errorCode: "AUTHENTICATION_FAILED",
          }),
        },
      },
    });
    assert.deepEqual(credentialResult, {
      status: "not_invoked",
      reason: "credential_preparation_failed",
    });
    const [credentialState] = await admin<
      { state: string; status: string; evidence: { reason: string } | null }[]
    >`select c.state,r.status,r.direct_noninvocation_evidence as evidence from growth.outreach_account_controls c join growth.outreach_reservations r on r.connection_id=c.connection_id where r.id=${credentialReservation.value.reservationId}`;
    assert.equal(credentialState?.state, "halted");
    assert.equal(credentialState?.status, "rejected");
    assert.equal(
      credentialState?.evidence?.reason,
      "credential_preparation_failed",
    );
    await admin`update growth.outreach_account_controls set state='active',version=${beforeHalt.version} where connection_id=${id}`;
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,outreach_guarded_claim,subject_snapshot,html_snapshot,text_snapshot) values (${failureMessage},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'sending',${randomUUID()},${leaseToken},now()+interval '5 minutes','queued',true,'Failure','<p>Failure</p>','Failure')`;
    const failureReservation = await reserveOutreachAttempt(db, {
      messageId: failureMessage,
      leaseToken,
      attemptKey: randomUUID(),
    });
    assert.ok(failureReservation.status === "ready");
    for (const candidate of [waitingMessage, freshMessage]) {
      await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,outreach_guarded_claim,subject_snapshot,html_snapshot,text_snapshot) values (${candidate},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'sending',${randomUUID()},${leaseToken},now()+interval '5 minutes','queued',true,'Waiting','<p>Waiting</p>','Waiting')`;
    }
    const waiting = await reserveOutreachAttempt(db, {
      messageId: waitingMessage,
      leaseToken,
      attemptKey: randomUUID(),
    });
    assert.ok(waiting.status === "ready");
    await admin`create function growth.test_reject_provider_halt() returns trigger language plpgsql as $$ begin if new.action='outreach_account.provider_halt' then raise exception 'synthetic halt failure'; end if; return new; end $$`;
    await admin`create trigger test_reject_provider_halt before insert on growth.audit_log for each row execute function growth.test_reject_provider_halt()`;
    try {
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const inFlight = submitReservedOutreach(db, {
        reservationId: failureReservation.value.reservationId,
        leaseToken,
        fence: failureReservation.value.fence,
        fingerprint: failureReservation.value.preparation.fingerprint,
        bound: {
          binding,
          client: {
            sendMessageOnce: async () => {
              started.resolve();
              await release.promise;
              return {
                status: "invoked_unknown",
                errorCode: "AUTHENTICATION_FAILED",
                providerStatus: 401,
              };
            },
          },
        },
      });
      await started.promise;
      let concurrentCalls = 0;
      try {
        assert.deepEqual(
          await submitReservedOutreach(db, {
            reservationId: waiting.value.reservationId,
            leaseToken,
            fence: waiting.value.fence,
            fingerprint: waiting.value.preparation.fingerprint,
            bound: {
              binding,
              client: {
                sendMessageOnce: async () => {
                  concurrentCalls++;
                  return { status: "not_invoked", reason: "guard_rejected" };
                },
              },
            },
          }),
          { status: "held", reason: "account_submission_unresolved" },
        );
        assert.equal(concurrentCalls, 0);
      } finally {
        release.resolve();
      }
      const failedHalt = await inFlight;
      assert.deepEqual(failedHalt, {
        status: "uncertain",
        reason: "persistence_failed",
      });
      const [failedState] = await admin<
        { state: string; status: string; evidence: unknown }[]
      >`select c.state,r.status,r.direct_noninvocation_evidence as evidence from growth.outreach_account_controls c join growth.outreach_reservations r on r.connection_id=c.connection_id where r.id=${failureReservation.value.reservationId}`;
      assert.deepEqual(failedState, {
        state: "active",
        status: "submitting",
        evidence: null,
      });
      let calls = 0;
      const waitingInput = {
        reservationId: waiting.value.reservationId,
        leaseToken,
        fence: waiting.value.fence,
        fingerprint: waiting.value.preparation.fingerprint,
        bound: {
          binding,
          client: {
            sendMessageOnce: async () => {
              calls++;
              return {
                status: "not_invoked" as const,
                reason: "guard_rejected" as const,
              };
            },
          },
        },
      };
      const freshInput = {
        messageId: freshMessage,
        leaseToken,
        attemptKey: randomUUID(),
      };
      assert.deepEqual(await reserveOutreachAttempt(db, freshInput), {
        status: "held",
        reason: "account_submission_unresolved",
      });
      assert.deepEqual(await submitReservedOutreach(db, waitingInput), {
        status: "held",
        reason: "account_submission_unresolved",
      });
      assert.equal(calls, 0);
      assert.equal(
        (
          await settleOutreachAttempt(db, {
            reservationId: failureReservation.value.reservationId,
            leaseToken,
            fence: failureReservation.value.fence,
            outcome: { kind: "rejected" },
          })
        ).status,
        "ready",
      );
      assert.deepEqual(await reserveOutreachAttempt(db, freshInput), {
        status: "held",
        reason: "account_submission_unresolved",
      });
      assert.deepEqual(await submitReservedOutreach(db, waitingInput), {
        status: "held",
        reason: "account_submission_unresolved",
      });
      assert.equal(calls, 0);
      // Synthetic teardown removes this intentionally unresolved fixture; no production recovery is implied.
      await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id=${failureReservation.value.reservationId}`;
      await admin`delete from growth.outreach_reservations where id=${failureReservation.value.reservationId}`;
      assert.deepEqual(await submitReservedOutreach(db, waitingInput), {
        status: "not_invoked",
        reason: "guard_rejected",
      });
      assert.equal(calls, 1);
      const fresh = await reserveOutreachAttempt(db, freshInput);
      assert.ok(fresh.status === "ready");
      await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,outreach_guarded_claim,subject_snapshot,html_snapshot,text_snapshot) values (${prooflessMessage},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'sending',${randomUUID()},${leaseToken},now()+interval '5 minutes','queued',true,'Proofless','<p>Proofless</p>','Proofless')`;
      const proofless = await reserveOutreachAttempt(db, {
        messageId: prooflessMessage,
        leaseToken,
        attemptKey: randomUUID(),
      });
      assert.ok(proofless.status === "ready");
      assert.equal(
        (
          await beginOutreachSubmission(db, {
            reservationId: proofless.value.reservationId,
            leaseToken,
            fence: proofless.value.fence,
            fingerprint: proofless.value.preparation.fingerprint,
          })
        ).status,
        "ready",
      );
      assert.equal(
        (
          await settleOutreachAttempt(db, {
            reservationId: proofless.value.reservationId,
            leaseToken,
            fence: proofless.value.fence,
            outcome: {
              kind: "accepted",
              providerMessageId: "generic-message",
              providerThreadId: "generic-thread",
            },
          })
        ).status,
        "ready",
      );
      assert.deepEqual(
        await submitReservedOutreach(db, {
          reservationId: fresh.value.reservationId,
          leaseToken,
          fence: fresh.value.fence,
          fingerprint: fresh.value.preparation.fingerprint,
          bound: {
            binding,
            client: {
              sendMessageOnce: async () => {
                throw new Error("must not send");
              },
            },
          },
        }),
        { status: "held", reason: "account_submission_unresolved" },
      );
      await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id=${proofless.value.reservationId}`;
      await admin`delete from growth.outreach_reservations where id=${proofless.value.reservationId}`;
    } finally {
      await admin`drop trigger test_reject_provider_halt on growth.audit_log`;
      await admin`drop function growth.test_reject_provider_halt()`;
    }
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,outreach_guarded_claim,subject_snapshot,html_snapshot,text_snapshot) values (${expiryMessage},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'sending',${randomUUID()},${leaseToken},now()+interval '5 minutes','queued',true,'Expiry','<p>Expiry</p>','Expiry')`;
    const expiry = await reserveOutreachAttempt(db, {
      messageId: expiryMessage,
      leaseToken,
      attemptKey: randomUUID(),
    });
    assert.ok(expiry.status === "ready");
    let postCount = 0;
    const liveClient = createGmailClient(
      {
        clientId: "test-client",
        clientSecret: "test-secret",
        refreshToken: "test-token",
      },
      {
        fetch: async (url) => {
          if (String(url).endsWith("/token")) {
            mock.timers.setTime(Date.now() + 2 * 86_400_000);
            return Response.json({
              access_token: "test-access",
              expires_in: 3600,
              token_type: "Bearer",
            });
          }
          postCount++;
          return Response.json({ id: "unexpected", threadId: "unexpected" });
        },
      },
    );
    mock.timers.enable({ apis: ["Date"], now: Date.now() });
    try {
      assert.deepEqual(
        await submitReservedOutreach(db, {
          reservationId: expiry.value.reservationId,
          leaseToken,
          fence: expiry.value.fence,
          fingerprint: expiry.value.preparation.fingerprint,
          bound: { binding, client: liveClient },
        }),
        { status: "not_invoked", reason: "guard_rejected" },
      );
    } finally {
      mock.timers.reset();
    }
    assert.equal(postCount, 0);
    const [expiryState] = await admin<
      { status: string; reason: string }[]
    >`select status,direct_noninvocation_evidence->>'reason' as reason from growth.outreach_reservations where id=${expiry.value.reservationId}`;
    assert.deepEqual(expiryState, {
      status: "rejected",
      reason: "guard_rejected",
    });
    const largeBody = "a".repeat(1_048_576);
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,outreach_guarded_claim,subject_snapshot,html_snapshot,text_snapshot) values (${largeMessage},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'sending',${randomUUID()},${leaseToken},now()+interval '5 minutes','queued',true,'Large',${largeBody},'Large')`;
    const large = await reserveOutreachAttempt(db, {
      messageId: largeMessage,
      leaseToken,
      attemptKey: randomUUID(),
    });
    assert.ok(large.status === "ready");
    assert.deepEqual(
      await submitReservedOutreach(db, {
        reservationId: large.value.reservationId,
        leaseToken,
        fence: large.value.fence,
        fingerprint: large.value.preparation.fingerprint,
        bound: {
          binding,
          client: {
            sendMessageOnce: async () => {
              throw new Error("oversized message must not be sent");
            },
          },
        },
      }),
      { status: "held", reason: "issued_payload_too_large" },
    );
    const [largeState] = await admin<
      { status: string; snapshot: unknown }[]
    >`select status,issued_snapshot as snapshot from growth.outreach_reservations where id=${large.value.reservationId}`;
    assert.deepEqual(largeState, { status: "reserved", snapshot: null });
    await exerciseConfirmationDueFairness(
      admin,
      db,
      acceptedLease.reservationId,
      id,
    );
    await exerciseLegacyConfirmation(admin, db, {
      reservationId: acceptedLease.reservationId,
      sequenceId,
      messageId: messageId2,
      contactEmail,
      email,
      binding,
      rfcMessageId: retried.value.rfcMessageId,
    });
  } finally {
    await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id in (select id::text from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3},${haltMessage},${credentialMessage},${failureMessage},${waitingMessage},${freshMessage},${prooflessMessage},${largeMessage},${expiryMessage}))`;
    await admin`delete from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3},${haltMessage},${credentialMessage},${failureMessage},${waitingMessage},${freshMessage},${prooflessMessage},${largeMessage},${expiryMessage})`;
    await admin`delete from growth.outreach_provider_usage where account_id=${otherAccount}`;
    await admin`delete from growth.integration_connections where id=${otherConnection}`;
    await admin`delete from growth.email_messages where sequence_enrollment_id=${sequenceId} and step_number in (1,3)`;
    await admin`delete from growth.email_messages where id in (${messageId},${messageId2},${messageId3},${haltMessage},${credentialMessage},${failureMessage},${waitingMessage},${freshMessage},${prooflessMessage},${largeMessage},${expiryMessage})`;
    await admin`delete from growth.sequence_enrollments where id=${sequenceId}`;
    await admin`delete from growth.prospects where id=${prospectId}`;
    await admin`delete from growth.contacts where id=${contactId}`;
    await admin`delete from growth.businesses where id=${businessId}`;
  }
}
