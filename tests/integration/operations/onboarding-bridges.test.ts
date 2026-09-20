import assert from "node:assert/strict";
import test from "node:test";
import { onboardingFixture } from "./onboarding-fixtures";
import { billingProviderFixture } from "./billing-provider-fixture";
import {
  createOnboardingAccessProvider,
  resolveOnboardingAccess,
} from "../../../lib/operations/onboarding/access-provider";
import { createOnboardingBillingProvider } from "../../../lib/operations/onboarding/billing-provider";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";
import { controlJourney } from "../../../lib/operations/onboarding/repository";
const key = Buffer.alloc(32, 8);
const origin = "https://example.test";
async function welcome(f: Awaited<ReturnType<typeof onboardingFixture>>) {
  const [job] = await f.store.claim(1, new Date());
  await f.store.beginEffect(job, new Date());
  await f.store.succeed(job, {
    providerId: "welcome",
    acceptedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  });
  await f.approve();
}
test("access bridge requires approved scope, binds encrypted token, and preserves replay body", async (t) => {
  const f = await onboardingFixture(t, 1);
  await f.admin`delete from operations.memberships where organisation_id=${f.organisationId}`;
  await welcome(f);
  const [access] = await f.store.claim(1, new Date(Date.now() + 1000));
  assert.equal(access.step, "proposal_access");
  await f.store.beginEffect(access, new Date());
  let provisions = 0;
  const ensure = createOnboardingAccessProvider(
    f.worker,
    key,
    origin,
    async (email) => {
      assert.equal(email, access.recipient);
      provisions++;
    },
  );
  const result = await ensure(access);
  assert.equal(result.status, "succeeded");
  if (result.status !== "succeeded") throw Error();
  await f.store.succeed(access, result.receipt);
  const [proposal] = await f.store.claim(1, new Date(Date.now() + 1000));
  await f.store.beginEffect(proposal, new Date());
  const email = f.proposal.emails[0];
  const first = await resolveOnboardingAccess(
    f.worker,
    proposal,
    email,
    key,
    origin,
  );
  const replay = await resolveOnboardingAccess(
    f.worker,
    proposal,
    email,
    key,
    origin,
  );
  assert.deepEqual(first, replay);
  assert.match(first.text, /https:\/\/example\.test\/activate/);
  assert.doesNotMatch(first.text, /#invite=/);
  assert.ok(first.text.includes(f.proposal.portalUrl));
  assert.equal(provisions, 1);
  await assert.rejects(
    f.worker`select * from operations.portal_invites`,
    /permission denied/,
  );
  await assert.rejects(
    f.worker`select * from operations.onboarding_access_bindings`,
    /permission denied/,
  );
  await assert.rejects(
    resolveOnboardingAccess(
      f.worker,
      proposal,
      { ...email, to: "another@example.test" },
      key,
      origin,
    ),
    /recipient mismatch/,
  );
  await controlJourney(f.founderDb, f.founder, f.journeyId, "pause");
  await assert.rejects(
    resolveOnboardingAccess(f.worker, proposal, email, key, origin),
    /unavailable/,
  );
});
test("invoice bridge reuses permanent billing owner and records accepted outcome after cancellation", async (t) => {
  const f = await onboardingFixture(t, 1, { taxFree: true });
  await welcome(f);
  await f.sign(f.signingApproval);
  await completeAgreementSigning(
    f.signingWorker,
    f.signingApproval.id,
    f.correlationId,
  );
  const jobs = await f.store.claim(10, new Date(Date.now() + 2 * 86400000));
  const invoice = jobs.find((j) => j.step === "invoice");
  assert.ok(invoice);
  await f.store.beginEffect(invoice, new Date());
  const provider = billingProviderFixture();
  const issue = createOnboardingBillingProvider(f.worker, provider.stripe, {
    accountId: "acct_billingTest",
    mode: "test",
    portalOrigin: origin,
  });
  const first = await issue(invoice);
  assert.equal(first.status, "succeeded");
  const again = await issue(invoice);
  assert.deepEqual(first, again);
  assert.equal(
    provider.requests.filter(
      (r) => r.method === "POST" && r.path === "/v1/invoices",
    ).length,
    1,
  );
  assert.equal(
    provider.requests.filter(
      (r) => r.method === "POST" && r.path === "/v1/customers",
    ).length,
    1,
  );
  const [count] = await f.admin<
    { n: number }[]
  >`select count(*)::integer as n from operations.invoices where organisation_id=${f.organisationId}`;
  assert.equal(count.n, 1);
  await assert.rejects(
    f.worker`select * from operations.billing_commands`,
    /permission denied/,
  );
  await controlJourney(f.founderDb, f.founder, f.journeyId, "cancel");
  await assert.rejects(issue(invoice), /unavailable/);
  if (first.status !== "succeeded") throw Error();
  await f.store.succeed(invoice, first.receipt);
  const [state] = await f.admin<
    { state: string }[]
  >`select state from operations.onboarding_journeys where id=${f.journeyId}`;
  assert.equal(state.state, "cancelled");
});
