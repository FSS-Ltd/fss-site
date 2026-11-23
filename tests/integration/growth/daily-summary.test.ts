import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import {
  publishDailyOutreachSummary,
  readDailyOutreachSummary,
} from "../../../lib/growth/campaigns/daily-summary";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "publishes a private immutable snapshot once per London day",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const [day] = await admin<
      { day: string }[]
    >`select (statement_timestamp() at time zone 'Europe/London')::date::text as day`;
    if (!day) throw new Error("missing day");
    try {
      await admin`delete from growth.daily_outreach_summaries where london_day=${day.day}::date`;
      const [first, second] = await Promise.all([
        publishDailyOutreachSummary(db),
        publishDailyOutreachSummary(db),
      ]);
      assert.deepEqual(second, first);
      assert.deepEqual(await readDailyOutreachSummary(db, day.day), first);
      assert.equal(first.dayStatus, "partial_at_run");
      assert.deepEqual(first.goal, {
        minimum: 100,
        target: 150,
        conditional: true,
      });
      await assert.rejects(
        db`update growth.daily_outreach_summaries set evidence='{}'::jsonb`,
      );
      await assert.rejects(db`delete from growth.daily_outreach_summaries`);
    } finally {
      await admin`delete from growth.daily_outreach_summaries where london_day=${day.day}::date`;
      await db.end();
      await admin.end();
    }
  },
);

test(
  "counts current evidence but keeps a published snapshot fixed after later changes",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const { seedMonthlyReport } = await import("./monthly-report-fixture");
    const fixture = await seedMonthlyReport(admin);
    const eventId = randomUUID();
    let extraId: string | undefined;
    let crossId: string | undefined;
    let unknownId: string | undefined;
    const legacyId = randomUUID();
    const [clock] = await admin<
      { day: string; at: Date }[]
    >`select (statement_timestamp() at time zone 'Europe/London')::date::text as day, statement_timestamp() as at`;
    if (!clock) throw new Error("missing clock");
    try {
      await admin`delete from growth.daily_outreach_summaries where london_day=${clock.day}::date`;
      const receipt = await fixture.createEarlierReceipt(
        fixture.observedAt.getTime() - clock.at.getTime() + 1000,
      );
      extraId = receipt.id;
      const cross = await fixture.createEarlierReceipt(
        fixture.observedAt.getTime() - clock.at.getTime() + 2000,
      );
      crossId = cross.id;
      const unknown = await fixture.createEarlierReceipt(
        fixture.observedAt.getTime() - clock.at.getTime() + 3000,
      );
      unknownId = unknown.id;
      await admin.begin(async (tx) => {
        await tx`alter table growth.outreach_reservations disable trigger protect_outreach_confirmation`;
        await tx`update growth.outreach_reservations set confirmation_receipt=jsonb_set(confirmation_receipt,'{possibleInvocationFrom}',to_jsonb(to_char(date_trunc('milliseconds',submitted_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) where id=${receipt.id}`;
        await tx`alter table growth.outreach_reservations enable trigger protect_outreach_confirmation`;
      });
      await admin`insert into growth.outreach_reservations(id,idempotency_key,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence)
        select ${legacyId},${randomUUID()},email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,${randomUUID()},clock_timestamp()+interval '5 minutes',fence+2 from growth.outreach_reservations where id=${fixture.reservationId}`;
      await admin`update growth.outreach_reservations set status='submitting',submitted_at=${new Date(clock.at.getTime() - 1000)},issued_snapshot=(select issued_snapshot - 'membershipId' - 'campaign' from growth.outreach_reservations where id=${fixture.reservationId}),issued_snapshot_hash=(select issued_snapshot_hash from growth.outreach_reservations where id=${fixture.reservationId}) where id=${legacyId}`;
      await admin.begin(async (tx) => {
        await tx`alter table growth.outreach_reservations disable trigger protect_outreach_reservation_authority`;
        await tx`update growth.outreach_reservations set submitted_at=(((statement_timestamp() at time zone 'Europe/London')::date - 1)::timestamp at time zone 'Europe/London') where id=${cross.id}`;
        await tx`alter table growth.outreach_reservations enable trigger protect_outreach_reservation_authority`;
        await tx`alter table growth.outreach_reservations disable trigger protect_outreach_confirmation`;
        await tx`update growth.outreach_reservations set confirmation_receipt=jsonb_set(confirmation_receipt,'{possibleInvocationFrom}',to_jsonb(to_char(date_trunc('milliseconds',submitted_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) where id=${cross.id}`;
        await tx`alter table growth.outreach_reservations enable trigger protect_outreach_confirmation`;
      });
      await admin`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type) values (${eventId},${fixture.campaignId},1,${fixture.membershipId},'first_message_prepared')`;
      await admin`insert into growth.outreach_jobs(id,campaign_id,policy_version,membership_id,job_type,due_at,idempotency_key,status,last_error_code) values (${randomUUID()},${fixture.campaignId},1,${fixture.membershipId},'first_preparation',clock_timestamp(),${randomUUID()},'held','permission_missing')`;
      const first = await publishDailyOutreachSummary(db);
      assert.equal(first.preparationEvents, 1);
      assert.equal(first.heldJobsAtRead, 1);
      assert.equal(first.heldReasons.permission, 1);
      assert.equal(first.issuedAttempts, 2);
      assert.equal(first.acceptedAtRead, 2);
      assert.equal(first.observedConfirmations, 3);
      assert.equal(first.observedUnknownDay, 1);
      assert.equal(first.observedCrossDay, 1);
      assert.equal(first.confirmedWithinDay, 1);
      await admin`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type) values (${randomUUID()},${fixture.campaignId},1,${fixture.membershipId},'first_message_prepared')`;
      assert.deepEqual(await publishDailyOutreachSummary(db), first);
    } finally {
      await admin`delete from growth.daily_outreach_summaries where london_day=${clock.day}::date`;
      if (extraId)
        await admin`delete from growth.outreach_reservations where id=${extraId}`;
      if (crossId)
        await admin`delete from growth.outreach_reservations where id=${crossId}`;
      if (unknownId)
        await admin`delete from growth.outreach_reservations where id=${unknownId}`;
      await admin`delete from growth.outreach_reservations where id=${legacyId}`;
      await fixture.cleanup();
      await db.end();
      await admin.end();
    }
  },
);
