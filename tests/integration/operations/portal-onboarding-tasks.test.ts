import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PortalAccessDenied } from "../../../lib/operations/auth/types";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";
import { executeDocumentCommand } from "../../../lib/operations/documents/service";
import { executeProjectCommand } from "../../../lib/operations/projects/service";
import {
  attachClearedDocumentToTask,
  ClientOnboardingConflict,
  completeClientProfile,
  loadClientOnboardingWorkspace,
} from "../../../lib/operations/onboarding/client-workspace";
import type { OnboardingTaskDefinition } from "../../../lib/operations/onboarding/workspace-types";
import { onboardingFixture } from "./onboarding-fixtures";

const profileTask = (
  id: string,
  ownerRole: OnboardingTaskDefinition["ownerRole"],
): OnboardingTaskDefinition => ({
  id,
  title: "Confirm your working details",
  instructions: "Check the details FSS will use for your project.",
  kind: "profile",
  ownerRole,
  required: true,
  dependsOnTaskId: null,
  dueRule: "activation",
  evidenceRule: "profile_saved",
  bookingUrl: null,
});

const uploadTask = (id: string): OnboardingTaskDefinition => ({
  id,
  title: "Share approved brand assets",
  instructions: "Attach files that have passed the document safety checks.",
  kind: "upload",
  ownerRole: "owner",
  required: true,
  dependsOnTaskId: null,
  dueRule: "activation",
  evidenceRule: "cleared_documents",
  bookingUrl: null,
});

const agreementTask = (id: string): OnboardingTaskDefinition => ({
  id,
  title: "Review your agreement",
  instructions: "Your agreement progress is updated from signing evidence.",
  kind: "agreement",
  ownerRole: "owner",
  required: true,
  dependsOnTaskId: null,
  dueRule: "activation",
  evidenceRule: "agreement_signed",
  bookingUrl: null,
});

async function publishAndInstantiateTasks(
  fixture: Awaited<ReturnType<typeof onboardingFixture>>,
  tasks: readonly OnboardingTaskDefinition[],
): Promise<string> {
  const templateId = randomUUID();
  const [draft] = await fixture.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
    return tx<Array<{ draftVersion: number }>>`
      select draft_version as "draftVersion"
      from operations.save_onboarding_template_draft(
        ${templateId}, ${fixture.organisationId}, ${"Client launch"},
        ${tx.json({ tasks })}::jsonb, 0, ${"portal-onboarding-tasks"}
      )
    `;
  });
  const [version] = await fixture.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
    return tx<Array<{ id: string }>>`
      select id
      from operations.publish_onboarding_template_version(
        ${templateId}, ${draft!.draftVersion}, ${"portal-onboarding-tasks"}
      )
    `;
  });
  await fixture.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
    await tx`select operations.instantiate_onboarding_journey_tasks(${fixture.journeyId}, ${version!.id})`;
  });
  return version!.id;
}

test("client onboarding workspace derives evidence and limits task mutation to the matching member", async (t) => {
  const fixture = await onboardingFixture(t, 3);
  const otherFixture = await onboardingFixture(t, 1);
  const owner = fixture.identities[0]!;
  const contributor = fixture.identities[1]!;
  const viewer = fixture.identities[2]!;
  await fixture.admin`update operations.memberships set role = 'contributor' where organisation_id = ${fixture.organisationId} and user_id = ${contributor.userId}`;
  await fixture.admin`update operations.memberships set role = 'viewer' where organisation_id = ${fixture.organisationId} and user_id = ${viewer.userId}`;

  const ownerProfileTaskId = randomUUID();
  const contributorProfileTaskId = randomUUID();
  const uploadTaskId = randomUUID();
  const templateVersionId = await publishAndInstantiateTasks(fixture, [
    profileTask(ownerProfileTaskId, "owner"),
    profileTask(contributorProfileTaskId, "contributor"),
    agreementTask(randomUUID()),
    uploadTask(uploadTaskId),
  ]);
  const otherTemplateVersionId = await publishAndInstantiateTasks(otherFixture, [
    uploadTask(randomUUID()),
  ]);
  const taskInstances = await fixture.admin<
    Array<{ id: string; templateTaskId: string }>
  >`
    select id, template_task_id as "templateTaskId"
    from operations.onboarding_journey_tasks
    where organisation_id = ${fixture.organisationId}
      and journey_id = ${fixture.journeyId}
  `;
  const taskIdByTemplateTaskId = new Map(
    taskInstances.map((task) => [task.templateTaskId, task.id]),
  );
  const ownerProfileTaskInstanceId = taskIdByTemplateTaskId.get(
    ownerProfileTaskId,
  )!;
  const contributorProfileTaskInstanceId = taskIdByTemplateTaskId.get(
    contributorProfileTaskId,
  )!;
  const uploadTaskInstanceId = taskIdByTemplateTaskId.get(uploadTaskId)!;
  await fixture.sign(fixture.signingApproval, 0);
  await fixture.sign(fixture.signingApproval, 1);
  await fixture.sign(fixture.signingApproval, 2);
  assert.equal(
    await completeAgreementSigning(
      fixture.signingWorker,
      fixture.signingApproval.id,
      fixture.correlationId,
    ),
    true,
  );

  const workspace = await loadClientOnboardingWorkspace(
    fixture.portal,
    owner,
    fixture.organisationId,
    fixture.correlationId,
  );
  assert.equal(
    workspace.tasks.find((task) => task.kind === "agreement")?.state,
    "complete",
  );
  assert.equal(
    workspace.tasks.find((task) => task.id === uploadTaskInstanceId)?.action
      .type,
    "attach_cleared_documents",
  );
  assert.equal(workspace.requiredTasksComplete, false);

  await assert.rejects(
    completeClientProfile(
      fixture.portal,
      contributor,
      fixture.organisationId,
      {
        taskId: ownerProfileTaskInstanceId,
        expectedTemplateVersionId: templateVersionId,
        profile: { preferredName: "Contributor cannot complete owner work" },
      },
      fixture.correlationId,
    ),
    PortalAccessDenied,
  );
  await assert.rejects(
    completeClientProfile(
      fixture.portal,
      viewer,
      fixture.organisationId,
      {
        taskId: ownerProfileTaskInstanceId,
        expectedTemplateVersionId: templateVersionId,
        profile: { preferredName: "Viewer cannot update tasks" },
      },
      fixture.correlationId,
    ),
    PortalAccessDenied,
  );
  await assert.rejects(
    completeClientProfile(
      fixture.portal,
      owner,
      fixture.organisationId,
      {
        taskId: ownerProfileTaskInstanceId,
        expectedTemplateVersionId: randomUUID(),
        profile: { preferredName: "Stale template" },
      },
      fixture.correlationId,
    ),
    ClientOnboardingConflict,
  );

  await completeClientProfile(
    fixture.portal,
    owner,
    fixture.organisationId,
    {
      taskId: ownerProfileTaskInstanceId,
      expectedTemplateVersionId: templateVersionId,
      profile: {
        preferredName: "Alex Morgan",
        jobTitle: "Operations director",
        phone: "+44 20 7946 0958",
      },
    },
    fixture.correlationId,
  );
  await completeClientProfile(
    fixture.portal,
    contributor,
    fixture.organisationId,
    {
      taskId: contributorProfileTaskInstanceId,
      expectedTemplateVersionId: templateVersionId,
      profile: { preferredName: "Taylor Morgan" },
    },
    fixture.correlationId,
  );
  const [ownerMembership] = await fixture.admin<Array<{ role: string }>>`
    select role from operations.memberships
    where organisation_id = ${fixture.organisationId} and user_id = ${owner.userId}
  `;
  assert.equal(ownerMembership!.role, "owner");

  const project = await executeProjectCommand(
    fixture.founderDb,
    fixture.founder,
    fixture.organisationId,
    {
      action: "create",
      reviewReference: "portal-onboarding-project",
      metadata: {
        agreementId: fixture.record.id,
        title: "Website delivery",
        summary: "Client-safe delivery summary",
        outcome: "A useful public website",
        deliverables: ["Accessible website"],
        status: "planned",
        ownerDisplay: "FSS",
        targetDate: null,
        scheduleDependencies: ["Client assets"],
        scheduleEvidence: null,
        internalNotes: "Internal planning notes",
        internalEstimateMinutes: 120,
        visibility: "client",
      },
    },
    fixture.correlationId,
  );
  const clearedDocumentId = randomUUID();
  const quarantinedDocumentId = randomUUID();
  const documentMetadata = {
    kind: "file" as const,
    projectId: project.id,
    milestoneId: null,
    title: "Brand guide",
    visibility: "client" as const,
    expiresAt: null,
    filename: "brand-guide.pdf",
    mimeType: "application/pdf" as const,
    sizeBytes: 32,
  };
  await executeDocumentCommand(
    fixture.founderDb,
    fixture.founder,
    fixture.organisationId,
    {
      action: "create",
      documentId: clearedDocumentId,
      reviewReference: "cleared-brand-guide",
      metadata: {
        ...documentMetadata,
        contentHash: "a".repeat(64),
        scanStatus: "cleared",
        scanContentHash: "a".repeat(64),
        scanEvidence: "Recorded independent scan evidence.",
      },
    },
    fixture.correlationId,
  );
  await executeDocumentCommand(
    fixture.founderDb,
    fixture.founder,
    fixture.organisationId,
    {
      action: "create",
      documentId: quarantinedDocumentId,
      reviewReference: "quarantined-brand-guide",
      metadata: {
        ...documentMetadata,
        title: "Unverified brand guide",
        contentHash: "b".repeat(64),
        scanStatus: "quarantined",
        scanContentHash: null,
        scanEvidence: null,
      },
    },
    fixture.correlationId,
  );

  await assert.rejects(
    attachClearedDocumentToTask(
      fixture.portal,
      owner,
      fixture.organisationId,
      {
        taskId: uploadTaskInstanceId,
        expectedTemplateVersionId: templateVersionId,
        documentIds: [quarantinedDocumentId],
      },
      fixture.correlationId,
    ),
    PortalAccessDenied,
  );
  const [otherTask] = await otherFixture.admin<Array<{ id: string }>>`
    select id
    from operations.onboarding_journey_tasks
    where organisation_id = ${otherFixture.organisationId}
      and template_version_id = ${otherTemplateVersionId}
  `;
  await assert.rejects(
    attachClearedDocumentToTask(
      fixture.portal,
      owner,
      fixture.organisationId,
      {
        taskId: otherTask!.id,
        expectedTemplateVersionId: otherTemplateVersionId,
        documentIds: [clearedDocumentId],
      },
      fixture.correlationId,
    ),
    PortalAccessDenied,
  );
  const completion = await attachClearedDocumentToTask(
    fixture.portal,
    owner,
    fixture.organisationId,
    {
      taskId: uploadTaskInstanceId,
      expectedTemplateVersionId: templateVersionId,
      documentIds: [clearedDocumentId],
    },
    fixture.correlationId,
  );
  assert.deepEqual(completion, {
    taskId: uploadTaskInstanceId,
    state: "complete",
  });
  assert.equal(
    (
      await loadClientOnboardingWorkspace(
        fixture.portal,
        owner,
        fixture.organisationId,
        fixture.correlationId,
      )
    ).requiredTasksComplete,
    true,
  );
});
