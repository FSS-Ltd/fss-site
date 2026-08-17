import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { persistEmailAssetForRun } from "../../../lib/growth/email/assets/repository";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createValidResearchRunFixture } from "../../../lib/growth/research/ingestion-schema.test-fixture";
import type {
  ResearchProspectCandidate,
  ResearchRunIngestion,
} from "../../../lib/growth/research/types";

const connectionString = process.env.DIRECT_DATABASE_URL;

function setCandidateIdentity(
  candidate: ResearchProspectCandidate,
  input: {
    companyNumber: string;
    emailLocalPart: string;
    googlePlaceId: string;
  },
): void {
  candidate.business.companyNumber = input.companyNumber;
  candidate.business.googlePlaceId = input.googlePlaceId;
  candidate.contact.email = `${input.emailLocalPart}@example.test`;

  const companiesHouse = candidate.evidence.find(
    (evidence) => evidence.sourceType === "companies_house",
  );
  assert.ok(companiesHouse);
  companiesHouse.externalReference = input.companyNumber;
  companiesHouse.sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${input.companyNumber}`;
}

function createRun(
  externalRunId: string,
  identity: Parameters<typeof setCandidateIdentity>[1],
): ResearchRunIngestion {
  const input = createValidResearchRunFixture();
  input.externalRunId = externalRunId;
  setCandidateIdentity(input.prospects[0]!, identity);
  return input;
}

test(
  "research ingestion is idempotent, deduplicated, suppressed, and atomic",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");
    const runPrefix = `integration-ingestion-${token}`;
    const companyNumbers = [
      token.slice(0, 12).toUpperCase(),
      token.slice(12, 24).toUpperCase(),
      token.slice(20, 32).toUpperCase(),
      `${token.slice(0, 8)}A`.toUpperCase(),
      `${token.slice(0, 8)}B`.toUpperCase(),
      `${token.slice(0, 8)}C`.toUpperCase(),
    ];

    try {
      const acceptedInput = createRun(`${runPrefix}-accepted`, {
        companyNumber: companyNumbers[0]!,
        emailLocalPart: `accepted-${token}`,
        googlePlaceId: `place-accepted-${token}`,
      });

      const accepted = await ingestResearchRun(sql, acceptedInput);
      assert.equal(accepted.accepted, 1);
      assert.equal(accepted.duplicates, 0);
      assert.equal(accepted.rejected, 0);
      assert.equal(accepted.acceptedProspects.length, 1);
      assert.equal(accepted.acceptedProspects[0]?.candidateIndex, 0);
      const acceptedProspectId = accepted.acceptedProspects[0]!.prospectId;

      const retry = await ingestResearchRun(sql, acceptedInput);
      assert.deepEqual(retry, accepted);

      const rows = await sql<
        Array<{
          runStatus: string;
          businessCount: number;
          contactCount: number;
          prospectCount: number;
          evidenceCount: number;
          assessmentCount: number;
          taskCount: number;
          visualKind: string;
          emailSubject: string;
        }>
      >`
        select
          rr.status as "runStatus",
          count(distinct b.id)::integer as "businessCount",
          count(distinct c.id)::integer as "contactCount",
          count(distinct p.id)::integer as "prospectCount",
          count(distinct se.id)::integer as "evidenceCount",
          count(distinct wa.id)::integer as "assessmentCount",
          count(distinct at.id)::integer as "taskCount",
          max(at.output_snapshot -> 'visual' ->> 'kind') as "visualKind",
          max(at.output_snapshot -> 'email' ->> 'subject') as "emailSubject"
        from growth.research_runs rr
        left join growth.prospects p on p.research_run_id = rr.id
        left join growth.businesses b on b.id = p.business_id
        left join growth.contacts c on c.id = p.primary_contact_id
        left join growth.source_evidence se on se.prospect_id = p.id
        left join growth.website_assessments wa on wa.prospect_id = p.id
        left join growth.agent_tasks at on at.prospect_id = p.id
        where rr.external_run_id = ${acceptedInput.externalRunId}
        group by rr.id
      `;
      assert.deepEqual(rows[0], {
        runStatus: "completed",
        businessCount: 1,
        contactCount: 1,
        prospectCount: 1,
        evidenceCount: 2,
        assessmentCount: 1,
        taskCount: 1,
        visualKind: "fallback",
        emailSubject: acceptedInput.prospects[0]!.firstEmail.subject,
      });

      const duplicateInput = createRun(`${runPrefix}-duplicate`, {
        companyNumber: companyNumbers[0]!,
        emailLocalPart: `duplicate-${token}`,
        googlePlaceId: `place-duplicate-${token}`,
      });
      const duplicate = await ingestResearchRun(sql, duplicateInput);
      assert.equal(duplicate.accepted, 0);
      assert.equal(duplicate.duplicates, 1);
      assert.deepEqual(duplicate.acceptedProspects, []);

      const businessCount = await sql<Array<{ count: number }>>`
        select count(*)::integer as count
        from growth.businesses
        where upper(regexp_replace(company_number, '\s+', '', 'g')) = ${companyNumbers[0]}
      `;
      assert.equal(businessCount[0]?.count, 1);

      await sql`
        update growth.prospects
        set status = 'suppressed'
        where id = ${acceptedProspectId}
      `;
      const suppressedInput = createRun(`${runPrefix}-suppressed`, {
        companyNumber: companyNumbers[1]!,
        emailLocalPart: `accepted-${token}`,
        googlePlaceId: `place-suppressed-${token}`,
      });
      await assert.rejects(
        ingestResearchRun(sql, suppressedInput),
        (error: unknown) =>
          error instanceof Error &&
          "code" in error &&
          error.code === "suppressed_contact",
      );

      const uploadedAssetId = randomUUID();
      const uploadedAltText =
        "Concept illustration used only for ingestion association testing.";
      await persistEmailAssetForRun(sql, {
        id: uploadedAssetId,
        runId: accepted.runId,
        prospectId: acceptedProspectId,
        assetKind: "cold_first_email",
        blobUrl: `https://blob.example.test/${token}.webp`,
        contentType: "image/webp",
        byteSize: 1000,
        width: 1200,
        height: 630,
        altText: uploadedAltText,
        promptSummary: "Integration-test visual without personal data.",
        sha256: token.padEnd(64, "0").slice(0, 64),
        reviewStatus: "pending",
        createdBy: "agent_ingestion",
      });
      const selectedVisual = await sql<
        Array<{
          kind: string;
          assetId: string;
          altText: string;
          reviewStatus: string;
          hasSnapshotReviewStatus: boolean;
        }>
      >`
        select
          output_snapshot -> 'visual' ->> 'kind' as kind,
          output_snapshot -> 'visual' ->> 'assetId' as "assetId",
          output_snapshot -> 'visual' ->> 'altText' as "altText",
          ea.review_status as "reviewStatus",
          output_snapshot -> 'visual' ? 'reviewStatus' as "hasSnapshotReviewStatus"
        from growth.agent_tasks at
        inner join growth.email_assets ea
          on ea.id = (at.output_snapshot -> 'visual' ->> 'assetId')::uuid
        where at.research_run_id = ${accepted.runId}
          and at.prospect_id = ${acceptedProspectId}
          and at.task_type = 'first_email_draft'
      `;
      assert.deepEqual(selectedVisual[0], {
        kind: "stored",
        assetId: uploadedAssetId,
        altText: uploadedAltText,
        reviewStatus: "pending",
        hasSnapshotReviewStatus: false,
      });

      const newsletterAssetId = randomUUID();
      await persistEmailAssetForRun(sql, {
        id: newsletterAssetId,
        runId: accepted.runId,
        prospectId: acceptedProspectId,
        assetKind: "newsletter",
        blobUrl: `https://blob.example.test/${token}-newsletter.webp`,
        contentType: "image/webp",
        byteSize: 1000,
        width: 1200,
        height: 630,
        altText: "Concept illustration for a separate newsletter workflow.",
        promptSummary: "Newsletter integration-test visual.",
        sha256: token.padStart(64, "f").slice(0, 64),
        reviewStatus: "pending",
        createdBy: "agent_ingestion",
      });
      const draftAfterNewsletter = await sql<Array<{ assetId: string }>>`
        select output_snapshot -> 'visual' ->> 'assetId' as "assetId"
        from growth.agent_tasks
        where research_run_id = ${accepted.runId}
          and prospect_id = ${acceptedProspectId}
          and task_type = 'first_email_draft'
      `;
      assert.equal(draftAfterNewsletter[0]?.assetId, uploadedAssetId);

      await sql`
        update growth.agent_tasks
        set status = 'paused'
        where research_run_id = ${accepted.runId}
          and prospect_id = ${acceptedProspectId}
          and task_type = 'first_email_draft'
      `;
      const rejectedAssetId = randomUUID();
      await assert.rejects(
        persistEmailAssetForRun(sql, {
          id: rejectedAssetId,
          runId: accepted.runId,
          prospectId: acceptedProspectId,
          assetKind: "cold_first_email",
          blobUrl: `https://blob.example.test/${token}-rejected.webp`,
          contentType: "image/webp",
          byteSize: 1000,
          width: 1200,
          height: 630,
          altText:
            "Concept illustration that must not persist without a draft.",
          promptSummary: "Rollback integration-test visual.",
          sha256: token.padStart(64, "e").slice(0, 64),
          reviewStatus: "pending",
          createdBy: "agent_ingestion",
        }),
      );
      const rejectedAssetRows = await sql<Array<{ count: number }>>`
        select count(*)::integer as count
        from growth.email_assets
        where id = ${rejectedAssetId}
      `;
      assert.equal(rejectedAssetRows[0]?.count, 0);
      await sql`
        update growth.agent_tasks
        set status = 'completed'
        where research_run_id = ${accepted.runId}
          and prospect_id = ${acceptedProspectId}
          and task_type = 'first_email_draft'
      `;

      const mismatchedAssetInput = createRun(`${runPrefix}-asset-mismatch`, {
        companyNumber: companyNumbers[2]!,
        emailLocalPart: `asset-${token}`,
        googlePlaceId: `place-asset-${token}`,
      });
      const untrustedVisual = mismatchedAssetInput.prospects[0]!.visual as {
        assetId: string | null;
      };
      untrustedVisual.assetId = uploadedAssetId;
      await assert.rejects(
        ingestResearchRun(sql, mismatchedAssetInput),
        (error: unknown) =>
          error instanceof Error &&
          "code" in error &&
          error.code === "invalid_asset_reference",
      );

      const invalidInput = createRun(`${runPrefix}-invalid`, {
        companyNumber: companyNumbers[3]!,
        emailLocalPart: `invalid-${token}`,
        googlePlaceId: `place-invalid-${token}`,
      });
      invalidInput.prospects[0]!.evidence.push(
        structuredClone(invalidInput.prospects[0]!.evidence[0]!),
      );
      await assert.rejects(ingestResearchRun(sql, invalidInput));

      const concurrentA = createRun(`${runPrefix}-concurrent-a`, {
        companyNumber: companyNumbers[4]!,
        emailLocalPart: `concurrent-a-${token}`,
        googlePlaceId: `place-concurrent-a-${token}`,
      });
      const concurrentSecond = structuredClone(
        concurrentA.prospects[0],
      ) as ResearchProspectCandidate;
      setCandidateIdentity(concurrentSecond, {
        companyNumber: companyNumbers[5]!,
        emailLocalPart: `concurrent-b-${token}`,
        googlePlaceId: `place-concurrent-b-${token}`,
      });
      concurrentA.prospects.push(concurrentSecond);

      const concurrentB = structuredClone(concurrentA);
      concurrentB.externalRunId = `${runPrefix}-concurrent-b`;
      concurrentB.prospects.reverse();

      const [concurrentResultA, concurrentResultB] = await Promise.all([
        ingestResearchRun(sql, concurrentA),
        ingestResearchRun(sql, concurrentB),
      ]);
      assert.equal(concurrentResultA.accepted + concurrentResultB.accepted, 2);
      assert.equal(
        concurrentResultA.duplicates + concurrentResultB.duplicates,
        2,
      );
      const acceptedConcurrentResult =
        concurrentResultA.accepted === 2
          ? concurrentResultA
          : concurrentResultB;
      assert.deepEqual(
        acceptedConcurrentResult.acceptedProspects.map(
          ({ candidateIndex }) => candidateIndex,
        ),
        [0, 1],
      );

      const rolledBack = await sql<
        Array<{ runCount: number; businessCount: number }>
      >`
        select
          (
            select count(*)::integer
            from growth.research_runs
            where external_run_id in (
              ${suppressedInput.externalRunId},
              ${mismatchedAssetInput.externalRunId},
              ${invalidInput.externalRunId}
            )
          ) as "runCount",
          (
            select count(*)::integer
            from growth.businesses
            where upper(regexp_replace(company_number, '\s+', '', 'g')) in (
              ${companyNumbers[1]},
              ${companyNumbers[2]},
              ${companyNumbers[3]}
            )
          ) as "businessCount"
      `;
      assert.deepEqual(rolledBack[0], { runCount: 0, businessCount: 0 });
    } finally {
      await sql`
        delete from growth.email_assets
        where prospect_id in (
          select p.id
          from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id like ${`${runPrefix}%`}
        )
      `;
      await sql`
        delete from growth.agent_tasks
        where research_run_id in (
          select id from growth.research_runs
          where external_run_id like ${`${runPrefix}%`}
        )
      `;
      await sql`
        delete from growth.source_evidence
        where research_run_id in (
          select id from growth.research_runs
          where external_run_id like ${`${runPrefix}%`}
        )
      `;
      await sql`
        delete from growth.website_assessments
        where prospect_id in (
          select p.id
          from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id like ${`${runPrefix}%`}
        )
      `;
      await sql`
        delete from growth.audit_log
        where correlation_id like ${`${runPrefix}%`}
      `;
      await sql`
        delete from growth.prospects
        where research_run_id in (
          select id from growth.research_runs
          where external_run_id like ${`${runPrefix}%`}
        )
      `;
      await sql`
        delete from growth.contacts
        where email like ${`%-${token}@example.test`}
      `;
      await sql`
        delete from growth.businesses
        where upper(regexp_replace(company_number, '\s+', '', 'g')) = any(${companyNumbers}::text[])
      `;
      await sql`
        delete from growth.research_runs
        where external_run_id like ${`${runPrefix}%`}
      `;
      await sql.end();
    }
  },
);
