import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { publishMonthlyReport } from "../../../lib/growth/campaigns/monthly-report";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "scheduled report rejects forged leases and unanchored legacy jobs under the Growth role",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const campaignId = randomUUID(),
      jobId = randomUUID(),
      anchorReservationId = randomUUID();
    try {
      await admin`insert into growth.campaigns(id,version,request_id,name,policy) values (${campaignId},1,${randomUUID()},'synthetic report',${admin.json({})})`;
      await admin`insert into growth.outreach_jobs(id,campaign_id,policy_version,job_type,due_at,idempotency_key,status,lease_owner,lease_until,lease_revision) values (${jobId},${campaignId},1,'monthly_report',clock_timestamp()-interval '1 day',${randomUUID()},'leased','real-worker',clock_timestamp()+interval '1 hour',1)`;
      const fence = {
        jobId,
        leaseOwner: "real-worker",
        leaseRevision: "1",
        anchorRevision: 1,
        anchorReservationId,
      };
      assert.deepEqual(
        await publishMonthlyReport(db, { ...fence, leaseOwner: "forged" }),
        { status: "held", reason: "job_lease_invalid" },
      );
      assert.deepEqual(await publishMonthlyReport(db, fence), {
        status: "held",
        reason: "job_lease_invalid",
      });
      const [count] = await admin<
        { count: number }[]
      >`select count(*)::int as count from growth.experiment_reviews where report_job_id=${jobId}`;
      assert.equal(count?.count, 0);
    } finally {
      await admin`delete from growth.outreach_jobs where id=${jobId}`;
      await admin`delete from growth.campaigns where id=${campaignId}`;
      await db.end();
      await admin.end();
    }
  },
);

test(
  "publishes once with a real lease and immutable system provenance",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const { seedMonthlyReport } = await import("./monthly-report-fixture");
    let fixture: Awaited<ReturnType<typeof seedMonthlyReport>> | undefined;
    try {
      fixture = await seedMonthlyReport(admin);
      const preAnchorReply = await fixture.insertReviewedReply(
        new Date("2026-01-31T10:59:30Z"),
        new Date("2026-02-01T12:00:00Z"),
      );
      const lateReview = await fixture.insertReviewedReply(
        new Date("2026-02-02T12:00:00Z"),
        new Date("2026-03-01T12:00:00Z"),
      );
      const fence = {
        jobId: fixture.jobId,
        leaseOwner: "report-worker",
        leaseRevision: "1",
        anchorRevision: 1,
        anchorReservationId: fixture.reservationId,
      };
      const [a, b] = await Promise.all([
        publishMonthlyReport(db, fence),
        publishMonthlyReport(db, fence),
      ]);
      assert.equal(a.status, "ready");
      assert.equal(b.status, "ready");
      if (a.status !== "ready" || b.status !== "ready")
        throw new Error("publication held");
      assert.equal(a.value.reportId, b.value.reportId);
      assert.deepEqual([a.value.replay, b.value.replay].sort(), [false, true]);
      assert.deepEqual(
        await publishMonthlyReport(db, { ...fence, leaseRevision: "2" }),
        { status: "held", reason: "job_lease_invalid" },
      );
      const [stored] = await admin<
        {
          reviewedBy: string | null;
          reviewedAt: Date | null;
          generation: string;
          evidence: {
            sourceAvailabilityAtCutoff: string;
            report: {
              winner: string | null;
              groups: Array<{
                knownPositiveReplies: number;
                preAnchorPositiveReplies: number;
                missingReplies: number;
              }>;
            };
            lateReviewedPositives: Array<{ replyId: string }>;
            sources: { replyIds: string[] };
          };
        }[]
      >`select reviewed_by as "reviewedBy",reviewed_at as "reviewedAt",generation_kind as generation,evidence from growth.experiment_reviews where id=${a.value.reportId}`;
      assert.equal(stored?.reviewedBy, null);
      assert.equal(stored?.reviewedAt, null);
      assert.equal(stored?.generation, "scheduled_report");
      assert.equal(stored?.evidence.sourceAvailabilityAtCutoff, "unknown");
      assert.equal(stored?.evidence.report.winner, null);
      assert.equal(stored?.evidence.report.groups[0]?.knownPositiveReplies, 1);
      assert.equal(
        stored?.evidence.report.groups[0]?.preAnchorPositiveReplies,
        1,
      );
      assert.equal(stored?.evidence.report.groups[0]?.missingReplies, 1);
      assert.deepEqual(
        stored?.evidence.lateReviewedPositives.map((reply) => reply.replyId),
        [lateReview],
      );
      assert.deepEqual(
        new Set(stored?.evidence.sources.replyIds),
        new Set([preAnchorReply, lateReview]),
      );
      await assert.rejects(
        admin`update growth.experiment_reviews set evidence='{}' where id=${a.value.reportId}`,
        /immutable/,
      );
      await assert.rejects(
        db`delete from growth.experiment_reviews where id=${a.value.reportId}`,
      );
      // An earlier receipt for this same membership is not its frozen first
      // confirmation. The correction must invalidate the old lease and hold.
      const earlier = await fixture.createEarlierReceipt();
      const { withGrowthTransaction } =
        await import("../../../lib/growth/db/client");
      const { lockGmailRouting } =
        await import("../../../lib/growth/sequences/gmail-thread-association");
      const { reviseCampaignReportJob } =
        await import("../../../lib/growth/campaigns/gmail-confirmation-campaign");
      const campaignId = fixture.campaignId;
      await withGrowthTransaction(db, async (tx) => {
        await lockGmailRouting(tx);
        await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${campaignId}`},0))`;
        await reviseCampaignReportJob(tx, {
          campaignId,
          policyVersion: 1,
          reservationId: earlier.id,
        });
      });
      assert.deepEqual(await publishMonthlyReport(db, fence), {
        status: "held",
        reason: "job_lease_invalid",
      });
      const [corrected] = await admin<
        { status: string; anchorRevision: number }[]
      >`select status,anchor_revision as "anchorRevision" from growth.outreach_jobs where id=${fixture.jobId}`;
      assert.equal(corrected?.status, "held");
      assert.equal(corrected?.anchorRevision, 2);
      await admin`update growth.outreach_jobs set status='leased',lease_owner='new-worker',lease_until=clock_timestamp()+interval '1 hour',lease_revision=lease_revision+1 where id=${fixture.jobId}`;
      const [reclaimed] = await admin<
        { revision: string }[]
      >`select lease_revision::text as revision from growth.outreach_jobs where id=${fixture.jobId}`;
      assert.ok(reclaimed);
      assert.deepEqual(
        await publishMonthlyReport(db, {
          ...fence,
          leaseOwner: "new-worker",
          leaseRevision: reclaimed.revision,
          anchorRevision: 2,
          anchorReservationId: earlier.id,
        }),
        { status: "held", reason: "report_evidence_unknown" },
      );
      const [unchanged] = await admin<
        { count: number }[]
      >`select count(*)::int as count from growth.experiment_reviews where report_job_id=${fixture.jobId}`;
      assert.equal(unchanged?.count, 1);
    } finally {
      if (fixture) await fixture.cleanup();
      await db.end();
      await admin.end();
    }
  },
);

test(
  "earlier anchor correction fences a racing publisher",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 3,
      connection: { options: "-c role=growth_app" },
    });
    const { seedMonthlyReport } = await import("./monthly-report-fixture");
    const { withGrowthTransaction } =
      await import("../../../lib/growth/db/client");
    const { lockGmailRouting } =
      await import("../../../lib/growth/sequences/gmail-thread-association");
    const { reviseCampaignReportJob } =
      await import("../../../lib/growth/campaigns/gmail-confirmation-campaign");
    let fixture: Awaited<ReturnType<typeof seedMonthlyReport>> | undefined;
    try {
      fixture = await seedMonthlyReport(admin);
      const earlier = await fixture.createEarlierReceipt();
      const campaignId = fixture.campaignId,
        jobId = fixture.jobId;
      const fence = {
        jobId,
        leaseOwner: "report-worker",
        leaseRevision: "1",
        anchorRevision: 1,
        anchorReservationId: fixture.reservationId,
      };
      const [result] = await Promise.all([
        publishMonthlyReport(db, fence),
        withGrowthTransaction(db, async (tx) => {
          await lockGmailRouting(tx);
          await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${campaignId}`},0))`;
          await reviseCampaignReportJob(tx, {
            campaignId,
            policyVersion: 1,
            reservationId: earlier.id,
          });
        }),
      ]);
      assert.ok(
        result.status === "ready" ||
          (result.status === "held" && result.reason === "job_lease_invalid"),
      );
      const [job] = await admin<
        { status: string; anchor: string; revision: number }[]
      >`select status,anchor_reservation_id as anchor,anchor_revision as revision from growth.outreach_jobs where id=${jobId}`;
      assert.deepEqual(job, {
        status: "held",
        anchor: earlier.id,
        revision: 2,
      });
      const [snapshots] = await admin<
        { count: number }[]
      >`select count(*)::int as count from growth.experiment_reviews where report_job_id=${jobId}`;
      assert.equal(snapshots?.count, result.status === "ready" ? 1 : 0);
      assert.deepEqual(await publishMonthlyReport(db, fence), {
        status: "held",
        reason: "job_lease_invalid",
      });
    } finally {
      if (fixture) await fixture.cleanup();
      await db.end();
      await admin.end();
    }
  },
);

test(
  "rejects another receipt for the same membership at the same millisecond",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const { seedMonthlyReport } = await import("./monthly-report-fixture");
    let fixture: Awaited<ReturnType<typeof seedMonthlyReport>> | undefined;
    try {
      fixture = await seedMonthlyReport(admin);
      const other = await fixture.createEarlierReceipt(0);
      await admin`update growth.outreach_jobs set anchor_reservation_id=${other.id},anchor_revision=2,lease_revision=2 where id=${fixture.jobId}`;
      const result = await publishMonthlyReport(db, {
        jobId: fixture.jobId,
        leaseOwner: "report-worker",
        leaseRevision: "2",
        anchorRevision: 2,
        anchorReservationId: other.id,
      });
      assert.deepEqual(result, {
        status: "held",
        reason: "report_evidence_unknown",
      });
      const [rows] = await admin<
        { count: number }[]
      >`select count(*)::int as count from growth.experiment_reviews where report_job_id=${fixture.jobId}`;
      assert.equal(rows?.count, 0);
    } finally {
      if (fixture) await fixture.cleanup();
      await db.end();
      await admin.end();
    }
  },
);

test(
  "publishes a generation-visible Gmail winner only with classified replies and continuous coverage",
  { skip: !url },
  async () => {
    if (!url) return;
    const target = new URL(url);
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
      target.pathname !== "/fss_growth_test"
    )
      throw new Error("synthetic local database required");
    const admin = postgres(url, { max: 1 }),
      db = postgres(url, {
        max: 3,
        connection: { options: "-c role=growth_app" },
      });
    const { seedComparableReport } =
      await import("./report-comparison-fixture");
    const { withGrowthTransaction } =
      await import("../../../lib/growth/db/client");
    const { loadReportEvidence } =
      await import("../../../lib/growth/campaigns/report-evidence");
    const { buildCampaignReport } =
      await import("../../../lib/growth/campaigns/report");
    let fixture: Awaited<ReturnType<typeof seedComparableReport>> | undefined;
    try {
      fixture = await seedComparableReport(admin);
      const cutoff = new Date("2026-02-28T11:00:00Z");
      const getEvidence = () =>
        withGrowthTransaction(db, (tx) =>
          loadReportEvidence(tx, fixture!.campaignId, cutoff),
        );
      const clean = await getEvidence();
      assert.equal(clean.observedCompleteAtRead, 60);
      assert.equal(clean.lateReviewedPositives.length, 20);
      const [firstB] = fixture.ids.filter((item) => item.variant === "b");
      assert.ok(firstB);
      const inbound = randomUUID(),
        providerId = `unreviewed-${randomUUID()}`;
      await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,provider_message_id,provider_thread_id,received_at) values (${inbound},${firstB.sequence},${firstB.prospect},${firstB.contact},'gmail','inbound',0,'received',${randomUUID()},${providerId},${firstB.thread},'2026-02-02T12:00:00Z')`;
      await admin`insert into growth.email_events(email_message_id,provider,provider_event_id,event_type,occurred_at) values (${inbound},'gmail',${providerId},'reply','2026-02-02T12:00:00Z')`;
      const incomplete = await getEvidence();
      assert.equal(incomplete.observedCompleteAtRead, 59);
      const noWinner = buildCampaignReport({
        anchor: {
          basis: "gmail_fss_sent_observed",
          observedAt: clean.members[0].confirmation.observedAt,
        },
        cutoff,
        evidenceAsOf: incomplete.readAt,
        members: incomplete.members,
      });
      assert.equal(noWinner.winner, null);
      assert.equal(
        noWinner.groups.reduce((sum, g) => sum + g.missingReplies, 0),
        1,
      );
      await admin`delete from growth.email_events where email_message_id=${inbound}`;
      await admin`delete from growth.email_messages where id=${inbound}`;
      const gap = randomUUID();
      await admin`insert into growth.gmail_reply_coverage(id,connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state,reason) select ${gap},connection_id,grant_epoch,google_subject,'200','201','2026-02-01T00:00:00Z','2026-02-01T01:00:00Z','2026-02-01T01:01:00Z','2026-02-01T01:02:00Z','gap','synthetic_gap' from growth.gmail_reply_coverage where connection_id=${fixture.connectionId} and state='complete'`;
      const gapped = await getEvidence();
      assert.equal(gapped.observedCompleteAtRead, 0);
      await admin`delete from growth.gmail_reply_coverage where id=${gap}`;
      const result = await publishMonthlyReport(db, {
        jobId: fixture.jobId,
        leaseOwner: "report-worker",
        leaseRevision: "1",
        anchorRevision: 1,
        anchorReservationId: fixture.anchorId,
      });
      if (result.status !== "ready") throw new Error(result.reason);
      const [stored] = await admin<
        {
          evidence: {
            version: number;
            sourceAvailabilityAtCutoff: string;
            visibility: { basis: string; snapshot: string; readAt: string };
            report: {
              winner: string | null;
              winnerReason: string;
              groups: Array<{ mature: number; positiveReplies: number }>;
            };
            lateReviewedPositives: unknown[];
          };
        }[]
      >`select evidence from growth.experiment_reviews where id=${result.value.reportId}`;
      assert.equal(stored?.evidence.version, 2);
      assert.equal(
        stored?.evidence.visibility.basis,
        "postgres_statement_snapshot",
      );
      assert.ok(stored?.evidence.visibility.snapshot);
      assert.equal(stored?.evidence.sourceAvailabilityAtCutoff, "unknown");
      assert.equal(stored?.evidence.report.winner, "a");
      assert.equal(stored?.evidence.report.winnerReason, "clear_interval");
      assert.deepEqual(
        stored?.evidence.report.groups.map((g) => g.mature),
        [30, 30],
      );
      assert.deepEqual(
        stored?.evidence.report.groups.map((g) => g.positiveReplies),
        [20, 0],
      );
      assert.equal(stored?.evidence.lateReviewedPositives.length, 20);
    } finally {
      if (fixture) await fixture.cleanup();
      await db.end();
      await admin.end();
    }
  },
);
