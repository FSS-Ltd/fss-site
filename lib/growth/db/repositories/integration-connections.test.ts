import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../types";
import { listIntegrationConnectionHealth } from "./integration-connections";

test("returns a bounded, secret-free integration health projection", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const rows = [
    {
      provider: "gmail" as const,
      status: "connected" as const,
      lastSyncedAt: new Date("2026-08-17T06:00:00.000Z"),
    },
  ];
  const db = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return rows;
  }) as unknown as GrowthQueryExecutor;

  const result = await listIntegrationConnectionHealth(
    db,
    " Founder@Example.Test ",
    5,
  );

  assert.deepEqual(result, rows);
  assert.deepEqual(queries[0]?.values, ["founder@example.test", 5]);
  const queryText = queries[0]?.text ?? "";
  const projection = queryText.split(" from ")[0] ?? "";
  assert.match(queryText, /where ic\.subject_email = \?/);
  assert.match(queryText, /limit \?/);
  assert.doesNotMatch(
    queryText,
    /encrypted_refresh_token|provider_cursor|last_error_code/i,
  );
  assert.doesNotMatch(projection, /subject_email/i);
});

test("rejects unbounded integration health requests", async () => {
  const db = (() => []) as unknown as GrowthQueryExecutor;

  await assert.rejects(
    () => listIntegrationConnectionHealth(db, "founder@example.test", 6),
    {
      name: "RangeError",
    },
  );
});

test("rejects a blank integration subject before querying", async () => {
  const db = (() => []) as unknown as GrowthQueryExecutor;

  await assert.rejects(() => listIntegrationConnectionHealth(db, "  "), {
    name: "TypeError",
  });
});
