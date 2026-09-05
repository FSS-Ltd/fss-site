import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import type { GrowthDb } from "../../../lib/growth/db/types";
import { approveProspectPreview } from "../../../lib/growth/prospect-previews/approval";
import { getPublishedProspectPreviewSlug } from "../../../lib/growth/prospect-previews/public-repository";
import { getReviewableBespokePreviewSourceBySlug } from "../../../lib/growth/prospect-previews/reviewable-source";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createValidResearchRunFixture } from "../../../lib/growth/research/ingestion-schema.test-fixture";

const connectionString = process.env.DIRECT_DATABASE_URL;

const founder = {
  email: "founder@example.test",
  actorId: "c".repeat(64),
};

async function cleanupResearchRun(
  sql: postgres.Sql,
  externalRunId: string,
  companyNumber: string,
): Promise<void> {
  await sql`
    delete from growth.audit_log
    where correlation_id like ${`${externalRunId}%`}
  `;
  await sql`
    delete from growth.agent_tasks
    where research_run_id in (
      select id from growth.research_runs where external_run_id = ${externalRunId}
    )
  `;
  await sql`
    delete from growth.source_evidence
    where research_run_id in (
      select id from growth.research_runs where external_run_id = ${externalRunId}
    )
  `;
  await sql`
    delete from growth.website_assessments
    where prospect_id in (
      select p.id from growth.prospects p
      inner join growth.research_runs rr on rr.id = p.research_run_id
      where rr.external_run_id = ${externalRunId}
    )
  `;
  await sql`
    delete from growth.prospect_previews
    where prospect_id in (
      select p.id from growth.prospects p
      inner join growth.research_runs rr on rr.id = p.research_run_id
      where rr.external_run_id = ${externalRunId}
    )
  `;
  await sql`
    delete from growth.prospects
    where research_run_id in (
      select id from growth.research_runs where external_run_id = ${externalRunId}
    )
  `;
  await sql`
    delete from growth.contacts
    where email like ${`${externalRunId}-%@example.test`}
  `;
  await sql`
    delete from growth.businesses
    where company_number = ${companyNumber}
  `;
  await sql`
    delete from growth.research_runs
    where external_run_id = ${externalRunId}
  `;
}

test(
  "approves a reconciled allowlisted bespoke preview",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-preview-approval-${token}`;
    const companyNumber = token.slice(0, 12).toUpperCase();
    const contactEmail = `${externalRunId}-contact@example.test`;
    const correlationId = `${externalRunId}-approve`;
    const source = getReviewableBespokePreviewSourceBySlug(
      "acckent-accountants",
    );
    assert.ok(source);

    try {
      const fixture = createValidResearchRunFixture();
      fixture.externalRunId = externalRunId;
      const candidate = fixture.prospects[0]!;
      candidate.business.legalName = `AccKent Integration ${token}`;
      candidate.business.tradingName = "AccKent Accountants";
      candidate.business.companyNumber = companyNumber;
      candidate.business.googlePlaceId = `place-${token}`;
      candidate.contact.email = contactEmail;
      const companiesHouseEvidence = candidate.evidence.find(
        (evidence) => evidence.sourceType === "companies_house",
      );
      assert.ok(companiesHouseEvidence);
      companiesHouseEvidence.externalReference = companyNumber;
      companiesHouseEvidence.sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;

      const ingestion = await ingestResearchRun(sql, fixture);
      const prospectId = ingestion.acceptedProspects[0]!.prospectId;
      const [identity] = await sql<
        Array<{
          previewId: string;
          previewPublicId: string;
          previewVersion: number;
          prospectVersion: number;
        }>
      >`
        select
          pp.id as "previewId",
          pp.public_id as "previewPublicId",
          pp.version as "previewVersion",
          p.version as "prospectVersion"
        from growth.prospect_previews pp
        inner join growth.prospects p on p.id = pp.prospect_id
        where p.id = ${prospectId}
      `;
      assert.ok(identity);

      await sql`
        update growth.prospect_previews
        set generation_status = 'merged_draft',
            slug = ${source.slug},
            composition_digest = ${source.digest},
            generation_pr_number = 198,
            generation_branch = 'fix/reconcile-six-bespoke-concepts',
            generated_at = now()
        where id = ${identity.previewId}
      `;

      const result = await approveProspectPreview(sql as unknown as GrowthDb, {
        prospectId,
        expectedProspectVersion: identity.prospectVersion,
        expectedPreviewVersion: identity.previewVersion,
        founder,
        correlationId,
      });

      assert.equal(result.status, "published");

      const [preview] = await sql<
        Array<{
          status: string;
          generationStatus: string;
          slug: string | null;
          compositionDigest: string | null;
          generationPrNumber: number | null;
          generationBranch: string | null;
          approvedAt: Date | null;
          approvedBy: string | null;
        }>
      >`
        select
          status,
          generation_status as "generationStatus",
          slug,
          composition_digest as "compositionDigest",
          generation_pr_number as "generationPrNumber",
          generation_branch as "generationBranch",
          approved_at as "approvedAt",
          approved_by as "approvedBy"
        from growth.prospect_previews
        where id = ${identity.previewId}
      `;

      assert.deepEqual(
        {
          status: preview?.status,
          generationStatus: preview?.generationStatus,
          slug: preview?.slug,
          compositionDigest: preview?.compositionDigest,
          generationPrNumber: preview?.generationPrNumber,
          generationBranch: preview?.generationBranch,
          approvedBy: preview?.approvedBy,
        },
        {
          status: "published",
          generationStatus: "published",
          slug: "acckent-accountants",
          compositionDigest: source.digest,
          generationPrNumber: 198,
          generationBranch: "fix/reconcile-six-bespoke-concepts",
          approvedBy: founder.actorId,
        },
      );
      assert.ok(preview?.approvedAt);

      assert.equal(
        await getPublishedProspectPreviewSlug(
          identity.previewPublicId,
          sql as unknown as GrowthDb,
        ),
        "acckent-accountants",
      );
    } finally {
      await cleanupResearchRun(sql, externalRunId, companyNumber);
      await sql.end();
    }
  },
);
