import assert from "node:assert/strict";
import type { GrowthDb, GrowthTransaction } from "../../../lib/growth/db/types";

// Test-only clock substitution keeps all reservation SQL and locks on PostgreSQL.
export function withTransitionClock(
  db: GrowthDb,
  start: Date,
  finish: Date,
  expectBudget = true,
  minClocks = 3,
): GrowthDb {
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "begin") return Reflect.get(target, property, receiver);
      return (operation: (tx: GrowthTransaction) => Promise<unknown>) =>
        target.begin(async (tx) => {
          await tx`create temporary table transition_test_clock(at timestamptz not null) on commit drop`;
          await tx`insert into transition_test_clock values (${start})`;
          await tx`create or replace function pg_temp.transition_test_now() returns timestamptz language sql volatile as 'select at from pg_temp.transition_test_clock'`;
          let clocks = 0;
          let budget = false;
          let terminal = 0;
          const wrapped = new Proxy(tx, {
            apply(
              targetQuery,
              thisArg,
              args: [TemplateStringsArray, ...unknown[]],
            ) {
              const [strings, ...values] = args;
              const parts = [...strings];
              const text = parts.join("?");
              if (text.includes('as "globalUsed"')) budget = true;
              for (let i = 0; i < parts.length; i++) {
                if (parts[i]!.includes("clock_timestamp()")) {
                  clocks++;
                  parts[i] = parts[i]!.replaceAll(
                    "clock_timestamp()",
                    "pg_temp.transition_test_now()",
                  );
                }
              }
              const template = Object.assign(parts, { raw: parts });
              if (text.includes('day_ok as "dayOk"')) {
                terminal++;
                return (async () => {
                  assert.ok(
                    clocks >= minClocks,
                    "preliminary clock sites and terminal clock intercepted",
                  );
                  if (expectBudget)
                    assert.ok(budget, "budget evaluated before transition");
                  await tx`update transition_test_clock set at=${finish}`;
                  return Reflect.apply(targetQuery, thisArg, [
                    template,
                    ...values,
                  ]);
                })();
              }
              return Reflect.apply(targetQuery, thisArg, [template, ...values]);
            },
          });
          const result = await operation(wrapped);
          assert.equal(
            terminal,
            1,
            `terminal statement intercepted once: ${JSON.stringify(result)}`,
          );
          return result;
        });
    },
  });
}
