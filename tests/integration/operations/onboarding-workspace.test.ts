import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { withVerifiedPortalIdentity } from "../../../lib/operations/db/portal-client";
import { loadFounderOnboardingWorkspace } from "../../../lib/operations/onboarding/queries";
import type { OnboardingTaskDefinition } from "../../../lib/operations/onboarding/workspace-types";
import { onboardingFixture } from "./onboarding-fixtures";

const profileTask = (id: string): OnboardingTaskDefinition => ({
  id,
  title: "Confirm your details",
  instructions: "Check the contact details we will use for your project.",
  kind: "profile",
  ownerRole: "owner",
  required: true,
  dependsOnTaskId: null,
  dueRule: "activation",
  evidenceRule: "profile_saved",
  bookingUrl: null,
});

test("onboarding workspace keeps template versions tenant-scoped and immutable", async (t) => {
  const fixture = await onboardingFixture(t, 1);
  const otherFixture = await onboardingFixture(t, 1);
  const templateId = randomUUID();
  const invalidTemplateId = randomUUID();
  const firstTaskId = randomUUID();
  const secondTaskId = randomUUID();
  const saveTemplate = (
    tasks: readonly ReturnType<typeof profileTask>[],
    expectedVersion: number,
    id = templateId,
  ) =>
    fixture.founderDb.begin(async (tx) => {
      await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
      return tx<Array<{ id: string; draftVersion: number }>>`
        select id, draft_version as "draftVersion"
        from operations.save_onboarding_template_draft(
          ${id},
          ${fixture.organisationId},
          ${"Studio launch"},
          ${tx.json({ tasks })}::jsonb,
          ${expectedVersion},
          ${"onboarding-workspace-test"}
        )
      `;
    });
  const publish = (expectedVersion: number) =>
    fixture.founderDb.begin(async (tx) => {
      await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
      return tx<Array<{ id: string; version: number }>>`
        select id, version
        from operations.publish_onboarding_template_version(
          ${templateId},
          ${expectedVersion},
          ${"onboarding-workspace-test"}
        )
      `;
    });

  const invalidTask = profileTask(randomUUID());
  await assert.rejects(
    saveTemplate(
      [{ ...invalidTask, dependsOnTaskId: invalidTask.id }],
      0,
      invalidTemplateId,
    ),
    /dependency/i,
  );

  const [firstDraft] = await saveTemplate([profileTask(firstTaskId)], 0);
  assert.equal(firstDraft.draftVersion, 1);
  const [firstVersion] = await publish(firstDraft.draftVersion);
  assert.equal(firstVersion.version, 1);

  await fixture.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
    await tx`select operations.instantiate_onboarding_journey_tasks(${fixture.journeyId}, ${firstVersion.id})`;
  });

  const [secondDraft] = await saveTemplate(
    [profileTask(secondTaskId)],
    firstDraft.draftVersion,
  );
  const [secondVersion] = await publish(secondDraft.draftVersion);
  assert.equal(secondVersion.version, 2);

  const workspace = await loadFounderOnboardingWorkspace(
    fixture.founderDb,
    fixture.founder,
    fixture.organisationId,
  );
  assert.deepEqual(
    workspace.templateDrafts.map((template) => ({
      draftVersion: template.draftVersion,
      id: template.id,
      publishedVersion: template.publishedVersion,
    })),
    [
      {
        draftVersion: secondDraft.draftVersion,
        id: templateId,
        publishedVersion: secondVersion.version,
      },
    ],
  );
  assert.deepEqual(
    workspace.tasks.map((task) => task.templateVersionId),
    [firstVersion.id],
  );

  await assert.rejects(
    fixture.admin`update operations.onboarding_template_versions set content = ${JSON.stringify({ tasks: [] })}::jsonb where id = ${firstVersion.id}`,
    /immutable/i,
  );
  await assert.rejects(
    withVerifiedPortalIdentity(
      fixture.portal,
      fixture.identities[0],
      fixture.correlationId,
      async (tx) => {
        await tx`select set_config('operations.organisation_id', ${otherFixture.organisationId}, true)`;
        return tx`select * from operations.read_onboarding_workspace(${otherFixture.organisationId})`;
      },
    ),
    /access/i,
  );
  await assert.rejects(
    fixture.founderDb`insert into operations.onboarding_templates(id, organisation_id, title, draft_content, draft_version, created_by) values(${randomUUID()}, ${fixture.organisationId}, ${"Direct write"}, ${JSON.stringify({ tasks: [] })}::jsonb, 1, ${fixture.founder.actorId})`,
    /permission|row-level security/i,
  );
  await assert.rejects(
    fixture.portal`insert into operations.onboarding_templates(id, organisation_id, title, draft_content, draft_version, created_by) values(${randomUUID()}, ${fixture.organisationId}, ${"Direct write"}, ${JSON.stringify({ tasks: [] })}::jsonb, 1, ${fixture.founder.actorId})`,
    /permission|row-level security/i,
  );

  await fixture.admin`update operations.memberships set revoked_at = clock_timestamp() where organisation_id = ${fixture.organisationId} and user_id = ${fixture.identities[0].userId}`;
  await assert.rejects(
    withVerifiedPortalIdentity(
      fixture.portal,
      fixture.identities[0],
      fixture.correlationId,
      async (tx) => {
        await tx`select set_config('operations.organisation_id', ${fixture.organisationId}, true)`;
        return tx`select * from operations.read_onboarding_workspace(${fixture.organisationId})`;
      },
    ),
    /access/i,
  );
});
