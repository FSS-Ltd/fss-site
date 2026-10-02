import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { loadFounderOnboardingWorkspace } from "../../../lib/operations/onboarding/queries";
import { createDesignedWelcomePack } from "../../../lib/operations/onboarding/packet-editions";
import { withVerifiedPortalIdentity } from "../../../lib/operations/db/portal-client";
import { onboardingFixture } from "./onboarding-fixtures";

test("staff draft reader restores edited packet and reviewed facts without exposing editing state to clients", async (t) => {
  const f = await onboardingFixture(t, 1);
  const packet = createDesignedWelcomePack("website_build");
  packet.guide[1].paragraphs[0] = "Edited project details awaiting review.";
  packet.emailBody =
    "Hello {{contact_first_name}},\n\nYour edited project priorities are retained.";
  const templateId = randomUUID(),
    draftId = randomUUID(),
    packVersionId = randomUUID();
  const { recipient, invoice, content, thankYou } = f.prepared.snapshot;
  const state = {
    welcomeSubject: "Edited welcome subject",
    welcomeBody: "Edited welcome body",
    reviewedWelcome: { recipient, invoice, content, thankYou },
    composer: {
      packet,
      packVersionId,
      obligationKey: "installment:1",
      settingsRevision: 0,
    },
    expectedAgreementVersion: f.record.version,
    recipientRole: "owner",
  };
  await f.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${f.founder.actorId}, true)`;
    const [draft] = await tx<
      Array<{ draftVersion: number }>
    >`select draft_version as "draftVersion" from operations.save_onboarding_template_draft(${templateId},${f.organisationId},'Retained packet checklist',${tx.json({ tasks: packet.tasks })}::jsonb,0,'packet-restore-test')`;
    const [version] = await tx<
      Array<{ id: string }>
    >`select id from operations.publish_onboarding_template_version(${templateId},${draft.draftVersion},'packet-restore-test')`;
    const [contact] = await tx<
      Array<{ id: string }>
    >`select id from operations.contacts where organisation_id=${f.organisationId} and email=${f.identities[0].email}`;
    await tx`select operations.save_onboarding_journey_draft(${draftId},${f.organisationId},${f.record.id},${contact.id},${version.id},'content',${JSON.stringify(state)}::text::jsonb,0,'packet-restore-test')`;
  });
  const workspace = await loadFounderOnboardingWorkspace(
    f.founderDb,
    f.founder,
    f.organisationId,
  );
  const draft = workspace.journeyDrafts.find((row) => row.id === draftId);
  assert.ok(draft?.content);
  assert.equal(
    draft.content.composer?.packet.guide[1].paragraphs[0],
    "Edited project details awaiting review.",
  );
  assert.equal(draft.content.composer?.settingsRevision, 0);
  assert.equal(draft.content.reviewedWelcome?.recipient, recipient);
  assert.equal(draft.content.welcomeBody, "Edited welcome body");
  const [clientRow] = await withVerifiedPortalIdentity(
    f.portal,
    f.identities[0],
    f.correlationId,
    async (tx) => {
      await tx`select set_config('operations.organisation_id', ${f.organisationId}, true)`;
      return tx<
        Array<{
          workspace: { journeyDrafts: unknown[]; templateDrafts: unknown[] };
        }>
      >`select operations.read_onboarding_workspace(${f.organisationId}) as workspace`;
    },
  );
  assert.deepEqual(clientRow.workspace.journeyDrafts, []);
  assert.deepEqual(clientRow.workspace.templateDrafts, []);
});
