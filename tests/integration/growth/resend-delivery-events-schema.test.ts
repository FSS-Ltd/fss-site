import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

const connectionString = process.env.DIRECT_DATABASE_URL;

test(
  "Resend delivery events schema is private, constrained, and idempotent",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 1 });

    try {
      const tables = await sql<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'growth' and table_name = 'resend_delivery_events'
      `;
      assert.deepEqual(
        tables.map((row) => row.table_name),
        ["resend_delivery_events"],
      );

      const requiredColumns = [
        "id",
        "provider_event_id",
        "event_type",
        "occurred_at",
        "recipient_normalised_email",
        "email_message_id",
        "newsletter_send_id",
        "sanitised_payload",
        "created_at",
      ] as const;
      const columns = await sql<{ columnName: string }[]>`
        select column_name as "columnName"
        from information_schema.columns
        where table_schema = 'growth' and table_name = 'resend_delivery_events'
          and column_name = any(${requiredColumns}::text[])
      `;
      assert.deepEqual(
        columns.map((row) => row.columnName).sort(),
        [...requiredColumns].sort(),
      );

      const requiredIndexes = [
        "unique_resend_delivery_event",
        "resend_delivery_events_recipient_idx",
        "resend_delivery_events_email_message_id_idx",
        "resend_delivery_events_newsletter_send_id_idx",
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
                 where has_table_privilege(role_name, 'growth.resend_delivery_events', 'select,insert,update,delete')
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
          has_table_privilege('growth_app', 'growth.resend_delivery_events', 'select') as "canSelect",
          has_table_privilege('growth_app', 'growth.resend_delivery_events', 'insert') as "canInsert",
          has_table_privilege('growth_app', 'growth.resend_delivery_events', 'update') as "canUpdate",
          has_table_privilege('growth_app', 'growth.resend_delivery_events', 'delete') as "canDelete"
      `;
      assert.deepEqual(runtimePrivileges, {
        canSelect: true,
        canInsert: true,
        canUpdate: false,
        canDelete: false,
      });

      await sql
        .begin(async (transaction) => {
          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.resend_delivery_events (
                  provider_event_id, event_type, occurred_at, recipient_normalised_email
                ) values (
                  'evt-bad-email', 'delivered', now(), 'not-an-email'
                )
              `,
            ),
            { code: "23514" },
            "a malformed recipient email must be rejected",
          );

          const [event] = await transaction<{ id: string }[]>`
            insert into growth.resend_delivery_events (
              provider_event_id, event_type, occurred_at, recipient_normalised_email
            ) values (
              'evt-1', 'delivered', now(), 'schema-test-resend-event@example.test'
            )
            returning id
          `;
          assert.ok(event);

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.resend_delivery_events (
                  provider_event_id, event_type, occurred_at, recipient_normalised_email
                ) values (
                  'evt-1', 'opened', now(), 'schema-test-resend-event@example.test'
                )
              `,
            ),
            { code: "23505" },
            "the provider_event_id must be globally unique",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.resend_delivery_events (
                  provider_event_id, event_type, occurred_at, recipient_normalised_email,
                  email_message_id, newsletter_send_id
                ) values (
                  'evt-2', 'delivered', now(), 'schema-test-resend-event@example.test',
                  gen_random_uuid(), gen_random_uuid()
                )
              `,
            ),
            { code: "23514" },
            "setting both email_message_id and newsletter_send_id must be rejected",
          );

          throw new Error("ROLLBACK_RESEND_DELIVERY_EVENTS_SCHEMA_TEST");
        })
        .catch((error: unknown) => {
          assert.equal((error as Error).message, "ROLLBACK_RESEND_DELIVERY_EVENTS_SCHEMA_TEST");
        });
    } finally {
      await sql.end();
    }
  },
);
