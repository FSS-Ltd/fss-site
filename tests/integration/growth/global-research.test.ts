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
      await assert.rejects(
        ingestResearchRun(sql, first, {
          kind: "signed_research",
          keyId: "agent",
          bodySha256: "a".repeat(64),
        }),
        /conflict/i,
      );
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

test("proof-bearing research requires authenticated source principal", async () => {
  const fixture = createGlobalResearchFixture();
  const candidate = fixture.prospects[0]!;
  const run = globalResearchRunSchema.parse({
    ...fixture,
    prospects: [
      {
        ...candidate,
        evidence: [
          { ...candidate.evidence[0]!, claimType: "contact_email" },
          {
            ...candidate.evidence[0]!,
            claimType: "business_observation",
            claimSummary: "Customers request appointments by telephone.",
          },
        ],
        proof: {
          purpose: "campaign_source_proof",
          contactEmail: { evidenceIndex: 0, email: candidate.contact.email },
          businessObservation: { evidenceIndex: 1 },
        },
      },
    ],
  });
  const db = postgres("postgresql://postgres@127.0.0.1:1/unused", {
    connect_timeout: 1,
  });
  try {
    await assert.rejects(
      ingestResearchRun(db, run),
      (error) =>
        error instanceof ResearchIngestionError &&
        error.code === "signed_research_required",
    );
  } finally {
    await db.end();
  }
});

test(
  "signed research binds actual evidence and rejects changed authenticated bytes",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;
    const db = postgres(connectionString, { max: 1 });
    const fixture = createGlobalResearchFixture();
    const candidate = fixture.prospects[0]!;
    const token = randomUUID();
    const url = `https://${token}.example.test/contact`;
    const now = new Date(Date.now() - 60000).toISOString();
    const source = {
      ...candidate.evidence[0]!,
      sourceUrl: url,
      observedAt: now,
      verifiedAt: now,
    };
    const run = globalResearchRunSchema.parse({
      ...fixture,
      externalRunId: token,
      prospects: [
        {
          ...candidate,
          business: {
            ...candidate.business,
            websiteUrl: url,
            firstPartySourceUrl: url,
            verifiedAt: now,
          },
          contact: {
            ...candidate.contact,
            email: `${token}@example.test`,
            emailSourceUrl: url,
            emailVerifiedAt: now,
          },
          evidence: [
            { ...source, claimType: "contact_email" },
            {
              ...source,
              claimType: "business_observation",
              claimSummary: "Customers request appointments by telephone.",
            },
          ],
          proof: {
            purpose: "campaign_source_proof",
            contactEmail: { evidenceIndex: 0, email: `${token}@example.test` },
            businessObservation: { evidenceIndex: 1 },
          },
        },
      ],
    });
    const principal = {
      kind: "signed_research" as const,
      keyId: "test-agent",
      bodySha256: "a".repeat(64),
    };
    try {
      await db`set role growth_app`;
      const first = await ingestResearchRun(db, run, principal);
      assert.deepEqual(await ingestResearchRun(db, run, principal), first);
      const actualNow = Date.now;
      try {
        Date.now = () => actualNow() + 31 * 86400000;
        assert.deepEqual(await ingestResearchRun(db, run, principal), first);
      } finally {
        Date.now = actualNow;
      }
      await assert.rejects(
        ingestResearchRun(db, run, {
          ...principal,
          bodySha256: "b".repeat(64),
        }),
        /conflict/i,
      );
      const rows = await db<
        { count: number }[]
      >`select count(*)::integer as count from growth.research_source_proof_bindings where research_run_id=${first.runId}`;
      assert.equal(rows[0]?.count, 1);
      const [binding] = await db<
        { id: string; contactEvidenceId: string }[]
      >`select id, contact_evidence_id as "contactEvidenceId" from growth.research_source_proof_bindings where research_run_id=${first.runId}`;
      assert.ok(binding);
      const { loadFounderSourceProof } =
        await import("../../../lib/growth/campaigns/founder-verification-reader");
      const { createHash } = await import("node:crypto");
      const email = "j.ntagengwa@faithfulsoftware.dev";
      const founder = {
        email,
        actorId: createHash("sha256").update(email).digest("hex"),
      };
      const prospectId = first.acceptedProspects[0]!.prospectId;
      const proof = await loadFounderSourceProof(
        db,
        prospectId,
        new Date(),
        founder,
        { origin: "research", bindingId: binding.id },
      );
      assert.equal(proof?.origin, "research");
      await db`update growth.businesses set first_party_source_url='https://different.example.test/contact' where id=(select business_id from growth.prospects where id=${prospectId})`;
      assert.equal(
        await loadFounderSourceProof(db, prospectId, new Date(), founder, {
          origin: "research",
          bindingId: binding.id,
        }),
        null,
      );
      await db`update growth.businesses set first_party_source_url=${url} where id=(select business_id from growth.prospects where id=${prospectId})`;

      await assert.rejects(
        db`insert into growth.research_source_proof_bindings(research_run_id,prospect_id,business_id,contact_id,prospect_version,contact_version,contact_evidence_id,observation_evidence_id) select research_run_id,prospect_id,${randomUUID()},contact_id,prospect_version,contact_version,contact_evidence_id,observation_evidence_id from growth.research_source_proof_bindings where id=${binding.id}`,
        /invalid research proof binding/,
      );
      await assert.rejects(
        db`insert into growth.research_source_proof_bindings(research_run_id,prospect_id,business_id,contact_id,prospect_version,contact_version,contact_evidence_id,observation_evidence_id) select research_run_id,prospect_id,business_id,contact_id,prospect_version,contact_version+1,contact_evidence_id,observation_evidence_id from growth.research_source_proof_bindings where id=${binding.id}`,
        /invalid research proof binding/,
      );

      await assert.rejects(
        db`update growth.source_evidence set claim_summary='altered' where id=${binding.contactEvidenceId}`,
      );
      await assert.rejects(
        db`update growth.research_runs set signed_body_sha256=${"c".repeat(64)} where id=${first.runId}`,
      );
      await assert.rejects(
        db`update growth.research_runs set external_run_id=${randomUUID()} where id=${first.runId}`,
      );
      await assert.rejects(
        loadFounderSourceProof(
          db,
          prospectId,
          new Date(),
          { ...founder, actorId: "fake" },
          { origin: "research", bindingId: binding.id },
        ),
      );
      await db`update growth.prospects set version=version+1 where id=${prospectId}`;
      assert.equal(
        await loadFounderSourceProof(db, prospectId, new Date(), founder, {
          origin: "research",
          bindingId: binding.id,
        }),
        null,
      );
    } finally {
      await db.end();
    }
  },
);

test(
  "signed proof rejects future observation",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;
    const fixture = createGlobalResearchFixture();
    const candidate = fixture.prospects[0]!;
    const source = {
      ...candidate.evidence[0]!,
      observedAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const run = globalResearchRunSchema.parse({
      ...fixture,
      prospects: [
        {
          ...candidate,
          evidence: [
            { ...source, claimType: "contact_email" },
            {
              ...source,
              claimType: "business_observation",
              claimSummary: "Customers request appointments by telephone.",
            },
          ],
          proof: {
            purpose: "campaign_source_proof",
            contactEmail: { evidenceIndex: 0, email: candidate.contact.email },
            businessObservation: { evidenceIndex: 1 },
          },
        },
      ],
    });
    const db = postgres(connectionString, {
      max: 1,
      connection: { options: "-c role=growth_app" },
    });
    try {
      await assert.rejects(
        ingestResearchRun(db, run, {
          kind: "signed_research",
          keyId: "agent",
          bodySha256: "a".repeat(64),
        }),
        (error) =>
          error instanceof ResearchIngestionError &&
          error.code === "invalid_proof",
      );
    } finally {
      await db.end();
    }
  },
);

test(
  "signed proof rejects stale observations",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;
    const fixture = createGlobalResearchFixture();
    const candidate = fixture.prospects[0]!;
    const stale = new Date(Date.now() - 31 * 86400000).toISOString();
    const source = {
      ...candidate.evidence[0]!,
      observedAt: stale,
      verifiedAt: stale,
    };
    const run = globalResearchRunSchema.parse({
      ...fixture,
      prospects: [
        {
          ...candidate,
          evidence: [
            { ...source, claimType: "contact_email" },
            {
              ...source,
              claimType: "business_observation",
              claimSummary: "Customers request appointments by telephone.",
            },
          ],
          proof: {
            purpose: "campaign_source_proof",
            contactEmail: { evidenceIndex: 0, email: candidate.contact.email },
            businessObservation: { evidenceIndex: 1 },
          },
        },
      ],
    });
    const db = postgres(connectionString, {
      max: 1,
      connection: { options: "-c role=growth_app" },
    });
    try {
      await assert.rejects(
        ingestResearchRun(db, run, {
          kind: "signed_research",
          keyId: "agent",
          bodySha256: "a".repeat(64),
        }),
        (error) =>
          error instanceof ResearchIngestionError &&
          error.code === "invalid_proof",
      );
    } finally {
      await db.end();
    }
  },
);
