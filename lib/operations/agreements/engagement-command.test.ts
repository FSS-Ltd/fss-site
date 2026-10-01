import assert from "node:assert/strict";
import test from "node:test";
import { engagementCommandSchema } from "./engagement-command";

const commandId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const engagementId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("accepts a reviewed create command for a client without a Growth prospect", () => {
  const result = engagementCommandSchema.safeParse({
    action: "create",
    commandId,
    draftId,
    expectedVersion: 2,
    name: "Website and booking experience",
    primaryGoal: "Help customers book online.",
    proposedScope: "Website pages and a booking workflow.",
    reviewReference: "Discovery review 2026-10-01",
    reviewed: true,
  });

  assert.equal(result.success, true);
});

test("requires explicit review and review provenance before creating work", () => {
  const result = engagementCommandSchema.safeParse({
    action: "create",
    commandId,
    name: "Website and booking experience",
    primaryGoal: "Help customers book online.",
    proposedScope: "Website pages and a booking workflow.",
    reviewReference: " ",
    reviewed: false,
  });

  assert.equal(result.success, false);
});

test("requires draft identity and version together", () => {
  const result = engagementCommandSchema.safeParse({
    action: "select",
    commandId,
    draftId,
    engagementId,
  });

  assert.equal(result.success, false);
});

test("accepts a versioned command to select an existing linked engagement", () => {
  const result = engagementCommandSchema.safeParse({
    action: "select",
    commandId,
    draftId,
    engagementId,
    expectedVersion: 2,
  });

  assert.equal(result.success, true);
});
