import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { GrowthQueryExecutor } from "../db/types";
import { getProspectCampaignOutcomes } from "./prospect-campaign-outcomes";

const email = "j.ntagengwa@faithfulsoftware.dev";
const founder = {
  email,
  actorId: createHash("sha256").update(email).digest("hex"),
};
const date = new Date("2026-11-22T12:00:00Z");
function database(invalid = false): GrowthQueryExecutor {
  return (async (parts: TemplateStringsArray) => {
    const sql = parts.join(" ");
    if (sql.includes("from growth.campaign_memberships m"))
      return [
        {
          id: "member",
          campaign: "Campaign",
          policyVersion: 1,
          prospectVersion: 2,
          contactVersion: 3,
          submittedAt: invalid ? "bad" : date,
        },
      ];
    if (sql.includes("from growth.crm_activities"))
      return [{ id: "meeting", recordedAt: date, attributed: false }];
    if (sql.includes("from growth.commercial_stage_events"))
      return [
        {
          id: "proposal",
          engagementId: "engagement",
          recordedAt: date,
          attributed: true,
        },
      ];
    throw new Error("unexpected query");
  }) as unknown as GrowthQueryExecutor;
}
test("returns bounded existing evidence and attribution state without activity body", async () => {
  const result = await getProspectCampaignOutcomes(
    "prospect",
    founder,
    database(),
  );
  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.equal(result.memberships.length, 1);
    assert.equal(result.meetings[0]?.attributed, false);
    assert.equal(result.proposals[0]?.attributed, true);
    assert.doesNotMatch(JSON.stringify(result), /body|recipient/);
  }
});
test("rejects invalid dates and nonfounders", async () => {
  assert.deepEqual(
    await getProspectCampaignOutcomes("prospect", founder, database(true)),
    { status: "unavailable" },
  );
  await assert.rejects(() =>
    getProspectCampaignOutcomes(
      "prospect",
      { ...founder, actorId: "other" },
      database(),
    ),
  );
});
