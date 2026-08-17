import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

const connectionString = process.env.DIRECT_DATABASE_URL;

test(
  "foundation schema is private and complete",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 1 });

    try {
      const tables = await sql<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'growth'
        order by table_name
      `;

      assert.deepEqual(
        tables.map((row) => row.table_name),
        [
          "audit_log",
          "businesses",
          "contacts",
          "integration_connections",
          "prospects",
        ],
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
        order by table_name
      `;

      assert.deepEqual(Array.from(runtimePrivileges), [
        {
          table_name: "audit_log",
          can_select: true,
          can_insert: true,
          can_update: false,
          can_delete: false,
        },
        {
          table_name: "businesses",
          can_select: true,
          can_insert: true,
          can_update: true,
          can_delete: false,
        },
        {
          table_name: "contacts",
          can_select: true,
          can_insert: true,
          can_update: true,
          can_delete: false,
        },
        {
          table_name: "integration_connections",
          can_select: true,
          can_insert: true,
          can_update: true,
          can_delete: false,
        },
        {
          table_name: "prospects",
          can_select: true,
          can_insert: true,
          can_update: true,
          can_delete: false,
        },
      ]);

      const indexes = await sql<{ indexname: string }[]>`
        select indexname
        from pg_indexes
        where schemaname = 'growth'
          and indexname in (
            'businesses_county_sector_idx',
            'businesses_status_verified_idx',
            'one_open_prospect_per_business',
            'prospects_fit_score_created_idx',
            'prospects_status_next_action_idx'
          )
        order by indexname
      `;

      assert.deepEqual(
        indexes.map((row) => row.indexname),
        [
          "businesses_county_sector_idx",
          "businesses_status_verified_idx",
          "one_open_prospect_per_business",
          "prospects_fit_score_created_idx",
          "prospects_status_next_action_idx",
        ],
      );

      await sql.begin(async (transaction) => {
        const [businessA, businessB] = await transaction<{ id: string }[]>`
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
          values
            (
              'Foundation Test Business A',
              'limited_company',
              'active',
              'Technology',
              'Canterbury',
              'Kent',
              'https://example.test/business-a',
              now()
            ),
            (
              'Foundation Test Business B',
              'limited_company',
              'active',
              'Technology',
              'Maidstone',
              'Kent',
              'https://example.test/business-b',
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
            'Test',
            'Contact',
            'foundation-contact-b@example.test',
            'https://example.test/contact-b',
            now(),
            'corporate',
            'legitimate_interests'
          )
          returning id
        `;

        await assert.rejects(
          transaction.savepoint(
            (savepoint) => savepoint`
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
                ${businessA.id},
                ${contactB.id},
                80,
                'Cross-business contact guard test',
                'Growth OS',
                100000,
                200000,
                'j.ntagengwa@faithfulsoftware.dev'
              )
            `,
          ),
          { code: "23503" },
        );

        await transaction`
          delete from growth.contacts
          where id = ${contactB.id}
        `;
        await transaction`
          delete from growth.businesses
          where id in (${businessA.id}, ${businessB.id})
        `;
      });
    } finally {
      await sql.end();
    }
  },
);
