import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createValidResearchRunFixture } from "../../../lib/growth/research/ingestion-schema.test-fixture";
import {
  FirstEmailRevisionError,
  reviseFirstEmailDraft,
} from "../../../lib/growth/sequences/first-email-revisions";

const connectionString = process.env.DIRECT_DATABASE_URL;

test(
  "founder email revisions persist history, version locks, and audit atomically",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-email-revision-${token}`;
    const correlationIds = [
      `${externalRunId}-first`,
      `${externalRunId}-race-a`,
      `${externalRunId}-race-b`,
      `${externalRunId}-materialised`,
    ];
    const companyNumber = token.slice(0, 12).toUpperCase();
    const contactEmail = `revision-${token}@example.test`;

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
        Array<{ draftTaskId: string; contactId: string }>
      >`
        select
          at.id as "draftTaskId",
          p.primary_contact_id as "contactId"
        from growth.agent_tasks at
        inner join growth.prospects p on p.id = at.prospect_id
        where at.prospect_id = ${prospectId}
          and at.task_type = 'first_email_draft'
      `;
      assert.ok(identity);
      const originalVisual = await sql<Array<{ visual: unknown }>>`
        select output_snapshot -> 'visual' as visual
        from growth.agent_tasks
        where id = ${identity.draftTaskId}
      `;
      const standards = candidate.firstEmail;
      const founder = {
        email: "founder@example.test",
        actorId: "c".repeat(64),
      };
      const body = (prefix: string) =>
        Array.from({ length: 125 }, (_, index) => `${prefix}${index}`).join(
          " ",
        );

      const first = await reviseFirstEmailDraft(sql, {
        draftTaskId: identity.draftTaskId,
        expectedVersion: 1,
        founder,
        correlationId: correlationIds[0]!,
        subject: "First founder revision",
        paragraphs: [
          body("first"),
          standards.optOutSentence,
          standards.conceptDisclaimer,
        ],
      });
      const raceInputs = [
        {
          correlationId: correlationIds[1]!,
          subject: "Concurrent founder revision A",
          bodyPrefix: "racea",
        },
        {
          correlationId: correlationIds[2]!,
          subject: "Concurrent founder revision B",
          bodyPrefix: "raceb",
        },
      ];
      const raceResults = await Promise.allSettled(
        raceInputs.map((raceInput) =>
          reviseFirstEmailDraft(sql, {
            draftTaskId: identity.draftTaskId,
            expectedVersion: first.version,
            founder,
            correlationId: raceInput.correlationId,
            subject: raceInput.subject,
            paragraphs: [
              body(raceInput.bodyPrefix),
              standards.optOutSentence,
              standards.conceptDisclaimer,
            ],
          }),
        ),
      );
      const winningIndex = raceResults.findIndex(
        (result) => result.status === "fulfilled",
      );
      const conflictIndex = raceResults.findIndex(
        (result) => result.status === "rejected",
      );
      assert.notEqual(winningIndex, -1);
      assert.notEqual(conflictIndex, -1);
      assert.equal(
        raceResults.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        raceResults.filter((result) => result.status === "rejected").length,
        1,
      );
      const winner = raceResults[winningIndex]!;
      const conflict = raceResults[conflictIndex]!;
      assert.equal(winner.status, "fulfilled");
      assert.equal(winner.value.version, 3);
      assert.equal(conflict.status, "rejected");
      assert.ok(conflict.reason instanceof FirstEmailRevisionError);
      assert.equal(conflict.reason.code, "version_conflict");

      await sql`
        insert into growth.sequence_enrollments (
          prospect_id,
          contact_id,
          status
        ) values (
          ${prospectId},
          ${identity.contactId},
          'pending_approval'
        )
      `;
      await assert.rejects(
        reviseFirstEmailDraft(sql, {
          draftTaskId: identity.draftTaskId,
          expectedVersion: 3,
          founder,
          correlationId: correlationIds[3]!,
          subject: "Materialised revision",
          paragraphs: [
            body("blocked"),
            standards.optOutSentence,
            standards.conceptDisclaimer,
          ],
        }),
        (error: unknown) =>
          error instanceof FirstEmailRevisionError &&
          error.code === "not_editable",
      );

      const [stored] = await sql<
        Array<{
          draftVersion: number;
          subject: string;
          revisionCount: number;
          visual: unknown;
        }>
      >`
        select
          (output_snapshot ->> 'draftVersion')::integer as "draftVersion",
          output_snapshot -> 'email' ->> 'subject' as subject,
          jsonb_array_length(output_snapshot -> 'emailRevisions') as "revisionCount",
          output_snapshot -> 'visual' as visual
        from growth.agent_tasks
        where id = ${identity.draftTaskId}
      `;
      const audits = await sql<Array<{ correlationId: string }>>`
        select correlation_id as "correlationId"
        from growth.audit_log
        where correlation_id = any(${correlationIds}::text[])
        order by correlation_id
      `;
      assert.deepEqual(stored, {
        draftVersion: 3,
        subject: raceInputs[winningIndex]!.subject,
        revisionCount: 3,
        visual: originalVisual[0]?.visual,
      });
      assert.deepEqual(
        audits.map((audit) => audit.correlationId),
        [correlationIds[0]!, raceInputs[winningIndex]!.correlationId].sort(),
      );
    } finally {
      await sql`
        delete from growth.sequence_enrollments
        where prospect_id in (
          select p.id
          from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.audit_log
        where correlation_id like ${`${externalRunId}%`}
      `;
      await sql`
        delete from growth.agent_tasks
        where research_run_id in (
          select id from growth.research_runs
          where external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.source_evidence
        where research_run_id in (
          select id from growth.research_runs
          where external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.website_assessments
        where prospect_id in (
          select p.id
          from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.prospect_previews
        where prospect_id in (
          select p.id
          from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.prospects
        where research_run_id in (
          select id from growth.research_runs
          where external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.contacts
        where email = ${contactEmail}
      `;
      await sql`
        delete from growth.businesses
        where company_number = ${companyNumber}
      `;
      await sql`
        delete from growth.research_runs
        where external_run_id = ${externalRunId}
      `;
      await sql.end();
    }
  },
);
