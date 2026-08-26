import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

const connectionString = process.env.DIRECT_DATABASE_URL;

const requiredForeignKeyIndexes = [
  "client_messages_recipient_contact_id_idx",
  "email_messages_asset_prospect_idx",
  "email_messages_enrollment_identity_idx",
  "newsletter_issues_email_asset_id_idx",
  "newsletter_sends_subscriber_id_idx",
  "prospects_primary_contact_business_idx",
  "sequence_enrollments_first_message_idx",
  "sequence_enrollments_prospect_contact_idx",
] as const;

test(
  "production hardening covers foreign keys and public security-definer access",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 1 });

    try {
      const indexes = await sql<{ indexname: string }[]>`
        select indexname
        from pg_indexes
        where schemaname = 'growth'
          and indexname = any(${requiredForeignKeyIndexes}::text[])
        order by indexname
      `;

      assert.deepEqual(
        indexes.map(({ indexname }) => indexname),
        [...requiredForeignKeyIndexes].sort(),
      );

      const functions = await sql<
        {
          anonymousCanExecute: boolean;
          authenticatedCanExecute: boolean;
        }[]
      >`
        select
          has_function_privilege('anon', p.oid, 'execute') as "anonymousCanExecute",
          has_function_privilege('authenticated', p.oid, 'execute') as "authenticatedCanExecute"
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'rls_auto_enable'
      `;

      for (const functionPrivileges of functions) {
        assert.deepEqual(functionPrivileges, {
          anonymousCanExecute: false,
          authenticatedCanExecute: false,
        });
      }
    } finally {
      await sql.end();
    }
  },
);
