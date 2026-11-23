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
    query += parts.join(" ");
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

test("exact reference uses confirmed immutable Gmail evidence across thread and grant changes", async () => {
  const base = row();
  const recipient = "owner@example.com";
  const sequenceId = "c2312dac-511f-446c-b86e-e33b06a44a65";
  const contactId = "0652f8d1-5606-4ea8-880e-e88a4cf9f48e";
  const attribution = {
    basis: "gmail_exact_reference_v1",
    outboundProvider: "gmail",
    reservationId: base.reservationId,
    rfcMessageId: base.rfc,
    connectionId: base.connectionId,
    googleSubject: "subject",
    grantEpoch: 2,
    recipient,
  };
  const exact = {
    ...base,
    threadId: "different-thread",
    sequenceId,
    policyProvider: "gmail",
    policyConnectionId: base.connectionId,
    attribution,
    sourceReservationId: base.reservationId,
    sender: recipient,
    mailboxSubject: "subject",
    mailboxAddress: email,
    mailboxVersion: 3,
  };
  const source = {
    id: base.reservationId,
    membershipId: base.membershipId,
    channel: "gmail",
    sequenceId,
    status: "active",
    prospectId: "prospect",
    contactId,
    contactEmail: recipient,
    rfc: base.rfc,
    accountId: base.accountId,
    connectionId: base.connectionId,
    grantEpoch: 2,
    generation: null,
    key: "key",
    hash: base.hash,
    providerId: base.providerId,
    threadId: base.providerThreadId,
    snapshot: {
      from: email,
      recipient,
      connectionId: base.connectionId,
      googleSubject: "subject",
      grantEpoch: 2,
      rfcMessageId: base.rfc,
      rawSha256: base.hash,
    },
    evidence: base.evidence,
    receipt: {
      basis: "gmail_fss_sent_observed",
      providerMessageId: base.providerId,
      providerThreadId: base.providerThreadId,
      rfcMessageId: base.rfc,
      googleSubject: "subject",
      rawSha256: base.hash,
      observationGrantEpoch: 2,
    },
    deliveryMatches: false,
    membershipMatches: true,
  };
  async function read(proven: object[], observation = exact) {
    let calls = 0;
    const db = Object.assign(
      async () => (++calls === 1 ? [] : calls === 2 ? [observation] : proven),
      { array: (values: unknown[]) => values },
    ) as unknown as GrowthQueryExecutor;
    return getProspectCampaignReplies("prospect", founder, db, now);
  }
  const result = await read([source]);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(
    result.items[0]?.gmailUrl,
    "https://mail.google.com/mail/u/0/#all/different-thread",
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /owner@example|subject|sent@example/,
  );
  for (const bad of [
    [{ ...source, evidence: null }],
    [
      source,
      {
        ...source,
        id: "d8fd3d6d-9fc6-4a71-9a61-c20691c432df",
        evidence: {
          ...base.evidence,
          reservationId: "d8fd3d6d-9fc6-4a71-9a61-c20691c432df",
        },
      },
    ],
    [{ ...source, membershipId: "another" }],
  ]) {
    const rejected = await read(bad);
    if (rejected.status === "ready") assert.equal(rejected.items.length, 0);
  }
  const resendConnection = "b1280a7e-e5da-401e-bf1a-0bc11074db51";
  const generation = "97fa7c69-7aa6-4d30-8f98-5b35d735069d";
  const resend = {
    ...source,
    channel: "resend",
    accountId: resendConnection,
    connectionId: resendConnection,
    generation,
    deliveryMatches: true,
    membershipMatches: true,
    snapshot: {
      recipient,
      replyTo: email,
      accountId: resendConnection,
      connectionId: resendConnection,
      sendGeneration: generation,
      idempotencyKey: "key",
      bodySha256: base.hash,
      monitoredMailbox: {
        connectionId: base.connectionId,
        googleSubject: "subject",
        grantEpoch: 2,
        address: email,
        grantedScopes: scopes,
      },
      campaign: {
        effectiveRecipient: { email: recipient, contactId },
        reviewedRecipient: { email: recipient, contactId },
      },
    },
    evidence: {
      version: 1,
      kind: "resend_api_send_email_v1",
      reservationId: base.reservationId,
      accountId: resendConnection,
      connectionId: resendConnection,
      sendGeneration: generation,
      idempotencyKey: "key",
      bodySha256: base.hash,
      providerMessageId: base.providerId,
    },
    receipt: {
      basis: "resend_fss_delivery_observed",
      providerMessageId: base.providerId,
      providerEventId: "delivery",
      bodySha256: base.hash,
      rfcMessageId: base.rfc,
      connectionId: resendConnection,
      webhookGeneration: generation,
      sendGeneration: generation,
    },
  };
  const resendObservation = {
    ...exact,
    policyProvider: "resend",
    policyConnectionId: resendConnection,
    attribution: { ...attribution, outboundProvider: "resend" },
  };
  const resendResult = await read([resend], resendObservation);
  if (resendResult.status === "ready")
    assert.equal(resendResult.items.length, 1);
  else assert.fail("Resend unavailable");
  const unconfirmed = await read(
    [{ ...resend, deliveryMatches: false }],
    resendObservation,
  );
  if (unconfirmed.status === "ready") assert.equal(unconfirmed.items.length, 0);
  const wrongMailbox = await read([source], {
    ...exact,
    mailboxSubject: "different",
  });
  if (wrongMailbox.status === "ready")
    assert.equal(wrongMailbox.items.length, 0);
});
