import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { GrowthQueryExecutor } from "../db/types";
import { getProspectCampaignReplies } from "./prospect-campaign-replies";

const email = "j.ntagengwa@faithfulsoftware.dev";
const founder = {
  email,
  actorId: createHash("sha256").update(email).digest("hex"),
};
const scopes = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.modify",
];
const now = new Date("2026-11-23T12:00:00Z");
function row() {
  const reservationId = "63824032-a9cf-475d-a1e3-d0910e4b6fdd",
    connectionId = "c84d3199-9866-45a8-98fd-ed028e116d3e";
  const evidence = {
    version: 1,
    kind: "gmail_api_send_message_v1",
    reservationId,
    accountId: "account",
    connectionId,
    googleSubject: "subject",
    grantEpoch: 2,
    rfcMessageId: "<sent@example.com>",
    rawSha256: "a".repeat(64),
    providerMessageId: "sent-1",
    providerThreadId: "thread/1",
  };
  return {
    messageId: "0fd0d6f0-44e6-4d79-a24a-c20c071dd810",
    membershipId: "4e3d1653-82b2-4eed-a62e-ec5c0d7eb732",
    policyVersion: 1,
    prospectVersion: 4,
    contactVersion: 3,
    receivedAt: new Date("2026-11-22T12:00:00Z"),
    threadId: "thread/1",
    googleSubject: "subject",
    connectionId,
    grantEpoch: 2,
    scopes,
    verifiedScopes: scopes,
    reviewedMembershipId: null,
    reviewedKind: null,
    reviewedAt: null,
    reservationId,
    accountId: "account",
    reservationConnectionId: connectionId,
    reservationGrantEpoch: 2,
    rfc: "<sent@example.com>",
    hash: "a".repeat(64),
    providerId: "sent-1",
    providerThreadId: "thread/1",
    snapshotSubject: "subject",
    evidence,
  };
}
function dbReturning(rows: object[]): GrowthQueryExecutor {
  return (async () => rows) as unknown as GrowthQueryExecutor;
}

test("projects only attributable receipt metadata and a safe Gmail link", async () => {
  let query = "";
  const db = (async (parts: TemplateStringsArray) => {
    query = parts.join(" ");
    return [row()];
  }) as unknown as GrowthQueryExecutor;
  const result = await getProspectCampaignReplies("prospect", founder, db, now);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.items.length, 1);
  assert.equal(
    result.items[0]?.gmailUrl,
    "https://mail.google.com/mail/u/0/#all/thread%2F1",
  );
  assert.equal(result.items[0]?.review, null);
  assert.doesNotMatch(
    JSON.stringify(result),
    /sent@example.com|subject|rawSha256/,
  );
  assert.match(query, /count\(\*\) from growth.campaign_memberships/);
  assert.match(query, /count\(\*\) from growth.sequence_enrollments/);
  assert.match(query, /limit 21/);
});

test("omits mismatched evidence, ambiguous review, and unbound issuers", async () => {
  for (const bad of [
    { ...row(), snapshotSubject: "different" },
    {
      ...row(),
      reviewedMembershipId: "another",
      reviewedKind: "positive",
      reviewedAt: now,
    },
    { ...row(), evidence: null },
  ]) {
    const result = await getProspectCampaignReplies(
      "prospect",
      founder,
      dbReturning([bad]),
      now,
    );
    assert.deepEqual(result, { status: "ready", items: [], truncated: false });
  }
});

test("retains valid historical same-subject evidence after the grant version changes", async () => {
  const historical = row();
  historical.grantEpoch = 3;
  const result = await getProspectCampaignReplies(
    "prospect",
    founder,
    dbReturning([historical]),
    now,
  );
  assert.equal(result.status, "ready");
  if (result.status === "ready") assert.equal(result.items.length, 1);
});

test("retains a recorded classification but does not expose invalid classifications", async () => {
  const good = row();
  const result = await getProspectCampaignReplies(
    "prospect",
    founder,
    dbReturning([
      {
        ...good,
        reviewedMembershipId: good.membershipId,
        reviewedKind: "opt_out",
        reviewedAt: now,
      },
    ]),
    now,
  );
  assert.equal(result.status, "ready");
  if (result.status === "ready")
    assert.equal(result.items[0]?.review?.kind, "opt_out");
  const bad = await getProspectCampaignReplies(
    "prospect",
    founder,
    dbReturning([
      {
        ...good,
        reviewedMembershipId: good.membershipId,
        reviewedKind: "invented",
        reviewedAt: now,
      },
    ]),
    now,
  );
  if (bad.status === "ready") assert.equal(bad.items.length, 0);
  await assert.rejects(() =>
    getProspectCampaignReplies(
      "prospect",
      { ...founder, actorId: "wrong" },
      dbReturning([]),
      now,
    ),
  );
});
