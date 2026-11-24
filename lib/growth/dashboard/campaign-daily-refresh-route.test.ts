import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createCampaignDailyRefreshHandler } from "./campaign-daily-refresh-route";
const origin = "https://example.test";
const email = "j.ntagengwa@faithfulsoftware.dev";
const founder = {
  email,
  actorId: createHash("sha256").update(email).digest("hex"),
};
test("reauthorizes the founder and rejects cross-origin requests without leaking state", async () => {
  const run = createCampaignDailyRefreshHandler({
    origin,
    authorizeFounder: async () => founder,
    read: async () => ({ status: "empty" }),
  });
  const good = await run(new Request(`${origin}/api`));
  assert.equal(good.status, 200);
  assert.deepEqual(await good.json(), { status: "empty" });
  assert.equal(good.headers.get("Cache-Control"), "no-store");
  assert.equal(
    (
      await run(
        new Request(`${origin}/api`, {
          headers: { origin: "https://other.test" },
        }),
      )
    ).status,
    400,
  );
  const bad = createCampaignDailyRefreshHandler({
    origin,
    authorizeFounder: async () => ({ ...founder, actorId: "other" }),
  });
  assert.equal((await bad(new Request(`${origin}/api`))).status, 401);
});
