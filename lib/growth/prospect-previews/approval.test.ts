import assert from "node:assert/strict";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import type { StoredFirstEmailDraft } from "../sequences/first-email-draft-snapshot";
import {
  createProspectPreviewApprover,
  ProspectPreviewApprovalError,
  type ProspectPreviewApprovalRepository,
} from "./approval";

const PROSPECT_ID = "11111111-1111-4111-8111-111111111111";
const PREVIEW_ID = "22222222-2222-4222-8222-222222222222";
const DRAFT_ID = "33333333-3333-4333-8333-333333333333";
const founder: FounderSession = {
  email: "founder@example.test",
  actorId: "f".repeat(64),
};
const optOutSentence =
  "If you would rather not hear from me, reply and I will not contact you again.";
const conceptDisclaimer =
  "This is a private concept, not a connected live service.";
const COMPOSITION_DIGEST = "a".repeat(64);
const PREVIEW_SLUG = "marden-garage";

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

function createDraft(): StoredFirstEmailDraft {
  const text = [words(125), conceptDisclaimer, optOutSentence].join("\n\n");
  return {
    id: DRAFT_ID,
    prospectId: PROSPECT_ID,
    status: "completed",
    completedAt: new Date("2026-08-26T09:00:00.000Z"),
    hasEnrollment: false,
    outputSnapshot: {
      schemaVersion: "1.0",
      email: {
        subject: "Original prospect email",
        html: `<p>${words(125)}</p><p>${conceptDisclaimer}</p><p>${optOutSentence}</p>`,
        text,
        wordCount: text.split(/\s+/).length,
        optOutSentence,
        conceptDisclaimer,
      },
      emailNarrative: {
        openingStrength: {
          text: "the services page gives visitors a clear explanation of the work provided",
          evidenceSourceUrl: "https://example.test/services",
          kind: "first_party_service",
        },
        improvements: [
          {
            text: "the general enquiry route could collect the details needed before a call-back",
            evidenceSourceUrl: "https://example.test/services",
          },
          {
            text: "the next step could be clearer for visitors who need urgent help",
            evidenceSourceUrl: "https://example.test/services",
          },
        ],
      },
      visual: {
        kind: "fallback",
        fallbackAssetKey: "home-property",
        pathname: "/growth/email/fallbacks/home-property.webp",
        sha256: "a".repeat(64),
        altText: "Concept showing a service enquiry moving into an organised call-back workflow.",
        conceptDisclaimer,
      },
    },
  };
}

function createRepository(status = "ready_for_email_review") {
  const state = {
    prospect: { id: PROSPECT_ID, status, version: 3 },
    preview: {
      id: PREVIEW_ID,
      publicId: "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm",
      slug: PREVIEW_SLUG,
      compositionDigest: COMPOSITION_DIGEST,
      generationStatus: "merged_draft",
      status: "draft" as string,
      version: 1,
    },
    assessment: {
      status: "pending_review",
      trustSignals: {
        schemaVersion: "1.0",
        summary: "the services page explains the work the business provides",
        items: ["Service information"],
      },
      conversionPlan: {
        schemaVersion: "1.0",
        summary: "The enquiry route can collect the detail needed for a call-back.",
        items: ["Problem selector", "Preferred contact time"],
      },
      firstPartyEvidenceUrl: "https://example.test/services",
    },
    draft: createDraft(),
    savedSnapshots: [] as Array<Record<string, unknown>>,
    approvals: [] as Array<Record<string, unknown>>,
    audits: [] as Array<Record<string, unknown>>,
    gmailCalls: 0,
    sentMessages: 0,
  };
  const repository: ProspectPreviewApprovalRepository = {
    async withTransaction(_db, operation) {
      return operation({
        async lockApprovalState() {
          return {
            prospect: state.prospect,
            preview: state.preview,
            assessment: state.assessment,
            draft: state.draft,
          };
        },
        async publishPreviewAndSaveEmail(input) {
          state.preview = {
            ...state.preview,
            status: "published",
            version: state.preview.version + 1,
          };
          state.prospect = {
            ...state.prospect,
            version: state.prospect.version + 1,
          };
          state.savedSnapshots.push(input.outputSnapshot);
          state.approvals.push(input as Record<string, unknown>);
        },
        async appendApprovalAudit(input) {
          state.audits.push(input as Record<string, unknown>);
        },
      });
    },
  };
  return { repository, state };
}

function resolveCurrentComposition(prospectId: string) {
  return prospectId === PROSPECT_ID
    ? { prospectId: PROSPECT_ID, digest: COMPOSITION_DIGEST }
    : null;
}

function approvalInput() {
  return {
    prospectId: PROSPECT_ID,
    expectedProspectVersion: 3,
    expectedPreviewVersion: 1,
    founder,
    correlationId: "preview-approval-correlation-id",
  };
}

test("publishes a draft preview and revises only the stored first-email draft", async () => {
  const fake = createRepository();
  const approve = createProspectPreviewApprover({
    repository: fake.repository,
    now: () => new Date("2026-08-26T10:00:00.000Z"),
    siteUrl: "https://faithfulsoftware.dev",
    resolveComposition: resolveCurrentComposition,
  });

  const result = await approve({} as GrowthDb, approvalInput());

  assert.deepEqual(result, {
    prospectId: PROSPECT_ID,
    publicId: "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm",
    status: "published",
    emailDraftVersion: 2,
  });
  assert.match(
    String((fake.state.savedSnapshots[0]?.email as { text?: unknown }).text),
    /I didn’t want to just list off concerns/i,
  );
  assert.match(
    String((fake.state.savedSnapshots[0]?.email as { text?: unknown }).text),
    /https:\/\/faithfulsoftware\.dev\/preview\/marden-garage/,
  );
  assert.equal(fake.state.gmailCalls, 0);
  assert.equal(fake.state.sentMessages, 0);
  assert.equal(fake.state.approvals.length, 1);
  assert.equal(fake.state.audits.length, 1);
});

test("derives a historical narrative at approval without changing the original draft first", async () => {
  const fake = createRepository();
  delete (fake.state.draft.outputSnapshot as { emailNarrative?: unknown })
    .emailNarrative;
  const originalSnapshot = structuredClone(
    fake.state.draft.outputSnapshot,
  ) as Record<string, unknown>;
  const approve = createProspectPreviewApprover({
    repository: fake.repository,
    now: () => new Date("2026-08-26T10:00:00.000Z"),
    siteUrl: "https://faithfulsoftware.dev",
    resolveComposition: resolveCurrentComposition,
  });

  await approve({} as GrowthDb, approvalInput());

  assert.equal(
    "emailNarrative" in originalSnapshot,
    false,
    "the backfill path must not mutate the stored draft before approval",
  );
  assert.match(
    String((fake.state.savedSnapshots[0]?.email as { text?: unknown }).text),
    /services page explains the work/i,
  );
});

test("rejects a terminal prospect without publishing a preview URL", async () => {
  const fake = createRepository("suppressed");
  const approve = createProspectPreviewApprover({
    repository: fake.repository,
    siteUrl: "https://faithfulsoftware.dev",
    resolveComposition: resolveCurrentComposition,
  });

  await assert.rejects(
    approve({} as GrowthDb, approvalInput()),
    (error: unknown) =>
      error instanceof ProspectPreviewApprovalError &&
      error.code === "not_publishable",
  );
  assert.equal(fake.state.approvals.length, 0);
});

test("rejects a generic draft when its merged composition is absent or stale", async () => {
  const fake = createRepository();
  const approve = createProspectPreviewApprover({
    repository: fake.repository,
    siteUrl: "https://faithfulsoftware.dev",
    resolveComposition: () => null,
  });

  await assert.rejects(
    approve({} as GrowthDb, approvalInput()),
    (error: unknown) =>
      error instanceof ProspectPreviewApprovalError &&
      error.code === "not_publishable",
  );
  assert.equal(fake.state.approvals.length, 0);
  assert.equal(fake.state.gmailCalls, 0);
  assert.equal(fake.state.sentMessages, 0);
});
