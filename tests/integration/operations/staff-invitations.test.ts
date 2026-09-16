import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { cleanupStaffInvitationFixtures } from "./staff-invitation-fixtures";

test("staff invitation lifecycle is atomic, isolated, audited, and cannot be replayed after revocation", async () => {
  const db = postgres(
    requireOperationsTestDatabaseUrl(process.env.OPERATIONS_TEST_DATABASE_URL),
    { max: 3 },
  );
  const actor = "a".repeat(64);
  const userId = randomUUID();
  const invitationId = randomUUID();
  const email = `${randomUUID()}@example.test`;
  const correlationId = randomUUID();
  const claim = (verifiedEmail: string, verifiedUser = userId) =>
    db.begin(async (tx) => {
      await tx`set local role operations_portal`;
      await tx`select set_config('operations.user_id', ${verifiedUser}, true), set_config('operations.verified_email', ${verifiedEmail}, true), set_config('operations.correlation_id', ${correlationId}, true)`;
      const [row] = await tx<
        { id: string | null }[]
      >`select operations.claim_staff_invitation(${invitationId}) as id`;
      return row.id;
    });
  try {
    const [issued] = await db.begin(async (tx) => {
      await tx`set local role operations_founder`;
      await tx`select set_config('operations.actor_id', ${actor}, true)`;
      return tx<
        { id: string; expiresAt: Date }[]
      >`select id, expires_at as "expiresAt" from operations.issue_staff_invitation(${invitationId}, 'Staff Admin', ${` ${email.toUpperCase()} `}, 'approved-staff-test', ${correlationId})`;
    });
    assert.equal(issued.id, invitationId);
    assert.ok(issued.expiresAt > new Date());
    assert.equal(await claim(`other-${email}`), null);
    const [unclaimed] = await db<
      { count: number }[]
    >`select count(*)::int as count from operations.staff_memberships where user_id = ${userId}`;
    assert.equal(unclaimed.count, 0);
    const [membershipId, concurrentMembershipId] = await Promise.all([
      claim(email),
      claim(email),
    ]);
    assert.ok(membershipId);
    assert.equal(concurrentMembershipId, membershipId);
    assert.equal(await claim(email), membershipId);
    assert.equal(await claim(email, randomUUID()), null);
    const [stored] = await db<
      { email: string; state: string; userId: string }[]
    >`select email, state, claimed_user_id as "userId" from operations.pending_staff_invitations where id = ${invitationId}`;
    assert.deepEqual(stored, { email, state: "completed", userId });
    await db.begin(async (tx) => {
      await tx`set local role operations_portal`;
      await tx`select set_config('operations.user_id', ${userId}, true), set_config('operations.verified_email', ${email}, true)`;
      const [active] = await tx<
        { membershipId: string; userId: string; role: string }[]
      >`select membership_id as "membershipId", user_id as "userId", role from operations.active_staff_membership()`;
      assert.deepEqual(active, { membershipId, userId, role: "admin" });
      assert.equal((await tx`select * from operations.memberships`).length, 0);
      const [pending] = await tx<
        { needed: boolean }[]
      >`select operations.pending_portal_onboarding() as needed`;
      assert.equal(pending.needed, false);
    });
    for (const role of [
      "operations_portal",
      "operations_founder",
      "operations_billing_worker",
      "operations_signing_worker",
      "operations_onboarding_worker",
      "anon",
      "authenticated",
      "service_role",
      "growth_app",
    ]) {
      const [privileges] = await db<
        { tables: boolean; issue: boolean; claim: boolean }[]
      >`
        select has_table_privilege(${role}, 'operations.staff_memberships', 'select,insert,update,delete')
          or has_table_privilege(${role}, 'operations.pending_staff_invitations', 'select,insert,update,delete')
          or has_table_privilege(${role}, 'operations.staff_invitation_audit', 'select,insert,update,delete') as tables,
          has_function_privilege(${role}, 'operations.issue_staff_invitation(uuid,text,text,text,uuid)', 'execute') as issue,
          has_function_privilege(${role}, 'operations.claim_staff_invitation(uuid)', 'execute') as claim
      `;
      assert.deepEqual(privileges, {
        tables: false,
        issue: role === "operations_founder",
        claim: role === "operations_portal",
      });
    }
    await db.begin(async (tx) => {
      await tx`set local role operations_founder`;
      await tx`select set_config('operations.actor_id', ${actor}, true)`;
      await tx`select operations.revoke_staff_invitation(${invitationId}, 'founder-revoked-test', ${correlationId})`;
      await tx`select operations.revoke_staff_invitation(${invitationId}, 'idempotent-repeat', ${correlationId})`;
    });
    assert.equal(await claim(email), null);
    await db.begin(async (tx) => {
      await tx`set local role operations_portal`;
      await tx`select set_config('operations.user_id', ${userId}, true), set_config('operations.verified_email', ${email}, true)`;
      assert.equal(
        (await tx`select * from operations.active_staff_membership()`).length,
        0,
      );
    });
    const audit = await db<
      { action: string; review: string; correlationId: string }[]
    >`select action, review_reference as review, correlation_id as "correlationId" from operations.staff_invitation_audit where invitation_id = ${invitationId} order by occurred_at, id`;
    assert.deepEqual(
      audit.map(({ action }) => action),
      ["issued", "completed", "revoked"],
    );
    assert.equal(audit.at(-1)?.review, "founder-revoked-test");
    assert.ok(audit.every((entry) => entry.correlationId === correlationId));
  } finally {
    await cleanupStaffInvitationFixtures(db, [invitationId]);
  }
});

test("expiry, provider failure, pending revocation, and client-only access cannot create staff access", async () => {
  const db = postgres(
    requireOperationsTestDatabaseUrl(process.env.OPERATIONS_TEST_DATABASE_URL),
    { max: 1 },
  );
  const actor = "a".repeat(64);
  const userId = randomUUID();
  const organisationId = randomUUID();
  const contactId = randomUUID();
  const email = `${randomUUID()}@example.test`;
  const invitations: string[] = [];
  try {
    await db`insert into operations.organisations (id, legal_name, display_name, trading_status, timezone, created_by, review_reference) values (${organisationId}, 'Client Ltd', 'Client', 'active', 'UTC', ${actor}, 'client-isolation-test')`;
    await db`insert into operations.contacts (id, organisation_id, name, email, created_by, review_reference) values (${contactId}, ${organisationId}, 'Client Owner', ${email}, ${actor}, 'client-isolation-test')`;
    await db`insert into operations.memberships (organisation_id, contact_id, user_id, role) values (${organisationId}, ${contactId}, ${userId}, 'owner')`;
    await db.begin(async (tx) => {
      await tx`set local role operations_portal`;
      await tx`select set_config('operations.user_id', ${userId}, true), set_config('operations.verified_email', ${email}, true), set_config('operations.organisation_id', ${organisationId}, true)`;
      assert.equal((await tx`select * from operations.memberships`).length, 1);
      assert.equal(
        (await tx`select * from operations.active_staff_membership()`).length,
        0,
      );
    });
    for (const state of ["expired", "provider_failed", "revoked"]) {
      const invitationId = randomUUID();
      invitations.push(invitationId);
      await db.begin(async (tx) => {
        await tx`set local role operations_founder`;
        await tx`select set_config('operations.actor_id', ${actor}, true)`;
        await tx`select * from operations.issue_staff_invitation(${invitationId}, 'Staff Admin', ${email}, 'approved-staff-test', ${randomUUID()})`;
        if (state === "provider_failed")
          await tx`select operations.fail_staff_invitation(${invitationId}, ${randomUUID()})`;
        if (state === "revoked")
          await tx`select operations.revoke_staff_invitation(${invitationId}, 'revoked-before-claim', ${randomUUID()})`;
      });
      if (state === "expired")
        await db`update operations.pending_staff_invitations set expires_at = now() - interval '1 minute' where id = ${invitationId}`;
      const history = await db<
        { action: string }[]
      >`select action from operations.staff_invitation_audit where invitation_id = ${invitationId} order by occurred_at, id`;
      assert.deepEqual(
        history.map(({ action }) => action),
        state === "expired" ? ["issued"] : ["issued", state],
      );
      await db.begin(async (tx) => {
        await tx`set local role operations_portal`;
        await tx`select set_config('operations.user_id', ${userId}, true), set_config('operations.verified_email', ${email}, true), set_config('operations.correlation_id', ${randomUUID()}, true)`;
        const [claim] = await tx<
          { id: string | null }[]
        >`select operations.claim_staff_invitation(${invitationId}) as id`;
        assert.equal(claim.id, null, state);
        assert.equal(
          (await tx`select * from operations.active_staff_membership()`).length,
          0,
        );
      });
    }
    const [client] = await db<
      { role: string }[]
    >`select role from operations.memberships where contact_id = ${contactId} and revoked_at is null`;
    assert.equal(client.role, "owner");
  } finally {
    await cleanupStaffInvitationFixtures(db, invitations, {
      organisationId,
      contactId,
    });
  }
});
