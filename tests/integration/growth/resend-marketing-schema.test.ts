import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

const connectionString = process.env.DIRECT_DATABASE_URL;

const resendMarketingTables = [
  "inbound_leads",
  "newsletter_issues",
  "newsletter_subscribers",
] as const;

const requiredIndexes = [
  "subscribed_newsletter_recipients",
  "unique_inbound_submission",
  "unique_newsletter_email",
  "unique_newsletter_issue_key",
] as const;

const expectedTemplateRequiredFields = new Map([
  ["site-enquiry-thank-you", ["firstName", "businessName"]],
  ["resource-delivery", ["firstName", "resourceTitle", "resourceUrl"]],
  [
    "client-delivery-thank-you",
    ["firstName", "engagementName", "newsletterOptInUrl"],
  ],
  ["newsletter-welcome", ["firstName"]],
  ["newsletter-issue", []],
]);

const expectedTemplateCategory = new Map([
  ["site-enquiry-thank-you", "transactional"],
  ["resource-delivery", "resource-delivery"],
  ["client-delivery-thank-you", "transactional"],
  ["newsletter-welcome", "newsletter"],
  ["newsletter-issue", "newsletter"],
]);

test(
  "Resend marketing schema is private, constrained, and seeded",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 1 });

    try {
      const tables = await sql<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'growth'
          and table_name = any(${resendMarketingTables}::text[])
        order by table_name
      `;
      assert.deepEqual(
        tables.map((row) => row.table_name),
        [...resendMarketingTables].sort(),
      );

      const indexes = await sql<{ indexname: string }[]>`
        select indexname
        from pg_indexes
        where schemaname = 'growth'
          and indexname = any(${requiredIndexes}::text[])
        order by indexname
      `;
      assert.deepEqual(
        indexes.map((row) => row.indexname),
        [...requiredIndexes].sort(),
      );

      const publicPrivileges = await sql<
        { role_name: string; privileged_table_count: number }[]
      >`
        select role_name,
               count(*) filter (
                 where has_table_privilege(
                   role_name,
                   format('growth.%I', table_name),
                   'select,insert,update,delete'
                 )
               )::integer as privileged_table_count
        from unnest(array['anon', 'authenticated', 'service_role']) as role_name
        cross join unnest(${resendMarketingTables}::text[]) as table_name
        group by role_name
        order by role_name
      `;
      assert.deepEqual(Array.from(publicPrivileges), [
        { role_name: "anon", privileged_table_count: 0 },
        { role_name: "authenticated", privileged_table_count: 0 },
        { role_name: "service_role", privileged_table_count: 0 },
      ]);

      const runtimePrivileges = await sql<
        {
          table_name: string;
          can_select: boolean;
          can_insert: boolean;
          can_update: boolean;
          can_delete: boolean;
        }[]
      >`
        select table_name,
               has_table_privilege('growth_app', format('growth.%I', table_name), 'select') as can_select,
               has_table_privilege('growth_app', format('growth.%I', table_name), 'insert') as can_insert,
               has_table_privilege('growth_app', format('growth.%I', table_name), 'update') as can_update,
               has_table_privilege('growth_app', format('growth.%I', table_name), 'delete') as can_delete
        from unnest(${resendMarketingTables}::text[]) as table_name
        order by table_name
      `;
      assert.deepEqual(
        Array.from(runtimePrivileges),
        [...resendMarketingTables].sort().map((tableName) => ({
          table_name: tableName,
          can_select: true,
          can_insert: true,
          can_update: true,
          can_delete: false,
        })),
      );

      const templates = await sql<
        {
          templateKey: string;
          category: string | null;
          status: string;
          requiredFields: string[];
          checksum: string;
          expectedChecksum: string;
        }[]
      >`
        select
          template_key as "templateKey",
          category,
          status,
          required_fields as "requiredFields",
          checksum,
          encode(
            digest(
              convert_to(E'\n' || html_template || E'\n' || text_template, 'UTF8'),
              'sha256'
            ),
            'hex'
          ) as "expectedChecksum"
        from growth.email_templates
        where channel = 'resend'
        order by template_key
      `;
      assert.equal(templates.length, 5);
      for (const template of templates) {
        assert.equal(template.status, "draft");
        assert.equal(
          template.category,
          expectedTemplateCategory.get(template.templateKey),
        );
        assert.deepEqual(
          template.requiredFields,
          expectedTemplateRequiredFields.get(template.templateKey),
        );
        assert.equal(template.checksum, template.expectedChecksum);
        assert.match(template.checksum, /^[0-9a-f]{64}$/);
      }

      await sql
        .begin(async (transaction) => {
          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.newsletter_subscribers (
                  email, status
                ) values (
                  'schema-test-subscriber@example.test', 'subscribed'
                )
              `,
            ),
            { code: "23514" },
            "a subscriber cannot be subscribed without consent evidence",
          );

          const [subscriber] = await transaction<{ id: string }[]>`
            insert into growth.newsletter_subscribers (
              email, status, consent_source, consent_text_version,
              consent_evidence, consented_at
            ) values (
              'schema-test-subscriber@example.test', 'subscribed',
              'newsletter_signup', 'v1', 'checkbox on /newsletter form', now()
            )
            returning id
          `;
          assert.ok(subscriber);

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.newsletter_subscribers (
                  email, status, consent_source, consent_text_version,
                  consent_evidence, consented_at
                ) values (
                  'Schema-Test-Subscriber@Example.test', 'pending',
                  'newsletter_signup', 'v1', 'duplicate address', now()
                )
              `,
            ),
            { code: "23505" },
            "normalised_email must be unique regardless of case",
          );

          const consentedAt = new Date();
          await transaction`
            update growth.newsletter_subscribers
            set status = 'unsubscribed', unsubscribed_at = now()
            where id = ${subscriber.id}
          `;
          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                update growth.newsletter_subscribers
                set status = 'subscribed'
                where id = ${subscriber.id}
              `,
            ),
            /resubscribing requires new consent evidence/,
            "resubscribing without a fresher consented_at must be rejected",
          );
          await transaction`
            update growth.newsletter_subscribers
            set status = 'subscribed', consented_at = ${new Date(consentedAt.getTime() + 1000)}
            where id = ${subscriber.id}
          `;

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.inbound_leads (
                  submission_id, submission_type, first_name, last_name,
                  work_email, business_name, source_path, source_context,
                  newsletter_opt_in
                ) values (
                  gen_random_uuid(), 'site_enquiry', 'Ada', 'Lovelace',
                  'ada@example.test', 'Example Ltd', '/contact', 'contact_form',
                  true
                )
              `,
            ),
            { code: "23514" },
            "opting in without a consent text version must be rejected",
          );

          const submissionId = crypto.randomUUID();
          await transaction`
            insert into growth.inbound_leads (
              submission_id, submission_type, first_name, last_name,
              work_email, business_name, source_path, source_context,
              newsletter_opt_in, consent_text_version
            ) values (
              ${submissionId}, 'site_enquiry', 'Ada', 'Lovelace',
              'ada@example.test', 'Example Ltd', '/contact', 'contact_form',
              true, 'v1'
            )
          `;
          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.inbound_leads (
                  submission_id, submission_type, first_name, last_name,
                  work_email, business_name, source_path, source_context
                ) values (
                  ${submissionId}, 'site_enquiry', 'Ada', 'Lovelace',
                  'ada@example.test', 'Example Ltd', '/contact', 'contact_form'
                )
              `,
            ),
            { code: "23505" },
            "a repeated submission_id must not create a second lead",
          );

          const [newsletterAsset] = await transaction<{ id: string }[]>`
            insert into growth.email_assets (
              asset_kind, blob_url, content_type, byte_size, width, height,
              alt_text, prompt_summary, sha256, review_status, created_by
            ) values (
              'newsletter', 'https://example.test/newsletter-asset.webp',
              'image/webp', 50000, 1200, 630,
              'Concept illustration of a newsletter for schema testing.',
              'Schema test newsletter asset',
              encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'),
              'approved', 'resend-schema-test'
            )
            returning id
          `;
          assert.ok(newsletterAsset, "a newsletter asset needs no prospect_id");

          const [issue] = await transaction<{ id: string }[]>`
            insert into growth.newsletter_issues (
              issue_key, status, subject, preview_text, html_snapshot,
              text_snapshot, email_asset_id, created_by
            ) values (
              'schema-test-issue', 'draft', 'Original subject',
              'Original preview', '<p>Original body</p>', 'Original body',
              ${newsletterAsset.id}, 'resend-schema-test'
            )
            returning id
          `;
          await transaction`
            update growth.newsletter_issues
            set status = 'scheduled', scheduled_for = now() + interval '1 day'
            where id = ${issue.id}
          `;
          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                update growth.newsletter_issues
                set subject = 'Changed after scheduling'
                where id = ${issue.id}
              `,
            ),
            /a scheduled newsletter issue is immutable/,
            "a scheduled issue's content must not change",
          );
          await transaction.savepoint(
            (savepoint) => savepoint`
              update growth.newsletter_issues
              set status = 'sent', sent_at = now()
              where id = ${issue.id}
            `,
          );

          throw new Error("ROLLBACK_RESEND_MARKETING_SCHEMA_TEST");
        })
        .catch((error: unknown) => {
          assert.equal(
            (error as Error).message,
            "ROLLBACK_RESEND_MARKETING_SCHEMA_TEST",
          );
        });
    } finally {
      await sql.end();
    }
  },
);
