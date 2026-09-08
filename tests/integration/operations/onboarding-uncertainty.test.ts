import assert from "node:assert/strict";
import test from "node:test";
import { onboardingFixture } from "./onboarding-fixtures";
import { controlJourney } from "../../../lib/operations/onboarding/repository";
import { runOnboardingWorker } from "../../../lib/operations/onboarding/worker";
import type { EffectResult } from "../../../lib/operations/onboarding/types";

test("lost response remains unresolved after a rejected replay and a pause past 24 hours", async (t) => {
  const f = await onboardingFixture(t);
  let calls = 0;
  const send = async (): Promise<EffectResult> => {
    calls++;
    if (calls === 1)
      return {
        status: "failed",
        code: "unknown_outcome",
        uncertain: true,
        retryable: true,
      };
    if (calls === 2)
      return {
        status: "failed",
        code: "rate_limited",
        uncertain: false,
        retryable: true,
      };
    return {
      status: "succeeded",
      receipt: {
        providerId: "duplicate-send",
        acceptedAt: new Date().toISOString(),
      },
    };
  };
  const effects = {
    sendEmail: send,
    ensureProposalAccess: send,
    createInvoice: send,
    ensureInvitation: send,
  };
  assert.equal((await runOnboardingWorker(f.store, effects)).retried, 1);
  await f.admin`update operations.onboarding_jobs set next_attempt_at=now() where journey_id=${f.journeyId}`;
  assert.equal((await runOnboardingWorker(f.store, effects)).retried, 1);
  await controlJourney(f.founderDb, f.founder, f.journeyId, "pause");
  await f.admin`update operations.onboarding_jobs set first_attempt_at=now()-interval '25 hours',next_attempt_at=now() where journey_id=${f.journeyId}`;
  await f.admin`update operations.onboarding_effects set first_attempt_at=now()-interval '25 hours' where organisation_id=${f.organisationId}`;
  await controlJourney(f.founderDb, f.founder, f.journeyId, "resume");
  const report = await runOnboardingWorker(f.store, effects);
  assert.equal(
    calls,
    2,
    "A later 429 cannot disprove an earlier provider acceptance.",
  );
  assert.equal(report.held, 1);
});

test("a definite rejection without an earlier unresolved attempt remains retryable", async (t) => {
  const f = await onboardingFixture(t);
  let calls = 0;
  const send = async (): Promise<EffectResult> =>
    ++calls === 1
      ? {
          status: "failed",
          code: "rate_limited",
          uncertain: false,
          retryable: true,
        }
      : {
          status: "succeeded",
          receipt: {
            providerId: "first-acceptance",
            acceptedAt: new Date().toISOString(),
          },
        };
  const effects = {
    sendEmail: send,
    ensureProposalAccess: send,
    createInvoice: send,
    ensureInvitation: send,
  };
  await runOnboardingWorker(f.store, effects);
  await controlJourney(f.founderDb, f.founder, f.journeyId, "pause");
  await f.admin`update operations.onboarding_jobs set first_attempt_at=now()-interval '25 hours',next_attempt_at=now() where journey_id=${f.journeyId}`;
  await f.admin`update operations.onboarding_effects set first_attempt_at=now()-interval '25 hours' where organisation_id=${f.organisationId}`;
  await controlJourney(f.founderDb, f.founder, f.journeyId, "resume");
  assert.equal((await runOnboardingWorker(f.store, effects)).succeeded, 1);
  assert.equal(calls, 2);
});
