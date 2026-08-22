import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";
import type { TransactionSql } from "postgres";

const connectionString = process.env.DIRECT_DATABASE_URL;

const pipelineTables = ["delivery_engagements", "commercial_stage_events"] as const;

const requiredIndexes = [
  "unique_engagement_prospect",
  "delivery_engagements_by_stage",
  "won_delivery_engagements",
  "commercial_stage_events_engagement_idx",
  "commercial_stage_events_correlation_id_idx",
] as const;

const requiredEngagementColumns = [
  "id",
  "prospect_id",
  "version",
  "stage",
  "name",
  "one_off_value_pence",
  "monthly_value_pence",
  "probability_percent",
  "expected_close_date",
  "won_at",
  "lost_at",
  "loss_reason",
  "delivery_status",
  "delivery_start_date",
  "delivery_target_date",
  "newsletter_invited_at",
  "created_at",
  "updated_at",
] as const;

const requiredEventColumns = [
  "id",
  "engagement_id",
  "dimension",
  "from_state",
  "to_state",
  "reason_code",
  "actor_type",
  "actor_id",
  "correlation_id",
  "occurred_at",
] as const;

async function insertProspect(
  transaction: TransactionSql<Record<string, never>>,
  suffix: string,
) {
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
      ${`Pipeline Schema Test Business ${suffix}`},
      'limited_company',
      'active',
      'Technology',
      'Canterbury',
      'Kent',
      ${`https://example.test/pipeline-business-${suffix}`},
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
      'Pipeline',
      'Test',
      ${`pipeline-schema-${suffix}@example.test`},
      ${`https://example.test/pipeline-contact-${suffix}`},
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
      'Pipeline schema test opportunity',
      'Growth OS',
      100000,
      200000,
      'j.ntagengwa@faithfulsoftware.dev'
    )
    returning id
  `;
  return prospect.id as string;
}

test(
  "Pipeline and delivery schema is private, constrained, and versioned",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 1 });

    try {
      const tables = await sql<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'growth' and table_name = any(${pipelineTables}::text[])
        order by table_name
      `;
      assert.deepEqual(
        tables.map((row) => row.table_name).sort(),
        [...pipelineTables].sort(),
      );

      const engagementColumns = await sql<{ columnName: string }[]>`
        select column_name as "columnName"
        from information_schema.columns
        where table_schema = 'growth' and table_name = 'delivery_engagements'
          and column_name = any(${requiredEngagementColumns}::text[])
      `;
      assert.deepEqual(
        engagementColumns.map((row) => row.columnName).sort(),
        [...requiredEngagementColumns].sort(),
      );

      const eventColumns = await sql<{ columnName: string }[]>`
        select column_name as "columnName"
        from information_schema.columns
        where table_schema = 'growth' and table_name = 'commercial_stage_events'
          and column_name = any(${requiredEventColumns}::text[])
      `;
      assert.deepEqual(
        eventColumns.map((row) => row.columnName).sort(),
        [...requiredEventColumns].sort(),
      );

      const [engagementTypes] = await sql<
        { idType: string; versionType: string; occurredType: string }[]
      >`
        select
          (select data_type from information_schema.columns
            where table_schema = 'growth' and table_name = 'delivery_engagements' and column_name = 'id') as "idType",
          (select data_type from information_schema.columns
            where table_schema = 'growth' and table_name = 'delivery_engagements' and column_name = 'version') as "versionType",
          (select data_type from information_schema.columns
            where table_schema = 'growth' and table_name = 'commercial_stage_events' and column_name = 'occurred_at') as "occurredType"
      `;
      assert.equal(engagementTypes.idType, "uuid");
      assert.equal(engagementTypes.versionType, "integer");
      assert.equal(engagementTypes.occurredType, "timestamp with time zone");

      const indexes = await sql<{ indexname: string }[]>`
        select indexname
        from pg_indexes
        where schemaname = 'growth' and indexname = any(${requiredIndexes}::text[])
      `;
      assert.deepEqual(
        indexes.map((row) => row.indexname).sort(),
        [...requiredIndexes].sort(),
      );

      const publicPrivileges = await sql<
        { roleName: string; privilegedTableCount: number }[]
      >`
        select role_name as "roleName",
               count(*) filter (
                 where has_table_privilege(
                   role_name,
                   format('growth.%I', table_name),
                   'select,insert,update,delete'
                 )
               )::integer as "privilegedTableCount"
        from unnest(array['anon', 'authenticated', 'service_role']) as role_name
        cross join unnest(${pipelineTables}::text[]) as table_name
        group by role_name
        order by role_name
      `;
      assert.deepEqual(Array.from(publicPrivileges), [
        { roleName: "anon", privilegedTableCount: 0 },
        { roleName: "authenticated", privilegedTableCount: 0 },
        { roleName: "service_role", privilegedTableCount: 0 },
      ]);

      const [runtimePrivileges] = await sql<
        {
          canUpdateEngagement: boolean;
          canDeleteEngagement: boolean;
          canUpdateEvents: boolean;
          canDeleteEvents: boolean;
        }[]
      >`
        select
          has_table_privilege('growth_app', 'growth.delivery_engagements', 'update') as "canUpdateEngagement",
          has_table_privilege('growth_app', 'growth.delivery_engagements', 'delete') as "canDeleteEngagement",
          has_table_privilege('growth_app', 'growth.commercial_stage_events', 'update') as "canUpdateEvents",
          has_table_privilege('growth_app', 'growth.commercial_stage_events', 'delete') as "canDeleteEvents"
      `;
      assert.deepEqual(runtimePrivileges, {
        canUpdateEngagement: true,
        canDeleteEngagement: false,
        canUpdateEvents: false,
        canDeleteEvents: false,
      });

      await sql
        .begin(async (transaction) => {
          const prospectId = await insertProspect(transaction, "a");

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.delivery_engagements (prospect_id, name, one_off_value_pence)
                values (${prospectId}, 'Bad negative value', -100)
              `,
            ),
            { code: "23514" },
            "a negative one-off value must be rejected",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.delivery_engagements (prospect_id, name, monthly_value_pence)
                values (${prospectId}, 'Bad negative monthly', -50)
              `,
            ),
            { code: "23514" },
            "a negative monthly value must be rejected",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.delivery_engagements (prospect_id, name, probability_percent)
                values (${prospectId}, 'Bad probability', 101)
              `,
            ),
            { code: "23514" },
            "a probability above 100 must be rejected",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.delivery_engagements (prospect_id, name, stage)
                values (${prospectId}, 'Won without value or timestamp', 'won')
              `,
            ),
            { code: "23514" },
            "a won stage without won_at and a value must be rejected",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.delivery_engagements (
                  prospect_id, name, stage, won_at, one_off_value_pence
                )
                values (${prospectId}, 'Won without value', 'won', now(), 0)
              `,
            ),
            { code: "23514" },
            "a won stage with a zero value must be rejected",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.delivery_engagements (prospect_id, name, stage, lost_at)
                values (${prospectId}, 'Lost without reason', 'lost', now())
              `,
            ),
            { code: "23514" },
            "a lost stage without a loss reason must be rejected",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.delivery_engagements (prospect_id, name, won_at)
                values (${prospectId}, 'Open stage with won timestamp', now())
              `,
            ),
            { code: "23514" },
            "an open stage must not carry a terminal timestamp",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.delivery_engagements (prospect_id, name, delivery_status)
                values (${prospectId}, 'Delivery before won', 'discovery')
              `,
            ),
            { code: "23514" },
            "delivery status other than not_started requires stage won",
          );

          const [engagement] = await transaction<{ id: string; version: number }[]>`
            insert into growth.delivery_engagements (
              prospect_id, name, stage, won_at, one_off_value_pence
            )
            values (
              ${prospectId}, 'Won engagement', 'won', now(), 500000
            )
            returning id, version
          `;
          assert.ok(engagement);
          assert.equal(engagement.version, 1);

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.delivery_engagements (prospect_id, name)
                values (${prospectId}, 'Second engagement for the same prospect')
              `,
            ),
            { code: "23505" },
            "a prospect must have at most one engagement",
          );

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                update growth.delivery_engagements
                set stage = 'negotiation'
                where id = ${engagement.id}
              `,
            ),
            /won or lost commercial stage cannot be reopened/,
            "a won stage must not revert to an earlier commercial stage",
          );

          await transaction`
            update growth.delivery_engagements
            set delivery_status = 'complete'
            where id = ${engagement.id}
          `;

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                update growth.delivery_engagements
                set delivery_status = 'build'
                where id = ${engagement.id}
              `,
            ),
            /complete delivery can only advance to support/,
            "a complete delivery must not revert to an earlier delivery status",
          );

          await transaction`
            update growth.delivery_engagements
            set delivery_status = 'support'
            where id = ${engagement.id}
          `;

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                update growth.delivery_engagements
                set delivery_status = 'complete'
                where id = ${engagement.id}
              `,
            ),
            /support or cancelled delivery status cannot be reopened/,
            "a support delivery must not be reopened",
          );

          const cancelledProspectId = await insertProspect(transaction, "c");
          const [cancelledEngagement] = await transaction<{ id: string }[]>`
            insert into growth.delivery_engagements (
              prospect_id, name, stage, won_at, one_off_value_pence, delivery_status
            )
            values (
              ${cancelledProspectId}, 'Cancelled delivery', 'won', now(), 500000, 'cancelled'
            )
            returning id
          `;
          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                update growth.delivery_engagements
                set delivery_status = 'discovery'
                where id = ${cancelledEngagement.id}
              `,
            ),
            /support or cancelled delivery status cannot be reopened/,
            "a cancelled delivery must not be reopened",
          );

          const [event] = await transaction<{ id: string }[]>`
            insert into growth.commercial_stage_events (
              engagement_id, dimension, from_state, to_state,
              actor_type, actor_id, correlation_id
            )
            values (
              ${engagement.id}, 'commercial', 'negotiation', 'won',
              'founder', 'j.ntagengwa@faithfulsoftware.dev', 'schema-test-correlation-1'
            )
            returning id
          `;
          assert.ok(event);

          await assert.rejects(
            transaction.savepoint(
              (savepoint) => savepoint`
                insert into growth.commercial_stage_events (
                  engagement_id, dimension, from_state, to_state,
                  actor_type, actor_id, correlation_id
                )
                values (
                  ${engagement.id}, 'commercial', '', 'won',
                  'founder', 'j.ntagengwa@faithfulsoftware.dev', 'schema-test-correlation-2'
                )
              `,
            ),
            { code: "23514" },
            "an empty from_state must be rejected",
          );

          await assert.rejects(
            transaction.savepoint(async (savepoint) => {
              await savepoint`set local role growth_app`;
              await savepoint`
                update growth.commercial_stage_events
                set to_state = 'lost'
                where id = ${event.id}
              `;
            }),
            { code: "42501" },
            "the runtime role must not update a historical stage event",
          );

          await assert.rejects(
            transaction.savepoint(async (savepoint) => {
              await savepoint`set local role growth_app`;
              await savepoint`
                delete from growth.commercial_stage_events
                where id = ${event.id}
              `;
            }),
            { code: "42501" },
            "the runtime role must not delete a historical stage event",
          );

          throw new Error("ROLLBACK_PIPELINE_DELIVERY_SCHEMA_TEST");
        })
        .catch((error: unknown) => {
          assert.equal(
            (error as Error).message,
            "ROLLBACK_PIPELINE_DELIVERY_SCHEMA_TEST",
          );
        });
    } finally {
      await sql.end();
    }
  },
);
