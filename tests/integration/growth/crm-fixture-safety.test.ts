import assert from "node:assert/strict";
import test from "node:test";
import { withCrmTestDatabase } from "./crm-test-fixtures";
test("CRM fixtures refuse external or ordinary local database targets before connecting", async () => {
  for (const connection of [
    "postgres://postgres@db.example.test/fss_crm_test",
    "postgres://postgres@127.0.0.1/production",
  ])
    await assert.rejects(
      withCrmTestDatabase(async () => {
        throw new Error("Must not execute");
      }, connection),
      /disposable loopback/,
    );
});
