import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { currentLondonMonthKey } from "../../../lib/growth/analytics/definitions";
import { resolveFounderSession, type FounderSession } from "../../../lib/growth/auth/require-founder";
import { getAnalyticsResult } from "../../../lib/growth/dashboard/analytics";
import { getClientDetail, getClientListResult } from "../../../lib/growth/dashboard/clients";
import { getPipelineBoardResult } from "../../../lib/growth/dashboard/pipeline";
import {
  transitionEngagement,
  TransitionEngagementError,
} from "../../../lib/growth/pipeline/transition-engagement";
import { createValidResearchRunFixture } from "../../../lib/growth/research/ingestion-schema.test-fixture";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";

const connectionString = process.env.DIRECT_DATABASE_URL;

const OWNER_EMAIL = "j.ntagengwa@faithfulsoftware.dev";
const FOUNDER: FounderSession = resolveFounderSession(
  { user: { email: OWNER_EMAIL, founderEmailVerified: true } },
  OWNER_EMAIL,
);

type SeededIdentity = {
  externalRunId: string;
  prospectId: string;
  businessId: string;
  contactId: string;
};

/** Creates one real business/contact/prospect through the actual research
 * ingestion pipeline, matching how every other identity in this test suite
 * is seeded - not a hand-built row, so the same identity flows through the
 * rest of the lifecycle exactly as it would for a real accepted lead. */
async function seedIdentity(sql: postgres.Sql, token: string): Promise<SeededIdentity> {
  const fixture = createValidResearchRunFixture();
  const externalRunId = `integration-lifecycle-${token}`;
  fixture.externalRunId = externalRunId;
  const candidate = fixture.prospects[0]!;
  const companyNumber = token.slice(0, 8).toUpperCase();
  candidate.business.companyNumber = companyNumber;
  candidate.business.googlePlaceId = `place-lifecycle-${token}`;
  candidate.contact.email = `lifecycle-${token}@example.test`;
  const companiesHouseEvidence = candidate.evidence.find(
    (evidence) => evidence.sourceType === "companies_house",
  );
  assert.ok(companiesHouseEvidence);
  companiesHouseEvidence.externalReference = companyNumber;
  companiesHouseEvidence.sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;

  const ingestion = await ingestResearchRun(sql, fixture);
  const prospectId = ingestion.acceptedProspects[0]!.prospectId;
  const [identity] = await sql<{ businessId: string; contactId: string }[]>`
    select business_id as "businessId", primary_contact_id as "contactId"
    from growth.prospects where id = ${prospectId}
  `;
  assert.ok(identity);

  return { externalRunId, prospectId, businessId: identity.businessId, contactId: identity.contactId };
}

async function cleanupLifecycle(sql: postgres.Sql, externalRunId: string): Promise<void> {
  await sql`delete from growth.audit_log where correlation_id like ${`${externalRunId}%`}`;
  await sql`
    delete from growth.client_messages
    where engagement_id in (
      select de.id from growth.delivery_engagements de
      inner join growth.prospects p on p.id = de.prospect_id
      inner join growth.research_runs rr on rr.id = p.research_run_id
      where rr.external_run_id = ${externalRunId}
    )
  `;
  await sql`
    delete from growth.commercial_stage_events
    where engagement_id in (
      select de.id from growth.delivery_engagements de
      inner join growth.prospects p on p.id = de.prospect_id
      inner join growth.research_runs rr on rr.id = p.research_run_id
      where rr.external_run_id = ${externalRunId}
    )
  `;
  await sql`
    delete from growth.delivery_engagements
    where prospect_id in (
      select p.id from growth.prospects p
      inner join growth.research_runs rr on rr.id = p.research_run_id
      where rr.external_run_id = ${externalRunId}
    )
  `;
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
  for (const contact of contacts) {
    await sql`delete from growth.contacts where email = ${contact.email}`;
  }
  await sql`delete from growth.research_runs where external_run_id = ${externalRunId}`;
}

async function seedActiveOutreach(
  sql: postgres.Sql,
  prospectId: string,
  contactId: string,
  token: string,
): Promise<{ enrollmentId: string; messageId: string }> {
  const [enrollment] = await sql<{ id: string }[]>`
    insert into growth.sequence_enrollments (prospect_id, contact_id, status, started_at)
    values (${prospectId}, ${contactId}, 'active', now())
    returning id
  `;
  const [message] = await sql<{ id: string }[]>`
    insert into growth.email_messages (
      sequence_enrollment_id, prospect_id, contact_id, channel, direction, step_number,
      status, rfc_message_id, idempotency_key, scheduled_for
    ) values (
      ${enrollment!.id}, ${prospectId}, ${contactId}, 'gmail', 'outbound', 1, 'queued',
      ${`<lifecycle-followup-${token}@example.test>`}, ${`lifecycle-followup-${token}`}, now() + interval '1 day'
    )
    returning id
  `;
  return { enrollmentId: enrollment!.id, messageId: message!.id };
}

test(
  "a prospect's full commercial and delivery lifecycle preserves one identity, records every transition, and is visible consistently across the pipeline, deal, client, and analytics views",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;
    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");

    let externalRunId = "";
    try {
      const identity = await seedIdentity(sql, token);
      externalRunId = identity.externalRunId;
      const { prospectId, businessId, contactId } = identity;

      const [engagement] = await sql<{ id: string; version: number }[]>`
        insert into growth.delivery_engagements (prospect_id, name)
        values (${prospectId}, 'Lifecycle Engagement')
        returning id, version
      `;
      const engagementId = engagement!.id;
      let version = engagement!.version;

      const { enrollmentId, messageId } = await seedActiveOutreach(
        sql,
        prospectId,
        contactId,
        token,
      );

      // --- Commercial: new -> qualified -> proposal -> negotiation -> won ---

      const qualified = await transitionEngagement(
        sql as never,
        { dimension: "commercial", engagementId, expectedVersion: version, toStage: "qualified" },
        { founder: FOUNDER, correlationId: `${externalRunId}-qualified` },
      );
      assert.equal(qualified.stage, "qualified");
      assert.equal(qualified.alreadyApplied, false);
      version += 1;

      // Active outreach stops at qualification.
      const [enrollmentAfterQualify] = await sql<{ status: string }[]>`
        select status from growth.sequence_enrollments where id = ${enrollmentId}
      `;
      assert.equal(enrollmentAfterQualify?.status, "stopped_started_talks");
      const [messageAfterQualify] = await sql<{ status: string }[]>`
        select status from growth.email_messages where id = ${messageId}
      `;
      assert.equal(messageAfterQualify?.status, "cancelled");

      await transitionEngagement(
        sql as never,
        { dimension: "commercial", engagementId, expectedVersion: version, toStage: "proposal" },
        { founder: FOUNDER, correlationId: `${externalRunId}-proposal` },
      );
      version += 1;

      await transitionEngagement(
        sql as never,
        { dimension: "commercial", engagementId, expectedVersion: version, toStage: "negotiation" },
        { founder: FOUNDER, correlationId: `${externalRunId}-negotiation` },
      );
      version += 1;

      const pipelineBeforeWon = await getPipelineBoardResult({ after: {} }, sql as never);
      assert.equal(pipelineBeforeWon.status, "ready");
      const negotiationCountBefore =
        pipelineBeforeWon.status === "ready"
          ? pipelineBeforeWon.data.columns.negotiation.totalCount
          : 0;

      const won = await transitionEngagement(
        sql as never,
        {
          dimension: "commercial",
          engagementId,
          expectedVersion: version,
          toStage: "won",
          oneOffValuePence: 500_000,
        },
        { founder: FOUNDER, correlationId: `${externalRunId}-won` },
      );
      assert.equal(won.stage, "won");
      version += 1;

      // Pipeline totals drop at won: the engagement leaves every open column.
      const pipelineAfterWon = await getPipelineBoardResult({ after: {} }, sql as never);
      assert.equal(pipelineAfterWon.status, "ready");
      if (pipelineAfterWon.status === "ready") {
        assert.equal(
          pipelineAfterWon.data.columns.negotiation.totalCount,
          negotiationCountBefore - 1,
        );
        for (const column of Object.values(pipelineAfterWon.data.columns)) {
          assert.ok(
            !column.rows.some((row) => row.engagementId === engagementId),
            `won engagement must not appear in the open ${column.stage} column`,
          );
        }
      }

      // Client view appears at won.
      const clientListAtWon = await getClientListResult(
        { status: "all", after: null },
        sql as never,
      );
      assert.equal(clientListAtWon.status, "ready");
      if (clientListAtWon.status === "ready") {
        const row = clientListAtWon.data.rows.find((r) => r.businessId === businessId);
        assert.ok(row, "the won business must appear in the client list");
        assert.equal(row?.engagementCount, 1);
        assert.equal(row?.latestDeliveryStatus, "not_started");
      }

      const clientDetailAtWon = await getClientDetail(businessId, sql as never);
      assert.equal(clientDetailAtWon.status, "found");
      if (clientDetailAtWon.status === "found") {
        assert.equal(clientDetailAtWon.data.engagements.length, 1);
        assert.equal(clientDetailAtWon.data.engagements[0]?.deliveryStatus, "not_started");
      }

      // --- Delivery: not_started -> discovery -> build -> review -> complete ---

      for (const toStatus of ["discovery", "build", "review"] as const) {
        await transitionEngagement(
          sql as never,
          { dimension: "delivery", engagementId, expectedVersion: version, toStatus },
          { founder: FOUNDER, correlationId: `${externalRunId}-${toStatus}` },
        );
        version += 1;
      }

      await transitionEngagement(
        sql as never,
        {
          dimension: "delivery",
          engagementId,
          expectedVersion: version,
          toStatus: "complete",
          includeNewsletterInvite: true,
        },
        { founder: FOUNDER, correlationId: `${externalRunId}-complete` },
      );
      version += 1;

      // Completion creates one reviewable client thank-you, still pending
      // approval - the transition never calls Resend and never creates consent.
      const clientMessages = await sql<
        { id: string; status: string; includedNewsletterInvite: boolean }[]
      >`
        select id, status, included_newsletter_invite as "includedNewsletterInvite"
        from growth.client_messages where engagement_id = ${engagementId}
      `;
      assert.equal(clientMessages.length, 1);
      assert.equal(clientMessages[0]?.status, "pending_approval");
      assert.equal(clientMessages[0]?.includedNewsletterInvite, true);

      const [contactRow] = await sql<{ normalisedEmail: string }[]>`
        select normalised_email as "normalisedEmail" from growth.contacts where id = ${contactId}
      `;
      const [subscriberRow] = await sql<{ count: number }[]>`
        select count(*)::int as count from growth.newsletter_subscribers
        where normalised_email = ${contactRow!.normalisedEmail}
      `;
      assert.equal(subscriberRow?.count, 0, "completion must never create newsletter consent");

      // Delivery view changed without duplicate client records.
      const clientListAtComplete = await getClientListResult(
        { status: "all", after: null },
        sql as never,
      );
      assert.equal(clientListAtComplete.status, "ready");
      if (clientListAtComplete.status === "ready") {
        const rowsForBusiness = clientListAtComplete.data.rows.filter(
          (r) => r.businessId === businessId,
        );
        assert.equal(rowsForBusiness.length, 1, "one business must appear exactly once");
        assert.equal(rowsForBusiness[0]?.engagementCount, 1);
        assert.equal(rowsForBusiness[0]?.latestDeliveryStatus, "complete");
      }

      // One event exists for every transition: 4 commercial + 4 delivery.
      const [eventCountRow] = await sql<{ count: number }[]>`
        select count(*)::int as count from growth.commercial_stage_events
        where engagement_id = ${engagementId}
      `;
      assert.equal(eventCountRow?.count, 8);
      const [commercialCountRow] = await sql<{ count: number }[]>`
        select count(*)::int as count from growth.commercial_stage_events
        where engagement_id = ${engagementId} and dimension = 'commercial'
      `;
      assert.equal(commercialCountRow?.count, 4);
      const [deliveryCountRow] = await sql<{ count: number }[]>`
        select count(*)::int as count from growth.commercial_stage_events
        where engagement_id = ${engagementId} and dimension = 'delivery'
      `;
      assert.equal(deliveryCountRow?.count, 4);

      // Analytics reconcile: the win and the completed delivery value both
      // show up in the current London calendar month.
      const month = currentLondonMonthKey(new Date());
      const analytics = await getAnalyticsResult({ month }, sql as never);
      assert.equal(analytics.status, "ready");
      if (analytics.status === "ready") {
        assert.ok(analytics.data.funnel.wins >= 1);
        assert.ok(analytics.data.values.agreedWonValuePence >= 500_000);
        assert.ok(analytics.data.values.completedDeliveryValuePence >= 500_000);
      }

      // One business and contact identity remain; one engagement row changed
      // state rather than a new row being created for each stage.
      const [businessCountRow] = await sql<{ count: number }[]>`
        select count(*)::int as count from growth.businesses where id = ${businessId}
      `;
      assert.equal(businessCountRow?.count, 1);
      const [contactCountRow] = await sql<{ count: number }[]>`
        select count(*)::int as count from growth.contacts where id = ${contactId}
      `;
      assert.equal(contactCountRow?.count, 1);
      const [engagementCountRow] = await sql<{ count: number }[]>`
        select count(*)::int as count from growth.delivery_engagements where prospect_id = ${prospectId}
      `;
      assert.equal(engagementCountRow?.count, 1);
    } finally {
      if (externalRunId) await cleanupLifecycle(sql, externalRunId);
      await sql.end();
    }
  },
);

// --- Negative lifecycle tests -----------------------------------------------

async function seedBareEngagement(
  sql: postgres.Sql,
  token: string,
): Promise<{ externalRunId: string; engagementId: string; version: number; prospectId: string }> {
  const identity = await seedIdentity(sql, token);
  const [engagement] = await sql<{ id: string; version: number }[]>`
    insert into growth.delivery_engagements (prospect_id, name)
    values (${identity.prospectId}, 'Negative Test Engagement')
    returning id, version
  `;
  return {
    externalRunId: identity.externalRunId,
    engagementId: engagement!.id,
    version: engagement!.version,
    prospectId: identity.prospectId,
  };
}

test("a stale version is rejected with a conflict, not applied", { skip: !connectionString }, async () => {
  if (!connectionString) return;
  const sql = postgres(connectionString, { max: 2 });
  const token = randomUUID().replaceAll("-", "");
  let externalRunId = "";
  try {
    const seeded = await seedBareEngagement(sql, token);
    externalRunId = seeded.externalRunId;

    await assert.rejects(
      transitionEngagement(
        sql as never,
        {
          dimension: "commercial",
          engagementId: seeded.engagementId,
          expectedVersion: seeded.version + 1,
          toStage: "qualified",
        },
        { founder: FOUNDER, correlationId: `${externalRunId}-stale` },
      ),
      (error: unknown) =>
        error instanceof TransitionEngagementError && error.code === "version_conflict",
    );

    const [row] = await sql<{ stage: string; version: number }[]>`
      select stage, version from growth.delivery_engagements where id = ${seeded.engagementId}
    `;
    assert.equal(row?.stage, "new");
    assert.equal(row?.version, seeded.version);
  } finally {
    if (externalRunId) await cleanupLifecycle(sql, externalRunId);
    await sql.end();
  }
});

test("an invalid commercial jump is rejected", { skip: !connectionString }, async () => {
  if (!connectionString) return;
  const sql = postgres(connectionString, { max: 2 });
  const token = randomUUID().replaceAll("-", "");
  let externalRunId = "";
  try {
    const seeded = await seedBareEngagement(sql, token);
    externalRunId = seeded.externalRunId;

    await assert.rejects(
      transitionEngagement(
        sql as never,
        {
          dimension: "commercial",
          engagementId: seeded.engagementId,
          expectedVersion: seeded.version,
          toStage: "negotiation",
        },
        { founder: FOUNDER, correlationId: `${externalRunId}-invalid-jump` },
      ),
      (error: unknown) =>
        error instanceof TransitionEngagementError && error.code === "invalid_transition",
    );
  } finally {
    if (externalRunId) await cleanupLifecycle(sql, externalRunId);
    await sql.end();
  }
});

test("delivery cannot start before the commercial stage is won", { skip: !connectionString }, async () => {
  if (!connectionString) return;
  const sql = postgres(connectionString, { max: 2 });
  const token = randomUUID().replaceAll("-", "");
  let externalRunId = "";
  try {
    const seeded = await seedBareEngagement(sql, token);
    externalRunId = seeded.externalRunId;

    await assert.rejects(
      transitionEngagement(
        sql as never,
        {
          dimension: "delivery",
          engagementId: seeded.engagementId,
          expectedVersion: seeded.version,
          toStatus: "discovery",
        },
        { founder: FOUNDER, correlationId: `${externalRunId}-delivery-before-won` },
      ),
      (error: unknown) =>
        error instanceof TransitionEngagementError && error.code === "delivery_requires_won",
    );
  } finally {
    if (externalRunId) await cleanupLifecycle(sql, externalRunId);
    await sql.end();
  }
});

test("a won transition without any value is rejected before it reaches the database", { skip: !connectionString }, async () => {
  if (!connectionString) return;
  const sql = postgres(connectionString, { max: 2 });
  const token = randomUUID().replaceAll("-", "");
  let externalRunId = "";
  try {
    const seeded = await seedBareEngagement(sql, token);
    externalRunId = seeded.externalRunId;
    await transitionEngagement(
      sql as never,
      {
        dimension: "commercial",
        engagementId: seeded.engagementId,
        expectedVersion: seeded.version,
        toStage: "qualified",
      },
      { founder: FOUNDER, correlationId: `${externalRunId}-q` },
    );
    await transitionEngagement(
      sql as never,
      {
        dimension: "commercial",
        engagementId: seeded.engagementId,
        expectedVersion: seeded.version + 1,
        toStage: "proposal",
      },
      { founder: FOUNDER, correlationId: `${externalRunId}-p` },
    );
    await transitionEngagement(
      sql as never,
      {
        dimension: "commercial",
        engagementId: seeded.engagementId,
        expectedVersion: seeded.version + 2,
        toStage: "negotiation",
      },
      { founder: FOUNDER, correlationId: `${externalRunId}-n` },
    );

    await assert.rejects(
      transitionEngagement(
        sql as never,
        {
          dimension: "commercial",
          engagementId: seeded.engagementId,
          expectedVersion: seeded.version + 3,
          toStage: "won",
        },
        { founder: FOUNDER, correlationId: `${externalRunId}-won-no-value` },
      ),
    );

    const [row] = await sql<{ stage: string }[]>`
      select stage from growth.delivery_engagements where id = ${seeded.engagementId}
    `;
    assert.equal(row?.stage, "negotiation");
  } finally {
    if (externalRunId) await cleanupLifecycle(sql, externalRunId);
    await sql.end();
  }
});

test("a lost transition without a reason is rejected", { skip: !connectionString }, async () => {
  if (!connectionString) return;
  const sql = postgres(connectionString, { max: 2 });
  const token = randomUUID().replaceAll("-", "");
  let externalRunId = "";
  try {
    const seeded = await seedBareEngagement(sql, token);
    externalRunId = seeded.externalRunId;

    await assert.rejects(
      transitionEngagement(
        sql as never,
        {
          dimension: "commercial",
          engagementId: seeded.engagementId,
          expectedVersion: seeded.version,
          toStage: "lost",
        },
        { founder: FOUNDER, correlationId: `${externalRunId}-lost-no-reason` },
      ),
    );

    const [row] = await sql<{ stage: string }[]>`
      select stage from growth.delivery_engagements where id = ${seeded.engagementId}
    `;
    assert.equal(row?.stage, "new");
  } finally {
    if (externalRunId) await cleanupLifecycle(sql, externalRunId);
    await sql.end();
  }
});

async function seedWonEngagement(
  sql: postgres.Sql,
  token: string,
): Promise<{ externalRunId: string; engagementId: string; version: number }> {
  const seeded = await seedBareEngagement(sql, token);
  let version = seeded.version;
  for (const toStage of ["qualified", "proposal", "negotiation"] as const) {
    await transitionEngagement(
      sql as never,
      { dimension: "commercial", engagementId: seeded.engagementId, expectedVersion: version, toStage },
      { founder: FOUNDER, correlationId: `${seeded.externalRunId}-${toStage}` },
    );
    version += 1;
  }
  await transitionEngagement(
    sql as never,
    {
      dimension: "commercial",
      engagementId: seeded.engagementId,
      expectedVersion: version,
      toStage: "won",
      oneOffValuePence: 100_000,
    },
    { founder: FOUNDER, correlationId: `${seeded.externalRunId}-won` },
  );
  version += 1;
  return { externalRunId: seeded.externalRunId, engagementId: seeded.engagementId, version };
}

test("a cancelled delivery without a reason is rejected", { skip: !connectionString }, async () => {
  if (!connectionString) return;
  const sql = postgres(connectionString, { max: 2 });
  const token = randomUUID().replaceAll("-", "");
  let externalRunId = "";
  try {
    const won = await seedWonEngagement(sql, token);
    externalRunId = won.externalRunId;

    await assert.rejects(
      transitionEngagement(
        sql as never,
        {
          dimension: "delivery",
          engagementId: won.engagementId,
          expectedVersion: won.version,
          toStatus: "cancelled",
        },
        { founder: FOUNDER, correlationId: `${externalRunId}-cancel-no-reason` },
      ),
    );
  } finally {
    if (externalRunId) await cleanupLifecycle(sql, externalRunId);
    await sql.end();
  }
});

test("a won terminal engagement cannot be reopened", { skip: !connectionString }, async () => {
  if (!connectionString) return;
  const sql = postgres(connectionString, { max: 2 });
  const token = randomUUID().replaceAll("-", "");
  let externalRunId = "";
  try {
    const won = await seedWonEngagement(sql, token);
    externalRunId = won.externalRunId;

    await assert.rejects(
      transitionEngagement(
        sql as never,
        {
          dimension: "commercial",
          engagementId: won.engagementId,
          expectedVersion: won.version,
          toStage: "qualified",
        },
        { founder: FOUNDER, correlationId: `${externalRunId}-reopen` },
      ),
      (error: unknown) =>
        error instanceof TransitionEngagementError && error.code === "invalid_transition",
    );

    // The database itself rejects it too, independent of the app layer.
    await assert.rejects(
      sql`update growth.delivery_engagements set stage = 'qualified' where id = ${won.engagementId}`,
      /cannot be reopened/,
    );
  } finally {
    if (externalRunId) await cleanupLifecycle(sql, externalRunId);
    await sql.end();
  }
});

test("a second engagement for the same prospect is rejected at the database level", { skip: !connectionString }, async () => {
  if (!connectionString) return;
  const sql = postgres(connectionString, { max: 2 });
  const token = randomUUID().replaceAll("-", "");
  let externalRunId = "";
  try {
    const seeded = await seedBareEngagement(sql, token);
    externalRunId = seeded.externalRunId;

    await assert.rejects(
      sql`
        insert into growth.delivery_engagements (prospect_id, name)
        values (${seeded.prospectId}, 'Duplicate Engagement')
      `,
      /unique_engagement_prospect|duplicate key/,
    );
  } finally {
    if (externalRunId) await cleanupLifecycle(sql, externalRunId);
    await sql.end();
  }
});

test("two concurrent, conflicting transitions leave exactly one winner", { skip: !connectionString }, async () => {
  if (!connectionString) return;
  const sql = postgres(connectionString, { max: 4 });
  const token = randomUUID().replaceAll("-", "");
  let externalRunId = "";
  try {
    const seeded = await seedBareEngagement(sql, token);
    externalRunId = seeded.externalRunId;

    const results = await Promise.allSettled([
      transitionEngagement(
        sql as never,
        {
          dimension: "commercial",
          engagementId: seeded.engagementId,
          expectedVersion: seeded.version,
          toStage: "qualified",
        },
        { founder: FOUNDER, correlationId: `${externalRunId}-race-a` },
      ),
      transitionEngagement(
        sql as never,
        {
          dimension: "commercial",
          engagementId: seeded.engagementId,
          expectedVersion: seeded.version,
          toStage: "lost",
          reasonCode: "race_test",
        },
        { founder: FOUNDER, correlationId: `${externalRunId}-race-b` },
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, "exactly one concurrent transition must succeed");
    assert.equal(rejected.length, 1, "the other must be rejected as a version conflict");

    const rejection = rejected[0] as PromiseRejectedResult;
    assert.ok(
      rejection.reason instanceof TransitionEngagementError &&
        rejection.reason.code === "version_conflict",
    );

    const [row] = await sql<{ stage: string; version: number }[]>`
      select stage, version from growth.delivery_engagements where id = ${seeded.engagementId}
    `;
    assert.ok(row?.stage === "qualified" || row?.stage === "lost");
    assert.equal(row?.version, seeded.version + 1);

    const [eventCountRow] = await sql<{ count: number }[]>`
      select count(*)::int as count from growth.commercial_stage_events
      where engagement_id = ${seeded.engagementId}
    `;
    assert.equal(eventCountRow?.count, 1, "only the winning transition records an event");
  } finally {
    if (externalRunId) await cleanupLifecycle(sql, externalRunId);
    await sql.end();
  }
});
