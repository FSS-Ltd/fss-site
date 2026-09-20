import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";

const actor = "a".repeat(64);
type Transaction = postgres.TransactionSql;

async function fixture(
  run: (
    tx: Transaction,
    data: {
      userId: string;
      email: string;
      invitationId: string;
      organisationId: string;
    },
  ) => Promise<void>,
): Promise<void> {
  const db = postgres(
    requireOperationsTestDatabaseUrl(process.env.OPERATIONS_TEST_DATABASE_URL),
    { max: 1 },
  );
  const rollback = new Error("Roll back disposable invitation fixtures");
  try {
    await db.begin(async (tx) => {
      const data = {
        userId: randomUUID(),
        email: `${randomUUID()}@example.test`,
        invitationId: randomUUID(),
        organisationId: randomUUID(),
      };
      await tx`insert into operations.organisations(id, legal_name, display_name, trading_status, timezone, created_by, review_reference) values (${data.organisationId}, 'Test client', 'Test client', 'unknown', 'UTC', ${actor}, 'Fixture')`;
      await tx`insert into operations.pending_portal_invitations(id,name,email,role,target_organisation_id,created_by,review_reference,correlation_id) values (${data.invitationId}, 'Invited person', ${data.email}, 'viewer', ${data.organisationId}, ${actor}, 'Fixture', ${randomUUID()})`;
      await tx`select set_config('operations.user_id', ${data.userId}, true), set_config('operations.verified_email', ${data.email}, true), set_config('operations.correlation_id', ${randomUUID()}, true)`;
      await tx`set local role operations_portal`;
      await run(tx, data);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await db.end();
  }
}

test("scoped client invitation joins the approved organisation and replays without duplicating access", async () => {
  await fixture(async (tx, data) => {
    await tx`select operations.upsert_user_profile('Confirmed name')`;
    const [first] =
      await tx`select operations.claim_pending_portal_invitation(${data.invitationId}) as destination`;
    assert.equal(first.destination, "portal");
    const [second] =
      await tx`select operations.claim_pending_portal_invitation(${data.invitationId}) as destination`;
    assert.equal(second.destination, "portal");
    await tx`reset role`;
    const rows =
      await tx`select m.user_id, m.role, c.name from operations.memberships m join operations.contacts c on c.id=m.contact_id where m.organisation_id=${data.organisationId}`;
    assert.deepEqual(
      [...rows],
      [{ user_id: data.userId, role: "viewer", name: "Confirmed name" }],
    );
  });
});

test("existing Clerk users claim a scoped invitation by verified email without metadata", async () => {
  await fixture(async (tx, data) => {
    const [claim] =
      await tx`select operations.claim_pending_portal_invitation_for_verified_email() as destination`;
    assert.equal(claim.destination, "portal");
    await tx`reset role`;
    const [invitation] =
      await tx`select state, claimed_user_id from operations.pending_portal_invitations where id=${data.invitationId}`;
    assert.equal(invitation.state, "completed");
    assert.equal(invitation.claimed_user_id, data.userId);
  });
});

test("a scoped invitation cannot replace a membership bound to a different identity", async () => {
  await fixture(async (tx, data) => {
    await tx`reset role`;
    const [contact] =
      await tx`insert into operations.contacts(organisation_id,name,email,created_by,review_reference) values (${data.organisationId}, 'Original user', ${data.email}, ${actor}, 'Fixture') returning id`;
    const originalUser = randomUUID();
    await tx`insert into operations.memberships(organisation_id,contact_id,user_id,role) values (${data.organisationId}, ${contact.id}, ${originalUser}, 'owner')`;
    await tx`set local role operations_portal`;
    const [claim] =
      await tx`select operations.claim_pending_portal_invitation(${data.invitationId}) as destination`;
    assert.equal(claim.destination, null);
    await tx`reset role`;
    const [member] =
      await tx`select user_id,role from operations.memberships where contact_id=${contact.id}`;
    assert.equal(member.user_id, originalUser);
    assert.equal(member.role, "owner");
  });
});

test("archived organisations cannot receive invitation claims", async () => {
  await fixture(async (tx, data) => {
    await tx`reset role`;
    await tx`update operations.organisations set lifecycle='archived' where id=${data.organisationId}`;
    await tx`set local role operations_portal`;
    const [claim] =
      await tx`select operations.claim_pending_portal_invitation(${data.invitationId}) as destination`;
    assert.equal(claim.destination, null);
  });
});

test("a completed client invitation cannot restore revoked membership", async () => {
  await fixture(async (tx, data) => {
    await tx`select operations.claim_pending_portal_invitation(${data.invitationId})`;
    await tx`reset role`;
    await tx`update operations.memberships set revoked_at=now() where user_id=${data.userId}`;
    await tx`set local role operations_portal`;
    const [claim] =
      await tx`select operations.claim_pending_portal_invitation(${data.invitationId}) as destination`;
    assert.equal(claim.destination, null);
  });
});

test("pending staff invitees cannot create a client organisation through onboarding", async () => {
  await fixture(async (tx, data) => {
    await tx`reset role`;
    await tx`update operations.pending_portal_invitations set target_organisation_id=null,role='owner' where id=${data.invitationId}`;
    await tx`insert into operations.pending_staff_invitations(id,name,email,created_by,review_reference,correlation_id) values (${randomUUID()}, 'Staff', ${data.email}, ${actor}, 'Fixture', ${randomUUID()})`;
    await tx`set local role operations_portal`;
    const [pending] =
      await tx`select operations.pending_portal_onboarding() as needed`;
    assert.equal(pending.needed, false);
    const [onboarded] =
      await tx`select operations.complete_portal_onboarding('Wrong client','Wrong client','UTC') as organisation`;
    assert.equal(onboarded.organisation, null);
  });
});

test("an organisation owner cannot supersede another organisation's pending invitation", async () => {
  await fixture(async (tx, data) => {
    await tx`reset role`;
    const otherOrganisation = randomUUID();
    await tx`insert into operations.organisations(id,legal_name,display_name,trading_status,timezone,created_by,review_reference) values (${otherOrganisation}, 'Other client','Other client','unknown','UTC',${actor},'Fixture')`;
    const [owner] =
      await tx`insert into operations.contacts(organisation_id,name,email,created_by,review_reference) values (${otherOrganisation},'Owner','owner@example.test',${actor},'Fixture') returning id`;
    await tx`insert into operations.memberships(organisation_id,contact_id,user_id,role) values (${otherOrganisation},${owner.id},${data.userId},'owner')`;
    await tx`set local role operations_portal`;
    await assert.rejects(
      tx.savepoint(async (savepoint) => {
        await savepoint`select * from operations.issue_owner_portal_invitation(${randomUUID()}, 'Invitee', ${data.email}, 'viewer', ${otherOrganisation}, ${randomUUID()})`;
      }),
      /already has a pending invitation/,
    );
    await tx`reset role`;
    const [original] =
      await tx`select state from operations.pending_portal_invitations where id=${data.invitationId}`;
    assert.equal(original.state, "pending");
  });
});

test("founder and owner can issue scoped client invitations using the real database procedures", async () => {
  await fixture(async (tx, data) => {
    await tx`reset role`;
    await tx`select set_config('operations.actor_id',${actor},true)`;
    await tx`set local role operations_founder`;
    const invitationId = randomUUID();
    const [issued] =
      await tx`select * from operations.issue_pending_portal_invitation(${invitationId},'Approved contact',${`${randomUUID()}@example.test`},'viewer','Approved',${randomUUID()},${data.organisationId})`;
    assert.equal(issued.id, invitationId);
    await tx`reset role`;
    const [owner] =
      await tx`insert into operations.contacts(organisation_id,name,email,created_by,review_reference) values (${data.organisationId},'Owner',${data.email},${actor},'Fixture') returning id`;
    await tx`insert into operations.memberships(organisation_id,contact_id,user_id,role) values (${data.organisationId},${owner.id},${data.userId},'owner')`;
    await tx`set local role operations_portal`;
    const teamInvitationId = randomUUID();
    const [teamInvitation] =
      await tx`select * from operations.issue_owner_portal_invitation(${teamInvitationId},'Team member',${`${randomUUID()}@example.test`},'viewer',${data.organisationId},${randomUUID()})`;
    assert.equal(teamInvitation.id, teamInvitationId);
  });
});

test("webhook profile sync cannot overwrite a name confirmed during activation", async () => {
  await fixture(async (tx, data) => {
    await tx`select operations.upsert_user_profile('Confirmed name')`;
    await tx`select operations.upsert_user_profile('Older provider name',false)`;
    await tx`reset role`;
    const [profile] =
      await tx`select display_name,email from operations.user_profiles where user_id=${data.userId}`;
    assert.equal(profile.display_name, "Confirmed name");
    assert.equal(profile.email, data.email);
  });
});

test("legacy Clerk metadata cannot restore a revoked client membership", async () => {
  await fixture(async (tx, data) => {
    await tx`select operations.claim_pending_portal_invitation(${data.invitationId})`;
    await tx`reset role`;
    await tx`update operations.memberships set revoked_at=now() where user_id=${data.userId}`;
    await tx`set local role operations_portal`;
    const [result] =
      await tx`select operations.claim_clerk_portal_invitation(${data.organisationId},'Old name',${data.email},'owner','Stale metadata',${actor}) as organisation`;
    assert.equal(result.organisation, null);
  });
});

test("an existing user's staff invitation saves their profile without creating a client tenant", async () => {
  await fixture(async (tx, data) => {
    await tx`reset role`;
    const staffInvitationId = randomUUID();
    await tx`insert into operations.pending_staff_invitations(id,name,email,created_by,review_reference,correlation_id) values (${staffInvitationId},'Staff profile',${data.email},${actor},'Fixture',${randomUUID()})`;
    await tx`set local role operations_portal`;
    const [result] =
      await tx`select operations.claim_staff_invitation_for_verified_email() as membership`;
    assert.ok(result.membership);
    await tx`reset role`;
    const profiles =
      await tx`select display_name from operations.user_profiles where user_id=${data.userId}`;
    assert.deepEqual([...profiles], [{ display_name: "Staff profile" }]);
    const memberships =
      await tx`select id from operations.memberships where user_id=${data.userId}`;
    assert.equal(memberships.length, 0);
  });
});

test("revoking client access also cancels an unclaimed invitation issued before revocation", async () => {
  await fixture(async (tx, data) => {
    await tx`select operations.claim_pending_portal_invitation(${data.invitationId})`;
    await tx`reset role`;
    const [member] =
      await tx`select id from operations.memberships where user_id=${data.userId}`;
    const freshInvitation = randomUUID();
    await tx`insert into operations.pending_portal_invitations(id,name,email,role,target_organisation_id,created_by,review_reference,correlation_id) values (${freshInvitation},'Reinvited',${data.email},'viewer',${data.organisationId},${actor},'Fixture',${randomUUID()})`;
    await tx`select set_config('operations.actor_id',${actor},true)`;
    await tx`set local role operations_founder`;
    await tx`select operations.revoke_portal_membership(${data.organisationId},${member.id},'Access removed')`;
    await tx`set local role operations_portal`;
    const [claim] =
      await tx`select operations.claim_pending_portal_invitation(${freshInvitation}) as destination`;
    assert.equal(claim.destination, null);
  });
});

test("provider cleanup excludes pending invitations and other identities", async () => {
  await fixture(async (tx, data) => {
    assert.equal(
      (await tx`select * from operations.claimed_invitation_ids('portal')`)
        .length,
      0,
    );
    await tx`select operations.claim_pending_portal_invitation(${data.invitationId})`;
    const claimed =
      await tx`select * from operations.claimed_invitation_ids('portal')`;
    assert.deepEqual([...claimed], [{ invitation_id: data.invitationId }]);
    assert.equal(
      (await tx`select * from operations.claimed_invitation_ids('staff')`)
        .length,
      0,
    );
    await tx`select set_config('operations.user_id',${randomUUID()},true)`;
    assert.equal(
      (await tx`select * from operations.claimed_invitation_ids('portal')`)
        .length,
      0,
    );
  });
});
