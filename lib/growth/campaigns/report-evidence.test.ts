import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { projectConfirmation } from "./report-evidence";

function fixture() {
  const campaignId = randomUUID(),
    membershipId = randomUUID(),
    businessId = randomUUID(),
    sequenceId = randomUUID();
  const reservationId = randomUUID(),
    connectionId = randomUUID(),
    contactId = randomUUID();
  const raw = Buffer.from("bounded synthetic content").toString("base64url");
  const hash = createHash("sha256")
    .update(Buffer.from(raw, "base64url"))
    .digest("hex");
  const observedAt = new Date("2026-04-01T12:00:00Z");
  const recipient = {
    email: "person@example.test",
    contactId,
    contactVersion: 1,
    prospectVersion: 1,
  };
  const campaign = {
    campaignId,
    membershipId,
    businessId,
    policyVersion: 1,
    cadenceFamily: "review",
    market: "GB",
    offer: "review",
    variantId: "a",
    variantVersion: 1,
    copySha256: "a".repeat(64),
    permissionId: randomUUID(),
    reviewedRecipient: recipient,
    effectiveRecipient: recipient,
    sourceProof: {
      origin: "founder",
      requestId: randomUUID(),
      contactId,
      contactProofId: randomUUID(),
      observationProofId: randomUUID(),
      proofContactVersion: 1,
      proofProspectVersion: 1,
      freshUntil: "2026-04-02T00:00:00Z",
    },
  };
  const directEvidence = {
    version: 1,
    kind: "gmail_api_send_message_v1",
    reservationId,
    accountId: "test-account",
    connectionId,
    googleSubject: "subject",
    grantEpoch: 1,
    rfcMessageId: "<synthetic@example.test>",
    rawSha256: hash,
    providerMessageId: "message",
    providerThreadId: "thread",
  };
  return {
    membershipId,
    campaignId,
    businessId,
    sequenceId,
    policyVersion: 1,
    reservationId,
    connectionId,
    accountId: "test-account",
    grantEpoch: 1,
    rfc: directEvidence.rfcMessageId,
    providerId: "message",
    threadId: "thread",
    hash,
    observedAt,
    submittedAt: new Date("2026-04-01T11:59:00Z"),
    guardedClaim: true,
    directEvidence,
    policy: {
      version: 1,
      offer: "review",
      variants: [{ id: "a", version: 1, cta: "Interested?" }],
    },
    confirmedSnapshot: campaign,
    snapshot: {
      raw,
      rawSha256: hash,
      googleSubject: "subject",
      connectionId,
      grantEpoch: 1,
      rfcMessageId: directEvidence.rfcMessageId,
      sequenceId,
      membershipId,
      campaign,
    },
    receipt: {
      basis: "gmail_fss_sent_observed",
      providerMessageId: "message",
      providerThreadId: "thread",
      rfcMessageId: directEvidence.rfcMessageId,
      googleSubject: "subject",
      rawSha256: hash,
      observedUntil: observedAt.toISOString(),
      possibleInvocationFrom: "2026-04-01T11:59:00Z",
    },
  };
}

test("projects a verified immutable Gmail observation without claiming historical coverage", () => {
  const row = fixture();
  const result = projectConfirmation(row);
  assert.equal(result?.confirmation.basis, "gmail_fss_sent_observed");
  assert.equal(result?.replyCoverage, "unknown");
  assert.equal(result?.meetingObservation, "unknown");
  assert.equal(result?.comparisonFingerprint, null);
});

test("holds tampered content, receipt, direct submission and mismatched frozen assignment", () => {
  const row = fixture();
  assert.equal(projectConfirmation({ ...row, hash: "b".repeat(64) }), null);
  assert.equal(
    projectConfirmation({
      ...row,
      directEvidence: { ...row.directEvidence, providerThreadId: "other" },
    }),
    null,
  );
  assert.equal(
    projectConfirmation({
      ...row,
      receipt: { ...row.receipt, observedUntil: "2026-04-01T11:59:00Z" },
    }),
    null,
  );
  assert.equal(
    projectConfirmation({
      ...row,
      confirmedSnapshot: { ...row.confirmedSnapshot, variantId: "other" },
    }),
    null,
  );
  assert.equal(projectConfirmation({ ...row, campaignId: randomUUID() }), null);
});
