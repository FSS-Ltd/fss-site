import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { appendCampaignEventAndOutbox } from "../../../lib/growth/campaigns/events";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";
import { buildCampaignReport } from "../../../lib/growth/campaigns/report";
import { loadReportEvidence } from "../../../lib/growth/campaigns/report-evidence";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import { seedMonthlyReport } from "./monthly-report-fixture";

const url = process.env.DIRECT_DATABASE_URL;
const email = "j.ntagengwa@faithfulsoftware.dev";
const founder = {
  email,
  actorId: createHash("sha256").update(email).digest("hex"),
};

test(
  "reviews exact meeting and proposal sources once and projects observed outcomes",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 4,
      connection: { options: "-c role=growth_app" },
    });
    const fixture = await seedMonthlyReport(admin);
    const other = await seedMonthlyReport(admin, "other@example.test");
    const wrongActivityId = randomUUID(),
      followupId = randomUUID();
    const meetingId = randomUUID(),
      engagementId = randomUUID(),
      stageId = randomUUID();
    const [member] = await admin<
      {
        prospectId: string;
        prospectVersion: number;
        contactVersion: number;
        sequenceId: string;
      }[]
    >`
    select m.prospect_id as "prospectId",p.version as "prospectVersion",c.version as "contactVersion",m.sequence_id as "sequenceId"
    from growth.campaign_memberships m join growth.prospects p on p.id=m.prospect_id join growth.contacts c on c.id=p.primary_contact_id where m.id=${fixture.membershipId}`;
    if (!member) throw new Error("missing fixture member");
    try {
      await admin`insert into growth.crm_activities(id,prospect_id,activity_type,body,actor_id) select ${wrongActivityId},prospect_id,'meeting','other synthetic',${founder.actorId} from growth.campaign_memberships where id=${other.membershipId}`;
      await admin`insert into growth.outreach_jobs(id,campaign_id,policy_version,membership_id,job_type,due_at,idempotency_key,status) values (${followupId},${fixture.campaignId},1,${fixture.membershipId},'follow_up',clock_timestamp()+interval '1 day',${randomUUID()},'pending')`;
      await admin`insert into growth.crm_activities(id,prospect_id,activity_type,body,actor_id) values (${meetingId},${member.prospectId},'meeting','synthetic',${founder.actorId})`;
      await admin`insert into growth.delivery_engagements(id,prospect_id,name) values (${engagementId},${member.prospectId},'synthetic')`;
      await admin`insert into growth.commercial_stage_events(id,engagement_id,dimension,from_state,to_state,actor_type,actor_id,correlation_id,occurred_at) values (${stageId},${engagementId},'commercial','qualified','proposal','founder',${founder.actorId},'fixture','2026-02-01T12:00:00.000123Z'::timestamptz)`;
      const base = {
        type: "record_outcome" as const,
        requestId: randomUUID(),
        membershipId: fixture.membershipId,
        expectedPolicyVersion: 1,
        expectedProspectVersion: member.prospectVersion,
        expectedContactVersion: member.contactVersion,
      };
      const meeting = {
        ...base,
        outcome: {
          kind: "meeting" as const,
          crmActivityId: meetingId,
          occurredAt: new Date("2026-01-31T10:59:30Z"),
          qualified: true as const,
        },
      };
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            ...meeting,
            outcome: {
              ...meeting.outcome,
              occurredAt: new Date("2030-01-01T00:00:00Z"),
            },
          },
          founder,
          "fixture",
        ),
        /outcome_evidence_unavailable/,
      );
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            ...meeting,
            requestId: randomUUID(),
            outcome: { ...meeting.outcome, crmActivityId: wrongActivityId },
          },
          founder,
          "fixture",
        ),
        /outcome_evidence_unavailable/,
      );
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            ...meeting,
            requestId: randomUUID(),
            expectedProspectVersion: member.prospectVersion + 1,
          },
          founder,
          "fixture",
        ),
        /outcome_context_changed/,
      );
      await assert.rejects(
        executeCampaignCommand(
          db,
          { ...meeting, requestId: randomUUID() },
          { ...founder, actorId: "a".repeat(64) },
          "fixture",
        ),
        /founder_authorization_required/,
      );
      const [first, replay] = await Promise.all([
        executeCampaignCommand(db, meeting, founder, "fixture"),
        executeCampaignCommand(db, meeting, founder, "fixture"),
      ]);
      assert.deepEqual([first.alreadyExisted, replay.alreadyExisted].sort(), [
        false,
        true,
      ]);
      await assert.rejects(
        executeCampaignCommand(
          db,
          { ...meeting, requestId: randomUUID() },
          founder,
          "fixture",
        ),
        /outcome_evidence_attributed/,
      );
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            ...meeting,
            outcome: {
              ...meeting.outcome,
              occurredAt: new Date("2026-01-31T10:59:31Z"),
            },
          },
          founder,
          "fixture",
        ),
        /request_conflict/,
      );
      await assert.rejects(
        db`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type,request_id,request_hash,actor_id,result_id,review_outcome_kind,review_outcome_at,review_meeting_activity_id)
        select ${randomUUID()},campaign_id,policy_version,membership_id,event_type,${randomUUID()},request_hash,actor_id,result_id,review_outcome_kind,review_outcome_at,review_meeting_activity_id from growth.outreach_events where request_id=${meeting.requestId}`,
        (error: unknown) =>
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505",
      );
      const [jobs] = await admin<{ followup: string; report: string }[]>`select
      (select status from growth.outreach_jobs where id=${followupId}) as followup,
      (select status from growth.outreach_jobs where id=${fixture.jobId}) as report`;
      assert.equal(jobs?.followup, "cancelled");
      assert.equal(jobs?.report, "leased");
      const inboundId = randomUUID(),
        replyRequestId = randomUUID();
      await withGrowthTransaction(db, async (tx) => {
        await tx`select now()`;
        await tx`select pg_sleep(0.01)`;
        await tx`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,received_at)
          select ${inboundId},sequence_enrollment_id,prospect_id,contact_id,channel,'inbound',0,'received',${randomUUID()},clock_timestamp() from growth.email_messages where sequence_enrollment_id=${member.sequenceId} and direction='outbound' limit 1`;
        await appendCampaignEventAndOutbox(tx, {
          campaignId: fixture.campaignId,
          version: 1,
          membershipId: fixture.membershipId,
          resultId: inboundId,
          requestId: replyRequestId,
          requestHash: "a".repeat(64),
          type: "record_reply",
          founder,
          correlationId: "fixture",
          replyReview: { inboundMessageId: inboundId, kind: "positive" },
        });
      });
      const [replyTime] = await admin<
        { valid: boolean }[]
      >`select e.occurred_at>=em.received_at as valid from growth.outreach_events e join growth.email_messages em on em.id=e.review_inbound_message_id where e.request_id=${replyRequestId}`;
      assert.equal(replyTime?.valid, true);
      const proposal = {
        ...base,
        requestId: randomUUID(),
        outcome: {
          kind: "proposal" as const,
          engagementId,
          stageEventId: stageId,
        },
      };
      await executeCampaignCommand(db, proposal, founder, "fixture");
      const [sequence] = await admin<
        { status: string }[]
      >`select status from growth.sequence_enrollments where id=${member.sequenceId}`;
      assert.equal(sequence?.status, "stopped_started_talks");
      const evidence = await withGrowthTransaction(db, (tx) =>
        loadReportEvidence(
          tx,
          fixture.campaignId,
          new Date("2026-03-01T12:00:00Z"),
          fixture.reservationId,
        ),
      );
      assert.deepEqual(
        evidence.members[0]?.outcomes.map((o) => o.kind).sort(),
        ["meeting", "proposal"],
      );
      assert.equal(evidence.members[0]?.meetingObservation, "unknown");
      const report = buildCampaignReport({
        anchor: {
          basis: "gmail_fss_sent_observed",
          observedAt: fixture.observedAt,
        },
        cutoff: new Date("2026-03-01T12:00:00Z"),
        evidenceAsOf: evidence.readAt,
        members: evidence.members,
      });
      assert.equal(report.groups[0]?.qualifiedMeetings, 1);
      assert.equal(report.groups[0]?.meetingUnknown, 1);
    } finally {
      await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where campaign_id=${fixture.campaignId})`;
      await admin`delete from growth.outreach_events where campaign_id=${fixture.campaignId}`;
      await admin`delete from growth.commercial_stage_events where id=${stageId}`;
      await admin`delete from growth.delivery_engagements where id=${engagementId}`;
      await admin`delete from growth.crm_activities where id=${meetingId}`;
      await admin`delete from growth.crm_activities where id=${wrongActivityId}`;
      await other.cleanup();
      await fixture.cleanup();
      await db.end();
      await admin.end();
    }
  },
);
