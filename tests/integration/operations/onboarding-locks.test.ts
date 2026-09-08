import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { onboardingFixture } from "./onboarding-fixtures";
import { createPortalInviteToken } from "../../../lib/operations/auth/invites";
import { encryptInviteToken } from "../../../lib/operations/onboarding/invite-crypto";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";
import type { OnboardingLease } from "../../../lib/operations/onboarding/types";

function gate() {
  let open: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}
async function pauseWinsWhileBlocked(
  f: Awaited<ReturnType<typeof onboardingFixture>>,
  job: OnboardingLease,
) {
  const locked = gate(),
    unlock = gate(),
    paused = gate(),
    commitPause = gate();
  const session = await f.worker.reserve();
  const [{ pid }] = await session<
    { pid: number }[]
  >`select pg_backend_pid() as pid`;
  const blocker = f.admin.begin(async (tx) => {
    if (job.step === "proposal_access")
      await tx`select id from operations.contacts where organisation_id=${f.organisationId} and email=${job.recipient} for update`;
    else
      await tx`select id from operations.onboarding_jobs where id=${job.jobId} for update`;
    locked.open();
    await unlock.promise;
  });
  await locked.promise;
  const pause = f.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id',${f.founder.actorId},true)`;
    await tx`select operations.control_onboarding(${f.journeyId},'pause')`;
    paused.open();
    await commitPause.promise;
  });
  try {
    await paused.promise;
    const invite = createPortalInviteToken();
    const encrypted = encryptInviteToken(
      invite.token,
      Buffer.alloc(32, 8),
      job.jobId,
      job.recipient,
    );
    const action = (
      job.step === "proposal_access"
        ? session`select operations.onboarding_access(${job.jobId},${job.leaseToken},${job.generation},${invite.tokenHash},${JSON.stringify(encrypted)}::text::jsonb)`
        : session`select operations.onboarding_billing_context(${job.jobId},${job.leaseToken},${job.generation})`
    ).then(
      () => "mutated",
      (error: unknown) => {
        assert.match(
          String(error),
          /Onboarding (access|billing) is unavailable/,
        );
        return "rejected";
      },
    );
    let blocked = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const [row] = await f.admin<
        { waiting: boolean }[]
      >`select wait_event_type='Lock' as waiting from pg_stat_activity where pid=${pid}`;
      if (row.waiting) {
        blocked = true;
        break;
      }
      await setTimeout(10);
    }
    assert.equal(
      blocked,
      true,
      "Observe the actual database lock wait before committing pause.",
    );
    commitPause.open();
    await pause;
    unlock.open();
    await blocker;
    assert.equal(
      await action,
      "rejected",
      "A completed pause fences every subsequent scoped write.",
    );
  } finally {
    commitPause.open();
    unlock.open();
    await Promise.allSettled([pause, blocker]);
    session.release();
  }
}
test("access waiting on contact locks cannot write after pause wins", async (t) => {
  const f = await onboardingFixture(t, 1);
  await f.admin`delete from operations.memberships where organisation_id=${f.organisationId}`;
  const [welcome] = await f.store.claim(1, new Date());
  await f.store.beginEffect(welcome, new Date());
  await f.store.succeed(welcome, {
    providerId: "welcome",
    acceptedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  });
  await f.approve();
  const [access] = await f.store.claim(1, new Date(Date.now() + 1000));
  await f.store.beginEffect(access, new Date());
  await pauseWinsWhileBlocked(f, access);
  const [{ count }] = await f.admin<
    { count: number }[]
  >`select count(*)::integer as count from operations.portal_invites where organisation_id=${f.organisationId}`;
  assert.equal(count, 0);
});
test("billing context waiting on job locks cannot reserve commands after pause wins", async (t) => {
  const f = await onboardingFixture(t, 1, { taxFree: true });
  const [welcome] = await f.store.claim(1, new Date());
  await f.store.beginEffect(welcome, new Date());
  await f.store.succeed(welcome, {
    providerId: "welcome",
    acceptedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  });
  await f.approve();
  await f.sign(f.signingApproval);
  await completeAgreementSigning(
    f.signingWorker,
    f.signingApproval.id,
    f.correlationId,
  );
  const [invoice] = await f.store.claim(1, new Date(Date.now() + 2 * 86400000));
  assert.equal(invoice.step, "invoice");
  await f.store.beginEffect(invoice, new Date());
  await pauseWinsWhileBlocked(f, invoice);
  const [{ count }] = await f.admin<
    { count: number }[]
  >`select count(*)::integer as count from operations.billing_commands where organisation_id=${f.organisationId}`;
  assert.equal(count, 0);
});
