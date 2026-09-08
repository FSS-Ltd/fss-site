import assert from "node:assert/strict";
import test from "node:test";
import { onboardingFixture } from "./onboarding-fixtures";
import { createOnboardingAccessProvider } from "../../../lib/operations/onboarding/access-provider";
import { approveJourneyProposal } from "../../../lib/operations/onboarding/repository";

test("reapproval cannot substitute a viewer preview for an attempted owner invitation", async (t) => {
  const f = await onboardingFixture(t);
  const recipient = f.identities[1].email;
  await f.admin`delete from operations.memberships where organisation_id=${f.organisationId} and contact_id=(select id from operations.contacts where organisation_id=${f.organisationId} and email=${recipient})`;
  const [welcome] = await f.store.claim(1, new Date());
  await f.store.beginEffect(welcome, new Date());
  await f.store.succeed(welcome, {
    providerId: "welcome",
    acceptedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  });
  await f.approve();
  const access = createOnboardingAccessProvider(
    f.worker,
    Buffer.alloc(32, 8),
    "https://example.test",
    async () => {},
  );
  for (const job of await f.store.claim(10, new Date(Date.now() + 1000))) {
    await f.store.beginEffect(job, new Date());
    const result = await access(job);
    assert.equal(result.status, "succeeded");
    if (result.status === "succeeded")
      await f.store.succeed(job, result.receipt);
  }
  await assert.rejects(
    approveJourneyProposal(f.founderDb, f.founder, f.journeyId, {
      ...f.proposal,
      access: f.proposal.access.map((entry) =>
        entry.email === recipient ? { ...entry, role: "viewer" } : entry,
      ),
    }),
    /access.*reconcil|access.*review/i,
  );
  const [invite] = await f.admin<
    { role: string }[]
  >`select role from operations.portal_invites where organisation_id=${f.organisationId}`;
  assert.equal(invite.role, "owner");
  const [member] = await f.admin<
    { role: string }[]
  >`select role from operations.memberships where organisation_id=${f.organisationId}`;
  assert.equal(
    member.role,
    "owner",
    "Established membership is never silently downgraded.",
  );
});
