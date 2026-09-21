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
import { executeStaffOnboardingWorkspaceCommand } from "../../../lib/operations/onboarding/workspace-commands";
import { withPortalTransaction } from "../../../lib/operations/db/portal-client";
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
  const otherFixture = await onboardingFixture(t, 1);
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

    const templateId = randomUUID();
    const taskId = randomUUID();
    const bookingTaskId = randomUUID();
    const template = await executeStaffOnboardingWorkspaceCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      {
        action: "save_template_draft",
        templateId,
        name: "Studio launch",
        expectedVersion: 0,
        reviewReference: "staff-journey-template",
        tasks: [
          {
            id: taskId,
            title: "Confirm your details",
            instructions: "Check the contact details we will use for your project.",
            kind: "profile",
            ownerRole: "owner",
            required: true,
            dependsOnTaskId: null,
            dueRule: "activation",
            evidenceRule: "profile_saved",
            bookingUrl: null,
          },
          {
            id: bookingTaskId,
            title: "Book your kickoff call",
            instructions: "Choose a time from the FSS Studio calendar.",
            kind: "booking",
            ownerRole: "owner",
            required: true,
            dependsOnTaskId: null,
            dueRule: "activation",
            evidenceRule: "booking_confirmed",
            bookingUrl: "https://calendar.example.test/fss-studio",
          },
        ],
      },
      options,
    );
    assert.equal(template.kind, "template_draft");
    const version = await executeStaffOnboardingWorkspaceCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      {
        action: "publish_template",
        templateId,
        expectedDraftVersion: template.draftVersion,
        reviewReference: "staff-journey-template",
      },
      options,
    );
    assert.equal(version.kind, "template_version");
    await fixture.founderDb.begin(async (tx) => {
      await tx`select set_config('operations.actor_id', ${admin.actorId}, true)`;
      await tx`select operations.instantiate_onboarding_journey_tasks(${fixture.journeyId}, ${version.templateVersionId})`;
    });
    const [bookingTask] = await fixture.admin<Array<{ id: string }>>`
      select id from operations.onboarding_journey_tasks
      where organisation_id = ${fixture.organisationId}
        and journey_id = ${fixture.journeyId}
        and template_task_id = ${bookingTaskId}
    `;
    await assert.rejects(
      withPortalTransaction(
        fixture.portal,
        fixture.identities[0],
        fixture.organisationId,
        fixture.correlationId,
        (tx) =>
          tx`select operations.complete_onboarding_task(
            ${fixture.organisationId},
            ${bookingTask!.id},
            ${null},
            ${[] as string[]}::uuid[],
            ${new Date().toISOString()}::timestamptz,
            ${"forged-client-booking"}
          )`,
      ),
      /staff confirmation/i,
    );
    const confirmedBooking = await executeStaffOnboardingWorkspaceCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      {
        action: "confirm_booking",
        journeyId: fixture.journeyId,
        taskId: bookingTask!.id,
        bookingAt: new Date().toISOString(),
        reviewReference: "staff-journey-booking",
      },
      options,
    );
    assert.equal(confirmedBooking.kind, "booking_confirmed");
    const [bookingAudit] = await fixture.admin<Array<{ actorId: string }>>`
      select actor_id as "actorId" from operations.audit_events
      where organisation_id = ${fixture.organisationId}
        and action = 'onboarding.booking_confirmed'
        and entity_id = ${bookingTask!.id}
    `;
    assert.equal(bookingAudit!.actorId, admin.actorId);
    const [contact] = await fixture.admin<Array<{ id: string }>>`
      select id from operations.contacts
      where organisation_id = ${fixture.organisationId}
        and email = ${fixture.identities[0].email}
    `;
    const otherTemplate = await executeStaffOnboardingWorkspaceCommand(
      fixture.founderDb,
      admin,
      otherFixture.organisationId,
      {
        action: "save_template_draft",
        templateId: randomUUID(),
        name: "Other client launch",
        expectedVersion: 0,
        reviewReference: "other-client-template",
        tasks: [
          {
            id: randomUUID(),
            title: "Confirm your details",
            instructions: "Check the contact details we will use for your project.",
            kind: "profile",
            ownerRole: "owner",
            required: true,
            dependsOnTaskId: null,
            dueRule: "activation",
            evidenceRule: "profile_saved",
            bookingUrl: null,
          },
        ],
      },
      options,
    );
    assert.equal(otherTemplate.kind, "template_draft");
    const otherVersion = await executeStaffOnboardingWorkspaceCommand(
      fixture.founderDb,
      admin,
      otherFixture.organisationId,
      {
        action: "publish_template",
        templateId: otherTemplate.templateId,
        expectedDraftVersion: otherTemplate.draftVersion,
        reviewReference: "other-client-template",
      },
      options,
    );
    assert.equal(otherVersion.kind, "template_version");
    await assert.rejects(
      executeStaffOnboardingWorkspaceCommand(
        fixture.founderDb,
        admin,
        fixture.organisationId,
        {
          action: "save_journey_draft",
          draftId: randomUUID(),
          agreementId: fixture.record.id,
          contactId: contact!.id,
          templateVersionId: otherVersion.templateVersionId,
          expectedVersion: 0,
          stage: "content",
          content: {
            welcomeSubject: "Welcome to your FSS Studio workspace",
            welcomeBody: "We have prepared the next steps for your project.",
          },
          reviewReference: "wrong-client-template",
        },
        options,
      ),
      /no longer available/i,
    );
    const draftCommand = {
      action: "save_journey_draft" as const,
      draftId: randomUUID(),
      agreementId: fixture.record.id,
      contactId: contact!.id,
      templateVersionId: version.templateVersionId,
      expectedVersion: 0,
      stage: "content" as const,
      content: {
        welcomeSubject: "Welcome to your FSS Studio workspace",
        welcomeBody: "We have prepared the next steps for your project.",
      },
      reviewReference: "staff-journey-draft",
    };
    const draft = await executeStaffOnboardingWorkspaceCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      draftCommand,
      options,
    );
    assert.equal(draft.kind, "journey_draft");
    assert.equal(draft.stage, "content");
    await assert.rejects(
      executeStaffOnboardingWorkspaceCommand(
        fixture.founderDb,
        admin,
        fixture.organisationId,
        draftCommand,
        options,
      ),
      /changed/i,
    );
    const discardedDraft = await executeStaffOnboardingWorkspaceCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      {
        action: "discard_journey_draft",
        draftId: draft.draftId,
        expectedVersion: draft.version,
        reviewReference: "staff-journey-discard",
      },
      options,
    );
    assert.equal(discardedDraft.kind, "journey_draft_discarded");

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
    await assert.rejects(
      executeStaffOnboardingWorkspaceCommand(
        fixture.founderDb,
        admin,
        fixture.organisationId,
        {
          action: "save_template_draft",
          templateId: randomUUID(),
          name: "Blocked draft",
          expectedVersion: 0,
          reviewReference: "revoked-staff-journey",
          tasks: [
            {
              id: randomUUID(),
              title: "Confirm your details",
              instructions: "Check the contact details we will use for your project.",
              kind: "profile",
              ownerRole: "owner",
              required: true,
              dependsOnTaskId: null,
              dueRule: "activation",
              evidenceRule: "profile_saved",
              bookingUrl: null,
            },
          ],
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
