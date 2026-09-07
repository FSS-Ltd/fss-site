import assert from "node:assert/strict";
import test from "node:test";
import { getPortalDb } from "./portal-client";

test("portal database requires its independent configuration and reuses a bounded pool", async () => {
  const enabled = process.env.OPERATIONS_ENABLED;
  const url = process.env.OPERATIONS_PORTAL_DATABASE_URL;
  try {
    delete process.env.OPERATIONS_ENABLED;
    assert.throws(getPortalDb, /Operations is disabled/);
    process.env.OPERATIONS_ENABLED = "true";
    delete process.env.OPERATIONS_PORTAL_DATABASE_URL;
    assert.throws(getPortalDb, /Portal database is not configured/);
    process.env.OPERATIONS_PORTAL_DATABASE_URL =
      "postgres://synthetic:synthetic@127.0.0.1:1/synthetic";
    const db = getPortalDb();
    assert.equal(getPortalDb(), db);
    assert.equal(db.options.max, 5);
    assert.equal(db.options.prepare, false);
    assert.equal(db.options.connection.options, "-c role=operations_portal");
    await db.end();
  } finally {
    if (enabled === undefined) delete process.env.OPERATIONS_ENABLED;
    else process.env.OPERATIONS_ENABLED = enabled;
    if (url === undefined) delete process.env.OPERATIONS_PORTAL_DATABASE_URL;
    else process.env.OPERATIONS_PORTAL_DATABASE_URL = url;
  }
});
