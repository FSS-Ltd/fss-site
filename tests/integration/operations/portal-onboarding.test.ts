import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { applyStaffPortalAccessOperation } from "../../../lib/operations/studio/portal-access";
import { claimClerkPortalInvitation } from "../../../lib/operations/auth/invites";
import { claimStaffInvitationForVerifiedEmail } from "../../../lib/operations/auth/staff-invitations";
import { requireFssAdmin } from "../../../lib/operations/auth/require-admin";
import type {
  PortalInvitationClaim,
  PortalInvitationMetadata,
} from "../../../lib/operations/auth/clerk-invitation";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";

test("a verified invitee creates their organisation exactly once during portal onboarding", async () => {
  const url = requireOperationsTestDatabaseUrl(
    process.env.OPERATIONS_TEST_DATABASE_URL,
  );
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const actorId = "a".repeat(64);
  const staffInvitationId = randomUUID();
  let invitationId: string | null = null;
  const userId = randomUUID();
  const email = `${randomUUID()}@example.test`;
  const staffIdentity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true as const,
  };
  const correlationId = randomUUID();
  let organisationId: string | null = null;

  try {
    await founder.begin(async (tx) => {
      await tx`select set_config('operations.actor_id', ${actorId}, true)`;
      await tx`select * from operations.issue_staff_invitation(
        ${staffInvitationId}, 'Onboarding Test Admin', ${staffIdentity.email},
        'onboarding-staff-fixture', ${correlationId}
      )`;
    });
    assert.equal(
      await claimStaffInvitationForVerifiedEmail(
        portal,
        staffIdentity,
        correlationId,
      ),
      true,
    );
    const staffAdmin = await requireFssAdmin(
      portal,
      staffIdentity,
      correlationId,
    );
    let resolveInvitationMetadata: (
      metadata: PortalInvitationMetadata,
    ) => void = () => {
      throw new Error("New client invitation was not provisioned.");
    };
    const invitationMetadataPromise = new Promise<PortalInvitationMetadata>(
      (resolve) => {
        resolveInvitationMetadata = resolve;
      },
    );
    await applyStaffPortalAccessOperation(
      founder,
      staffAdmin,
      {
        action: "invite_client",
        name: "Invited Owner",
        email,
        reviewReference: "founder-approved-test-invitation",
      },
      "https://portal.example.test",
      async (_email, _redirectUrl, metadata) => {
        if (!metadata)
          throw new Error("New client invitation metadata is missing.");
        resolveInvitationMetadata(metadata);
      },
    );
    const invitationMetadata = await invitationMetadataPromise;
    assert.equal(invitationMetadata.version, 2);
    if (invitationMetadata.version !== 2)
      throw new Error("New client invitation metadata was not issued.");
    invitationId = invitationMetadata.invitationId;

    const [stored] = await admin<
      { organisationId: string | null; email: string; state: string }[]
    >`
      select organisation_id as "organisationId", email, state
      from operations.pending_portal_invitations
      where id = ${invitationId}
    `;
    assert.deepEqual(stored, {
      organisationId: null,
      email,
      state: "pending",
    });
    const [issuedAudit] = await admin<{ actorId: string; action: string }[]>`
      select actor_id as "actorId", action
      from operations.portal_invitation_audit
      where invitation_id = ${invitationId} and action = 'issued'
    `;
    assert.deepEqual(issuedAudit, {
      actorId: staffAdmin.actorId,
      action: "issued",
    });

    const claim: PortalInvitationClaim = {
      clerkUserId: "user_2zOnboardingOwner",
      identity: { userId, email, emailVerified: true },
      invitation: invitationMetadata,
    };
    assert.equal(
      await claimClerkPortalInvitation(
        portal,
        {
          ...claim,
          identity: {
            userId,
            email: `mismatch-${email}`,
            emailVerified: true,
          },
        },
        correlationId,
      ),
      false,
    );
    const [unclaimed] = await admin<{ state: string }[]>`
      select state from operations.pending_portal_invitations where id = ${invitationId}
    `;
    assert.equal(unclaimed.state, "pending");
    assert.equal(
      await claimClerkPortalInvitation(portal, claim, correlationId),
      false,
    );
    const [accepted] = await admin<{ state: string; claimedUserId: string }[]>`
      select state, claimed_user_id as "claimedUserId"
      from operations.pending_portal_invitations where id = ${invitationId}
    `;
    assert.deepEqual(accepted, { state: "accepted", claimedUserId: userId });

    const unrelatedNeedsOnboarding = await portal.begin(async (tx) => {
      await tx`
        select
          set_config('operations.user_id', ${randomUUID()}, true),
          set_config('operations.verified_email', ${`other-${email}`}, true),
          set_config('operations.correlation_id', ${randomUUID()}, true)
      `;
      const [row] = await tx<{ needed: boolean }[]>`
        select operations.pending_portal_onboarding() as needed
      `;
      return row.needed;
    });
    assert.equal(unrelatedNeedsOnboarding, false);

    const firstCompletion = await portal.begin(async (tx) => {
      await tx`
        select
          set_config('operations.user_id', ${userId}, true),
          set_config('operations.verified_email', ${email}, true),
          set_config('operations.correlation_id', ${randomUUID()}, true)
      `;
      const [pending] = await tx<{ needed: boolean }[]>`
      select operations.pending_portal_onboarding() as needed
      `;
      assert.equal(pending.needed, true);
      const [completed] = await tx<{ organisationId: string }[]>`
        select operations.complete_portal_onboarding(
          'Invited Organisation Ltd',
          'Invited Organisation',
          'Europe/London'
        ) as "organisationId"
      `;
      return completed.organisationId;
    });
    organisationId = firstCompletion;

    const repeatedCompletion = await portal.begin(async (tx) => {
      await tx`
        select
          set_config('operations.user_id', ${userId}, true),
          set_config('operations.verified_email', ${email}, true),
          set_config('operations.correlation_id', ${randomUUID()}, true)
      `;
      const [completed] = await tx<{ organisationId: string }[]>`
        select operations.complete_portal_onboarding(
          'Ignored Different Legal Name',
          'Ignored Different Display Name',
          'UTC'
        ) as "organisationId"
      `;
      return completed.organisationId;
    });
    assert.equal(repeatedCompletion, firstCompletion);

    const [counts] = await admin<
      {
        organisations: number;
        contacts: number;
        memberships: number;
        completedInvitations: number;
      }[]
    >`
      select
        (select count(*)::int from operations.organisations where id = ${firstCompletion}) as organisations,
        (select count(*)::int from operations.contacts where organisation_id = ${firstCompletion} and email = ${email}) as contacts,
        (select count(*)::int from operations.memberships where organisation_id = ${firstCompletion} and user_id = ${userId} and role = 'owner' and revoked_at is null) as memberships,
        (select count(*)::int from operations.pending_portal_invitations where id = ${invitationId} and state = 'completed' and organisation_id = ${firstCompletion}) as "completedInvitations"
    `;
    assert.deepEqual(counts, {
      organisations: 1,
      contacts: 1,
      memberships: 1,
      completedInvitations: 1,
    });
  } finally {
    if (organisationId) {
      if (invitationId) {
        await admin`delete from operations.portal_invitation_audit where invitation_id = ${invitationId}`;
        await admin`delete from operations.pending_portal_invitations where id = ${invitationId}`;
      }
      await admin`delete from operations.memberships where organisation_id = ${organisationId}`;
      await admin`delete from operations.contacts where organisation_id = ${organisationId}`;
      await admin`delete from operations.audit_events where organisation_id = ${organisationId}`;
      await admin`delete from operations.organisations where id = ${organisationId}`;
    } else {
      if (invitationId) {
        await admin`delete from operations.portal_invitation_audit where invitation_id = ${invitationId}`.catch(
          () => undefined,
        );
        await admin`delete from operations.pending_portal_invitations where id = ${invitationId}`.catch(
          () => undefined,
        );
      }
    }
    await admin`delete from operations.staff_invitation_audit where invitation_id = ${staffInvitationId}`;
    await admin`delete from operations.staff_memberships where invitation_id = ${staffInvitationId}`;
    await admin`delete from operations.pending_staff_invitations where id = ${staffInvitationId}`;
    await admin`delete from operations.user_profiles where user_id in (${userId}, ${staffIdentity.userId})`;
    await Promise.all([admin.end(), founder.end(), portal.end()]);
  }
});

test("expired invitations fail closed without creating tenant data", async () => {
  const url = requireOperationsTestDatabaseUrl(
    process.env.OPERATIONS_TEST_DATABASE_URL,
  );
  const admin = postgres(url, { max: 1 });
  const portal = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const invitationId = randomUUID();
  const email = `${randomUUID()}@example.test`;
  try {
    await admin`
      insert into operations.pending_portal_invitations (
        id, name, email, role, state, expires_at, created_by,
        review_reference, correlation_id
      ) values (
        ${invitationId}, 'Expired Invitee', ${email}, 'viewer', 'pending',
        now() - interval '1 minute', ${"b".repeat(64)}, 'expired-test', ${randomUUID()}
      )
    `;
    const result = await portal.begin(async (tx) => {
      await tx`
        select
          set_config('operations.user_id', ${randomUUID()}, true),
          set_config('operations.verified_email', ${email}, true),
          set_config('operations.correlation_id', ${randomUUID()}, true)
      `;
      const [pending] = await tx<{ needed: boolean }[]>`
        select operations.pending_portal_onboarding() as needed
      `;
      return pending.needed;
    });
    assert.equal(result, false);
  } finally {
    await admin`delete from operations.portal_invitation_audit where invitation_id = ${invitationId}`.catch(
      () => undefined,
    );
    await admin`delete from operations.pending_portal_invitations where id = ${invitationId}`.catch(
      () => undefined,
    );
    await Promise.all([admin.end(), portal.end()]);
  }
});
