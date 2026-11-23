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
    resendSetup: { status: "held", reason: "runtime_binding_unknown" },
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

test("does not mark activation ready when persisted prerequisites are held", async () => {
  const result = await getCampaignAccounts(
    founder,
    database({
      id: "connection",
      sender: email,
      status: "connected",
      subject: "subject",
      scopes: ["https://www.googleapis.com/auth/gmail.modify"],
      state: "paused",
      controlVersion: 2,
      lastRampAt: null,
      ramp: 25,
      limits: null,
      health: null,
      usageAt: null,
      usageExpires: null,
    }),
    null,
  );
  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.equal(result.accounts[0]?.control?.state, "paused");
    assert.deepEqual(result.accounts[0]?.control?.prerequisites, {
      status: "held",
      reason: "identity_or_grant_unknown",
    });
  }
});

test("offers a first Resend configuration only from the server-owned runtime", async () => {
  const runtime = {
    binding: {
      team: "team",
      environment: "preview" as const,
      sender: "sender@example.com",
      domain: "example.com",
      replyTo: email,
      sendGeneration: "00869510-3d9f-4b48-a93a-d8f0636b4708",
      usageGeneration: "dcfa7d70-9a12-4af4-9cd6-004f691cd69f",
    },
    sendCredential: "synthetic-send",
    usageCredential: "synthetic-usage",
  };
  const result = await getCampaignAccounts(founder, database(null), runtime);
  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.deepEqual(result.resendSetup, {
      status: "available",
      sender: "sender@example.com",
      expectedVersion: 0,
    });
    assert.doesNotMatch(
      JSON.stringify(result),
      /synthetic-send|synthetic-usage/,
    );
  }
  const wrongMailbox = await getCampaignAccounts(founder, database(null), {
    ...runtime,
    binding: { ...runtime.binding, replyTo: "other@example.com" },
  });
  if (wrongMailbox.status === "ready")
    assert.equal(wrongMailbox.resendSetup.status, "held");
});
