import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

const connectionString = process.env.DIRECT_DATABASE_URL;

const researchTables = [
  "agent_tasks",
  "email_assets",
  "research_runs",
  "source_evidence",
  "website_assessments",
] as const;

test(
  "research ingestion schema is private and constrained",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 1 });

    try {
      const tables = await sql<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'growth'
          and table_name = any(${researchTables}::text[])
        order by table_name
      `;

      assert.deepEqual(
        tables.map((row) => row.table_name),
        researchTables,
      );

      const indexes = await sql<{ indexname: string }[]>`
        select indexname
        from pg_indexes
        where schemaname = 'growth'
          and indexname in (
            'unique_agent_task_idempotency',
            'unique_email_asset_hash',
            'unique_evidence_claim',
            'unique_research_external_run'
          )
        order by indexname
      `;

      assert.deepEqual(
        indexes.map((row) => row.indexname),
        [
          "unique_agent_task_idempotency",
          "unique_email_asset_hash",
          "unique_evidence_claim",
          "unique_research_external_run",
        ],
      );

      const constraints = await sql<
        { constraint_name: string; definition: string }[]
      >`
        select con.conname as constraint_name,
               pg_get_constraintdef(con.oid) as definition
        from pg_constraint con
        where con.connamespace = 'growth'::regnamespace
          and con.conname in (
            'cold_asset_size',
            'email_asset_alt_text',
            'email_asset_cold_aspect_ratio',
            'email_asset_dimensions',
            'prospects_research_run_id_fkey',
            'research_run_counts_nonnegative',
            'research_run_target_positive'
          )
        order by con.conname
      `;

      assert.deepEqual(
        constraints.map((row) => row.constraint_name),
        [
          "cold_asset_size",
          "email_asset_alt_text",
          "email_asset_cold_aspect_ratio",
          "email_asset_dimensions",
          "prospects_research_run_id_fkey",
          "research_run_counts_nonnegative",
          "research_run_target_positive",
        ],
      );
      assert.match(
        constraints.find(
          (row) => row.constraint_name === "prospects_research_run_id_fkey",
        )?.definition ?? "",
        /DEFERRABLE INITIALLY DEFERRED/,
      );
      const constraintDefinitions = new Map(
        constraints.map((row) => [row.constraint_name, row.definition]),
      );
      assert.match(
        constraintDefinitions.get("research_run_target_positive") ?? "",
        /target_count > 0/,
      );
      assert.match(
        constraintDefinitions.get("research_run_counts_nonnegative") ?? "",
        /accepted_count >= 0.*duplicate_count >= 0.*rejected_count >= 0/,
      );
      assert.match(
        constraintDefinitions.get("cold_asset_size") ?? "",
        /byte_size <= 184320/,
      );
      assert.match(
        constraintDefinitions.get("email_asset_alt_text") ?? "",
        /length\(TRIM\(BOTH FROM alt_text\)\) >= 20/,
      );
      assert.match(
        constraintDefinitions.get("email_asset_cold_aspect_ratio") ?? "",
        /width.*185.*195/,
      );

      const schemaPrivileges = await sql<
        { role_name: string; has_usage: boolean }[]
      >`
        select role_name,
               has_schema_privilege(role_name, 'growth', 'usage') as has_usage
        from unnest(array['anon', 'authenticated', 'service_role', 'growth_app'])
          as role_name
        order by role_name
      `;

      assert.deepEqual(Array.from(schemaPrivileges), [
        { role_name: "anon", has_usage: false },
        { role_name: "authenticated", has_usage: false },
        { role_name: "growth_app", has_usage: true },
        { role_name: "service_role", has_usage: false },
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
        from information_schema.tables
        where table_schema = 'growth'
          and table_name = any(${researchTables}::text[])
        order by table_name
      `;

      assert.deepEqual(
        Array.from(runtimePrivileges),
        researchTables.map((tableName) => ({
          table_name: tableName,
          can_select: true,
          can_insert: true,
          can_update: true,
          can_delete: false,
        })),
      );
    } finally {
      await sql.end();
    }
  },
);
