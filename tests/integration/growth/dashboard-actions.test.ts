import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import {
  resolveFounderSession,
  type FounderSession,
} from "../../../lib/growth/auth/require-founder";
import type { ResendGateway } from "../../../lib/growth/integrations/resend/client";
import {
  createFounderTestSender,
  createIssueApproveAndScheduler,
  createPostgresNewsletterIssueDependencies,
  UNSUBSCRIBE_URL_PLACEHOLDER,
} from "../../../lib/growth/newsletter/issues";
import { createApproveSendHandler } from "../../../lib/growth/sequences/approve-send-route-handler";
import { createNeedsRedraftHandler } from "../../../lib/growth/sequences/needs-redraft-route-handler";
import { createStopRouteHandler } from "../../../lib/growth/sequences/stop-route-handler";
import { createProspectStatusTransitionRouteHandler } from "../../../lib/growth/prospects/status-transition-route-handler";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createValidResearchRunFixture } from "../../../lib/growth/research/ingestion-schema.test-fixture";

const connectionString = process.env.DIRECT_DATABASE_URL;

const ROUTE_ORIGIN = "https://faithfulsoftwaresolutions.co.uk";
const OWNER_EMAIL = "j.ntagengwa@faithfulsoftware.dev";
const FOUNDER: FounderSession = resolveFounderSession(
  { user: { email: OWNER_EMAIL, founderEmailVerified: true } },
  OWNER_EMAIL,
);

/** Real, integration-level auth decisions, matching how every route.ts in
 * this codebase actually authorises a request — just with a hand-built
 * session in place of a live NextAuth JWT, since `auth()` reads
 * `next/headers` and cannot run outside a real Next.js request (calling the
 * real route.ts `POST` exports directly from `node --test` throws on that,
 * not on a clean 401). */
function authorizeAs(
  session: { email?: string; verified?: boolean } | null,
): () => Promise<FounderSession> {
  return async () =>
    resolveFounderSession(
      session
        ? { user: { email: session.email, founderEmailVerified: session.verified } }
        : null,
      OWNER_EMAIL,
    );
}

function createRequest(
  url: string,
  body: unknown,
  origin: string | null = ROUTE_ORIGIN,
): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(origin === null ? {} : { origin }),
    },
    body: JSON.stringify(body),
  });
}

async function seedProspectWithDraft(
  sql: postgres.Sql,
  token: string,
): Promise<{ prospectId: string; draftTaskId: string; researchRunId: string }> {
  const fixture = createValidResearchRunFixture();
  const externalRunId = `integration-dashboard-actions-${token}`;
  fixture.externalRunId = externalRunId;
  const candidate = fixture.prospects[0]!;
  const companyNumber = token.slice(0, 12).toUpperCase();
  candidate.business.companyNumber = companyNumber;
  candidate.business.googlePlaceId = `place-${token}`;
  candidate.contact.email = `dashboard-actions-${token}@example.test`;
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
    select at.id as "draftTaskId", at.research_run_id as "researchRunId"
    from growth.agent_tasks at
    where at.prospect_id = ${prospectId} and at.task_type = 'first_email_draft'
  `;
  assert.ok(identity);
  return { prospectId, draftTaskId: identity.draftTaskId, researchRunId: identity.researchRunId };
}

async function cleanupResearchRun(
  sql: postgres.Sql,
  externalRunId: string,
): Promise<void> {
  await sql`delete from growth.audit_log where correlation_id like ${`${externalRunId}%`}`;
  await sql`
    delete from growth.email_messages
    where sequence_enrollment_id in (
      select se.id from growth.sequence_enrollments se
      inner join growth.prospects p on p.id = se.prospect_id
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
  await sql`
    delete from growth.suppressions
    where normalised_email in (
      select c.normalised_email from growth.contacts c
      inner join growth.prospects p on p.primary_contact_id = c.id
      inner join growth.research_runs rr on rr.id = p.research_run_id
      where rr.external_run_id = ${externalRunId}
    )
  `;
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
  const contacts = await sql<{ email: string }[]>`
    select c.email from growth.contacts c
    inner join growth.prospects p on p.primary_contact_id = c.id
    inner join growth.research_runs rr on rr.id = p.research_run_id
    where rr.external_run_id = ${externalRunId}
  `;
  await sql`
    delete from growth.prospects
    where research_run_id in (select id from growth.research_runs where external_run_id = ${externalRunId})
  `;
  for (const contact of contacts) {
    await sql`delete from growth.contacts where email = ${contact.email}`;
  }
  await sql`delete from growth.research_runs where external_run_id = ${externalRunId}`;
}

test(
  "founder-only mutation routes reject unauthenticated, wrong-account, wrong-origin, and stale-version requests, and only apply for the real founder",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-dashboard-actions-${token}`;

    try {
      const { prospectId } = await seedProspectWithDraft(sql, token);
      const [before] = await sql<{ version: number; status: string }[]>`
        select version, status from growth.prospects where id = ${prospectId}
      `;
      assert.ok(before);

      const url = `${ROUTE_ORIGIN}/api/growth/prospects/${prospectId}/do-not-contact`;
      const context = { params: Promise.resolve({ id: prospectId }) };
      const handler = createProspectStatusTransitionRouteHandler("do_not_contact", {
        db: sql as never,
        config: { origin: ROUTE_ORIGIN },
        authorizeFounder: authorizeAs({ email: OWNER_EMAIL, verified: true }),
        createCorrelationId: randomUUID,
        reportUnexpectedError: () => undefined,
      });

      // Unauthenticated: no session at all.
      const unauthenticatedHandler = createProspectStatusTransitionRouteHandler(
        "do_not_contact",
        {
          db: sql as never,
          config: { origin: ROUTE_ORIGIN },
          authorizeFounder: authorizeAs(null),
          createCorrelationId: randomUUID,
          reportUnexpectedError: () => undefined,
        },
      );
      const unauthenticated = await unauthenticatedHandler(
        createRequest(url, { expectedVersion: before.version }),
        context,
      );
      assert.equal(unauthenticated.status, 401);

      // Wrong account: a real, verified session for someone who isn't the founder.
      const wrongAccountHandler = createProspectStatusTransitionRouteHandler(
        "do_not_contact",
        {
          db: sql as never,
          config: { origin: ROUTE_ORIGIN },
          authorizeFounder: authorizeAs({
            email: "someone-else@example.test",
            verified: true,
          }),
          createCorrelationId: randomUUID,
          reportUnexpectedError: () => undefined,
        },
      );
      const wrongAccount = await wrongAccountHandler(
        createRequest(url, { expectedVersion: before.version }),
        context,
      );
      assert.equal(wrongAccount.status, 401);

      // CSRF: right founder, wrong request origin.
      const wrongOrigin = await handler(
        createRequest(url, { expectedVersion: before.version }, "https://attacker.test"),
        context,
      );
      assert.equal(wrongOrigin.status, 400);

      // Stale record version: right founder, right origin, wrong version.
      const staleVersion = await handler(
        createRequest(url, { expectedVersion: before.version + 1 }),
        context,
      );
      assert.equal(staleVersion.status, 409);
      const staleBody = (await staleVersion.json()) as { code: string };
      assert.equal(staleBody.code, "version_conflict");

      const [afterRejections] = await sql<{ status: string }[]>`
        select status from growth.prospects where id = ${prospectId}
      `;
      assert.equal(
        afterRejections?.status,
        before.status,
        "none of the rejected requests changed the prospect",
      );

      // Founder access: succeeds, suppresses the prospect, and audits it.
      const success = await handler(
        createRequest(url, { expectedVersion: before.version }),
        context,
      );
      assert.equal(success.status, 200);
      const successBody = (await success.json()) as { status: string };
      assert.equal(successBody.status, "suppressed");

      const [after] = await sql<{ status: string }[]>`
        select status from growth.prospects where id = ${prospectId}
      `;
      assert.equal(after?.status, "suppressed");

      const [suppression] = await sql<{ reason: string }[]>`
        select reason from growth.suppressions
        where normalised_email in (
          select normalised_email from growth.contacts where id = (
            select primary_contact_id from growth.prospects where id = ${prospectId}
          )
        )
      `;
      assert.equal(suppression?.reason, "do_not_contact");

      const [audit] = await sql<{ action: string }[]>`
        select action from growth.audit_log
        where entity_type = 'prospect' and entity_id = ${prospectId}
        order by created_at desc
        limit 1
      `;
      assert.equal(audit?.action, "prospect.status_transitioned.do_not_contact");
    } finally {
      await cleanupResearchRun(sql, externalRunId);
      await sql.end();
    }
  },
);

test(
  "the founder can approve a queued first email, which starts an active sequence the founder can then pause",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-dashboard-actions-${token}`;

    try {
      const { draftTaskId } = await seedProspectWithDraft(sql, token);
      const context = { params: Promise.resolve({ id: draftTaskId }) };

      const approveHandler = createApproveSendHandler({
        db: sql as never,
        config: { origin: ROUTE_ORIGIN },
        founderEmail: OWNER_EMAIL,
        siteOrigin: ROUTE_ORIGIN,
        authorizeFounder: authorizeAs({ email: OWNER_EMAIL, verified: true }),
        createCorrelationId: randomUUID,
        reportUnexpectedError: () => undefined,
      });

      const approveResponse = await approveHandler(
        createRequest(
          `${ROUTE_ORIGIN}/api/growth/messages/${draftTaskId}/approve-send`,
          { expectedVersion: 1 },
        ),
        context,
      );
      assert.equal(approveResponse.status, 200);
      const approved = (await approveResponse.json()) as {
        status: string;
        sequenceEnrollmentId: string;
      };
      assert.equal(approved.status, "queued");

      const [enrollmentAfterApprove] = await sql<{ status: string }[]>`
        select status from growth.sequence_enrollments where id = ${approved.sequenceEnrollmentId}
      `;
      assert.equal(enrollmentAfterApprove?.status, "active");

      const pauseHandler = createStopRouteHandler("pause", {
        db: sql as never,
        config: { origin: ROUTE_ORIGIN },
        authorizeFounder: authorizeAs({ email: OWNER_EMAIL, verified: true }),
        createCorrelationId: randomUUID,
        reportUnexpectedError: () => undefined,
      });
      const pauseResponse = await pauseHandler(
        createRequest(
          `${ROUTE_ORIGIN}/api/growth/sequences/${approved.sequenceEnrollmentId}/pause`,
          {},
        ),
        { params: Promise.resolve({ id: approved.sequenceEnrollmentId }) },
      );
      assert.equal(pauseResponse.status, 200);

      const [enrollmentAfterPause] = await sql<{ status: string }[]>`
        select status from growth.sequence_enrollments where id = ${approved.sequenceEnrollmentId}
      `;
      assert.equal(enrollmentAfterPause?.status, "paused");
    } finally {
      await cleanupResearchRun(sql, externalRunId);
      await sql.end();
    }
  },
);

test(
  "the founder can send a first-email draft back for redraft",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-dashboard-actions-${token}`;

    try {
      const { draftTaskId } = await seedProspectWithDraft(sql, token);
      const context = { params: Promise.resolve({ id: draftTaskId }) };

      const handler = createNeedsRedraftHandler({
        db: sql as never,
        config: { origin: ROUTE_ORIGIN },
        authorizeFounder: authorizeAs({ email: OWNER_EMAIL, verified: true }),
        createCorrelationId: randomUUID,
        reportUnexpectedError: () => undefined,
      });

      const response = await handler(
        createRequest(
          `${ROUTE_ORIGIN}/api/growth/messages/${draftTaskId}/needs-redraft`,
          {
            expectedVersion: 1,
            reason: "The offer needs to reference their new service line.",
          },
        ),
        context,
      );
      assert.equal(response.status, 200);

      const [redraftTask] = await sql<{ taskType: string; status: string }[]>`
        select task_type as "taskType", status from growth.agent_tasks
        where input_snapshot ->> 'redraftOfDraftTaskId' = ${draftTaskId}
        order by created_at desc
        limit 1
      `;
      assert.equal(redraftTask?.taskType, "first_email_redraft");
      assert.equal(redraftTask?.status, "pending");
    } finally {
      await cleanupResearchRun(sql, externalRunId);
      await sql.end();
    }
  },
);

test(
  "the founder can send a newsletter test to themselves, then approve and schedule the issue",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const issueKey = `integration-dashboard-actions-${randomUUID()}`;
    let issueId: string | undefined;

    function fakeResend(): {
      gateway: Pick<ResendGateway, "send">;
      sent: Parameters<ResendGateway["send"]>[0][];
    } {
      const sent: Parameters<ResendGateway["send"]>[0][] = [];
      return {
        sent,
        gateway: {
          send: async (message) => {
            sent.push(message);
            return { providerMessageId: `provider-${randomUUID()}` };
          },
        },
      };
    }

    try {
      const html = `<html><body><p>Field Notes</p><a href="${UNSUBSCRIBE_URL_PLACEHOLDER}">Unsubscribe</a></body></html>`;
      const text = `Field Notes\nUnsubscribe: ${UNSUBSCRIBE_URL_PLACEHOLDER}`;
      const [row] = await sql<{ id: string }[]>`
        insert into growth.newsletter_issues (
          issue_key, status, subject, preview_text, html_snapshot, text_snapshot, created_by
        ) values (
          ${issueKey}, 'ready_for_review', 'Field Notes #1', 'This week in Field Notes',
          ${html}, ${text}, 'integration-test'
        )
        returning id
      `;
      issueId = row!.id;

      const issueRepository = createPostgresNewsletterIssueDependencies(sql);
      const testSend = fakeResend();
      const sendFounderTest = createFounderTestSender({
        repository: issueRepository,
        resend: testSend.gateway,
        fromEmail: "notifications@faithfulsoftwaresolutions.co.uk",
        founderEmail: OWNER_EMAIL,
        unsubscribeTokenSecret: "integration-test-unsubscribe-secret-32ch",
        siteOrigin: ROUTE_ORIGIN,
      });
      await sendFounderTest(sql, {
        issueId,
        founder: FOUNDER,
        correlationId: randomUUID(),
      });
      assert.equal(testSend.sent.length, 1);
      assert.equal(testSend.sent[0]?.to, OWNER_EMAIL);

      const [afterTest] = await sql<{ testSentVersion: number | null }[]>`
        select test_sent_version as "testSentVersion" from growth.newsletter_issues
        where id = ${issueId}
      `;
      assert.equal(afterTest?.testSentVersion, 1);

      const approveAndSchedule = createIssueApproveAndScheduler({
        repository: issueRepository,
      });
      const scheduledFor = new Date(Date.now() + 60_000);
      const scheduled = await approveAndSchedule(sql, {
        issueId,
        expectedVersion: 1,
        scheduledFor,
        founder: FOUNDER,
        correlationId: randomUUID(),
      });
      assert.equal(scheduled.status, "scheduled");

      const [afterSchedule] = await sql<
        { status: string; scheduledFor: Date | null }[]
      >`
        select status, scheduled_for as "scheduledFor" from growth.newsletter_issues
        where id = ${issueId}
      `;
      assert.equal(afterSchedule?.status, "scheduled");
      assert.equal(
        afterSchedule?.scheduledFor?.getTime(),
        scheduledFor.getTime(),
      );

      const audits = await sql<{ action: string }[]>`
        select action from growth.audit_log
        where entity_type = 'newsletter_issue' and entity_id = ${issueId}
        order by created_at asc
      `;
      assert.deepEqual(
        audits.map((row) => row.action),
        [
          "newsletter_issue.test_sent",
          "newsletter_issue.approved",
          "newsletter_issue.scheduled",
        ],
      );
    } finally {
      if (issueId) {
        await sql`delete from growth.audit_log where entity_type = 'newsletter_issue' and entity_id = ${issueId}`;
        await sql`delete from growth.newsletter_issues where id = ${issueId}`;
      }
      await sql.end();
    }
  },
);
