import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { exerciseConfirmationCapacity } from "./reservation-capacity-assertions";
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
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status) values (${messageId},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'sending',${randomUUID()},${leaseToken},now()+interval '5 minutes','queued')`;
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
    await admin`update growth.email_messages set outreach_claim_previous_status=null where id=${messageId}`;
    assert.deepEqual(
      await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      }),
      { status: "held", reason: "claim_provenance_unknown" },
    );
    await admin`update growth.email_messages set outreach_claim_previous_status='retry' where id=${messageId}`;
    assert.deepEqual(
      await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      }),
      { status: "held", reason: "legacy_attempt_unreconciled" },
    );
    await admin`update growth.email_messages set outreach_claim_previous_status='queued' where id=${messageId}`;

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
      await admin`update growth.email_messages set rfc_message_id=null where id=${messageId}`;
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
      await admin`update growth.email_messages set rfc_message_id=null where id=${messageId}`;
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
      await admin`update growth.email_messages set rfc_message_id=null where id=${messageId}`;
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
      await admin`update growth.email_messages set rfc_message_id=null where id=${messageId}`;
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
    await admin`update growth.contacts set email=${contactEmail},version=version+1 where id=${contactId}`;
    await admin`update growth.email_messages set outreach_claim_previous_status='retry' where id=${messageId}`;
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
      { status: "held", reason: "attempt_unresolved" },
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
    await admin`update growth.email_messages set outreach_claim_previous_status='queued' where id=${messageId}`;
    await admin`update growth.outreach_account_controls set ramp=25 where connection_id=${id}`;
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,subject_snapshot,html_snapshot,text_snapshot) values (${messageId2},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'sending',${randomUUID()},${leaseToken2},now()+interval '5 minutes','queued','Second','<p>Second</p>','Second')`;
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
        (entry) => entry.status === "held" && entry.reason === "account_limit",
      ),
    );
    await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id in (select id::text from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3}))`;
    await admin`delete from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3})`;
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
    await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id in (select id::text from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3}))`;
    await admin`delete from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3})`;
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
    assert.equal(
      (
        await beginOutreachSubmission(db, {
          ...rejectedLease,
          fingerprint: rejectedAttempt.value.preparation.fingerprint,
        })
      ).status,
      "ready",
    );
    assert.equal(
      (
        await settleOutreachAttempt(db, {
          ...rejectedLease,
          outcome: { kind: "rejected" },
        })
      ).status,
      "ready",
    );
    await admin`update growth.email_messages set outreach_claim_previous_status='retry' where id=${messageId2}`;
    const retried = await reserveOutreachAttempt(db, {
      messageId: messageId2,
      leaseToken: leaseToken2,
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
      leaseToken: leaseToken2,
      fence: retried.value.fence,
    };
    assert.equal(
      (
        await beginOutreachSubmission(db, {
          ...acceptedLease,
          fingerprint: retried.value.preparation.fingerprint,
        })
      ).status,
      "ready",
    );
    const accepted = {
      kind: "accepted" as const,
      providerMessageId: "accepted-provider",
      providerThreadId: "accepted-thread",
    };
    assert.equal(
      (await settleOutreachAttempt(db, { ...acceptedLease, outcome: accepted }))
        .status,
      "ready",
    );
    assert.equal(
      (await settleOutreachAttempt(db, { ...acceptedLease, outcome: accepted }))
        .status,
      "ready",
    );
    assert.deepEqual(
      await settleOutreachAttempt(db, {
        ...acceptedLease,
        outcome: { ...accepted, providerMessageId: "different" },
      }),
      { status: "held", reason: "settlement_conflict" },
    );
    const [acceptedState] =
      await admin`select status,actual_sent_at from growth.outreach_reservations where id=${acceptedLease.reservationId}`;
    assert.equal(acceptedState?.status, "accepted");
    assert.equal(acceptedState?.actual_sent_at, null);
  } finally {
    await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id in (select id::text from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3}))`;
    await admin`delete from growth.outreach_reservations where email_message_id in (${messageId},${messageId2},${messageId3})`;
    await admin`delete from growth.outreach_provider_usage where account_id=${otherAccount}`;
    await admin`delete from growth.integration_connections where id=${otherConnection}`;
    await admin`delete from growth.email_messages where id in (${messageId},${messageId2},${messageId3})`;
    await admin`delete from growth.sequence_enrollments where id=${sequenceId}`;
    await admin`delete from growth.prospects where id=${prospectId}`;
    await admin`delete from growth.contacts where id=${contactId}`;
    await admin`delete from growth.businesses where id=${businessId}`;
  }
}
