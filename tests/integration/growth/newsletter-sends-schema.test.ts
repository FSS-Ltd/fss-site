import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

const connectionString = process.env.DIRECT_DATABASE_URL;

test(
  "Newsletter sends schema is private, constrained, and dispatch-claimable",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 1 });

    try {
      const tables = await sql<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'growth' and table_name = 'newsletter_sends'
      `;
      assert.deepEqual(
        tables.map((row) => row.table_name),
        ["newsletter_sends"],
      );

      const issueColumns = await sql<{ columnName: string }[]>`
        select column_name as "columnName"
        from information_schema.columns
        where table_schema = 'growth' and table_name = 'newsletter_issues'
          and column_name in ('test_sent_at', 'test_sent_version', 'approved_at', 'approved_by', 'approved_checksum')
      `;
      assert.deepEqual(
        issueColumns.map((row) => row.columnName).sort(),
        ["approved_at", "approved_by", "approved_checksum", "test_sent_at", "test_sent_version"],
      );

      const requiredIndexes = [
        "newsletter_sends_claimable_idx",
        "unique_newsletter_send_idempotency",
        "unique_newsletter_send_provider_message",
        "unique_newsletter_send_recipient",
      ] as const;
      const indexes = await sql<{ indexname: string }[]>`
        select indexname
        from pg_indexes
        where schemaname = 'growth' and indexname = any(${requiredIndexes}::text[])
      `;
      assert.deepEqual(
        indexes.map((row) => row.indexname).sort(),
        [...requiredIndexes].sort(),
      );

      const publicPrivileges = await sql<{ roleName: string; count: number }[]>`
        select role_name as "roleName",
               count(*) filter (
                 where has_table_privilege(role_name, 'growth.newsletter_sends', 'select,insert,update,delete')
               )::integer as count
        from unnest(array['anon', 'authenticated', 'service_role']) as role_name
        group by role_name
        order by role_name
      `;
      assert.deepEqual(Array.from(publicPrivileges), [
        { roleName: "anon", count: 0 },
        { roleName: "authenticated", count: 0 },
        { roleName: "service_role", count: 0 },
      ]);

      const [runtimePrivileges] = await sql<
        { canSelect: boolean; canInsert: boolean; canUpdate: boolean; canDelete: boolean }[]
      >`
        select
          has_table_privilege('growth_app', 'growth.newsletter_sends', 'select') as "canSelect",
          has_table_privilege('growth_app', 'growth.newsletter_sends', 'insert') as "canInsert",
          has_table_privilege('growth_app', 'growth.newsletter_sends', 'update') as "canUpdate",
          has_table_privilege('growth_app', 'growth.newsletter_sends', 'delete') as "canDelete"
      `;
      assert.deepEqual(runtimePrivileges, {
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        canDelete: false,
      });

      await sql
        .begin(async (transaction) => {
          const [issue] = await transaction<{ id: string }[]>`
            insert into growth.newsletter_issues (
              issue_key, status, subject, preview_text, html_snapshot, text_snapshot, created_by
            ) values (
              'schema-test-issue', 'draft', 'Test subject', 'Test preview',
              '<p>Body {{unsubscribeUrl}}</p>', 'Body {{unsubscribeUrl}}', 'schema-test'
            )
            returning id
          `;
          const [subscriber] = await transaction<{ id: string }[]>`
            insert into growth.newsletter_subscribers (
              email, status, consent_source, consent_text_version, consent_evidence, consented_at
            ) values (
              'schema-test-newsletter-send@example.test', 'subscribed',
              'newsletter_signup', 'v1', 'checkbox on /newsletter form', now()
            )
            returning id
          `;

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.newsletter_sends (
                  newsletter_issue_id, subscriber_id, status, idempotency_key
                ) values (
                  ${issue.id}, ${subscriber.id}, 'not_a_real_status', 'key-1'
                )
              `,
            ),
            { code: "23514" },
            "an invalid status must be rejected",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.newsletter_sends (
                  newsletter_issue_id, subscriber_id, status, idempotency_key,
                  lease_token
                ) values (
                  ${issue.id}, ${subscriber.id}, 'sending', 'key-2',
                  gen_random_uuid()
                )
              `,
            ),
            { code: "23514" },
            "a lease token without an expiry must be rejected",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.newsletter_sends (
                  newsletter_issue_id, subscriber_id, status, idempotency_key
                ) values (
                  ${issue.id}, ${subscriber.id}, 'sent', 'key-3'
                )
              `,
            ),
            { code: "23514" },
            "a sent row without a provider message id and sent_at must be rejected",
          );

          const [send] = await transaction<{ id: string }[]>`
            insert into growth.newsletter_sends (
              newsletter_issue_id, subscriber_id, status, idempotency_key
            ) values (
              ${issue.id}, ${subscriber.id}, 'queued', 'schema-test-key'
            )
            returning id
          `;
          assert.ok(send);

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.newsletter_sends (
                  newsletter_issue_id, subscriber_id, status, idempotency_key
                ) values (
                  ${issue.id}, ${subscriber.id}, 'queued', 'a-different-key'
                )
              `,
            ),
            { code: "23505" },
            "the same issue and subscriber cannot be queued twice",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.newsletter_sends (
                  newsletter_issue_id, subscriber_id, status, idempotency_key
                ) values (
                  ${issue.id}, gen_random_uuid(), 'queued', 'schema-test-key'
                )
              `,
            ),
            { code: "23505" },
            "the idempotency key must be globally unique",
          );

          const leaseToken = await transaction<{ id: string }[]>`
            update growth.newsletter_sends
            set status = 'sending', lease_token = gen_random_uuid(), lease_expires_at = now() + interval '5 minutes'
            where id = ${send.id}
            returning id
          `;
          assert.equal(leaseToken.length, 1);

          const [claimable] = await transaction<{ id: string }[]>`
            select id
            from growth.newsletter_sends
            where (status in ('queued', 'retry'))
               or (status = 'sending' and lease_expires_at < now())
            for update skip locked
          `;
          assert.equal(claimable, undefined, "a fresh lease is not yet claimable");

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.newsletter_sends (
                  newsletter_issue_id, subscriber_id, status, idempotency_key
                ) values (
                  gen_random_uuid(), ${subscriber.id}, 'queued', 'missing-issue-key'
                )
              `,
            ),
            /foreign key/,
            "a send row requires a real newsletter issue",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                update growth.newsletter_issues
                set test_sent_version = 0
                where id = ${issue.id}
              `,
            ),
            { code: "23514" },
            "test_sent_version must be positive",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                update growth.newsletter_issues
                set approved_checksum = 'not-a-checksum'
                where id = ${issue.id}
              `,
            ),
            { code: "23514" },
            "approved_checksum must look like a sha256 hex digest",
          );

          await transaction`
            update growth.newsletter_issues
            set test_sent_at = now(), test_sent_version = 1,
                approved_at = now(), approved_by = 'founder-actor-id',
                approved_checksum = ${"a".repeat(64)}
            where id = ${issue.id}
          `;

          throw new Error("ROLLBACK_NEWSLETTER_SENDS_SCHEMA_TEST");
        })
        .catch((error: unknown) => {
          assert.equal((error as Error).message, "ROLLBACK_NEWSLETTER_SENDS_SCHEMA_TEST");
        });
    } finally {
      await sql.end();
    }
  },
);
