import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { createOperationsDb } from "../../../lib/operations/db/client";
import {
  issueStaffInvitation,
  claimStaffInvitationForVerifiedEmail,
} from "../../../lib/operations/auth/staff-invitations";
import { requireFssAdmin } from "../../../lib/operations/auth/require-admin";
import {
  applyStaffPortalAccessOperation,
  listStudioPortalAccess,
} from "../../../lib/operations/studio/portal-access";

test("Studio access SQL deduplicates the full dataset, keeps filters independent and enforces founder/organisation boundaries", async (context) => {
  const url = requireOperationsTestDatabaseUrl(
    process.env.OPERATIONS_TEST_DATABASE_URL,
  );
  const raw = postgres(url, { max: 3 });
  const db = createOperationsDb(url, "operations_founder", 3);
  const portal = createOperationsDb(url, "operations_portal", 3);
  context.after(async () => {
    await Promise.all([raw.end(), db.end(), portal.end()]);
  });
  const actor = { actorId: "a".repeat(64) };
  const correlationId = randomUUID();
  const identity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true as const,
  };
  const staffIds = [randomUUID()];
  const organisationIds: string[] = [];
  const pendingEmail = `${randomUUID()}@example.test`;
  const clientEmail = `${randomUUID()}@example.test`;
  const clientUser = randomUUID();
  const previous = process.env.GROWTH_OS_OWNER_EMAIL;
  try {
    await issueStaffInvitation(
      db,
      actor,
      {
        name: "Access Admin",
        email: identity.email,
        reviewReference: "access-test",
      },
      staffIds[0],
      correlationId,
    );
    assert.equal(
      await claimStaffInvitationForVerifiedEmail(
        portal,
        identity,
        correlationId,
      ),
      true,
    );
    const admin = await requireFssAdmin(portal, identity, correlationId);
    process.env.GROWTH_OS_OWNER_EMAIL = identity.email;
    const baseline = await listStudioPortalAccess(
      db,
      admin,
      { page: 1 },
      identity,
    );
    let firstContact = "";
    let firstMembership = "";
    for (let index = 0; index < 27; index += 1) {
      const organisationId = randomUUID();
      organisationIds.push(organisationId);
      const contactId = randomUUID();
      await raw`insert into operations.organisations (id, legal_name, display_name, trading_status, timezone, created_by, review_reference) values (${organisationId}, 'Access Client', ${`Access Client ${index}`}, 'active', 'UTC', ${actor.actorId}, 'access-test')`;
      await raw`insert into operations.contacts (id, organisation_id, name, email, created_by, review_reference) values (${contactId}, ${organisationId}, 'Shared Person', ${clientEmail}, ${actor.actorId}, 'access-test')`;
      const [membership] = await raw<
        { id: string }[]
      >`insert into operations.memberships (organisation_id, contact_id, user_id, role) values (${organisationId}, ${contactId}, ${clientUser}, 'owner') returning id`;
      if (index === 0) {
        firstContact = contactId;
        firstMembership = membership.id;
      }
    }
    const pendingContact = randomUUID();
    await raw`insert into operations.contacts (id, organisation_id, name, email, created_by, review_reference) values (${pendingContact}, ${organisationIds[0]}, 'Pending Person', ${pendingEmail}, ${actor.actorId}, 'access-test')`;
    await applyStaffPortalAccessOperation(
      db,
      admin,
      {
        action: "invite_existing_client",
        contactId: pendingContact,
        organisationId: organisationIds[0],
        role: "contributor",
        reviewReference: "access-test",
      },
      "https://portal.example.test",
      async () => undefined,
    );
    const extraStaff = randomUUID();
    staffIds.push(extraStaff);
    await issueStaffInvitation(
      db,
      actor,
      {
        name: "Pending Person",
        email: pendingEmail,
        reviewReference: "access-test",
      },
      extraStaff,
      correlationId,
    );
    const full = await listStudioPortalAccess(
      db,
      admin,
      { page: 1, view: "clients", query: clientEmail },
      identity,
    );
    assert.equal(full.items.length, 10);
    assert.equal(full.totalPages, 3);
    assert.equal(full.hasNext, true);
    const finalPage = await listStudioPortalAccess(
      db,
      admin,
      { page: 3, view: "clients", query: clientEmail },
      identity,
    );
    assert.equal(finalPage.items.length, 7);
    assert.equal(finalPage.totalPages, 3);
    assert.equal(finalPage.hasNext, false);
    assert.equal(
      full.metrics.activeClientUsers,
      baseline.metrics.activeClientUsers + 1,
    );
    assert.equal(
      full.metrics.pendingInvitations,
      baseline.metrics.pendingInvitations + 1,
    );
    const filtered = await listStudioPortalAccess(
      db,
      admin,
      { page: 2, view: "invitations", query: "no-such-person" },
      identity,
    );
    assert.deepEqual(filtered.metrics, full.metrics);
    assert.equal(filtered.items.length, 0);
    await raw`update operations.pending_portal_invitations set expires_at=now()-interval '1 minute' where email=${pendingEmail}`;
    await raw`update operations.pending_staff_invitations set expires_at=now()-interval '1 minute' where id=${extraStaff}`;
    const attention = await listStudioPortalAccess(
      db,
      admin,
      {
        page: 2,
        view: "invitations",
        query: "no-such-person",
        state: "expired",
      },
      identity,
    );
    assert.equal(
      attention.metrics.pendingInvitations,
      baseline.metrics.pendingInvitations,
    );
    assert.equal(
      attention.metrics.attentionInvitations,
      baseline.metrics.attentionInvitations + 1,
    );
    const ordinary = await listStudioPortalAccess(db, admin, {
      page: 1,
      view: "invitations",
      query: pendingEmail,
    });
    assert.equal(ordinary.metrics.activeStaff, 0);
    assert.equal(ordinary.canManageStaff, false);
    assert.ok(ordinary.items.every((entry) => entry.accessType === "client"));
    assert.equal(ordinary.items.length, 1);
    assert.equal(ordinary.items[0].organisationId, organisationIds[0]);
    await assert.rejects(
      listStudioPortalAccess(db, admin, { page: 1, view: "staff" }),
      { name: "PortalAccessDenied" },
    );
    await assert.rejects(
      applyStaffPortalAccessOperation(
        db,
        admin,
        {
          action: "invite_admin",
          name: "Forged",
          email: "forged@example.test",
          reviewReference: "review",
        },
        "https://portal.example.test",
        async () => undefined,
      ),
      { name: "PortalAccessDenied" },
    );
    await assert.rejects(
      applyStaffPortalAccessOperation(
        db,
        admin,
        {
          action: "invite_existing_client",
          contactId: firstContact,
          organisationId: organisationIds[1],
          role: "owner",
          reviewReference: "cross-org",
        },
        "https://portal.example.test",
        async () => undefined,
      ),
      /selected active client contact/,
    );
    await assert.rejects(
      applyStaffPortalAccessOperation(
        db,
        admin,
        {
          action: "revoke_membership",
          membershipId: firstMembership,
          organisationId: organisationIds[1],
          reviewReference: "cross-org",
        },
        "https://portal.example.test",
      ),
      /no longer active/,
    );
    await raw`update operations.staff_memberships set revoked_at=now() where invitation_id=${staffIds[0]}`;
    await assert.rejects(
      listStudioPortalAccess(db, admin, { page: 1 }, identity),
      /staff|grant|access/i,
    );
  } finally {
    if (previous === undefined) delete process.env.GROWTH_OS_OWNER_EMAIL;
    else process.env.GROWTH_OS_OWNER_EMAIL = previous;
    for (const id of organisationIds) {
      await raw`delete from operations.portal_invitation_audit where invitation_id in (select id from operations.pending_portal_invitations where organisation_id=${id} or target_organisation_id=${id})`;
      await raw`delete from operations.pending_portal_invitations where organisation_id=${id} or target_organisation_id=${id}`;
      await raw`delete from operations.memberships where organisation_id=${id}`;
      await raw`delete from operations.contacts where organisation_id=${id}`;
      await raw`delete from operations.audit_events where organisation_id=${id}`;
      await raw`delete from operations.organisations where id=${id}`;
    }
    for (const id of staffIds) {
      await raw`delete from operations.staff_invitation_audit where invitation_id=${id}`;
      await raw`delete from operations.staff_memberships where invitation_id=${id}`;
      await raw`delete from operations.pending_staff_invitations where id=${id}`;
    }
  }
});
