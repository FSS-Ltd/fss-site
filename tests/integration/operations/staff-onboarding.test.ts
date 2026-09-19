import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  claimStaffInvitationForVerifiedEmail,
  revokeStaffMembership,
} from "../../../lib/operations/auth/staff-invitations";
import { requireFssAdmin } from "../../../lib/operations/auth/require-admin";
import type { FssAdminContext } from "../../../lib/operations/auth/staff-types";
import { executeStaffJourneyCommand } from "../../../lib/operations/onboarding/commands";
import { loadStaffWelcomePdf } from "../../../lib/operations/onboarding/download";
import {
  listStaffJourneyContacts,
  listStaffJourneys,
} from "../../../lib/operations/onboarding/queries";
import { onboardingFixture } from "./onboarding-fixtures";

const options = {
  billing: { accountId: "acct_billingTest", livemode: false },
  previewKey: Buffer.alloc(32, 7),
  portalOrigin: "https://example.test",
};

async function staffAdminFixture(
  fixture: Awaited<ReturnType<typeof onboardingFixture>>,
): Promise<{ admin: FssAdminContext; invitationId: string }> {
  const identity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true as const,
  };
  const invitationId = randomUUID();
  await fixture.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
    await tx`select * from operations.issue_staff_invitation(${invitationId}, 'Journey Administrator', ${identity.email}, 'staff-journey-test', ${fixture.correlationId})`;
  });
  assert.ok(
    await claimStaffInvitationForVerifiedEmail(
      fixture.portal,
      identity,
      fixture.correlationId,
    ),
  );
  return {
    admin: await requireFssAdmin(
      fixture.portal,
      identity,
      fixture.correlationId,
    ),
    invitationId,
  };
}

test("staff journeys retain previews, exact approvals, and revoked access checks", async (t) => {
  const fixture = await onboardingFixture(t, 1);
  const { admin, invitationId } = await staffAdminFixture(fixture);
  try {
    const [journey] = await listStaffJourneys(
      fixture.founderDb,
      admin,
      fixture.organisationId,
    );
    assert.equal(journey.id, fixture.journeyId);
    assert.ok(
      (
        await listStaffJourneyContacts(
          fixture.founderDb,
          admin,
          fixture.organisationId,
        )
      ).some((contact) => contact.email === fixture.identities[0].email),
    );
    const preview = await executeStaffJourneyCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      {
        action: "preview_proposal",
        journeyId: journey.id,
        expectedGeneration: journey.generation,
        expectedProposalApprovalId: journey.proposalApprovalId,
        signingApprovalId: fixture.signingApproval.id,
        access: [{ email: fixture.identities[0].email, role: "owner" }],
        scopeSummary: "the approved client workspace",
      },
      options,
    );
    assert.ok("preview" in preview && preview.preview.kind === "proposal");
    await executeStaffJourneyCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      {
        action: "approve_proposal",
        token: preview.preview.token,
        confirmed: true,
      },
      options,
    );
    const [approval] = await fixture.admin<
      { approvedBy: string }[]
    >`select approved_by as "approvedBy" from operations.onboarding_proposal_approvals where organisation_id=${fixture.organisationId} and id=(select proposal_approval_id from operations.onboarding_journeys where id=${fixture.journeyId})`;
    assert.equal(approval.approvedBy, admin.actorId);
    assert.equal(
      (
        await loadStaffWelcomePdf(
          fixture.founderDb,
          admin,
          fixture.organisationId,
          fixture.journeyId,
        )
      )?.equals(fixture.prepared.pdf),
      true,
    );

    await revokeStaffMembership(
      fixture.founderDb,
      fixture.founder,
      {
        staffMembershipId: admin.membershipId,
        reviewReference: "staff-journey-revoke-test",
      },
      randomUUID(),
    );
    await assert.rejects(
      executeStaffJourneyCommand(
        fixture.founderDb,
        admin,
        fixture.organisationId,
        {
          action: "pause",
          journeyId: fixture.journeyId,
          expectedGeneration: 2,
          expectedProposalApprovalId: null,
        },
        options,
      ),
    );
  } finally {
    await fixture.admin`delete from operations.staff_invitation_audit where invitation_id=${invitationId}`;
    await fixture.admin`delete from operations.staff_memberships where id=${admin.membershipId}`;
    await fixture.admin`delete from operations.pending_staff_invitations where id=${invitationId}`;
  }
});
