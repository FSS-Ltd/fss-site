import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { campaignCommandSchema } from "./schemas";

const base = {
  type: "record_outcome",
  requestId: randomUUID(),
  membershipId: randomUUID(),
  expectedPolicyVersion: 1,
  expectedProspectVersion: 1,
  expectedContactVersion: 1,
};
const meeting = {
  kind: "meeting",
  crmActivityId: randomUUID(),
  occurredAt: new Date(),
  qualified: true,
};
test("outcome commands accept only explicit qualified source review, never caller-asserted authority", () => {
  assert.equal(
    campaignCommandSchema.safeParse({ ...base, outcome: meeting }).success,
    true,
  );
  assert.equal(
    campaignCommandSchema.safeParse({
      ...base,
      outcome: { ...meeting, qualified: false },
    }).success,
    false,
  );
  assert.equal(
    campaignCommandSchema.safeParse({
      ...base,
      outcome: { ...meeting, reviewed: true },
    }).success,
    false,
  );
  assert.equal(
    campaignCommandSchema.safeParse({
      ...base,
      outcome: {
        kind: "payment",
        invoiceId: randomUUID(),
        netClearedPence: 100,
      },
    }).success,
    false,
  );
  assert.equal(
    campaignCommandSchema.safeParse({
      ...base,
      outcome: {
        kind: "proposal",
        engagementId: randomUUID(),
        stageEventId: randomUUID(),
      },
    }).success,
    true,
  );
});
