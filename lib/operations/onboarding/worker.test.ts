import { test } from "node:test";
import assert from "node:assert/strict";
import { runOnboardingWorker } from "./worker";
import { preparedWelcomeFixture } from "./fixtures";
import type {
  OnboardingEffects,
  OnboardingLease,
  OnboardingStore,
  EffectResult,
} from "./types";
async function fixture() {
  const { snapshot, pdf } = await preparedWelcomeFixture();
  const lease: OnboardingLease = {
    jobId: "job",
    recipient: snapshot.recipient,
    uncertain: false,
    journeyId: "journey",
    organisationId: "org",
    agreementId: "agreement",
    approvalId: "approval",
    signingApprovalId: null,
    step: "welcome",
    generation: 1,
    leaseToken: "lease",
    idempotencyKey: "stable",
    attempts: 0,
    firstAttemptAt: null,
    dueAt: "2026-09-08T09:00:00Z",
    snapshot,
    proposal: null,
    pdf,
    invoice: null,
    invitation: null,
  };
  const receipt = { providerId: "email-1", acceptedAt: "2026-09-08T10:00:00Z" };
  const calls: string[] = [];
  const store: OnboardingStore = {
    claim: async () => [lease],
    beginEffect: async () => true,
    succeed: async () => {
      calls.push("persist");
    },
    fail: async (_l, code, next) => {
      calls.push(`${code}:${next?.toISOString() ?? "held"}`);
    },
  };
  const success = async (): Promise<EffectResult> => {
    calls.push("effect");
    return { status: "succeeded", receipt };
  };
  const effects: OnboardingEffects = {
    sendEmail: success,
    ensureProposalAccess: success,
    createInvoice: success,
    ensureInvitation: success,
  };
  return { lease, store, effects, calls };
}
const now = () => new Date("2026-09-08T10:00:00Z");
test("stale lease never calls provider; expired uncertainty holds before call", async () => {
  const f = await fixture();
  f.store.beginEffect = async () => false;
  assert.equal(
    (await runOnboardingWorker(f.store, f.effects, { now })).skipped,
    1,
  );
  assert.deepEqual(f.calls, []);
  f.lease.uncertain = true;
  f.lease.firstAttemptAt = "2026-09-07T10:00:00Z";
  assert.equal(
    (await runOnboardingWorker(f.store, f.effects, { now })).held,
    1,
  );
  assert.deepEqual(f.calls, ["dedupe_window_expired:held"]);
});
test("exception retries same effect and exhausted budget holds", async () => {
  const f = await fixture();
  f.effects.sendEmail = async () => {
    throw Error("private transport details");
  };
  assert.equal(
    (await runOnboardingWorker(f.store, f.effects, { now })).retried,
    1,
  );
  assert.match(f.calls[0], /^unknown_outcome:2026-09-08T10:01/);
  f.lease.attempts = 5;
  assert.equal(
    (await runOnboardingWorker(f.store, f.effects, { now })).held,
    1,
  );
});
test("persistence failure escapes instead of losing provider uncertainty", async () => {
  const f = await fixture();
  f.store.succeed = async () => {
    throw Error("database offline");
  };
  await assert.rejects(
    runOnboardingWorker(f.store, f.effects, { now }),
    /database offline/,
  );
  assert.deepEqual(f.calls, ["effect"]);
});
test("resumable step routing and missing dependencies", async () => {
  const f = await fixture();
  for (const step of [
    "welcome",
    "proposal_access",
    "invoice",
    "invitation",
  ] as const) {
    f.lease.step = step;
    assert.equal(
      (await runOnboardingWorker(f.store, f.effects, { now })).succeeded,
      1,
    );
  }
  f.lease.step = "proposal";
  assert.equal(
    (await runOnboardingWorker(f.store, f.effects, { now })).held,
    1,
  );
  f.lease.proposal = {
    signingApprovalId: "approval",
    approvalHash: "hash",
    revision: 1,
    signers: [f.lease.recipient],
    access: [{ email: f.lease.recipient, role: "owner" }],
    emails: [f.lease.snapshot.welcome],
    portalUrl: "https://example.test/portal",
  };
  assert.equal(
    (await runOnboardingWorker(f.store, f.effects, { now })).succeeded,
    1,
  );
  f.lease.step = "thank_you";
  assert.equal(
    (await runOnboardingWorker(f.store, f.effects, { now })).held,
    1,
  );
  f.lease.invoice = {
    providerId: "invoice",
    acceptedAt: now().toISOString(),
    url: "https://example.test/portal/billing",
  };
  f.lease.invitation = {
    providerId: "access",
    acceptedAt: now().toISOString(),
    url: "https://example.test/portal",
  };
  assert.equal(
    (await runOnboardingWorker(f.store, f.effects, { now })).succeeded,
    1,
  );
});
