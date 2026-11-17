import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
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

    await admin`create function growth.test_reject_reservation_audit() returns trigger language plpgsql as $$ begin if new.action = 'outreach_reservation.reserved' then raise exception 'reservation audit failure'; end if; return new; end $$`;
    await admin`create trigger test_reject_reservation_audit before insert on growth.audit_log for each row execute function growth.test_reject_reservation_audit()`;
    try {
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
    assert.equal((await beginOutreachSubmission(db, second)).status, "ready");
    assert.equal((await beginOutreachSubmission(db, second)).status, "held");
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
      { status: "held", reason: "submission_uncertain" },
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
    };
    const reconciled = await reconcileOutreachAttempt(db, {
      reservationId: second.reservationId,
      gmailClient: { ...gmailClient, findByRfcMessageId: async () => metadata },
    });
    assert.equal(reconciled.status, "ready", JSON.stringify(reconciled));
    const [sentEvidence] =
      await admin`select status,actual_sent_at from growth.outreach_reservations where id=${second.reservationId}`;
    assert.equal(sentEvidence?.status, "accepted");
    assert.ok(sentEvidence?.actual_sent_at);
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
      await admin`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at,provider_message_id,provider_thread_id) values (${randomUUID()},${messageId3},${sequenceId},${id},(now() at time zone 'Europe/London')::date,'accepted',${id},1,'<matched@example.test>',1,${"a".repeat(64)},${leaseToken},now()+interval '5 minutes',now(),'0','thread')`;
      await admin`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) values (${randomUUID()},${messageId3},${sequenceId},${id},(now() at time zone 'Europe/London')::date,'uncertain',${id},1,'<uncertain@example.test>',1,${"a".repeat(64)},${leaseToken},now()+interval '5 minutes',now())`;
      const overlap = await reserveOutreachAttempt(db, {
        messageId,
        leaseToken,
        attemptKey: randomUUID(),
      });
      assert.equal(overlap.status, "ready");
      if (overlap.status === "ready")
        await cancelOutreachReservation(db, {
          reservationId: overlap.value.reservationId,
          leaseToken,
          fence: overlap.value.fence,
        });
      await admin`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) values (${randomUUID()},${messageId3},${sequenceId},${id},(now() at time zone 'Europe/London')::date,'uncertain',${id},1,'<uncertain2@example.test>',1,${"a".repeat(64)},${leaseToken},now()+interval '5 minutes',now())`;
      assert.deepEqual(
        await reserveOutreachAttempt(db, {
          messageId: messageId2,
          leaseToken: leaseToken2,
          attemptKey: randomUUID(),
        }),
        { status: "held", reason: "provider_limit" },
      );
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
