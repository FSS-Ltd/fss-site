import assert from "node:assert/strict";
import test from "node:test";
import { getOperationsDb, operationsEnabled } from "./client";

test("Operations is disabled unless explicitly enabled and never falls back to Growth credentials", async () => {
  for (const value of [undefined, "", "false", "TRUE", "1"])
    assert.equal(operationsEnabled({ OPERATIONS_ENABLED: value }), false);
  assert.equal(operationsEnabled({ OPERATIONS_ENABLED: "true" }), true);
  const enabled = process.env.OPERATIONS_ENABLED;
  const url = process.env.OPERATIONS_DATABASE_URL;
  try {
    delete process.env.OPERATIONS_ENABLED;
    assert.throws(getOperationsDb, /disabled/);
    process.env.OPERATIONS_ENABLED = "true";
    delete process.env.OPERATIONS_DATABASE_URL;
    assert.throws(getOperationsDb, /not configured/);
    process.env.OPERATIONS_DATABASE_URL =
      "postgres://operations_founder:local@127.0.0.1:1/unused";
    const db = getOperationsDb();
    assert.equal(getOperationsDb(), db);
    assert.equal(db.options.connection?.options, "-c role=operations_founder");
    await db.end();
  } finally {
    if (enabled === undefined) delete process.env.OPERATIONS_ENABLED;
    else process.env.OPERATIONS_ENABLED = enabled;
    if (url === undefined) delete process.env.OPERATIONS_DATABASE_URL;
    else process.env.OPERATIONS_DATABASE_URL = url;
  }
});
