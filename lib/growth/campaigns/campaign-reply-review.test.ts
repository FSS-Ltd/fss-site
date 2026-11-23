import assert from "node:assert/strict";
import test from "node:test";
import { campaignCommandSchema } from "./schemas";

const requestId = "6d2554d6-42a3-454c-9917-35ee593a6cab";
const membershipId = "4d2554d6-42a3-454c-9917-35ee593a6cab";
const messageId = "5d2554d6-42a3-454c-9917-35ee593a6cab";
const valid = {
  type: "record_reply" as const,
  requestId,
  membershipId,
  inboundMessageId: messageId,
  expectedPolicyVersion: 1,
  expectedProspectVersion: 1,
  expectedContactVersion: 1,
  kind: "positive" as const,
};

test("review requires the local inbound identity and actual source versions", () => {
  assert.equal(campaignCommandSchema.safeParse(valid).success, true);
  assert.equal(
    campaignCommandSchema.safeParse({ ...valid, inboundMessageId: "invalid" })
      .success,
    false,
  );
  assert.equal(
    campaignCommandSchema.safeParse({ ...valid, expectedContactVersion: 0 })
      .success,
    false,
  );
  assert.equal(
    campaignCommandSchema.safeParse({ ...valid, occurredAt: new Date() })
      .success,
    false,
  );
  assert.equal(
    campaignCommandSchema.safeParse({ ...valid, providerReplyId: "fake" })
      .success,
    false,
  );
});
