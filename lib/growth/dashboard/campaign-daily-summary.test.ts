import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { GrowthDb } from "../db/types";
import { getCampaignDailySummary } from "./campaign-daily-summary";

const email = "j.ntagengwa@faithfulsoftware.dev";
const founder = {
  email,
  actorId: createHash("sha256").update(email).digest("hex"),
};
import { summary } from "./campaign-daily-summary.fixture";

function db(rows: object[]): GrowthDb {
  return (async () => rows) as unknown as GrowthDb;
}
test("returns the latest stored parsed summary and keeps a prior London day", async () => {
  let query = "";
  const database = (async (parts: TemplateStringsArray) => {
    query = parts.join(" ");
    return [{ evidence: summary }];
  }) as unknown as GrowthDb;
  assert.deepEqual(await getCampaignDailySummary(founder, database), {
    status: "ready",
    summary,
  });
  assert.match(query, /order by london_day desc limit 1/);
  assert.match(query, /Europe\/London/);
});
test("distinguishes no record and unavailable or invalid evidence", async () => {
  assert.deepEqual(await getCampaignDailySummary(founder, db([])), {
    status: "empty",
  });
  assert.deepEqual(
    await getCampaignDailySummary(
      founder,
      db([{ evidence: { ...summary, issuedAttempts: -1 } }]),
    ),
    { status: "unavailable" },
  );
  assert.deepEqual(
    await getCampaignDailySummary(
      founder,
      db([{ evidence: { ...summary, londonDay: "2026-99-01" } }]),
    ),
    { status: "unavailable" },
  );
  await assert.rejects(() =>
    getCampaignDailySummary({ ...founder, actorId: "wrong" }, db([])),
  );
});
