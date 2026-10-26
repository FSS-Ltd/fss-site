import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { executeCrmCommand } from "../../../lib/growth/crm/commands";
import { captureBusiness } from "../../../lib/growth/crm/lead-repository";
import { CrmError } from "../../../lib/growth/crm/errors";

const connection = process.env.DIRECT_DATABASE_URL;
import {
  crmTestFounder as founder,
  withCrmTestDatabase,
} from "./crm-test-fixtures";

test(
  "CRM capture reuses requests, rejects duplicate open identities and preserves unverified status",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql, lead) => {
      const input = lead();
      const first = await executeCrmCommand(sql, input, founder, randomUUID());
      const replay = await executeCrmCommand(sql, input, founder, randomUUID());
      assert.equal(replay.prospectId, first.prospectId);
      const [row] =
        await sql`select b.corporate_status,b.verified_at,p.status,p.primary_contact_id from growth.prospects p join growth.businesses b on b.id=p.business_id where p.id=${first.prospectId!}`;
      assert.equal(row.corporate_status, "uncertain");
      assert.equal(row.verified_at, null);
      assert.equal(row.status, "needs_review");
      assert.equal(row.primary_contact_id, null);
      await assert.rejects(
        executeCrmCommand(
          sql,
          { ...input, requestId: randomUUID() },
          founder,
          randomUUID(),
        ),
        (error: unknown) =>
          error instanceof CrmError &&
          error.code === "duplicate" &&
          error.prospectId === first.prospectId,
      );
      await assert.rejects(
        executeCrmCommand(
          sql,
          {
            kind: "update_prospect",
            prospectId: first.prospectId!,
            expectedVersion: 99,
            opportunitySummary: "Other",
            recommendedOffer: "Other",
            oneOffMinPence: 0,
            oneOffMaxPence: 100,
            monthlyPence: 0,
          },
          founder,
          randomUUID(),
        ),
        (error: unknown) =>
          error instanceof CrmError && error.code === "version_conflict",
      );
      const [audit] =
        await sql`select count(*)::int count from growth.audit_log where entity_id=${first.prospectId!}`;
      assert.equal(audit.count, 1);
    }),
);
test(
  "enquiry conversion is idempotent and does not create newsletter consent",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql, lead) => {
      const [enquiry] =
        await sql`insert into growth.inbound_leads (submission_id,submission_type,first_name,last_name,work_email,business_name,source_path,source_context,newsletter_opt_in) values (${randomUUID()},'site_enquiry','Ada','Example',${randomUUID() + "@example.test"},'Example','/contact','CRM test',false) returning id,work_email`;
      const input = { ...lead(), inboundLeadId: String(enquiry.id) };
      const first = await executeCrmCommand(sql, input, founder, randomUUID());
      const second = await executeCrmCommand(
        sql,
        { ...input, requestId: randomUUID() },
        founder,
        randomUUID(),
      );
      assert.equal(first.prospectId, second.prospectId);
      const [count] =
        await sql`select count(*)::int count from growth.newsletter_subscribers where normalised_email=${enquiry.work_email}`;
      assert.equal(count.count, 0);
    }),
);

test(
  "manual leads can add a sourced contact and create one deal without approving outreach",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql, lead) => {
      const input = lead();
      const capture = await executeCrmCommand(
        sql,
        input,
        founder,
        randomUUID(),
      );
      const prospectId = capture.prospectId!;
      await executeCrmCommand(
        sql,
        {
          kind: "attach_contact",
          prospectId,
          expectedVersion: 1,
          contact: {
            firstName: "Ada",
            lastName: "Example",
            roleTitle: null,
            email: randomUUID() + "@example.test",
            sourceUrl: "https://example.test/team",
            verifiedAt: "2026-10-25T12:00:00Z",
            lawfulBasis: "legitimate_interests",
          },
        },
        founder,
        randomUUID(),
      );
      const requestId = randomUUID();
      const created = await executeCrmCommand(
        sql,
        {
          kind: "create_opportunity",
          prospectId,
          requestId,
          expectedVersion: 2,
        },
        founder,
        randomUUID(),
      );
      const replay = await executeCrmCommand(
        sql,
        {
          kind: "create_opportunity",
          prospectId,
          requestId,
          expectedVersion: 2,
        },
        founder,
        randomUUID(),
      );
      assert.equal(created.recordId, replay.recordId);
      const [stored] =
        await sql`select p.status,c.subscriber_type,de.stage from growth.prospects p join growth.contacts c on c.id=p.primary_contact_id join growth.delivery_engagements de on de.prospect_id=p.id where p.id=${prospectId}`;
      assert.equal(stored.status, "needs_review");
      assert.equal(stored.subscriber_type, "uncertain");
      assert.equal(stored.stage, "new");
    }),
);

test(
  "a closed commercial lifecycle permits another opportunity on the same business",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql, lead) => {
      const { transitionEngagement } =
        await import("../../../lib/growth/pipeline/transition-engagement");
      const input = lead();
      const capture = await executeCrmCommand(
        sql,
        input,
        founder,
        randomUUID(),
      );
      const prospectId = capture.prospectId!;
      const engagementId = randomUUID();
      await executeCrmCommand(
        sql,
        {
          kind: "create_opportunity",
          prospectId,
          requestId: engagementId,
          expectedVersion: 1,
        },
        founder,
        randomUUID(),
      );
      let version = 1;
      for (const stage of [
        "qualified",
        "proposal",
        "negotiation",
        "won",
      ] as const) {
        await transitionEngagement(
          sql,
          {
            dimension: "commercial",
            engagementId,
            expectedVersion: version++,
            toStage: stage,
            oneOffValuePence: 20000,
            monthlyValuePence: 300,
          },
          { founder, correlationId: randomUUID() },
        );
      }
      const [closed] =
        await sql`select status from growth.prospects where id=${prospectId}`;
      assert.equal(closed.status, "won");
      const next = await executeCrmCommand(
        sql,
        { ...input, requestId: randomUUID() },
        founder,
        randomUUID(),
      );
      assert.notEqual(next.prospectId, prospectId);
      const [identities] =
        await sql`select count(distinct business_id)::int count from growth.prospects where id in (${prospectId},${next.prospectId!})`;
      assert.equal(identities.count, 1);
    }),
);

test(
  "record editors enforce separate versions and preserve contact verification and consent fields",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql, lead) => {
      const input = {
        ...lead(),
        contact: {
          firstName: "Ada",
          lastName: "Example",
          roleTitle: null,
          email: randomUUID() + "@example.test",
          sourceUrl: "https://example.test/team",
          verifiedAt: "2026-10-25T12:00:00Z",
          lawfulBasis: "requested_service" as const,
        },
      };
      const capture = await executeCrmCommand(
        sql,
        input,
        founder,
        randomUUID(),
      );
      const prospectId = capture.prospectId!;
      await executeCrmCommand(
        sql,
        {
          kind: "update_business",
          prospectId,
          expectedVersion: 1,
          tradingName: "Studio",
          sector: "Engineering",
          locality: "Canterbury",
          websiteUrl: "https://example.test",
        },
        founder,
        randomUUID(),
      );
      await executeCrmCommand(
        sql,
        {
          kind: "update_contact",
          prospectId,
          expectedVersion: 1,
          firstName: "Ada",
          lastName: "Changed",
          roleTitle: "Director",
        },
        founder,
        randomUUID(),
      );
      await assert.rejects(
        executeCrmCommand(
          sql,
          {
            kind: "update_contact",
            prospectId,
            expectedVersion: 1,
            firstName: "Ada",
            lastName: "Stale",
            roleTitle: null,
          },
          founder,
          randomUUID(),
        ),
        (e: unknown) => e instanceof CrmError && e.code === "version_conflict",
      );
      await executeCrmCommand(
        sql,
        {
          kind: "update_prospect",
          prospectId,
          expectedVersion: 1,
          opportunitySummary: "Reviewed scope",
          recommendedOffer: "Workflow",
          oneOffMinPence: 100,
          oneOffMaxPence: 200,
          monthlyPence: 0,
        },
        founder,
        randomUUID(),
      );
      const [row] =
        await sql`select b.version business_version,c.version contact_version,p.version prospect_version,c.email,c.subscriber_type,c.lawful_basis,c.email_verified_at,b.corporate_status from growth.prospects p join growth.businesses b on b.id=p.business_id join growth.contacts c on c.id=p.primary_contact_id where p.id=${prospectId}`;
      assert.equal(row.business_version, 2);
      assert.equal(row.contact_version, 2);
      assert.equal(row.prospect_version, 2);
      assert.equal(row.email, input.contact.email);
      assert.equal(row.subscriber_type, "uncertain");
      assert.equal(row.lawful_basis, "requested_service");
      assert.equal(
        row.email_verified_at.toISOString(),
        "2026-10-25T12:00:00.000Z",
      );
      assert.equal(row.corporate_status, "uncertain");
    }),
);

test(
  "concurrent capture requests cannot create duplicate companies or open leads",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(
      async (sql, lead) => {
        const input = lead();
        const results = await Promise.allSettled([
          executeCrmCommand(sql, input, founder, randomUUID()),
          executeCrmCommand(
            sql,
            { ...input, requestId: randomUUID() },
            founder,
            randomUUID(),
          ),
        ]);
        assert.equal(
          results.filter((result) => result.status === "fulfilled").length,
          1,
        );
        const failure = results.find((result) => result.status === "rejected");
        assert.ok(
          failure?.status === "rejected" &&
            failure.reason instanceof CrmError &&
            failure.reason.code === "duplicate",
        );
        const [count] =
          await sql`select count(*)::int count from growth.businesses where company_number=${input.companyNumber}`;
        assert.equal(count.count, 1);
      },
      connection,
      3,
    ),
);

test(
  "runtime role can use CRM commands but cannot alter activity history or expose tables to browser roles",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql, lead) => {
      const input = lead();
      await sql`set role growth_app`;
      const capture = await executeCrmCommand(
        sql,
        input,
        founder,
        randomUUID(),
      );
      const activity = await executeCrmCommand(
        sql,
        {
          kind: "add_activity",
          prospectId: capture.prospectId!,
          requestId: randomUUID(),
          activityType: "note",
          body: "Preserve history",
        },
        founder,
        randomUUID(),
      );
      await assert.rejects(
        sql`update growth.crm_activities set body='Changed' where id=${activity.recordId!}`,
        (e: unknown) => e instanceof Error && "code" in e && e.code === "42501",
      );
      await assert.rejects(
        sql`delete from growth.crm_activities where id=${activity.recordId!}`,
        (e: unknown) => e instanceof Error && "code" in e && e.code === "42501",
      );
      await sql`reset role`;
      const [permissions] =
        await sql`select has_table_privilege('anon','growth.crm_tasks','select') anon,has_table_privilege('authenticated','growth.crm_activities','select') authenticated,(select relrowsecurity from pg_class where oid='growth.crm_tasks'::regclass) rls`;
      assert.equal(permissions.anon, false);
      assert.equal(permissions.authenticated, false);
      assert.equal(permissions.rls, true);
    }),
);

test(
  "cross-company contact conflicts link the existing CRM identity",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql, lead) => {
      const contact = {
        firstName: "Ada",
        lastName: "Example",
        roleTitle: null,
        email: randomUUID() + "@example.test",
        sourceUrl: "https://example.test/team",
        verifiedAt: "2026-10-25T12:00:00Z",
        lawfulBasis: "legitimate_interests" as const,
      };
      const first = await executeCrmCommand(
        sql,
        { ...lead(), contact },
        founder,
        randomUUID(),
      );
      await assert.rejects(
        executeCrmCommand(sql, { ...lead(), contact }, founder, randomUUID()),
        (error: unknown) =>
          error instanceof CrmError &&
          error.code === "duplicate" &&
          error.prospectId === first.prospectId,
      );
    }),
);

test(
  "capture reconciles historical closed deals before creating another opportunity",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql, lead) => {
      const input = lead();
      const first = await executeCrmCommand(sql, input, founder, randomUUID());
      await sql`insert into growth.delivery_engagements(prospect_id,name,stage,won_at,one_off_value_pence,monthly_value_pence) values (${first.prospectId!},'Historical deal','won',now(),10000,0)`;
      const next = await executeCrmCommand(
        sql,
        { ...input, requestId: randomUUID() },
        founder,
        randomUUID(),
      );
      assert.notEqual(next.prospectId, first.prospectId);
      const [old] =
        await sql`select status,version from growth.prospects where id=${first.prospectId!}`;
      assert.equal(old.status, "won");
      assert.equal(old.version, 2);
      const [audit] =
        await sql`select count(*)::int count from growth.audit_log where entity_id=${first.prospectId!} and action='crm.reconcile_commercial_status'`;
      assert.equal(audit.count, 1);
    }),
);

test(
  "business identity lookup does not invert record-editor row locks",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(
      async (sql, lead) => {
        const input = lead();
        const first = await executeCrmCommand(
          sql,
          input,
          founder,
          randomUUID(),
        );
        await sql.begin(async (editor) => {
          await editor`select id from growth.prospects where id=${first.prospectId!} for update`;
          const lookedUp = Promise.withResolvers<void>();
          const release = Promise.withResolvers<void>();
          const capture = sql.begin(async (tx) => {
            await captureBusiness(tx, input);
            lookedUp.resolve();
            await release.promise;
          });
          try {
            await lookedUp.promise;
            await editor`set local lock_timeout='500ms'`;
            await editor`update growth.businesses set trading_name='Concurrent edit' where company_number=${input.companyNumber}`;
          } finally {
            release.resolve();
            await capture;
          }
        });
      },
      connection,
      3,
    ),
);
