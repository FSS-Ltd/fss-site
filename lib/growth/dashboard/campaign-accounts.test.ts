import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { GrowthDb } from "../db/types";
import { getCampaignAccounts } from "./campaign-accounts";

const email = "j.ntagengwa@faithfulsoftware.dev";
const founder = {
  email,
  actorId: createHash("sha256").update(email).digest("hex"),
};
function database(gmail: object | null): GrowthDb {
  const tx = async (strings: TemplateStringsArray) => {
    const sql = strings.join(" ");
    if (sql.includes("from growth.integration_connections i"))
      return gmail ? [gmail] : [];
    return [];
  };
  return {
    begin: async (fn: (query: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as GrowthDb;
}

test("shows only the founder connection, with unknown readiness and no raw evidence", async () => {
  const result = await getCampaignAccounts(
    founder,
    database({
      id: "connection",
      sender: email,
      status: "connected",
      subject: "subject",
      scopes: ["https://www.googleapis.com/auth/gmail.modify"],
      ramp: null,
      limits: { secret: "private evidence" },
      health: null,
      usageAt: null,
      usageExpires: null,
    }),
    null,
  );
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.accounts.length, 1);
  assert.equal(result.accounts[0]?.selectable, true);
  assert.deepEqual(result.accounts[0]?.readiness, {
    status: "held",
    reason: "identity_or_grant_unknown",
  });
  assert.equal(result.accounts[0]?.limitsEvidence, null);
  assert.doesNotMatch(JSON.stringify(result), /private evidence|subject/);
  assert.equal(result.resendConfiguration, "unknown");
});

test("missing connections and database failures remain explicit", async () => {
  const empty = await getCampaignAccounts(founder, database(null), null);
  assert.deepEqual(empty, {
    status: "ready",
    accounts: [],
    resendConfiguration: "unknown",
  });
  const broken = {
    begin: async () => {
      throw new Error("private details");
    },
  } as unknown as GrowthDb;
  assert.deepEqual(await getCampaignAccounts(founder, broken, null), {
    status: "unavailable",
  });
  await assert.rejects(() =>
    getCampaignAccounts({ ...founder, actorId: "wrong" }, broken, null),
  );
});
