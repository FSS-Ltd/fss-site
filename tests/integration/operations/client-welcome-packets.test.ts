import assert from "node:assert/strict";
import test from "node:test";
import { withVerifiedPortalIdentity } from "../../../lib/operations/db/portal-client";
import {
  downloadClientWelcomePacket,
  loadClientWelcomePacket,
} from "../../../lib/operations/onboarding/client-packet";
import { onboardingFixture } from "./onboarding-fixtures";

test("portal packet functions retain approved bytes and enforce tenant, role and revocation boundaries", async (t) => {
  const fixture = await onboardingFixture(t, 1);
  const other = await onboardingFixture(t, 1);
  const read = () =>
    loadClientWelcomePacket(
      fixture.portal,
      fixture.identities[0],
      fixture.organisationId,
      fixture.correlationId,
    );
  const packet = await read();
  assert.equal(packet?.approvalId, fixture.approvalId);
  assert.deepEqual(packet?.pages, fixture.prepared.snapshot.content.pages);
  const downloaded = await downloadClientWelcomePacket(
    fixture.portal,
    fixture.identities[0],
    fixture.organisationId,
    fixture.approvalId,
    fixture.correlationId,
  );
  assert.deepEqual(downloaded?.pdf, fixture.prepared.pdf);
  assert.equal(
    await downloadClientWelcomePacket(
      fixture.portal,
      fixture.identities[0],
      fixture.organisationId,
      other.approvalId,
      fixture.correlationId,
    ),
    null,
  );
  await assert.rejects(
    withVerifiedPortalIdentity(
      fixture.portal,
      fixture.identities[0],
      fixture.correlationId,
      async (tx) => {
        await tx`select set_config('operations.organisation_id', ${other.organisationId}, true)`;
        return tx`select operations.read_client_welcome_packet(${other.organisationId})`;
      },
    ),
    /unavailable|permission/i,
  );
  await assert.rejects(
    fixture.portal`select snapshot, pdf from operations.onboarding_approvals`,
    /permission/i,
  );
  await fixture.admin`update operations.memberships set role = 'viewer' where organisation_id = ${fixture.organisationId} and user_id = ${fixture.identities[0].userId}`;
  assert.equal((await read())?.approvalId, fixture.approvalId);
  await fixture.admin`update operations.memberships set role = 'billing_contact' where organisation_id = ${fixture.organisationId} and user_id = ${fixture.identities[0].userId}`;
  await assert.rejects(read(), /access/i);
  await assert.rejects(
    withVerifiedPortalIdentity(
      fixture.portal,
      fixture.identities[0],
      fixture.correlationId,
      async (tx) => {
        await tx`select set_config('operations.organisation_id', ${fixture.organisationId}, true)`;
        return tx`select operations.read_client_welcome_packet(${fixture.organisationId})`;
      },
    ),
    /unavailable|permission/i,
  );
  await fixture.admin`update operations.memberships set role = 'owner', revoked_at = clock_timestamp() where organisation_id = ${fixture.organisationId} and user_id = ${fixture.identities[0].userId}`;
  await assert.rejects(read(), /access/i);
});
