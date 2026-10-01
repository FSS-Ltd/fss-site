import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { claimStaffInvitationForVerifiedEmail } from "../../../lib/operations/auth/staff-invitations";
import { requireFssAdmin } from "../../../lib/operations/auth/require-admin";
import {
  EngagementCommandConflict,
  completeStaffEngagementCommand,
} from "../../../lib/operations/agreements/engagement-service";
import { loadStaffAgreementBuilderDraft } from "../../../lib/operations/agreements/builder-draft-service";
import { saveStaffAgreementBuilderDraft } from "../../../lib/operations/agreements/builder-draft-service";
import type { FssAdminContext } from "../../../lib/operations/auth/staff-types";
import { signingFixture } from "./signing-fixtures";

async function staffAdminFixture(
  fixture: Awaited<ReturnType<typeof signingFixture>>,
): Promise<FssAdminContext> {
  const identity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true as const,
  };
  const invitationId = randomUUID();
  await fixture.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
    await tx`select * from operations.issue_staff_invitation(${invitationId}, 'Studio Administrator', ${identity.email}, 'studio-engagement-test', ${fixture.correlationId})`;
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

test("creates reviewed direct work atomically, resumes the saved agreement draft and reuses an identical command", async (t) => {
  const fixture = await signingFixture(t, 1);
  const admin = await staffAdminFixture(fixture);
  const draftId = randomUUID();
  const savedDraft = await saveStaffAgreementBuilderDraft(
    fixture.founderDb,
    admin,
    fixture.organisationId,
    {
      action: "save",
      draftId,
      expectedVersion: 0,
      step: "link",
      content: {
        agreement: {
          title: "Preserved agreement title",
          goals: "Preserved agreement goal.",
          scope: "Preserved agreement scope.",
        },
      },
    },
    fixture.correlationId,
  );
  const command = {
    action: "create",
    commandId: randomUUID(),
    draftId: savedDraft.id,
    expectedVersion: savedDraft.version,
    name: "Direct Studio engagement",
    primaryGoal: "Make booking simpler for customers.",
    proposedScope: "Update key pages and add an online booking flow.",
    reviewReference: "Discovery review 2026-10-01",
    reviewed: true,
  };

  const result = await completeStaffEngagementCommand(
    fixture.founderDb,
    admin,
    fixture.organisationId,
    command,
    fixture.correlationId,
  );
  assert.deepEqual(
    await completeStaffEngagementCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      command,
      fixture.correlationId,
    ),
    result,
  );

  const [engagement] = await fixture.admin<
    {
      prospectId: string | null;
      studioOrganisationId: string | null;
      stage: string;
      deliveryStatus: string;
    }[]
  >`select prospect_id as "prospectId", studio_organisation_id as "studioOrganisationId", stage, delivery_status as "deliveryStatus" from growth.delivery_engagements where id=${result.engagementId}`;
  assert.equal(engagement.prospectId, null);
  assert.equal(engagement.studioOrganisationId, fixture.organisationId);
  assert.equal(engagement.stage, "negotiation");
  assert.equal(engagement.deliveryStatus, "not_started");

  const [review] = await fixture.admin<
    { primaryGoal: string; proposedScope: string; reviewedBy: string }[]
  >`
    select primary_goal as "primaryGoal", proposed_scope as "proposedScope", reviewed_by as "reviewedBy"
    from operations.studio_engagement_reviews where engagement_id=${result.engagementId}
  `;
  assert.equal(review.primaryGoal, command.primaryGoal);
  assert.equal(review.proposedScope, command.proposedScope);
  assert.equal(review.reviewedBy, admin.actorId);

  const draft = await loadStaffAgreementBuilderDraft(
    fixture.founderDb,
    admin,
    fixture.organisationId,
    result.draftId,
  );
  assert.equal(draft?.version, result.draftVersion);
  assert.equal(draft?.step, "scope");
  assert.equal(draft?.content.engagementId, result.engagementId);
  assert.equal(draft?.content.agreement?.title, "Preserved agreement title");
  assert.equal(draft?.content.agreement?.goals, "Preserved agreement goal.");
  assert.equal(draft?.content.agreement?.scope, "Preserved agreement scope.");

  const selected = await completeStaffEngagementCommand(
    fixture.founderDb,
    admin,
    fixture.organisationId,
    {
      action: "select",
      commandId: randomUUID(),
      engagementId: result.engagementId,
    },
    fixture.correlationId,
  );
  const selectedDraft = await loadStaffAgreementBuilderDraft(
    fixture.founderDb,
    admin,
    fixture.organisationId,
    selected.draftId,
  );
  assert.equal(selectedDraft?.engagementId, result.engagementId);
  assert.equal(selectedDraft?.step, "scope");
  assert.equal(selected.draftVersion, 1);
});

test("rolls back engagement creation when the saved agreement draft is stale", async (t) => {
  const fixture = await signingFixture(t, 1);
  const admin = await staffAdminFixture(fixture);
  await assert.rejects(
    completeStaffEngagementCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      {
        action: "create",
        commandId: randomUUID(),
        draftId: randomUUID(),
        expectedVersion: 4,
        name: "Must roll back",
        primaryGoal: "A concrete goal.",
        proposedScope: "A concrete scope.",
        reviewReference: "Stale draft test",
        reviewed: true,
      },
      fixture.correlationId,
    ),
    EngagementCommandConflict,
  );
  assert.equal(
    (
      await fixture.admin`select count(*)::int as count from growth.delivery_engagements where studio_organisation_id=${fixture.organisationId}`
    )[0].count,
    0,
  );
});

test("direct Studio entry creates reviewed work and its first scope draft atomically", async (t) => {
  const fixture = await signingFixture(t, 1);
  const admin = await staffAdminFixture(fixture);
  const result = await completeStaffEngagementCommand(
    fixture.founderDb,
    admin,
    fixture.organisationId,
    {
      action: "create",
      commandId: randomUUID(),
      name: "Direct entry engagement",
      primaryGoal: "Help customers book online.",
      proposedScope: "Build a clear online booking flow.",
      reviewReference: "Discovery notes 2026-10-01",
      reviewed: true,
    },
    fixture.correlationId,
  );

  const draft = await loadStaffAgreementBuilderDraft(
    fixture.founderDb,
    admin,
    fixture.organisationId,
    result.draftId,
  );
  assert.equal(draft?.engagementId, result.engagementId);
  assert.equal(draft?.step, "scope");
  assert.equal(draft?.version, 1);
  assert.equal(draft?.content.agreement?.goals, "Help customers book online.");
  assert.equal(
    draft?.content.agreement?.scope,
    "Build a clear online booking flow.",
  );
});
