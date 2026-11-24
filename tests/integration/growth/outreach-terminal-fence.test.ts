import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;

test(
  "terminal fence excludes real Operations and Growth writers and releases partial locks",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 2 });
    const growth = postgres(url, {
      max: 3,
      connection: { options: "-c role=growth_app" },
    });
    const operations = postgres(url, {
      max: 2,
      connection: { options: "-c role=operations_founder" },
    });
    const actor = "a".repeat(64);
    try {
      await assert.rejects(
        operations.begin(async (writer) => {
          await writer`select set_config('operations.actor_id', ${actor}, true)`;
          await writer`insert into operations.organisations(id, legal_name, display_name, trading_status, timezone, created_by, review_reference) values (${randomUUID()}, 'Phantom', 'Phantom', 'active', 'Europe/London', ${actor}, 'synthetic')`;
          await growth.begin(async (sender) => {
            const [result] = await sender<
              { acquired: boolean }[]
            >`select growth.try_outreach_terminal_fence() as acquired`;
            assert.equal(result?.acquired, false);
            await admin.begin(async (probe) => {
              await probe`lock table growth.suppressions in row exclusive mode nowait`;
            });
          });
          throw new Error("rollback synthetic writer");
        }),
        /rollback synthetic writer/,
      );
      await assert.rejects(
        growth.begin(async (writer) => {
          await writer`insert into growth.suppressions(normalised_email, reason, source, created_by) values (${`${randomUUID()}@example.test`}, 'opt_out', 'manual', 'test')`;
          await growth.begin(async (sender) => {
            const [result] = await sender<
              { acquired: boolean }[]
            >`select growth.try_outreach_terminal_fence() as acquired`;
            assert.equal(result?.acquired, false);
            await admin.begin(async (probe) => {
              await probe`lock table operations.organisations in row exclusive mode nowait`;
            });
          });
          throw new Error("rollback synthetic writer");
        }),
        /rollback synthetic writer/,
      );
      await growth.begin(async (sender) => {
        const [result] = await sender<
          { acquired: boolean }[]
        >`select growth.try_outreach_terminal_fence() as acquired`;
        assert.equal(result?.acquired, true);
        await assert.rejects(
          operations.begin(async (writer) => {
            await writer`select set_config('operations.actor_id', ${actor}, true)`;
            await writer`set local lock_timeout = '50ms'`;
            await writer`insert into operations.organisations(id, legal_name, display_name, trading_status, timezone, created_by, review_reference) values (${randomUUID()}, 'Phantom', 'Phantom', 'active', 'Europe/London', ${actor}, 'synthetic')`;
          }),
          /lock timeout/,
        );
      });
      const [grants] = await admin<
        { directSelect: boolean; publicExecute: boolean; appExecute: boolean }[]
      >`select has_table_privilege('growth_app', 'operations.contacts', 'select') as "directSelect", has_function_privilege('public', 'growth.try_outreach_terminal_fence()', 'execute') as "publicExecute", has_function_privilege('growth_app', 'growth.try_outreach_terminal_fence()', 'execute') as "appExecute"`;
      assert.deepEqual(grants, {
        directSelect: false,
        publicExecute: false,
        appExecute: true,
      });
    } finally {
      await operations.end();
      await growth.end();
      await admin.end();
    }
  },
);
