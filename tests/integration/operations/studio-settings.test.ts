import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import type { FssAdminContext } from "../../../lib/operations/auth/staff-types";
import { withFssAdminTransaction } from "../../../lib/operations/auth/staff-transaction";
import {
  applyActiveStudioSettings,
  loadActiveStudioSettings,
  readPortalStudioPresentationSettings,
  ActiveStudioSettingsConflict,
} from "../../../lib/operations/studio/active-settings";

// Requires a migrated, explicitly local Operations test database. Never uses runtime URLs.
test("active settings apply, audit, conflict, rollback and least-privilege portal reads", async (t) => {
  const url = requireOperationsTestDatabaseUrl(
    process.env.OPERATIONS_TEST_DATABASE_URL,
  );
  const adminDb = postgres(url, { max: 2 });
  const staffDb = postgres(url, {
    max: 3,
    connection: { options: "-c role=operations_founder" },
  });
  const portalDb = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const workerDb = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_onboarding_worker" },
  });
  const userId = randomUUID();
  const invitationId = randomUUID();
  const membershipId = randomUUID();
  const correlationId = randomUUID();
  const organisationId = randomUUID();
  const contactId = randomUUID();
  const actorId = createHash("sha256")
    .update(`settings-test:${userId}`)
    .digest("hex");
  const admin: FssAdminContext = {
    realm: "staff",
    role: "admin",
    actorId,
    userId,
    membershipId,
    correlationId,
  };
  await adminDb`insert into operations.pending_staff_invitations(id, name, email, state, claimed_user_id, completed_at, created_by, review_reference, correlation_id)
    values (${invitationId}, 'Settings test', ${`${userId}@example.test`}, 'completed', ${userId}, now(), ${actorId}, 'synthetic-settings-test', ${correlationId})`;
  await adminDb`insert into operations.staff_memberships(id, invitation_id, user_id) values (${membershipId}, ${invitationId}, ${userId})`;
  await adminDb`insert into operations.organisations(id, legal_name, display_name, trading_status, timezone, lifecycle, created_by, review_reference)
    values (${organisationId}, 'Settings test', 'Settings test', 'active', 'Europe/London', 'active', ${actorId}, 'synthetic-settings-test')`;
  await adminDb`insert into operations.contacts(id, organisation_id, name, email, created_by, review_reference)
    values (${contactId}, ${organisationId}, 'Settings test', ${`${userId}@example.test`}, ${actorId}, 'synthetic-settings-test')`;
  await adminDb`insert into operations.memberships(organisation_id, contact_id, user_id, role) values (${organisationId}, ${contactId}, ${userId}, 'owner')`;
  t.after(async () => {
    await Promise.all([staffDb.end(), portalDb.end(), workerDb.end()]);
    await adminDb`delete from operations.studio_settings_audit where actor_id=${actorId}`;
    await adminDb`delete from operations.studio_settings_active where applied_by=${actorId}`;
    await adminDb`delete from operations.studio_settings_drafts where created_by=${actorId}`;
    await adminDb`delete from operations.memberships where organisation_id=${organisationId}`;
    await adminDb`delete from operations.contacts where organisation_id=${organisationId}`;
    await adminDb`delete from operations.audit_events where organisation_id=${organisationId}`;
    await adminDb`delete from operations.organisations where id=${organisationId}`;
    await adminDb`delete from operations.staff_memberships where id=${membershipId}`;
    await adminDb`delete from operations.pending_staff_invitations where id=${invitationId}`;
    await adminDb.end();
  });

  const initial = await loadActiveStudioSettings(staffDb, admin);
  const [latestDraft] = await adminDb<
    { revision: number }[]
  >`select revision from operations.studio_settings_drafts order by revision desc limit 1`;
  await adminDb`insert into operations.studio_settings_drafts(revision, display_name, timezone, response_expectation_hours, delivery_capacity, created_by, correlation_id)
    values (${(latestDraft?.revision ?? 0) + 1}, 'Historical draft only', 'Europe/London', 48, 'standard', ${actorId}, ${correlationId})`;
  assert.deepEqual(
    await loadActiveStudioSettings(staffDb, admin),
    initial,
    "historical drafts must not activate",
  );

  const identity = await applyActiveStudioSettings(
    staffDb,
    admin,
    {
      section: "identity",
      expectedRevision: initial.revision,
      values: { displayName: "Applied settings test" },
    },
    correlationId,
  );
  const [audit] = await adminDb<
    { section: string; actorId: string; previous: unknown; applied: unknown }[]
  >`
    select section, actor_id as "actorId", previous_settings as previous, applied_settings as applied
    from operations.studio_settings_audit where revision=${identity.revision}`;
  assert.equal(audit.section, "identity");
  assert.equal(audit.actorId, actorId);
  assert.deepEqual(audit.previous, initial);
  assert.deepEqual(audit.applied, identity);

  const outcomes = await Promise.allSettled([
    applyActiveStudioSettings(
      staffDb,
      admin,
      {
        section: "delivery",
        expectedRevision: identity.revision,
        values: { deliveryCapacity: "limited" },
      },
      correlationId,
    ),
    applyActiveStudioSettings(
      staffDb,
      admin,
      {
        section: "timezone",
        expectedRevision: identity.revision,
        values: { timezone: "America/New_York" },
      },
      correlationId,
    ),
  ]);
  assert.equal(
    outcomes.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const conflict = outcomes.find((result) => result.status === "rejected");
  assert.ok(
    conflict?.status === "rejected" &&
      conflict.reason instanceof ActiveStudioSettingsConflict,
  );
  const current = await loadActiveStudioSettings(staffDb, admin);
  assert.equal(current.revision, identity.revision + 1);

  // Inject an audit failure for just this test actor: the active append must roll back too.
  await adminDb.unsafe(
    `create function operations.settings_test_reject_audit() returns trigger language plpgsql as $$ begin if new.actor_id = '${actorId}' then raise exception 'Synthetic audit failure'; end if; return new; end; $$`,
  );
  await adminDb.unsafe(
    "create trigger settings_test_reject_audit before insert on operations.studio_settings_audit for each row execute function operations.settings_test_reject_audit()",
  );
  try {
    await assert.rejects(
      applyActiveStudioSettings(
        staffDb,
        admin,
        {
          section: "identity",
          expectedRevision: current.revision,
          values: { displayName: "Must roll back" },
        },
        correlationId,
      ),
      /Synthetic audit failure/,
    );
    assert.deepEqual(await loadActiveStudioSettings(staffDb, admin), current);
  } finally {
    await adminDb.unsafe(
      "drop trigger settings_test_reject_audit on operations.studio_settings_audit",
    );
    await adminDb.unsafe(
      "drop function operations.settings_test_reject_audit()",
    );
  }

  const portalRead = (target: string) =>
    portalDb.begin(async (tx) => {
      await tx`select set_config('operations.user_id', ${userId}, true), set_config('operations.organisation_id', ${organisationId}, true)`;
      return readPortalStudioPresentationSettings(tx, target);
    });
  const presentation = await portalRead(organisationId);
  assert.equal(presentation.displayName, current.displayName);
  assert.deepEqual(Object.keys(presentation).sort(), [
    "displayName",
    "responseExpectationHours",
    "revision",
    "timezone",
  ]);
  await assert.rejects(
    portalRead(randomUUID()),
    /Portal access is unavailable/,
  );
  await assert.rejects(
    portalDb`select * from operations.studio_settings_active`,
    /permission denied/,
  );
  await assert.rejects(
    workerDb`select * from operations.studio_settings_active`,
    /permission denied/,
  );
  await assert.rejects(
    workerDb`select * from operations.portal_studio_presentation_settings(${organisationId})`,
    /permission denied/,
  );
  await assert.rejects(
    withFssAdminTransaction(
      staffDb,
      admin,
      (tx) =>
        tx`update operations.studio_settings_active set display_name='changed' where revision=${current.revision}`,
    ),
    /permission denied/,
  );
  await adminDb`update operations.staff_memberships set revoked_at=now() where id=${membershipId}`;
  await assert.rejects(
    loadActiveStudioSettings(staffDb, admin),
    /Staff authorization is required/,
  );
});
