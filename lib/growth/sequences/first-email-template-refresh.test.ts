import assert from "node:assert/strict";
import test from "node:test";

import type { StoredFirstEmailDraft } from "./first-email-draft-snapshot";
import {
  FirstEmailTemplateRefreshError,
  refreshFirstEmailTemplate,
} from "./first-email-template-refresh";

const optOutSentence = "Reply opt out if you prefer no further emails.";
const conceptDisclaimer =
  "Concept image for discussion only and not a finished design.";

function email() {
  const body = Array.from(
    { length: 145 },
    (_, index) => `draftword${index}`,
  ).join(" ");
  const text = [body, optOutSentence, conceptDisclaimer].join("\n\n");
  return {
    subject: "A better first website conversation",
    html: `<p>${body}</p><p>${optOutSentence}</p><p>${conceptDisclaimer}</p>`,
    text,
    wordCount: text.split(/\s+/).length,
    optOutSentence,
    conceptDisclaimer,
  };
}

function storedDraft(
  overrides: Partial<StoredFirstEmailDraft> = {},
): StoredFirstEmailDraft {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    prospectId: "22222222-2222-4222-8222-222222222222",
    status: "completed",
    completedAt: new Date("2026-09-05T08:00:00.000Z"),
    hasEnrollment: false,
    outputSnapshot: {
      schemaVersion: "1.0",
      email: email(),
      emailNarrative: {
        openingStrength: {
          text: "Clear service information gives local customers confidence.",
          evidenceSourceUrl: "https://example.test/services",
          kind: "first_party_service",
        },
        improvements: [
          {
            text: "Make the enquiry route clearer for new visitors.",
            evidenceSourceUrl: "https://example.test/services",
          },
          {
            text: "Collect the details needed for a useful first response.",
            evidenceSourceUrl: "https://example.test/services",
          },
        ],
      },
      visual: {
        kind: "fallback",
        fallbackAssetKey: "hospitality",
        pathname: "/growth/email/fallbacks/hospitality.webp",
        sha256: "a".repeat(64),
        altText: "Concept illustration for the reviewed prospect workflow.",
        conceptDisclaimer,
      },
    },
    ...overrides,
  };
}

test("refreshes an eligible draft with the current sector-example first email", () => {
  const result = refreshFirstEmailTemplate({
    draft: storedDraft(),
    sector: "Roofing",
    siteUrl: "https://faithfulsoftware.dev",
    previewUrl: "https://faithfulsoftware.dev/preview/example-business",
    refreshedAt: new Date("2026-09-05T09:00:00.000Z"),
  });

  assert.equal(result.status, "refreshed");
  if (result.status !== "refreshed") return;

  assert.equal(result.version, 2);
  const refreshedEmail = result.outputSnapshot.email as { text: string };
  assert.match(refreshedEmail.text, /I work with local service firms/);
  const latestRevision = (
    result.outputSnapshot.emailRevisions as Array<{
      source: string;
      editorActorId: string;
    }>
  ).at(-1);
  assert.equal(latestRevision?.source, "system");
  assert.equal(latestRevision?.editorActorId, "first-email-template-refresh");
});

test("does not alter an email that already uses the current template", () => {
  const first = refreshFirstEmailTemplate({
    draft: storedDraft(),
    previewUrl: "https://faithfulsoftware.dev/preview/example-business",
    refreshedAt: new Date("2026-09-05T09:00:00.000Z"),
  });
  assert.equal(first.status, "refreshed");
  if (first.status !== "refreshed") return;

  const second = refreshFirstEmailTemplate({
    draft: storedDraft({ outputSnapshot: first.outputSnapshot }),
    previewUrl: "https://faithfulsoftware.dev/preview/example-business",
    refreshedAt: new Date("2026-09-05T09:05:00.000Z"),
  });
  assert.deepEqual(second, { status: "unchanged" });
});

test("does not refresh enrolled or approved drafts", () => {
  assert.throws(
    () =>
      refreshFirstEmailTemplate({
        draft: storedDraft({ hasEnrollment: true }),
        previewUrl: "https://faithfulsoftware.dev/preview/example-business",
        refreshedAt: new Date("2026-09-05T09:00:00.000Z"),
      }),
    (error) => {
      assert.ok(error instanceof FirstEmailTemplateRefreshError);
      assert.equal(error.code, "not_refreshable");
      return true;
    },
  );

  assert.throws(
    () =>
      refreshFirstEmailTemplate({
        draft: storedDraft({
          outputSnapshot: {
            ...(storedDraft().outputSnapshot as Record<string, unknown>),
            reviewState: "approved",
          },
        }),
        previewUrl: "https://faithfulsoftware.dev/preview/example-business",
        refreshedAt: new Date("2026-09-05T09:00:00.000Z"),
      }),
    (error) => {
      assert.ok(error instanceof FirstEmailTemplateRefreshError);
      assert.equal(error.code, "not_refreshable");
      return true;
    },
  );
});

test("adds sector examples without requiring a bespoke preview and stays idempotent", () => {
  const input = {
    draft: storedDraft(),
    sector: "estate agency",
    siteUrl: "https://faithfulsoftware.dev",
    refreshedAt: new Date("2026-09-05T10:00:00Z"),
  };
  const result = refreshFirstEmailTemplate(input);
  assert.equal(result.status, "refreshed");
  if (result.status !== "refreshed") return;
  assert.match(
    (result.outputSnapshot.email as { text: string }).text,
    /\/examples\/hearth-and-acre/,
  );
  assert.deepEqual(
    refreshFirstEmailTemplate({
      ...input,
      draft: storedDraft({ outputSnapshot: result.outputSnapshot }),
    }),
    { status: "unchanged" },
  );
});

test("sector refresh preserves a published company concept link", () => {
  const result = refreshFirstEmailTemplate({
    draft: storedDraft(),
    sector: "roofing",
    siteUrl: "https://faithfulsoftware.dev",
    previewUrl: "https://faithfulsoftware.dev/preview/existing-roofer",
    refreshedAt: new Date("2026-09-05T10:00:00Z"),
  });
  assert.equal(result.status, "refreshed");
  if (result.status !== "refreshed") return;
  const text = (result.outputSnapshot.email as { text: string }).text;
  assert.match(text, /\/examples\/ridge-and-vale/);
  assert.match(text, /\/preview\/existing-roofer/);
});

test("sector refresh cannot change any enrolled prospect", () => {
  assert.throws(
    () =>
      refreshFirstEmailTemplate({
        draft: storedDraft({ hasEnrollment: true }),
        sector: "roofing",
        siteUrl: "https://faithfulsoftware.dev",
        refreshedAt: new Date(),
      }),
    (error: unknown) =>
      error instanceof FirstEmailTemplateRefreshError &&
      error.code === "not_refreshable",
  );
});

test("refreshes an older draft using its validated first-party assessment", () => {
  const draft = storedDraft();
  const snapshot = { ...(draft.outputSnapshot as Record<string, unknown>) };
  delete snapshot.emailNarrative;
  const result = refreshFirstEmailTemplate({
    draft: { ...draft, outputSnapshot: snapshot },
    sector: "roofing",
    siteUrl: "https://faithfulsoftware.dev",
    refreshedAt: new Date(),
    historicalAssessment: {
      trustSignals: {
        schemaVersion: "1.0",
        summary: "Clear service descriptions explain the work offered.",
        items: ["Service information"],
      },
      conversionPlan: {
        schemaVersion: "1.0",
        summary: "A useful enquiry route.",
        items: [
          "Make the survey request easy to find",
          "Collect the details needed before a callback",
        ],
      },
      firstPartyEvidenceUrl: "https://example.test/services",
    },
  });
  assert.equal(result.status, "refreshed");
  if (result.status !== "refreshed") return;
  assert.ok(result.outputSnapshot.emailNarrative);
  assert.match(
    (result.outputSnapshot.email as { text: string }).text,
    /ridge-and-vale/,
  );
});

test("does not reconstruct historical copy without first-party evidence", () => {
  const draft = storedDraft();
  const snapshot = { ...(draft.outputSnapshot as Record<string, unknown>) };
  delete snapshot.emailNarrative;
  assert.throws(
    () =>
      refreshFirstEmailTemplate({
        draft: { ...draft, outputSnapshot: snapshot },
        sector: "roofing",
        siteUrl: "https://faithfulsoftware.dev",
        refreshedAt: new Date(),
        historicalAssessment: {
          trustSignals: {},
          conversionPlan: {},
          firstPartyEvidenceUrl: null,
        },
      }),
    (error: unknown) =>
      error instanceof FirstEmailTemplateRefreshError &&
      error.code === "invalid_narrative",
  );
});

test("refresh resolves a broad sector using the business name and stays idempotent", () => {
  const input = {
    draft: storedDraft(),
    sector: "Retail",
    businessName: "Paperstone",
    siteUrl: "https://faithfulsoftware.dev",
    refreshedAt: new Date("2026-09-05T10:00:00Z"),
  };
  const result = refreshFirstEmailTemplate(input);
  assert.equal(result.status, "refreshed");
  if (result.status !== "refreshed") return;
  const email = result.outputSnapshot.email as { text: string };
  assert.match(email.text, /\/examples\/orbit-supply/);
  assert.match(email.text, /fictional companies/);
  assert.equal(
    (email.text.match(/https:\/\/faithfulsoftware.dev\/examples\//g) ?? [])
      .length,
    4,
  );
  assert.deepEqual(
    refreshFirstEmailTemplate({
      ...input,
      draft: storedDraft({ outputSnapshot: result.outputSnapshot }),
    }),
    { status: "unchanged" },
  );
});
