import assert from "node:assert/strict";
import type postgres from "postgres";
import { createFirstEmailApprover } from "../../../lib/growth/sequences/approval";
import { postgresFirstEmailApprovalRepository } from "../../../lib/growth/sequences/approval-repository";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createValidResearchRunFixture } from "../../../lib/growth/research/ingestion-schema.test-fixture";

const founder = { email: "founder@example.test", actorId: "f".repeat(64) };
export const FOUNDER_EMAIL = "j.ntagengwa@faithfulsoftware.dev";

export async function setUpBoundBaseline(
  sql: postgres.Sql,
  connectionId: string,
) {
  const at = new Date("2026-01-01T00:00:00Z");
  await sql`insert into growth.integration_connections(id,provider,subject_email,status,provider_cursor,google_subject,granted_scopes) values (${connectionId},'gmail',${FOUNDER_EMAIL},'connected','100','test-subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
  await sql`insert into growth.gmail_reply_coverage(connection_id,grant_epoch,google_subject,history_end,observed_until,head_requested_at,head_responded_at,state,reason) values (${connectionId},1,'test-subject','100',${at},${at},${at},'gap','initial_history_unknown')`;
  return {
    connectionId,
    googleSubject: "test-subject",
    grantEpoch: 1,
    grantedScopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  };
}

export async function setUpApprovedGmailDraft(
  sql: postgres.Sql,
  externalRunId: string,
  companyNumber: string,
  contactEmail: string,
) {
  const fixture = createValidResearchRunFixture();
  fixture.externalRunId = externalRunId;
  const candidate = fixture.prospects[0]!;
  candidate.business.companyNumber = companyNumber;
  candidate.business.googlePlaceId = `place-${companyNumber}`;
  candidate.contact.email = contactEmail;
  const companiesHouseEvidence = candidate.evidence.find(
    (evidence) => evidence.sourceType === "companies_house",
  );
  assert.ok(companiesHouseEvidence);
  companiesHouseEvidence.externalReference = companyNumber;
  companiesHouseEvidence.sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;

  const ingestion = await ingestResearchRun(sql, fixture);
  const prospectId = ingestion.acceptedProspects[0]!.prospectId;
  const [identity] = await sql<Array<{ draftTaskId: string }>>`
    select at.id as "draftTaskId"
    from growth.agent_tasks at
    where at.prospect_id = ${prospectId}
      and at.task_type = 'first_email_draft'
  `;
  assert.ok(identity);

  const approve = createFirstEmailApprover({
    repository: postgresFirstEmailApprovalRepository,
    gmailClient: {
      createDraft: async () => ({
        draftId: "provider-draft-1",
        messageId: "provider-draft-message-1",
        gmailThreadId: "provider-draft-thread-1",
      }),
    },
    founderEmail: FOUNDER_EMAIL,
    siteOrigin: "https://faithfulsoftwaresolutions.co.uk",
  });
  const approved = await approve(sql, {
    draftTaskId: identity.draftTaskId,
    expectedVersion: 1,
    founder,
    correlationId: `${externalRunId}-approve`,
    sendMode: "gmail_draft",
  });

  return { prospectId, approved };
}

export async function cleanUp(
  sql: postgres.Sql,
  externalRunId: string,
  contactEmail: string,
  companyNumber: string,
) {
  await sql`
    update growth.sequence_enrollments set first_message_id = null
    where prospect_id in (
      select p.id from growth.prospects p
      inner join growth.research_runs rr on rr.id = p.research_run_id
      where rr.external_run_id = ${externalRunId}
    )
  `;
  await sql`
    delete from growth.email_events
    where email_message_id in (
      select em.id from growth.email_messages em
      inner join growth.prospects p on p.id = em.prospect_id
      inner join growth.research_runs rr on rr.id = p.research_run_id
      where rr.external_run_id = ${externalRunId}
    )
  `;
  await sql`
    delete from growth.email_messages
    where prospect_id in (
      select p.id from growth.prospects p
      inner join growth.research_runs rr on rr.id = p.research_run_id
      where rr.external_run_id = ${externalRunId}
    )
  `;
  await sql`
    delete from growth.sequence_enrollments
    where prospect_id in (
      select p.id from growth.prospects p
      inner join growth.research_runs rr on rr.id = p.research_run_id
      where rr.external_run_id = ${externalRunId}
    )
  `;
  await sql`delete from growth.audit_log where correlation_id like ${`${externalRunId}%`}`;
  await sql`
    delete from growth.agent_tasks
    where research_run_id in (select id from growth.research_runs where external_run_id = ${externalRunId})
  `;
  await sql`
    delete from growth.source_evidence
    where research_run_id in (select id from growth.research_runs where external_run_id = ${externalRunId})
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
    where research_run_id in (select id from growth.research_runs where external_run_id = ${externalRunId})
  `;
  await sql`delete from growth.contacts where email = ${contactEmail}`;
  await sql`delete from growth.businesses where company_number = ${companyNumber}`;
  await sql`delete from growth.research_runs where external_run_id = ${externalRunId}`;
}
