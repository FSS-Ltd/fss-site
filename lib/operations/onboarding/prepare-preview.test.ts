import assert from "node:assert/strict";
import test from "node:test";
import { agreementDraft } from "../agreements/fixtures";
import type { OperationsTransaction } from "../db/client";
import type { ActiveStudioSettings } from "../studio/active-settings-types";
import { JourneyConflict } from "./command-types";
import { journeyCommandSchema, type JourneyCommand } from "./command-schema";
import { welcomeFixtureInput } from "./fixtures";
import { createDesignedWelcomePack } from "./packet-editions";
import { prepareWelcomePreview } from "./prepare-preview";
import { runJourneyCommand } from "./commands";
import { envelope } from "./preview-envelope";
import { verifyPreview } from "./preview-token";

const organisationId = "73da6acb-e24f-4e2f-bd90-13d58634ad39";
const agreementId = "8921e3ee-c111-4ed6-85e7-a94dfc460dd1";
const packVersionId = "23c9f3cb-77f7-4c05-b859-f319c88b14a0";
const templateVersionId = "3021c49a-4eb9-430c-a80f-5d8434f071aa";
const contactId = "e94053c4-b1f1-4270-8c6b-4d9414e7b8a9";
const draftId = "5e0e3f99-f2e1-41af-9a4c-ddb563a6a3f2";
const actor = { actorId: "c".repeat(64) };
const settings: ActiveStudioSettings = {
  revision: 2,
  displayName: "FSS delivery",
  replyTo: "owner@example.test",
  timezone: "Europe/London",
  responseExpectationHours: 48,
  deliveryCapacity: "standard",
};
const options = {
  previewKey: Buffer.alloc(32, 2),
  portalOrigin: "https://portal.example.test",
  billing: { accountId: "acct_billingTest", livemode: false },
};
const now = Date.UTC(2026, 9, 1, 9);

function command(): Extract<JourneyCommand, { action: "preview_welcome" }> {
  const input = welcomeFixtureInput();
  const pack = createDesignedWelcomePack("website_build");
  const parsed = journeyCommandSchema.parse({
    action: "preview_welcome",
    agreementId,
    expectedVersion: 1,
    workspace: {
      draftId,
      expectedDraftVersion: 1,
      templateVersionId,
      contactId,
      recipientRole: "owner",
    },
    welcome: {
      ...input,
      content: {
        ...input.content,
        rendererVersion: 2,
        edition: "website_build",
        settingsRevision: 2,
        senderName: settings.displayName,
        replyTo: settings.replyTo,
        timezone: settings.timezone,
        responseExpectationHours: 48,
        welcomePackVersionId: packVersionId,
        pages: pack.guide,
      },
    },
  });
  if (parsed.action !== "preview_welcome")
    throw new Error("Expected welcome command.");
  return parsed;
}
function transaction(
  active: ActiveStudioSettings = settings,
  isCurrent: () => boolean = () => true,
  reviewedWelcomeMatches = true,
): OperationsTransaction {
  const packet = createDesignedWelcomePack("website_build");
  const query = Object.assign(
    async (parts: TemplateStringsArray) => {
      const sql = parts.join("?");
      if (sql.includes("from operations.agreements a join"))
        return [
          {
            id: agreementId,
            version: 1,
            status: "draft",
            draft: agreementDraft(),
          },
        ];
      if (sql.includes("studio_settings_active")) return [active];
      if (sql.includes("from operations.welcome_pack_versions"))
        return isCurrent()
          ? [{ packId: "website_build", content: packet }]
          : [];
      if (sql.includes("matches_reviewed_welcome_packet"))
        return [{ matches: reviewedWelcomeMatches }];
      if (sql.includes("from operations.contacts"))
        return [{ id: contactId, email: "signer0@example.test" }];
      if (sql.includes("read_onboarding_workspace"))
        return [
          {
            workspace: {
              templates: [
                {
                  id: templateVersionId,
                  templateId: "4c6dbb03-4211-42e4-8bd7-a38e204778e7",
                  version: 1,
                  name: "Approved packet checklist",
                  tasks: packet.tasks,
                  publishedAt: "2026-10-01T09:00:00Z",
                },
              ],
              templateDrafts: [],
              journeyDrafts: [
                {
                  id: draftId,
                  agreementId,
                  contactId,
                  templateVersionId,
                  stage: "content",
                  expectedAgreementVersion: 1,
                  recipientRole: "owner",
                  version: 1,
                  updatedAt: "2026-10-01T09:00:00Z",
                },
              ],
              tasks: [],
            },
          },
        ];
      return [];
    },
    { json: (value: unknown) => JSON.stringify(value) },
  );
  // The real preview preparation consumes deterministic rows without outbound effects.
  return query as unknown as OperationsTransaction;
}

test("a five-section packet cannot enter a Studio welcome preview", async () => {
  const modern = command();
  await assert.rejects(
    prepareWelcomePreview(
      transaction(),
      actor,
      organisationId,
      {
        ...modern,
        welcome: {
          ...modern.welcome,
          content: { ...modern.welcome.content, rendererVersion: undefined },
        },
      },
      options,
      now,
    ),
    (error) =>
      error instanceof JourneyConflict && error.code === "stale_preview",
  );
});

test("publishing a newer edition invalidates a previously prepared start token", async () => {
  let current = true;
  const tx = transaction(settings, () => current);
  const prepared = await prepareWelcomePreview(
    tx,
    actor,
    organisationId,
    command(),
    options,
    now,
  );
  assert.ok("preview" in prepared && prepared.preview.kind === "welcome");
  current = false;
  await assert.rejects(
    runJourneyCommand(
      tx,
      actor,
      organisationId,
      { action: "start", token: prepared.preview.token, confirmed: true },
      { ...options, now: () => now },
    ),
    (error) =>
      error instanceof JourneyConflict && error.code === "stale_preview",
  );
});

test("modern previews reject stale settings and mismatched resolved settings facts", async () => {
  for (const changed of [
    { revision: 3 },
    { displayName: "Other display name" },
    { replyTo: "changed@example.test" },
    { timezone: "UTC" },
    { responseExpectationHours: 24 },
  ]) {
    await assert.rejects(
      prepareWelcomePreview(
        transaction({ ...settings, ...changed }),
        actor,
        organisationId,
        command(),
        options,
        now,
      ),
      (error) =>
        error instanceof JourneyConflict && error.code === "stale_preview",
    );
  }
});

test("a packet without its reviewed checklist and welcome cannot be previewed", async () => {
  await assert.rejects(
    prepareWelcomePreview(
      transaction(settings, () => true, false),
      actor,
      organisationId,
      command(),
      options,
      now,
    ),
    (error) =>
      error instanceof JourneyConflict && error.code === "approval_conflict",
  );
});

test("approved preview freezes current settings and full modern packet into its signed envelope", async () => {
  const result = await prepareWelcomePreview(
    transaction(),
    actor,
    organisationId,
    command(),
    options,
    now,
  );
  assert.ok("preview" in result && result.preview.kind === "welcome");
  const frozen = envelope(
    verifyPreview(result.preview.token, options.previewKey),
    actor,
    organisationId,
    now,
  );
  assert.equal(frozen.kind, "welcome");
  if (frozen.kind !== "welcome") throw new Error("Expected welcome envelope.");
  assert.equal(frozen.snapshot.content.settingsRevision, 2);
  assert.equal(frozen.snapshot.content.senderName, "FSS delivery");
  assert.equal(frozen.snapshot.content.responseExpectationHours, 48);
  assert.equal(frozen.snapshot.content.welcomePackVersionId, packVersionId);
  assert.equal(frozen.snapshot.content.pages.length, 9);
  assert.equal(
    (
      Buffer.from(frozen.pdfBase64, "base64")
        .toString("latin1")
        .match(/\/Type \/Page\b/g) ?? []
    ).length,
    10,
  );
  assert.ok(
    result.preview.readiness.every((check) => check.status === "passed"),
  );
  await assert.rejects(
    prepareWelcomePreview(
      transaction({ ...settings, revision: 3 }),
      actor,
      organisationId,
      command(),
      options,
      now,
    ),
    (error) =>
      error instanceof JourneyConflict && error.code === "stale_preview",
  );
  assert.equal(frozen.snapshot.content.settingsRevision, 2);
});

test("preview errors preserve the exact overflowing section for staff correction", async () => {
  const input = command();
  input.welcome.content.pages[4].paragraphs = Array(8).fill(
    "Long content. ".repeat(120),
  );
  await assert.rejects(
    prepareWelcomePreview(
      transaction(),
      actor,
      organisationId,
      input,
      options,
      now,
    ),
    (error) =>
      error instanceof JourneyConflict &&
      error.code === "approval_conflict" &&
      /Packet section "timeline: Milestones and review points"/.test(
        error.message,
      ),
  );
});
