import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { onboardingFixture } from "./onboarding-fixtures";
import {
  reconcileJourneyAcceptance,
  controlJourney,
  recordOnboardingDeliveryFailure,
  startApprovedJourney,
} from "../../../lib/operations/onboarding/repository";
import { runOnboardingWorker } from "../../../lib/operations/onboarding/worker";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";
import type {
  EffectResult,
  OnboardingEffects,
} from "../../../lib/operations/onboarding/types";
const success = (id: string): EffectResult => ({
  status: "succeeded",
  receipt: {
    providerId: id,
    acceptedAt: new Date().toISOString(),
    url: "https://example.test/portal/billing",
  },
});
test("duplicate start freezes snapshots; worker and portal cannot mutate approval", async (t) => {
  const f = await onboardingFixture(t);
  assert.equal(await f.start(), f.journeyId);
  await assert.rejects(
    startApprovedJourney(f.founderDb, f.founder, {
      ...f.input,
      approvalId: randomUUID(),
    }),
    /already exists/,
  );
  await assert.rejects(
    f.worker`update operations.onboarding_approvals set snapshot='{}'::jsonb where id=${f.approvalId}`,
    /permission denied/,
  );
  await assert.rejects(
    f.portal`select * from operations.onboarding_approvals`,
    /permission denied/,
  );
  await assert.rejects(
    f.worker`insert into operations.contacts(organisation_id,name,email,created_by,review_reference) values(${f.organisationId},'Bad','bad@example.test',${f.founder.actorId},'bad')`,
    /permission denied/,
  );
});
test("concurrent leases and pause before call prevent stale execution, accepted inflight persists", async (t) => {
  const f = await onboardingFixture(t);
  const [a, b] = await Promise.all([
    f.store.claim(1, new Date()),
    f.store.claim(1, new Date()),
  ]);
  assert.equal(a.length + b.length, 1);
  const lease = a[0] ?? b[0];
  await controlJourney(f.founderDb, f.founder, f.journeyId, "pause");
  assert.equal(await f.store.beginEffect(lease, new Date()), false);
  await controlJourney(f.founderDb, f.founder, f.journeyId, "resume");
  await f.admin`update operations.onboarding_jobs set lease_until=now()-interval '1 second' where id=${lease.jobId}`;
  const [next] = await f.store.claim(1, new Date());
  assert.equal(next.idempotencyKey, lease.idempotencyKey);
  assert.equal(await f.store.beginEffect(next, new Date()), true);
  assert.equal(await f.store.beginEffect(next, new Date()), false);
  await controlJourney(f.founderDb, f.founder, f.journeyId, "cancel");
  const receipt = {
    providerId: "inflight-accepted",
    acceptedAt: new Date(Date.now() - 3600000).toISOString(),
  };
  await f.store.succeed(next, receipt);
  await f.store.succeed(next, receipt);
  const [journey] = await f.admin<
    { state: string; due: Date; accepted: Date }[]
  >`select state,proposal_due_at as due,welcome_accepted_at as accepted from operations.onboarding_journeys where id=${f.journeyId}`;
  assert.equal(journey.state, "cancelled");
  assert.equal(journey.accepted.toISOString(), receipt.acceptedAt);
  assert.equal(journey.due.getTime() - journey.accepted.getTime(), 7200000);
  assert.deepEqual(
    await f.store.claim(10, new Date(Date.now() + 86400000)),
    [],
  );
});
test("lost provider response older than 24h holds with permanent key and no resend", async (t) => {
  const f = await onboardingFixture(t);
  const [lease] = await f.store.claim(1, new Date());
  await f.store.beginEffect(lease, new Date());
  await f.admin`update operations.onboarding_jobs set lease_until=now()-interval '1 second',first_attempt_at=now()-interval '25 hours' where id=${lease.jobId}`;
  await f.admin`update operations.onboarding_effects set first_attempt_at=now()-interval '25 hours' where job_id=${lease.jobId}`;
  let calls = 0;
  const call = async () => {
    calls++;
    return success("never");
  };
  const report = await runOnboardingWorker(f.store, {
    sendEmail: call,
    createInvoice: call,
    ensureInvitation: call,
    ensureProposalAccess: call,
  });
  assert.equal(report.held, 1);
  assert.equal(calls, 0);
  const [job] = await f.admin<
    { state: string; key: string }[]
  >`select state,idempotency_key as key from operations.onboarding_jobs where id=${lease.jobId}`;
  assert.equal(job.state, "held");
  assert.equal(job.key, lease.idempotencyKey);
});
test("proposal holds without approval, exact recipients require access, duplicate bounce blocks", async (t) => {
  const f = await onboardingFixture(t);
  const [welcome] = await f.store.claim(1, new Date());
  await f.store.beginEffect(welcome, new Date());
  await f.store.succeed(welcome, {
    providerId: "welcome",
    acceptedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  });
  assert.deepEqual(await f.store.claim(10, new Date()), []);
  await f.approve();
  const stale = await f.store.claim(10, new Date(Date.now() + 1000));
  await f.approve();
  assert.equal(await f.store.beginEffect(stale[0], new Date()), false);
  const access = await f.store.claim(10, new Date(Date.now() + 1000));
  assert.equal(access.length, 2);
  assert.ok(access.every((job) => job.step === "proposal_access"));
  for (const job of access) {
    assert.equal(await f.store.beginEffect(job, new Date()), true);
    await f.store.succeed(job, {
      providerId: job.recipient,
      acceptedAt: new Date().toISOString(),
    });
  }
  const proposals = await f.store.claim(10, new Date(Date.now() + 1000));
  assert.equal(proposals.length, 2);
  assert.ok(proposals.every((job) => job.step === "proposal"));
  const event = {
    accountScope: "test-account",
    eventId: "bounce-1",
    jobId: welcome.jobId,
    kind: "bounced" as const,
  };
  assert.equal(await recordOnboardingDeliveryFailure(f.worker, event), true);
  assert.equal(await recordOnboardingDeliveryFailure(f.worker, event), false);
  assert.equal(await f.store.beginEffect(proposals[0], new Date()), false);
});
test("late verified signing schedules calendar morning once and email failure never repeats invoice", async (t) => {
  const f = await onboardingFixture(t);
  await f.approve();
  const accepted = new Date(Date.now() - 3 * 3600000).toISOString();
  const [welcome] = await f.store.claim(1, new Date());
  await f.store.beginEffect(welcome, new Date());
  await f.store.succeed(welcome, {
    providerId: "welcome",
    acceptedAt: accepted,
  });
  for (let i = 0; i < f.identities.length; i++)
    await f.sign(f.signingApproval, i);
  await completeAgreementSigning(
    f.signingWorker,
    f.signingApproval.id,
    f.correlationId,
  );
  assert.equal(
    await completeAgreementSigning(
      f.signingWorker,
      f.signingApproval.id,
      f.correlationId,
    ),
    false,
  );
  const future = () => new Date(Date.now() + 2 * 86400000);
  let invoiceCalls = 0,
    emailCalls = 0,
    invitationCalls = 0;
  const effects: OnboardingEffects = {
    createInvoice: async () => {
      invoiceCalls++;
      return success("invoice-one");
    },
    ensureInvitation: async () => {
      invitationCalls++;
      return success("access");
    },
    ensureProposalAccess: async () => success("access"),
    sendEmail: async () => {
      emailCalls++;
      if (emailCalls === 2)
        await controlJourney(f.founderDb, f.founder, f.journeyId, "pause");
      return emailCalls === 1
        ? {
            status: "failed",
            code: "transport",
            uncertain: false,
            retryable: true,
          }
        : success("thanks");
    },
  };
  assert.equal(
    (await runOnboardingWorker(f.store, effects, { now: future })).succeeded,
    1,
  );
  assert.equal(
    (await runOnboardingWorker(f.store, effects, { now: future })).succeeded,
    2,
  );
  assert.equal(
    (await runOnboardingWorker(f.store, effects, { now: future })).retried,
    1,
  );
  await f.admin`update operations.onboarding_jobs set next_attempt_at=now() where journey_id=${f.journeyId} and step='thank_you'`;
  assert.equal(
    (await runOnboardingWorker(f.store, effects, { now: future })).succeeded,
    1,
  );
  await controlJourney(f.founderDb, f.founder, f.journeyId, "resume");
  assert.equal(invoiceCalls, 1);
  assert.equal(invitationCalls, 2);
  assert.equal(emailCalls, 2);
  const [j] = await f.admin<
    { state: string; due: Date; signed: Date }[]
  >`select state,post_signature_due_at as due,signature_at as signed from operations.onboarding_journeys where id=${f.journeyId}`;
  assert.equal(j.state, "completed");
  assert.ok(j.due > j.signed);
  assert.ok(j.due < future());
  assert.deepEqual(await f.store.claim(10, future()), []);
});
test("expired lease recovers with same key, while held dependencies cannot starve ready work", async (t) => {
  const waiting = await onboardingFixture(t);
  const ready = await onboardingFixture(t);
  const [first] = await waiting.store.claim(1, new Date());
  assert.equal(first.journeyId, waiting.journeyId);
  await waiting.store.beginEffect(first, new Date());
  await waiting.store.fail(first, "configuration", null, false);
  const [second] = await ready.store.claim(1, new Date());
  assert.equal(second.journeyId, ready.journeyId);
  await ready.store.beginEffect(second, new Date());
  await ready.admin`update operations.onboarding_jobs set lease_until=now()-interval '1 second' where id=${second.jobId}`;
  const [recovered] = await ready.store.claim(1, new Date());
  assert.equal(recovered.idempotencyKey, second.idempotencyKey);
  assert.equal(recovered.uncertain, true);
  assert.equal(await ready.store.beginEffect(recovered, new Date()), true);
  await ready.store.succeed(second, {
    providerId: "same-effect",
    acceptedAt: new Date().toISOString(),
  });
  await ready.store.succeed(recovered, {
    providerId: "same-effect",
    acceptedAt: new Date().toISOString(),
  });
  const [{ count }] = await ready.admin<
    { count: number }[]
  >`select count(*)::integer as count from operations.onboarding_effects where job_id=${second.jobId} and status='succeeded'`;
  assert.equal(count, 1);
});

test("founder reconciliation records known acceptance without resending and retry crashes are bounded", async (t) => {
  const f = await onboardingFixture(t);
  const [lease] = await f.store.claim(1, new Date());
  await f.store.beginEffect(lease, new Date());
  await f.store.fail(lease, "unknown_outcome", null, true);
  const receipt = {
    providerId: "reconciled-acceptance",
    acceptedAt: new Date(Date.now() - 3600000).toISOString(),
  };
  try {
    await reconcileJourneyAcceptance(
      f.founderDb,
      f.founder,
      lease.jobId,
      receipt,
      "provider-acceptance-review-1",
    );
    const [row] = await f.admin<
      { state: string; actor: string }[]
    >`select j.state,r.reviewed_by as actor from operations.onboarding_jobs j join operations.onboarding_reconciliations r on r.job_id=j.id where j.id=${lease.jobId}`;
    assert.equal(row.state, "succeeded");
    assert.equal(row.actor, f.founder.actorId);
    await assert.rejects(
      f.worker`select operations.reconcile_onboarding_acceptance(${lease.jobId},'{}'::jsonb,'bad')`,
      /permission denied/,
    );
  } finally {
    await f.admin`delete from operations.onboarding_reconciliations where job_id=${lease.jobId}`;
  }
  const another = await onboardingFixture(t);
  const [job] = await another.store.claim(1, new Date());
  await another.admin`update operations.onboarding_jobs set attempts=6 where id=${job.jobId}`;
  assert.equal(await another.store.beginEffect(job, new Date()), false);
  const [held] = await another.admin<
    { state: string }[]
  >`select state from operations.onboarding_jobs where id=${job.jobId}`;
  assert.equal(held.state, "held");
});
