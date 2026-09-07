import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { projectCommandSchema } from "./service";
const metadata = {
  agreementId: randomUUID(),
  title: "Website",
  summary: "Delivery",
  outcome: "Clearer enquiries",
  deliverables: ["Website"],
  status: "planned",
  ownerDisplay: "FSS",
  targetDate: null,
  scheduleDependencies: ["Approved assets"],
  scheduleEvidence: null,
  internalNotes: "Private",
  internalEstimateMinutes: 60,
  visibility: "client",
};
test("project commands preserve unscheduled state and reject fabricated or unsafe fields", () => {
  const command = { action: "create", metadata, reviewReference: "review" };
  assert.equal(projectCommandSchema.parse(command).metadata.targetDate, null);
  for (const change of [
    { progressPercent: 75 },
    { status: "invented" },
    { targetDate: "2026-02-30" },
    { internalEstimateMinutes: -1 },
    { agreementId: "unknown" },
  ])
    assert.equal(
      projectCommandSchema.safeParse({
        ...command,
        metadata: { ...metadata, ...change },
      }).success,
      false,
    );
  assert.equal(
    projectCommandSchema.safeParse({
      action: "update",
      projectId: randomUUID(),
      expectedVersion: 0,
      metadata,
      reviewReference: "review",
    }).success,
    false,
  );
});
