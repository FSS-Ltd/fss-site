import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { claimStaffInvitationForVerifiedEmail } from "../../../lib/operations/auth/staff-invitations";
import { requireFssAdmin } from "../../../lib/operations/auth/require-admin";
import {
  StudioClientCurrencyConflict,
  updateStaffClientCurrency,
} from "../../../lib/operations/organisations/staff-service";
import { signingFixture } from "./signing-fixtures";

async function staffAdmin(fixture: Awaited<ReturnType<typeof signingFixture>>) {
  const identity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true as const,
  };
  const invitationId = randomUUID();
  await fixture.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
    await tx`select * from operations.issue_staff_invitation(${invitationId}, 'Currency Administrator', ${identity.email}, 'client-currency-test', ${fixture.correlationId})`;
  });
  assert.ok(
    await claimStaffInvitationForVerifiedEmail(
      fixture.portal,
      identity,
      fixture.correlationId,
    ),
  );
  return requireFssAdmin(fixture.portal, identity, fixture.correlationId);
}

test("currency changes preserve historical agreement currency, reject stale versions and append reviewed evidence", async (t) => {
  const fixture = await signingFixture(t, 1);
  const admin = await staffAdmin(fixture);
  const [before] = await fixture.admin<
    { billingCurrency: string; currencyVersion: number }[]
  >`
    select billing_currency as "billingCurrency", currency_version as "currencyVersion"
    from operations.organisations where id = ${fixture.organisationId}
  `;
  assert.deepEqual(before, { billingCurrency: "GBP", currencyVersion: 1 });
  const correlationId = randomUUID();
  const command = {
    billingCurrency: "EUR",
    expectedCurrencyVersion: 1,
    reviewReference: "Client approved EUR for future work",
  };
  assert.deepEqual(
    await updateStaffClientCurrency(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      command,
      correlationId,
    ),
    {
      organisationId: fixture.organisationId,
      billingCurrency: "EUR",
      currencyVersion: 2,
    },
  );
  await assert.rejects(
    updateStaffClientCurrency(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      { ...command, billingCurrency: "USD" },
      randomUUID(),
    ),
    StudioClientCurrencyConflict,
  );
  const [audit] = await fixture.admin<
    {
      actorId: string;
      entityVersion: number;
      reviewReference: string;
      correlationId: string;
    }[]
  >`
    select actor_id as "actorId", entity_version as "entityVersion", review_reference as "reviewReference", correlation_id as "correlationId"
    from operations.audit_events where organisation_id = ${fixture.organisationId} and action = 'organisation.currency_changed'
  `;
  assert.deepEqual(audit, {
    actorId: admin.actorId,
    entityVersion: 2,
    reviewReference: command.reviewReference,
    correlationId,
  });
  const agreements = await fixture.admin<{ currency: string }[]>`
    select snapshot ->> 'currency' as currency from operations.agreement_revisions where agreement_id in (
      select id from operations.agreements where organisation_id = ${fixture.organisationId}
    )
  `;
  assert.ok(agreements.length > 0);
  assert.ok(agreements.every((agreement) => agreement.currency === "GBP"));
});

test("currency commands require current staff membership and remain inaccessible to the portal role", async (t) => {
  const fixture = await signingFixture(t, 1);
  await assert.rejects(
    fixture.founderDb.begin(async (tx) => {
      await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true), set_config('operations.user_id', ${randomUUID()}, true)`;
      await tx`select * from operations.update_client_currency(${fixture.organisationId}, 'EUR', 1, 'Unauthorised change', ${randomUUID()}::uuid)`;
    }),
  );
  await assert.rejects(
    fixture.portal.begin(async (tx) => {
      await tx`select * from operations.update_client_currency(${fixture.organisationId}, 'EUR', 1, 'Client change', ${randomUUID()}::uuid)`;
    }),
  );
  await assert.rejects(
    fixture.founderDb`update operations.organisations set billing_currency = 'EUR' where id = ${fixture.organisationId}`,
  );
});

test("concurrent reviewed currency changes permit exactly one version winner", async (t) => {
  const fixture = await signingFixture(t, 1);
  const admin = await staffAdmin(fixture);
  const changes = await Promise.allSettled(
    ["USD", "EUR"].map((billingCurrency) =>
      updateStaffClientCurrency(
        fixture.founderDb,
        admin,
        fixture.organisationId,
        {
          billingCurrency,
          expectedCurrencyVersion: 1,
          reviewReference: "Concurrent staff review",
        },
        randomUUID(),
      ),
    ),
  );
  assert.equal(
    changes.filter((change) => change.status === "fulfilled").length,
    1,
  );
  const rejected = changes.find((change) => change.status === "rejected");
  assert.ok(
    rejected?.status === "rejected" &&
      rejected.reason instanceof StudioClientCurrencyConflict,
  );
  const [audit] = await fixture.admin<{ count: number }[]>`
    select count(*)::integer as count from operations.audit_events
    where organisation_id = ${fixture.organisationId} and action = 'organisation.currency_changed'
  `;
  assert.equal(audit.count, 1);
});
