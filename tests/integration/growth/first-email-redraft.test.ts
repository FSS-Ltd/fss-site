import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createValidResearchRunFixture } from "../../../lib/growth/research/ingestion-schema.test-fixture";
import {
  FirstEmailRedraftError,
  requestFirstEmailRedraft,
} from "../../../lib/growth/sequences/redraft";

const connectionString = process.env.DIRECT_DATABASE_URL;
const founder = { email: "founder@example.test", actorId: "d".repeat(64) };

test(
  "founder redraft requests create a pending agent task idempotently and audit atomically",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-email-redraft-${token}`;
    const companyNumber = token.slice(0, 12).toUpperCase();
    const contactEmail = `redraft-${token}@example.test`;
    const correlationIds = [`${externalRunId}-first`, `${externalRunId}-retry`];

    try {
      const fixture = createValidResearchRunFixture();
      fixture.externalRunId = externalRunId;
      const candidate = fixture.prospects[0]!;
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
        Array<{ draftTaskId: string; researchRunId: string }>
      >`
        select
          at.id as "draftTaskId",
          at.research_run_id as "researchRunId"
        from growth.agent_tasks at
        where at.prospect_id = ${prospectId}
          and at.task_type = 'first_email_draft'
      `;
      assert.ok(identity);

      const first = await requestFirstEmailRedraft(sql, {
        draftTaskId: identity.draftTaskId,
        expectedVersion: 1,
        founder,
        correlationId: correlationIds[0]!,
        reason: "The offer needs to reference their new service line.",
      });

      const retry = await requestFirstEmailRedraft(sql, {
        draftTaskId: identity.draftTaskId,
        expectedVersion: 1,
        founder,
        correlationId: correlationIds[1]!,
        reason: "A different reason should not create a second task.",
      });
      assert.equal(retry.redraftTaskId, first.redraftTaskId);

      const [redraftTask] = await sql<
        Array<{
          taskType: string;
          status: string;
          researchRunId: string;
          prospectId: string;
          reason: string;
        }>
      >`
        select
          task_type as "taskType",
          status,
          research_run_id as "researchRunId",
          prospect_id as "prospectId",
          input_snapshot ->> 'reason' as reason
        from growth.agent_tasks
        where id = ${first.redraftTaskId}
      `;
      assert.equal(redraftTask?.taskType, "first_email_redraft");
      assert.equal(redraftTask?.status, "pending");
      assert.equal(redraftTask?.researchRunId, identity.researchRunId);
      assert.equal(redraftTask?.prospectId, prospectId);
      assert.equal(
        redraftTask?.reason,
        "The offer needs to reference their new service line.",
      );

      const [originalDraft] = await sql<Array<{ reviewState: string | null }>>`
        select output_snapshot ->> 'reviewState' as "reviewState"
        from growth.agent_tasks
        where id = ${identity.draftTaskId}
      `;
      assert.equal(originalDraft?.reviewState, null);

      const audits = await sql<Array<{ correlationId: string }>>`
        select correlation_id as "correlationId"
        from growth.audit_log
        where correlation_id = any(${correlationIds}::text[])
      `;
      assert.deepEqual(
        audits.map((audit) => audit.correlationId).sort(),
        [...correlationIds].sort(),
      );

      await assert.rejects(
        requestFirstEmailRedraft(sql, {
          draftTaskId: identity.draftTaskId,
          expectedVersion: 2,
          founder,
          correlationId: `${externalRunId}-conflict`,
          reason: "This version does not match the stored draft anymore.",
        }),
        (error: unknown) =>
          error instanceof FirstEmailRedraftError &&
          error.code === "version_conflict",
      );
    } finally {
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
      await sql`delete from growth.contacts where email = ${contactEmail}`;
      await sql`delete from growth.businesses where company_number = ${companyNumber}`;
      await sql`delete from growth.research_runs where external_run_id = ${externalRunId}`;
      await sql.end();
    }
  },
);
