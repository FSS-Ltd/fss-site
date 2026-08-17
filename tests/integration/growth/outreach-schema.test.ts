import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

const connectionString = process.env.DIRECT_DATABASE_URL;

const outreachTables = [
  "email_events",
  "email_messages",
  "email_templates",
  "sequence_enrollments",
  "suppressions",
] as const;

const requiredIndexes = [
  "unique_message_idempotency",
  "unique_provider_event",
  "unique_provider_message",
  "unique_rfc_message_id",
  "unique_suppression_email",
  "unique_template_version",
] as const;

const expectedTemplateText = new Map([
  [
    "gmail_follow_up_day_5",
    `Hi {{firstName}},

I wanted to bring this back to the top of your inbox.

The practical starting point for {{businessName}} would be a focused enquiry journey, not a large website project. It would collect the details your team needs before the first call and keep the response personal.

Would it be useful if I outlined the smallest version worth building?

Jean-Fidele`,
  ],
  [
    "gmail_follow_up_day_11",
    `Hi {{firstName}},

One useful way to test this idea is to look at the information your team asks for on almost every first call.

If a customer can provide the job type, location, urgency and preferred contact method in advance, the call starts with context rather than repetition. That is the type of practical improvement FSS would design around {{businessName}}.

If you would like, I can send a one-page outline of that flow.

Jean-Fidele`,
  ],
  [
    "gmail_follow_up_day_20",
    `Hi {{firstName}},

I will close the loop after this message.

I contacted you because I saw a practical opportunity to make enquiries easier for customers and clearer for the team at {{businessName}}. If that becomes a priority later, you are welcome to reply to this thread.

Jean-Fidele
Faithful Software Solutions`,
  ],
]);

test(
  "Gmail outreach schema is private, constrained, and seeded",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 1 });

    try {
      const tables = await sql<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'growth'
          and table_name = any(${outreachTables}::text[])
        order by table_name
      `;

      assert.deepEqual(
        tables.map((row) => row.table_name),
        outreachTables,
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
        requiredIndexes,
      );

      const dueIndex = await sql<{ indexdef: string }[]>`
        select indexdef
        from pg_indexes
        where schemaname = 'growth'
          and indexname = 'due_email_messages'
      `;
      assert.equal(dueIndex.length, 1);
      assert.match(dueIndex[0].indexdef, /scheduled_for/);
      assert.match(dueIndex[0].indexdef, /status.*queued.*retry/);

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
        cross join unnest(${outreachTables}::text[]) as table_name
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
        from unnest(${outreachTables}::text[]) as table_name
        order by table_name
      `;

      assert.deepEqual(
        Array.from(runtimePrivileges),
        outreachTables.map((tableName) => ({
          table_name: tableName,
          can_select: true,
          can_insert: true,
          can_update: tableName !== "suppressions",
          can_delete: false,
        })),
      );

      const [protectedPrivileges] = await sql<
        {
          can_update_audit: boolean;
          can_delete_audit: boolean;
          can_delete_suppressions: boolean;
        }[]
      >`
        select has_table_privilege('growth_app', 'growth.audit_log', 'update') as can_update_audit,
               has_table_privilege('growth_app', 'growth.audit_log', 'delete') as can_delete_audit,
               has_table_privilege('growth_app', 'growth.suppressions', 'delete') as can_delete_suppressions
      `;
      assert.deepEqual(protectedPrivileges, {
        can_update_audit: false,
        can_delete_audit: false,
        can_delete_suppressions: false,
      });

      const [suppressionColumnPrivileges] = await sql<
        { can_update_reason: boolean; can_update_email: boolean }[]
      >`
        select has_column_privilege(
                 'growth_app',
                 'growth.suppressions',
                 'reason',
                 'update'
               ) as can_update_reason,
               has_column_privilege(
                 'growth_app',
                 'growth.suppressions',
                 'normalised_email',
                 'update'
               ) as can_update_email
      `;
      assert.deepEqual(suppressionColumnPrivileges, {
        can_update_reason: false,
        can_update_email: false,
      });

      const templates = await sql<
        {
          template_key: string;
          version: string;
          status: string;
          subject_template: string | null;
          html_template: string;
          text_template: string;
          required_fields: string[];
          image_policy: { kind: string };
          checksum: string;
          expected_checksum: string;
        }[]
      >`
        select template_key,
               version,
               status,
               subject_template,
               html_template,
               text_template,
               required_fields,
               image_policy,
               checksum,
               encode(
                 digest(
                   convert_to(
                     coalesce(subject_template, '') || E'\n' || html_template || E'\n' || text_template,
                     'UTF8'
                   ),
                   'sha256'
                 ),
                 'hex'
               ) as expected_checksum
        from growth.email_templates
        where channel = 'gmail'
          and template_key like 'gmail_follow_up_day_%'
        order by template_key
      `;

      assert.equal(templates.length, 3);
      for (const template of templates) {
        assert.equal(template.version, "1.0");
        assert.equal(template.status, "published");
        assert.equal(template.subject_template, null);
        assert.deepEqual(template.required_fields, [
          "firstName",
          "businessName",
        ]);
        assert.deepEqual(template.image_policy, { kind: "none" });
        assert.equal(template.checksum, template.expected_checksum);
        assert.match(template.checksum, /^[0-9a-f]{64}$/);
        assert.equal(
          template.text_template,
          expectedTemplateText.get(template.template_key),
        );
        assert.match(template.html_template, /^<p>Hi \{\{firstName\}\},<\/p>/);
        assert.doesNotMatch(template.html_template, /<script|<img/i);
      }

      await sql
        .begin(async (transaction) => {
          const [business] = await transaction<{ id: string }[]>`
          insert into growth.businesses (
            legal_name,
            corporate_type,
            corporate_status,
            sector,
            locality,
            county,
            first_party_source_url,
            verified_at
          )
          values (
            'Outreach Schema Test Business',
            'limited_company',
            'active',
            'Technology',
            'Canterbury',
            'Kent',
            'https://example.test/outreach-business',
            now()
          )
          returning id
        `;
          const [contact] = await transaction<{ id: string }[]>`
          insert into growth.contacts (
            business_id,
            first_name,
            last_name,
            email,
            email_source_url,
            email_verified_at,
            subscriber_type,
            lawful_basis
          )
          values (
            ${business.id},
            'Outreach',
            'Test',
            'outreach-schema@example.test',
            'https://example.test/outreach-contact',
            now(),
            'corporate',
            'legitimate_interests'
          )
          returning id
        `;
          const [prospect] = await transaction<{ id: string }[]>`
          insert into growth.prospects (
            business_id,
            primary_contact_id,
            fit_score,
            opportunity_summary,
            recommended_offer,
            estimated_one_off_min_pence,
            estimated_one_off_max_pence,
            assigned_owner_email
          )
          values (
            ${business.id},
            ${contact.id},
            80,
            'Outreach state invariant test',
            'Growth OS',
            100000,
            200000,
            'j.ntagengwa@faithfulsoftware.dev'
          )
          returning id
        `;
          const [asset] = await transaction<{ id: string }[]>`
          insert into growth.email_assets (
            prospect_id,
            asset_kind,
            blob_url,
            content_type,
            byte_size,
            width,
            height,
            alt_text,
            prompt_summary,
            sha256,
            review_status,
            created_by
          )
          values (
            ${prospect.id},
            'cold_first_email',
            'https://example.test/outreach-asset.webp',
            'image/webp',
            1000,
            1900,
            1000,
            'A conceptual enquiry workflow for schema testing.',
            'Schema test asset',
            encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'),
            'approved',
            'outreach-schema-test'
          )
          returning id
        `;
          const [enrollment] = await transaction<{ id: string }[]>`
          insert into growth.sequence_enrollments (
            prospect_id,
            contact_id,
            status,
            template_snapshot,
            started_at
          )
          values (
            ${prospect.id},
            ${contact.id},
            'active',
            '{}'::jsonb,
            now()
          )
          returning id
        `;
          const [message] = await transaction<{ id: string }[]>`
          insert into growth.email_messages (
            sequence_enrollment_id,
            prospect_id,
            contact_id,
            channel,
            direction,
            step_number,
            status,
            subject_snapshot,
            html_snapshot,
            text_snapshot,
            email_asset_id,
            rfc_message_id,
            idempotency_key,
            sent_at
          )
          values (
            ${enrollment.id},
            ${prospect.id},
            ${contact.id},
            'gmail',
            'outbound',
            1,
            'sent',
            'Original subject',
            '<p>Original body</p>',
            'Original body',
            ${asset.id},
            '<growthos.outreach-schema@example.test>',
            ${`outreach-schema-${prospect.id}`},
            now()
          )
          returning id
        `;

          const [businessB] = await transaction<{ id: string }[]>`
          insert into growth.businesses (
            legal_name,
            corporate_type,
            corporate_status,
            sector,
            locality,
            county,
            first_party_source_url,
            verified_at
          )
          values (
            'Outreach Schema Test Business B',
            'limited_company',
            'active',
            'Technology',
            'Maidstone',
            'Kent',
            'https://example.test/outreach-business-b',
            now()
          )
          returning id
        `;
          const [contactB] = await transaction<{ id: string }[]>`
          insert into growth.contacts (
            business_id,
            first_name,
            last_name,
            email,
            email_source_url,
            email_verified_at,
            subscriber_type,
            lawful_basis
          )
          values (
            ${businessB.id},
            'Other',
            'Contact',
            'outreach-schema-b@example.test',
            'https://example.test/outreach-contact-b',
            now(),
            'corporate',
            'legitimate_interests'
          )
          returning id
        `;
          const [prospectB] = await transaction<{ id: string }[]>`
          insert into growth.prospects (
            business_id,
            primary_contact_id,
            fit_score,
            opportunity_summary,
            recommended_offer,
            estimated_one_off_min_pence,
            estimated_one_off_max_pence,
            assigned_owner_email
          )
          values (
            ${businessB.id},
            ${contactB.id},
            75,
            'Second outreach state invariant test',
            'Growth OS',
            100000,
            200000,
            'j.ntagengwa@faithfulsoftware.dev'
          )
          returning id
        `;
          const [assetB] = await transaction<{ id: string }[]>`
          insert into growth.email_assets (
            prospect_id,
            asset_kind,
            blob_url,
            content_type,
            byte_size,
            width,
            height,
            alt_text,
            prompt_summary,
            sha256,
            review_status,
            created_by
          )
          values (
            ${prospectB.id},
            'cold_first_email',
            'https://example.test/outreach-asset-b.webp',
            'image/webp',
            1000,
            1900,
            1000,
            'A second conceptual enquiry workflow for schema testing.',
            'Second schema test asset',
            encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'),
            'approved',
            'outreach-schema-test'
          )
          returning id
        `;
          const [enrollmentB] = await transaction<{ id: string }[]>`
          insert into growth.sequence_enrollments (
            prospect_id,
            contact_id,
            status,
            template_snapshot,
            started_at
          )
          values (
            ${prospectB.id},
            ${contactB.id},
            'active',
            '{}'::jsonb,
            now()
          )
          returning id
        `;

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
            insert into growth.email_messages (
              sequence_enrollment_id,
              prospect_id,
              contact_id,
              channel,
              direction,
              step_number,
              status,
              text_snapshot,
              idempotency_key,
              received_at
            )
            values (
              ${enrollment.id},
              ${prospect.id},
              ${contact.id},
              'gmail',
              'inbound',
              0,
              'received',
              'A reply body must not be stored.',
              ${`outreach-inbound-body-${prospect.id}`},
              now()
            )
          `,
            ),
            { code: "23514" },
          );

          const sentContentMutations = [
            () =>
              transaction.savepoint(
                (savepoint) => savepoint`
            update growth.email_messages
            set subject_snapshot = 'Changed subject'
            where id = ${message.id}
          `,
              ),
            () =>
              transaction.savepoint(
                (savepoint) => savepoint`
            update growth.email_messages
            set html_snapshot = '<p>Changed body</p>'
            where id = ${message.id}
          `,
              ),
            () =>
              transaction.savepoint(
                (savepoint) => savepoint`
            update growth.email_messages
            set text_snapshot = 'Changed body'
            where id = ${message.id}
          `,
              ),
            () =>
              transaction.savepoint(
                (savepoint) => savepoint`
            update growth.email_messages
            set email_asset_id = null
            where id = ${message.id}
          `,
              ),
            () =>
              transaction.savepoint(
                (savepoint) => savepoint`
            update growth.email_messages
            set rfc_message_id = '<changed@example.test>'
            where id = ${message.id}
          `,
              ),
          ];

          for (const mutateSentContent of sentContentMutations) {
            await assert.rejects(
              mutateSentContent(),
              /sent email content is immutable/,
            );
          }

          await assert.rejects(
            transaction.savepoint(async (savepoint) => {
              await savepoint`
                update growth.email_messages
                set status = 'failed'
                where id = ${message.id}
              `;
              await savepoint`
                update growth.email_messages
                set subject_snapshot = 'Changed after status downgrade'
                where id = ${message.id}
              `;
            }),
            /sent email content is immutable/,
            "sent content must remain immutable after a status downgrade",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
              insert into growth.sequence_enrollments (
                prospect_id,
                contact_id,
                status,
                template_snapshot
              )
              values (
                ${prospect.id},
                ${contactB.id},
                'pending_approval',
                '{}'::jsonb
              )
            `,
            ),
            { code: "23503" },
            "an enrollment must use the prospect's primary contact",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
              insert into growth.email_messages (
                sequence_enrollment_id,
                prospect_id,
                contact_id,
                channel,
                direction,
                step_number,
                status,
                subject_snapshot,
                html_snapshot,
                text_snapshot,
                email_asset_id,
                idempotency_key
              )
              values (
                ${enrollment.id},
                ${prospectB.id},
                ${contactB.id},
                'gmail',
                'outbound',
                1,
                'draft',
                'Wrong recipient',
                '<p>Wrong recipient</p>',
                'Wrong recipient',
                ${assetB.id},
                ${`outreach-cross-enrollment-${prospect.id}`}
              )
            `,
            ),
            { code: "23503" },
            "a message must match its enrollment identity",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
              insert into growth.email_messages (
                sequence_enrollment_id,
                prospect_id,
                contact_id,
                channel,
                direction,
                step_number,
                status,
                subject_snapshot,
                html_snapshot,
                text_snapshot,
                email_asset_id,
                idempotency_key
              )
              values (
                ${enrollment.id},
                ${prospect.id},
                ${contact.id},
                'gmail',
                'outbound',
                1,
                'draft',
                'Wrong asset',
                '<p>Wrong asset</p>',
                'Wrong asset',
                ${assetB.id},
                ${`outreach-cross-asset-${prospect.id}`}
              )
            `,
            ),
            { code: "23503" },
            "a message asset must belong to its prospect",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
              update growth.sequence_enrollments
              set first_message_id = ${message.id}
              where id = ${enrollmentB.id}
            `,
            ),
            { code: "23503" },
            "the first message must belong to its enrollment",
          );

          await transaction`
          update growth.sequence_enrollments
          set status = 'stopped_reply',
              stopped_at = now(),
              stop_reason = 'reply'
          where id = ${enrollment.id}
        `;
          await assert.rejects(
            transaction.savepoint(async (savepoint) => {
              await savepoint`
                update growth.sequence_enrollments
                set status = 'paused'
                where id = ${enrollment.id}
              `;
              await savepoint`
                update growth.sequence_enrollments
                set status = 'active',
                    stopped_at = null,
                    stop_reason = null
                where id = ${enrollment.id}
              `;
            }),
            /stopped sequence cannot be reactivated/,
            "a terminal enrollment must not transition through paused",
          );

          const [suppression] = await transaction<{ id: string }[]>`
            insert into growth.suppressions (
              normalised_email,
              business_id,
              reason,
              source,
              created_by
            )
            values (
              'suppressed@example.test',
              ${business.id},
              'opt_out',
              'gmail',
              'outreach-schema-test'
            )
            returning id
          `;
          await assert.rejects(
            transaction.savepoint(async (savepoint) => {
              await savepoint`set local role growth_app`;
              await savepoint`
                update growth.suppressions
                set normalised_email = 'replacement@example.test'
                where id = ${suppression.id}
              `;
            }),
            { code: "42501" },
            "the runtime role must not move a suppression to another address",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
            update growth.email_templates
            set text_template = 'Changed published copy'
            where channel = 'gmail'
              and template_key = 'gmail_follow_up_day_5'
              and version = '1.0'
          `,
            ),
            /published email templates are immutable/,
          );

          throw new Error("ROLLBACK_OUTREACH_SCHEMA_TEST");
        })
        .catch((error: unknown) => {
          assert.equal(
            (error as Error).message,
            "ROLLBACK_OUTREACH_SCHEMA_TEST",
          );
        });
    } finally {
      await sql.end();
    }
  },
);
