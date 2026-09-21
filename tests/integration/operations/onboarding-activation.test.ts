import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { onboardingFixture } from "./onboarding-fixtures";
import { approveJourneyProposal } from "../../../lib/operations/onboarding/repository";
import { executeJourneyCommand } from "../../../lib/operations/onboarding/commands";
import { runOnboardingWorker } from "../../../lib/operations/onboarding/worker";
import {
  createOnboardingAccessProvider,
  resolveOnboardingAccess,
} from "../../../lib/operations/onboarding/access-provider";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";
import type {
  OnboardingEffects,
  OnboardingStep,
} from "../../../lib/operations/onboarding/types";

const journeyOptions = {
  billing: { accountId: "acct_billingTest", livemode: false },
  previewKey: Buffer.alloc(32, 9),
  portalOrigin: "https://example.test",
};

test("separate signer, billing recipient and owner receive exactly their approved messages", async (t) => {
  const billing = "billing-recipient@example.test",
    owner = "client-owner@example.test";
  const f = await onboardingFixture(t, 1, {
    welcomeRecipient: billing,
    accessContacts: [
      { email: billing, role: "billing_contact" },
      { email: owner, role: "owner" },
    ],
  });
  const key = Buffer.alloc(32, 8),
    origin = "https://example.test";
  const access = createOnboardingAccessProvider(
    f.worker,
    key,
    origin,
    async () => {},
  );
  const messages: {
    recipient: string;
    step: OnboardingStep;
    key: string;
    text: string;
    html: string;
    accepted: boolean;
  }[] = [];
  let ownerAttempts = 0;
  const effects: OnboardingEffects = {
    ensureProposalAccess: access,
    ensureInvitation: access,
    createInvoice: async () => ({
      status: "succeeded",
      receipt: {
        providerId: "invoice",
        acceptedAt: new Date().toISOString(),
        url: "https://example.test/portal/billing",
      },
    }),
    async sendEmail({ lease, email }) {
      const resolved =
        lease.step === "welcome"
          ? email
          : await resolveOnboardingAccess(f.worker, lease, email, key, origin);
      const accepted = lease.recipient !== owner || ++ownerAttempts > 1;
      messages.push({
        recipient: lease.recipient,
        step: lease.step,
        key: lease.idempotencyKey,
        text: resolved.text,
        html: resolved.html,
        accepted,
      });
      if (!accepted)
        return {
          status: "failed",
          code: "transport",
          uncertain: false,
          retryable: true,
        };
      return {
        status: "succeeded",
        receipt: {
          providerId: `${lease.step}:${lease.recipient}`,
          acceptedAt: new Date(
            Date.now() - (lease.step === "welcome" ? 3 * 3600000 : 0),
          ).toISOString(),
        },
      };
    },
  };
  await runOnboardingWorker(f.store, effects);
  await assert.rejects(
    approveJourneyProposal(f.founderDb, f.founder, f.journeyId, {
      ...f.proposal,
      activationEmails: [],
    }),
    /Current signing approval/,
  );
  await f.approve();
  for (let i = 0; i < 3; i++)
    await runOnboardingWorker(f.store, effects, {
      now: () => new Date(Date.now() + 1000),
    });
  assert.deepEqual(
    messages.filter((m) => m.step === "proposal").map((m) => m.recipient),
    [f.identities[0].email],
  );
  await f.sign(f.signingApproval);
  await completeAgreementSigning(
    f.signingWorker,
    f.signingApproval.id,
    f.correlationId,
  );
  for (let i = 0; i < 4; i++)
    await runOnboardingWorker(f.store, effects, {
      now: () => new Date(Date.now() + 2 * 86400000),
    });
  assert.equal(
    messages.filter((m) => m.recipient === owner).length,
    1,
    "The additional approved owner needs a separate activation message.",
  );
  const [pending] = await f.admin<
    { state: string }[]
  >`select state from operations.onboarding_journeys where id=${f.journeyId}`;
  assert.equal(
    pending.state,
    "active",
    "Pending owner delivery must remain visible even after billing thanks succeeds.",
  );
  assert.equal(
    messages.filter(
      (m) => m.recipient === billing && m.step === "thank_you" && m.accepted,
    ).length,
    1,
  );
  await f.admin`update operations.onboarding_jobs set next_attempt_at=now() where journey_id=${f.journeyId} and step='activation'`;
  await runOnboardingWorker(f.store, effects, {
    now: () => new Date(Date.now() + 2 * 86400000),
  });
  await runOnboardingWorker(f.store, effects, {
    now: () => new Date(Date.now() + 2 * 86400000),
  });
  const ownerMessages = messages.filter((m) => m.recipient === owner);
  assert.equal(ownerMessages.length, 2);
  assert.equal(ownerMessages.filter((m) => m.accepted).length, 1);
  assert.equal(ownerMessages[0].key, ownerMessages[1].key);
  assert.equal(ownerMessages[0].html, ownerMessages[1].html);
  assert.equal(ownerMessages[0].text, ownerMessages[1].text);
  assert.match(
    ownerMessages[0].text,
    /https:\/\/example\.test\/activate/,
  );
  assert.doesNotMatch(ownerMessages[0].text, /#invite=/);
  assert.doesNotMatch(ownerMessages[0].text, /proposal|sign it/i);
  assert.equal(messages.filter((m) => m.step === "proposal").length, 1);
  const [completed] = await f.admin<
    { state: string }[]
  >`select state from operations.onboarding_journeys where id=${f.journeyId}`;
  assert.equal(completed.state, "completed");
});

test("activation instantiates the reviewed workspace snapshot and rejects a revised draft", async (t) => {
  const f = await onboardingFixture(t, 1);
  await f.admin`delete from operations.onboarding_jobs where journey_id=${f.journeyId}`;
  await f.admin`delete from operations.onboarding_journeys where id=${f.journeyId}`;
  await f.admin`delete from operations.onboarding_approvals where id=${f.approvalId}`;

  const [agreement] = await f.admin<Array<{ version: number }>>`
    select version
    from operations.agreements
    where id = ${f.record.id}
  `;
  const [contact] = await f.admin<Array<{ id: string }>>`
    select id
    from operations.contacts
    where organisation_id = ${f.organisationId}
      and email = ${f.identities[0].email}
  `;
  assert.ok(agreement);
  assert.ok(contact);

  const templateId = randomUUID();
  const taskId = randomUUID();
  const templateContent = {
    tasks: [
      {
        id: taskId,
        title: "Confirm project contact",
        instructions: "Confirm the details for the project delivery team.",
        kind: "profile",
        ownerRole: "owner",
        required: true,
        dependsOnTaskId: null,
        dueRule: "activation",
        evidenceRule: "profile_saved",
        bookingUrl: null,
      },
    ],
  };
  const [templateDraft] = await f.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${f.founder.actorId}, true)`;
    return tx<Array<{ id: string; draftVersion: number }>>`
      select id, draft_version as "draftVersion"
      from operations.save_onboarding_template_draft(
        ${templateId},
        ${f.organisationId},
        ${"Activation workspace"},
        ${tx.json(templateContent)}::jsonb,
        ${0},
        ${"onboarding-activation-test"}
      )
    `;
  });
  assert.ok(templateDraft);
  const [templateVersion] = await f.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${f.founder.actorId}, true)`;
    return tx<Array<{ id: string }>>`
      select id
      from operations.publish_onboarding_template_version(
        ${templateId},
        ${templateDraft.draftVersion},
        ${"onboarding-activation-test"}
      )
    `;
  });
  assert.ok(templateVersion);

  const draftId = randomUUID();
  const draftContent = {
    welcomeSubject: "Welcome to the project",
    welcomeBody: "Your project workspace is ready.",
    expectedAgreementVersion: agreement.version,
    recipientRole: "owner",
  };
  const saveDraft = (expectedVersion: number, content = draftContent) =>
    f.founderDb.begin(async (tx) => {
      await tx`select set_config('operations.actor_id', ${f.founder.actorId}, true)`;
      return tx<Array<{ id: string; version: number }>>`
        select id, version
        from operations.save_onboarding_journey_draft(
          ${draftId},
          ${f.organisationId},
          ${f.record.id},
          ${contact.id},
          ${templateVersion.id},
          ${"activate"},
          ${tx.json(content)}::jsonb,
          ${expectedVersion},
          ${"onboarding-activation-test"}
        )
      `;
    });
  const [initialDraft] = await saveDraft(0);
  assert.ok(initialDraft);

  const { recipient, invoice, content, thankYou } = f.prepared.snapshot;
  const previewWelcome = (expectedDraftVersion: number) =>
    executeJourneyCommand(f.founderDb, f.founder, f.organisationId, {
      action: "preview_welcome",
      agreementId: f.record.id,
      expectedVersion: agreement.version,
      welcome: { recipient, invoice, content, thankYou },
      workspace: {
        draftId,
        expectedDraftVersion,
        templateVersionId: templateVersion.id,
        contactId: contact.id,
        recipientRole: "owner",
      },
    }, journeyOptions);

  const initialPreview = await previewWelcome(initialDraft.version);
  if (!("preview" in initialPreview) || initialPreview.preview.kind !== "welcome")
    throw new Error("Expected a welcome preview.");
  assert.equal(
    initialPreview.preview.readiness.every(
      (check) => check.status === "passed",
    ),
    true,
  );

  const [revisedDraft] = await saveDraft(initialDraft.version, {
    ...draftContent,
    welcomeBody: "The reviewed onboarding workspace has changed.",
  });
  assert.ok(revisedDraft);
  await assert.rejects(
    executeJourneyCommand(f.founderDb, f.founder, f.organisationId, {
      action: "start",
      token: initialPreview.preview.token,
      confirmed: true,
    }, journeyOptions),
    /welcome setup changed/i,
  );
  const [beforeStart] = await f.admin<Array<{ count: number }>>`
    select count(*)::integer as count
    from operations.onboarding_journeys
    where organisation_id = ${f.organisationId}
  `;
  assert.equal(beforeStart?.count, 0);

  const refreshedPreview = await previewWelcome(revisedDraft.version);
  if (!("preview" in refreshedPreview) || refreshedPreview.preview.kind !== "welcome")
    throw new Error("Expected a refreshed welcome preview.");
  const start = {
    action: "start" as const,
    token: refreshedPreview.preview.token,
    confirmed: true as const,
  };
  const firstStart = await executeJourneyCommand(
    f.founderDb,
    f.founder,
    f.organisationId,
    start,
    journeyOptions,
  );
  const secondStart = await executeJourneyCommand(
    f.founderDb,
    f.founder,
    f.organisationId,
    start,
    journeyOptions,
  );
  assert.deepEqual(firstStart, secondStart);

  const [snapshot] = await f.admin<
    Array<{
      workspaceDraftId: string;
      templateVersionId: string;
      taskCount: number;
    }>
  >`
    select
      j.onboarding_workspace_draft_id as "workspaceDraftId",
      j.onboarding_template_version_id as "templateVersionId",
      (
        select count(*)::integer
        from operations.onboarding_journey_tasks task
        where task.journey_id = j.id
      ) as "taskCount"
    from operations.onboarding_journeys j
    where j.organisation_id = ${f.organisationId}
  `;
  assert.deepEqual(snapshot, {
    workspaceDraftId: draftId,
    templateVersionId: templateVersion.id,
    taskCount: 1,
  });
});
