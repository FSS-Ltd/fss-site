import { verifyResearchEmailFlow } from "./research-email-flow";
import { getMessageReview } from "../../../lib/growth/dashboard/message-review";
import { getProspectDetail } from "../../../lib/growth/dashboard/prospect-detail";
import { getOverviewViewModel } from "../../../lib/growth/dashboard/overview";
import {
  getProspectListResult,
  parseProspectListQuery,
} from "../../../lib/growth/dashboard/prospects";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import {
  ingestResearchRun,
  ResearchIngestionError,
} from "../../../lib/growth/research/ingest";
import {
  globalResearchRunSchema,
  type GlobalResearchRun,
} from "../../../lib/growth/research/global-schema";
import { createGlobalResearchFixture } from "../../../lib/growth/research/global-test-fixture";

const connectionString = process.env.DIRECT_DATABASE_URL;

test(
  "global research preserves exact review-only drafts, country identities, replay and suppression",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;
    const sql = postgres(connectionString, { max: 4 });
    const token = randomUUID().replaceAll("-", "");
    const prefix = `global-${token}`;
    function fixture(suffix: string): GlobalResearchRun {
      const run = globalResearchRunSchema.parse(createGlobalResearchFixture());
      run.externalRunId = `${prefix}-${suffix}`;
      const candidate = run.prospects[0]!;
      candidate.business.legalName = `${prefix}-${suffix}`;
      candidate.business.websiteUrl = `https://${suffix}-${token}.example.test`;
      candidate.business.firstPartySourceUrl = `${candidate.business.websiteUrl}/contact`;
      candidate.contact.email = `${suffix}-${token}@gmail.com`;
      candidate.contact.emailSourceUrl = candidate.business.firstPartySourceUrl;
      candidate.evidence[0]!.sourceUrl = candidate.business.firstPartySourceUrl;
      return run;
    }
    try {
      const first = fixture("first");
      const result = await ingestResearchRun(sql, first);
      assert.equal(result.accepted, 1);
      assert.deepEqual(await ingestResearchRun(sql, first), result);
      const rows = await sql<
        Array<{
          firstName: string | null;
          basis: string;
          country: string;
          snapshot: unknown;
          previewCount: number;
          assessmentCount: number;
          enrollmentCount: number;
        }>
      >`
      select c.first_name as "firstName", c.lawful_basis as basis, b.country_code as country,
        task.output_snapshot as snapshot,
        (select count(*)::integer from growth.prospect_previews where prospect_id=p.id) as "previewCount",
        (select count(*)::integer from growth.website_assessments where prospect_id=p.id) as "assessmentCount",
        (select count(*)::integer from growth.sequence_enrollments where prospect_id=p.id) as "enrollmentCount"
      from growth.prospects p join growth.contacts c on c.id=p.primary_contact_id
      join growth.businesses b on b.id=p.business_id
      join growth.agent_tasks task on task.prospect_id=p.id
      where p.id=${result.acceptedProspects[0]!.prospectId}
    `;
      assert.deepEqual(rows[0], {
        firstName: null,
        basis: "research_only",
        country: "CA",
        snapshot: {
          schemaVersion: "2.0",
          reviewState: "research_only",
          email: first.prospects[0]!.firstEmail,
        },
        previewCount: 0,
        assessmentCount: 0,
        enrollmentCount: 0,
      });

      const prospectId = result.acceptedProspects[0]!.prospectId;
      const tasks = await sql<
        { id: string }[]
      >`select id from growth.agent_tasks where prospect_id=${prospectId}`;
      const review = await getMessageReview(
        tasks[0]!.id,
        "founder@example.test",
        "https://example.test",
        sql,
      );
      assert.equal(review.status, "ready");
      if (review.status !== "ready")
        throw new Error("Global review unavailable");
      assert.equal(
        review.data.previewText,
        first.prospects[0]!.firstEmail.text,
      );
      assert.equal(review.data.researchOnly, true);
      assert.equal(review.data.eligibility.ready, true);
      assert.match(review.data.approvalFingerprint ?? "", /^[0-9a-f]{64}$/);
      const detail = await getProspectDetail(prospectId, sql);
      assert.equal(detail.status, "found");
      if (detail.status !== "found")
        throw new Error("Global detail unavailable");
      assert.equal(detail.data.contact?.firstName, null);
      assert.equal(detail.data.business.countryCode, "CA");
      const overview = await getOverviewViewModel(sql);
      assert.equal(overview.status, "ready");
      if (overview.status !== "ready")
        throw new Error("Global overview unavailable");
      assert.ok(
        overview.data.workQueue.some((tab) =>
          tab.rows.some(
            (row) => row.prospectId === prospectId && row.researchOnly,
          ),
        ),
      );
      const list = await getProspectListResult(
        parseProspectListQuery({ q: prefix }),
        sql,
      );
      assert.equal(list.status, "ready");
      if (list.status !== "ready") throw new Error("Global list unavailable");
      assert.equal(list.data.rows[0]?.researchOnly, true);

      const domainDuplicate = fixture("duplicate");
      domainDuplicate.prospects[0]!.business.websiteUrl =
        first.prospects[0]!.business.websiteUrl!.replace(
          "https://",
          "https://www.",
        ) + "/services";
      domainDuplicate.prospects[0]!.business.firstPartySourceUrl =
        first.prospects[0]!.business.firstPartySourceUrl;
      domainDuplicate.prospects[0]!.contact.emailSourceUrl =
        first.prospects[0]!.business.firstPartySourceUrl;
      domainDuplicate.prospects[0]!.evidence[0]!.sourceUrl =
        first.prospects[0]!.business.firstPartySourceUrl;
      assert.equal(
        (await ingestResearchRun(sql, domainDuplicate)).duplicates,
        1,
      );

      const sourceOnly = fixture("source-only");
      sourceOnly.prospects[0]!.business.websiteUrl = null;
      assert.equal((await ingestResearchRun(sql, sourceOnly)).accepted, 1);
      const sameSource = structuredClone(sourceOnly);
      sameSource.externalRunId = `${prefix}-source-only-duplicate`;
      sameSource.prospects[0]!.contact.email = `source-only-other-${token}@gmail.com`;
      assert.equal((await ingestResearchRun(sql, sameSource)).duplicates, 1);

      const unicode = fixture("unicode");
      const unicodeHost = `https://café-${token}.example.test`;
      unicode.prospects[0]!.business.websiteUrl = unicodeHost;
      unicode.prospects[0]!.business.firstPartySourceUrl = `${unicodeHost}/contact`;
      unicode.prospects[0]!.contact.emailSourceUrl = `${unicodeHost}/contact`;
      unicode.prospects[0]!.evidence[0]!.sourceUrl = `${unicodeHost}/contact`;
      assert.equal((await ingestResearchRun(sql, unicode)).accepted, 1);
      unicode.externalRunId = `${prefix}-unicode-duplicate`;
      unicode.prospects[0]!.contact.email = `unicode-other-${token}@gmail.com`;
      assert.equal((await ingestResearchRun(sql, unicode)).duplicates, 1);

      const ca = fixture("registration-ca");
      const us = fixture("registration-us");
      ca.prospects[0]!.business.companyNumber = `REG ${token}`;
      us.prospects[0]!.business.companyNumber = `REG${token}`;
      us.prospects[0]!.business.countryCode = "US";
      assert.equal((await ingestResearchRun(sql, ca)).accepted, 1);
      assert.equal((await ingestResearchRun(sql, us)).accepted, 1);
      const sameRegistration = fixture("registration-duplicate");
      sameRegistration.prospects[0]!.business.companyNumber = `reg ${token}`;
      assert.equal(
        (await ingestResearchRun(sql, sameRegistration)).duplicates,
        1,
      );

      const concurrentA = fixture("concurrent-a");
      const concurrentB = structuredClone(concurrentA);
      concurrentB.externalRunId = `${prefix}-concurrent-b`;
      concurrentB.prospects[0]!.contact.email = `concurrent-b-${token}@gmail.com`;
      const concurrent = await Promise.all([
        ingestResearchRun(sql, concurrentA),
        ingestResearchRun(sql, concurrentB),
      ]);
      assert.equal(
        concurrent.reduce((sum, run) => sum + run.accepted, 0),
        1,
      );
      assert.equal(
        concurrent.reduce((sum, run) => sum + run.duplicates, 0),
        1,
      );

      const suppressed = fixture("suppressed");
      await sql`insert into growth.suppressions (normalised_email, reason, source, created_by) values (${suppressed.prospects[0]!.contact.email}, 'opt_out', 'manual', 'integration-test')`;
      await assert.rejects(
        ingestResearchRun(sql, suppressed),
        (error: unknown) =>
          error instanceof ResearchIngestionError &&
          error.code === "suppressed_contact",
      );
      const rolledBack =
        await sql`select id from growth.research_runs where external_run_id=${suppressed.externalRunId}`;
      assert.equal(rolledBack.length, 0);
      await verifyResearchEmailFlow(sql, tasks[0]!.id, prefix);
    } finally {
      await sql`delete from growth.email_events where email_message_id in (select id from growth.email_messages where prospect_id in (select id from growth.prospects where research_run_id in (select id from growth.research_runs where external_run_id like ${`${prefix}%`})))`;
      await sql`update growth.sequence_enrollments set first_message_id=null where prospect_id in (select id from growth.prospects where research_run_id in (select id from growth.research_runs where external_run_id like ${`${prefix}%`}))`;
      await sql`delete from growth.email_messages where prospect_id in (select id from growth.prospects where research_run_id in (select id from growth.research_runs where external_run_id like ${`${prefix}%`}))`;
      await sql`delete from growth.sequence_enrollments where prospect_id in (select id from growth.prospects where research_run_id in (select id from growth.research_runs where external_run_id like ${`${prefix}%`}))`;
      await sql`delete from growth.agent_tasks where research_run_id in (select id from growth.research_runs where external_run_id like ${`${prefix}%`})`;
      await sql`delete from growth.source_evidence where research_run_id in (select id from growth.research_runs where external_run_id like ${`${prefix}%`})`;
      await sql`delete from growth.audit_log where correlation_id like ${`${prefix}%`}`;
      await sql`delete from growth.prospects where research_run_id in (select id from growth.research_runs where external_run_id like ${`${prefix}%`})`;
      await sql`delete from growth.contacts where business_id in (select id from growth.businesses where legal_name like ${`${prefix}%`})`;
      await sql`delete from growth.businesses where legal_name like ${`${prefix}%`}`;
      await sql`delete from growth.research_runs where external_run_id like ${`${prefix}%`}`;
      await sql`delete from growth.suppressions where normalised_email like ${`%-${token}@gmail.com`}`;
      await sql.end();
    }
  },
);
