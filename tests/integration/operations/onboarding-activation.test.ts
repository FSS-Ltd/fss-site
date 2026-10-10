import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { onboardingFixture } from "./onboarding-fixtures";
import { approveJourneyProposal } from "../../../lib/operations/onboarding/repository";
import { executeStaffJourneyCommand } from "../../../lib/operations/onboarding/commands";
import { runOnboardingWorker } from "../../../lib/operations/onboarding/worker";
import { createDesignedWelcomePack } from "../../../lib/operations/onboarding/packet-editions";
import { resolveWelcomePack } from "../../../lib/operations/onboarding/welcome-personalisation";
import { withWelcomeAgreementCallouts } from "../../../lib/operations/onboarding/welcome-agreement-callouts";
import {
  executeStaffWelcomePackCommand,
  listStaffWelcomePacks,
} from "../../../lib/operations/onboarding/welcome-packs";
import {
  applyActiveStudioSettings,
  loadActiveStudioSettings,
} from "../../../lib/operations/studio/active-settings";
import type { FssAdminContext } from "../../../lib/operations/auth/staff-types";
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
  assert.match(ownerMessages[0].text, /https:\/\/example\.test\/activate/);
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

  const userId = randomUUID();
  const invitationId = randomUUID();
  const membershipId = randomUUID();
  const staff: FssAdminContext = {
    realm: "staff",
    role: "admin",
    actorId: f.founder.actorId,
    userId,
    membershipId,
    correlationId: f.correlationId,
  };
  await f.admin`insert into operations.pending_staff_invitations(
    id, name, email, state, claimed_user_id, completed_at, created_by,
    review_reference, correlation_id
  ) values (
    ${invitationId}, 'Activation test', ${`${userId}@example.test`},
    'completed', ${userId}, now(), ${staff.actorId},
    'onboarding-activation-test', ${staff.correlationId}
  )`;
  await f.admin`insert into operations.staff_memberships(id, invitation_id, user_id)
    values (${membershipId}, ${invitationId}, ${userId})`;
  const packId = "website_build";
  const designed = createDesignedWelcomePack(packId);
  const [pack] = await listStaffWelcomePacks(f.founderDb, staff);
  assert.ok(pack);
  const savedPack = await executeStaffWelcomePackCommand(f.founderDb, staff, {
    action: "save_draft",
    packId,
    content: designed,
    expectedVersion: pack.draftVersion,
    reviewReference: "onboarding-activation-test",
  });
  if (savedPack.kind !== "welcome_pack_draft")
    throw new Error("Expected a saved packet draft.");
  const published = await executeStaffWelcomePackCommand(f.founderDb, staff, {
    action: "publish",
    packId,
    expectedDraftVersion: savedPack.draftVersion,
    reviewReference: "onboarding-activation-test",
  });
  if (published.kind !== "welcome_pack_version")
    throw new Error("Expected a published packet version.");
  const templateId = randomUUID();
  const templateContent = { tasks: designed.tasks };
  await f.admin`insert into operations.onboarding_templates(
    id, organisation_id, title, draft_content, draft_version, published_version, created_by
  ) values (
    ${templateId}, ${f.organisationId}, ${pack.title}, ${f.admin.json(templateContent)},
    1, 1, ${f.founder.actorId}
  )`;
  const [templateVersion] = await f.admin<Array<{ id: string }>>`
    insert into operations.onboarding_template_versions(
      template_id, organisation_id, version, title, content, published_by,
      source_welcome_pack_version_id
    ) values (
      ${templateId}, ${f.organisationId}, 1, ${pack.title},
      ${f.admin.json(templateContent)}, ${f.founder.actorId}, ${published.id}
    ) returning id
  `;
  assert.ok(templateVersion);
  const currentSettings = await loadActiveStudioSettings(f.founderDb, staff);
  const settings = await applyActiveStudioSettings(
    f.founderDb,
    staff,
    {
      section: "communication",
      expectedRevision: currentSettings.revision,
      values: { replyTo: "owner@example.test", responseExpectationHours: 48 },
    },
    staff.correlationId,
    ["owner@example.test"],
  );
  t.after(async () => {
    const cleanup = postgres(
      requireOperationsTestDatabaseUrl(
        process.env.OPERATIONS_TEST_DATABASE_URL,
      ),
    );
    try {
      await cleanup`delete from operations.studio_settings_audit
        where revision = ${settings.revision} and actor_id = ${staff.actorId}`;
      await cleanup`delete from operations.studio_settings_active
        where revision = ${settings.revision} and applied_by = ${staff.actorId}`;
      await cleanup`delete from operations.staff_memberships where id = ${membershipId}`;
      await cleanup`delete from operations.pending_staff_invitations where id = ${invitationId}`;
    } finally {
      await cleanup.end();
    }
  });
  const personalised = resolveWelcomePack(
    designed,
    {
      client_name: "Activation client",
      contact_first_name: "Alex",
      agreement_goal: "A simpler request process",
      sender_name: settings.displayName,
    },
    settings.responseExpectationHours,
  );
  const reviewed = withWelcomeAgreementCallouts(personalised, {
    scopeSummary: "A reviewed request process",
    responsibilitiesSummary: "Nominate one reviewer and supply content",
  });

  const draftId = randomUUID();
  const { recipient, invoice, content } = f.prepared.snapshot;
  const welcome = {
    recipient,
    invoice,
    content: {
      ...content,
      rendererVersion: 2 as const,
      emailArtworkVersion: 1 as const,
      edition: packId,
      settingsRevision: settings.revision,
      timezone: settings.timezone,
      responseExpectationHours: settings.responseExpectationHours,
      senderName: settings.displayName,
      replyTo: settings.replyTo ?? "owner@example.test",
      welcomePackVersionId: published.id,
      emailSubject: personalised.emailSubject,
      emailBody: personalised.emailBody,
      pages: reviewed.guide,
    },
    thankYou: personalised.thankYou,
  };
  const draftContent = {
    welcomeSubject: "Welcome to the project",
    welcomeBody: "Your project workspace is ready.",
    reviewedWelcome: welcome,
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

  const previewWelcome = (expectedDraftVersion: number) =>
    executeStaffJourneyCommand(
      f.founderDb,
      staff,
      f.organisationId,
      {
        action: "preview_welcome",
        agreementId: f.record.id,
        expectedVersion: agreement.version,
        welcome,
        workspace: {
          draftId,
          expectedDraftVersion,
          templateVersionId: templateVersion.id,
          contactId: contact.id,
          recipientRole: "owner",
        },
      },
      journeyOptions,
    );

  const initialPreview = await previewWelcome(initialDraft.version);
  if (
    !("preview" in initialPreview) ||
    initialPreview.preview.kind !== "welcome"
  )
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
    executeStaffJourneyCommand(
      f.founderDb,
      staff,
      f.organisationId,
      {
        action: "start",
        token: initialPreview.preview.token,
        confirmed: true,
      },
      journeyOptions,
    ),
    /welcome setup changed/i,
  );
  const [beforeStart] = await f.admin<Array<{ count: number }>>`
    select count(*)::integer as count
    from operations.onboarding_journeys
    where organisation_id = ${f.organisationId}
  `;
  assert.equal(beforeStart?.count, 0);

  const refreshedPreview = await previewWelcome(revisedDraft.version);
  if (
    !("preview" in refreshedPreview) ||
    refreshedPreview.preview.kind !== "welcome"
  )
    throw new Error("Expected a refreshed welcome preview.");
  const start = {
    action: "start" as const,
    token: refreshedPreview.preview.token,
    confirmed: true as const,
  };
  const firstStart = await executeStaffJourneyCommand(
    f.founderDb,
    staff,
    f.organisationId,
    start,
    journeyOptions,
  );
  const secondStart = await executeStaffJourneyCommand(
    f.founderDb,
    staff,
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
    taskCount: designed.tasks.length,
  });
});
