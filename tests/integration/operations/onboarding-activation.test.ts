import assert from "node:assert/strict";
import test from "node:test";
import { onboardingFixture } from "./onboarding-fixtures";
import { approveJourneyProposal } from "../../../lib/operations/onboarding/repository";
import { runOnboardingWorker } from "../../../lib/operations/onboarding/worker";
import {
  createOnboardingAccessProvider,
  resolveOnboardingAccess,
} from "../../../lib/operations/onboarding/access-provider";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";
import type {
  OnboardingEffects,
  OnboardingStep,
} from "../../../lib/operations/onboarding/types";

test("separate signer, billing recipient and owner receive exactly their approved messages", async (t) => {
  const billing = "billing-recipient@example.test",
    owner = "client-owner@example.test";
  const f = await onboardingFixture(t, 1, {
    welcomeRecipient: billing,
    accessContacts: [
      { email: billing, role: "billing_contact" },
      { email: owner, role: "owner" },
    ],
  });
  const key = Buffer.alloc(32, 8),
    origin = "https://example.test";
  const access = createOnboardingAccessProvider(
    f.worker,
    key,
    origin,
    async () => {},
  );
  const messages: {
    recipient: string;
    step: OnboardingStep;
    key: string;
    text: string;
    html: string;
    accepted: boolean;
  }[] = [];
  let ownerAttempts = 0;
  const effects: OnboardingEffects = {
    ensureProposalAccess: access,
    ensureInvitation: access,
    createInvoice: async () => ({
      status: "succeeded",
      receipt: {
        providerId: "invoice",
        acceptedAt: new Date().toISOString(),
        url: "https://example.test/portal/billing",
      },
    }),
    async sendEmail({ lease, email }) {
      const resolved =
        lease.step === "welcome"
          ? email
          : await resolveOnboardingAccess(f.worker, lease, email, key, origin);
      const accepted = lease.recipient !== owner || ++ownerAttempts > 1;
      messages.push({
        recipient: lease.recipient,
        step: lease.step,
        key: lease.idempotencyKey,
        text: resolved.text,
        html: resolved.html,
        accepted,
      });
      if (!accepted)
        return {
          status: "failed",
          code: "transport",
          uncertain: false,
          retryable: true,
        };
      return {
        status: "succeeded",
        receipt: {
          providerId: `${lease.step}:${lease.recipient}`,
          acceptedAt: new Date(
            Date.now() - (lease.step === "welcome" ? 3 * 3600000 : 0),
          ).toISOString(),
        },
      };
    },
  };
  await runOnboardingWorker(f.store, effects);
  await assert.rejects(
    approveJourneyProposal(f.founderDb, f.founder, f.journeyId, {
      ...f.proposal,
      activationEmails: [],
    }),
    /Current signing approval/,
  );
  await f.approve();
  for (let i = 0; i < 3; i++)
    await runOnboardingWorker(f.store, effects, {
      now: () => new Date(Date.now() + 1000),
    });
  assert.deepEqual(
    messages.filter((m) => m.step === "proposal").map((m) => m.recipient),
    [f.identities[0].email],
  );
  await f.sign(f.signingApproval);
  await completeAgreementSigning(
    f.signingWorker,
    f.signingApproval.id,
    f.correlationId,
  );
  for (let i = 0; i < 4; i++)
    await runOnboardingWorker(f.store, effects, {
      now: () => new Date(Date.now() + 2 * 86400000),
    });
  assert.equal(
    messages.filter((m) => m.recipient === owner).length,
    1,
    "The additional approved owner needs a separate activation message.",
  );
  const [pending] = await f.admin<
    { state: string }[]
  >`select state from operations.onboarding_journeys where id=${f.journeyId}`;
  assert.equal(
    pending.state,
    "active",
    "Pending owner delivery must remain visible even after billing thanks succeeds.",
  );
  assert.equal(
    messages.filter(
      (m) => m.recipient === billing && m.step === "thank_you" && m.accepted,
    ).length,
    1,
  );
  await f.admin`update operations.onboarding_jobs set next_attempt_at=now() where journey_id=${f.journeyId} and step='activation'`;
  await runOnboardingWorker(f.store, effects, {
    now: () => new Date(Date.now() + 2 * 86400000),
  });
  await runOnboardingWorker(f.store, effects, {
    now: () => new Date(Date.now() + 2 * 86400000),
  });
  const ownerMessages = messages.filter((m) => m.recipient === owner);
  assert.equal(ownerMessages.length, 2);
  assert.equal(ownerMessages.filter((m) => m.accepted).length, 1);
  assert.equal(ownerMessages[0].key, ownerMessages[1].key);
  assert.equal(ownerMessages[0].html, ownerMessages[1].html);
  assert.equal(ownerMessages[0].text, ownerMessages[1].text);
  assert.match(
    ownerMessages[0].text,
    /https:\/\/example\.test\/portal\/activate/,
  );
  assert.doesNotMatch(ownerMessages[0].text, /#invite=/);
  assert.doesNotMatch(ownerMessages[0].text, /proposal|sign it/i);
  assert.equal(messages.filter((m) => m.step === "proposal").length, 1);
  const [completed] = await f.admin<
    { state: string }[]
  >`select state from operations.onboarding_journeys where id=${f.journeyId}`;
  assert.equal(completed.state, "completed");
});
