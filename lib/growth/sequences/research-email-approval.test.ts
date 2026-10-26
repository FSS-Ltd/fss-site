import assert from "node:assert/strict";
import test from "node:test";
import type { GrowthDb } from "../db/types";
import { createGlobalResearchFixture } from "../research/global-test-fixture";
import type {
  FirstEmailApprovalRepository,
  FirstEmailApprovalTransaction,
  CreateEnrollmentAndMessageInput,
} from "./approval";
import { createResearchEmailApprover } from "./research-email-approval";
import {
  researchEmailFingerprint,
  researchEmailSnapshotSchema,
} from "./research-email-snapshot";

const snapshot = researchEmailSnapshotSchema.parse({
  schemaVersion: "2.0",
  reviewState: "research_only",
  email: createGlobalResearchFixture().prospects[0]!.firstEmail,
});
const id = "11111111-1111-4111-8111-111111111111";
const founder = { email: "founder@example.test", actorId: "a".repeat(64) };
const recipient = "business@example.test";
const request = {
  draftTaskId: id,
  expectedVersion: 1,
  expectedProspectVersion: 2,
  fingerprint: researchEmailFingerprint(snapshot, recipient, 2),
  permission: {
    basis: "consent" as const,
    evidence: "Recipient requested this information.",
  },
  founder,
  correlationId: "research-approval",
};

function setup(overrides: Record<string, unknown> = {}) {
  const writes: CreateEnrollmentAndMessageInput[] = [];
  const saved: Record<string, unknown>[] = [];
  const permissions: unknown[] = [];
  const audits: unknown[] = [];
  const tx: FirstEmailApprovalTransaction = {
    lockDraft: async () => ({
      id,
      prospectId: id,
      contactId: id,
      contactEmail: recipient,
      normalisedEmail: recipient,
      status: "completed",
      completedAt: new Date(),
      hasEnrollment: false,
      outputSnapshot: snapshot,
      subscriberType: "uncertain",
      corporateStatus: "active",
      prospectStatus: "ready_for_email_review",
      prospectVersion: 2,
      ...overrides,
    }),
    isSuppressed: async () => overrides.suppressed === true,
    getApprovedAsset: async () => null,
    createEnrollmentAndFirstMessage: async (input) => {
      writes.push(input);
      return { sequenceEnrollmentId: id };
    },
    markDraftReviewState: async (_id, output) => {
      saved.push(output);
    },
    appendApprovalAudit: async (input) => {
      audits.push(input);
    },
    authorizeResearchContact: async (input) => {
      permissions.push(input);
    },
  };
  const repository: FirstEmailApprovalRepository = {
    withTransaction: async (_db, operation) => operation(tx),
    recordProviderDraft: async () => {},
  };
  const approve = createResearchEmailApprover({
    repository,
    founderEmail: founder.email,
    createMessageId: () => id,
  });
  return { approve, writes, saved, permissions, audits };
}

test("explicit research approval freezes the exact email and recipient as a single email", async () => {
  const state = setup();
  const result = await state.approve({} as GrowthDb, request);
  assert.equal(result.status, "queued");
  assert.equal(state.writes[0]?.message.htmlSnapshot, snapshot.email.html);
  assert.equal(state.writes[0]?.message.textSnapshot, snapshot.email.text);
  assert.equal(state.writes[0]?.followUpPolicy, "manual_only");
  assert.equal(state.saved[0]?.reviewState, "approved");
  assert.equal(state.permissions.length, 1);
  assert.equal(state.audits.length, 1);
});

test("research approval rejects suppression, stale copy, stale contact state and replay before writes", async () => {
  for (const overrides of [
    { suppressed: true },
    { hasEnrollment: true },
    { prospectStatus: "rejected" },
    { prospectVersion: 3 },
    { outputSnapshot: { ...snapshot, draftVersion: 2 } },
  ]) {
    const state = setup(overrides);
    await assert.rejects(state.approve({} as GrowthDb, request));
    assert.equal(state.writes.length, 0);
    assert.equal(state.permissions.length, 0);
  }
  const state = setup();
  await assert.rejects(
    state.approve({} as GrowthDb, { ...request, fingerprint: "b".repeat(64) }),
  );
  assert.equal(state.writes.length, 0);
});
