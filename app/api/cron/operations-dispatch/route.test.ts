import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route";

test("exported onboarding cron authenticates and gates work before onboarding worker or database access", async () => {
  const names = [
    "CRON_SECRET",
    "OPERATIONS_ENABLED",
    "OPERATIONS_ONBOARDING_ENABLED",
  ];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  try {
    process.env.CRON_SECRET = "synthetic-cron-secret";
    process.env.OPERATIONS_ENABLED = "false";
    process.env.OPERATIONS_ONBOARDING_ENABLED = "true";
    const url = "https://fss.test/api/cron/operations-dispatch";
    assert.equal((await GET(new Request(url))).status, 401);
    const request = () =>
      new Request(url, {
        headers: { authorization: "Bearer synthetic-cron-secret" },
      });
    const disabled = await GET(request());
    assert.equal(disabled.status, 200);
    assert.deepEqual(await disabled.json(), {
      ok: true,
      skipped: "operations_onboarding_disabled",
    });
    process.env.OPERATIONS_ENABLED = "true";
    process.env.OPERATIONS_ONBOARDING_ENABLED = "false";
    assert.equal((await GET(request())).status, 200);
  } finally {
    for (const [name, value] of previous)
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  }
});
