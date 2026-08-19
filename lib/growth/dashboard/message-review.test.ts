import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import { EMAIL_ASSET_FALLBACKS } from "../email/assets/fallbacks";
import { getMessageReview } from "./message-review";

const draftTaskId = "11111111-1111-4111-8111-111111111111";
const prospectId = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";
const siteOrigin = "https://faithfulsoftwaresolutions.co.uk";
const founderEmail = "j.ntagengwa@faithfulsoftware.dev";

const emailWords = Array.from({ length: 140 }, (_, index) => `word${index + 1}`).join(
  " ",
);
const optOutSentence = "Reply opt out and I will send no further emails.";
const conceptDisclaimer =
  "This visual is a concept for discussion, not an existing system.";
const emailText = `${emailWords}\n\n${conceptDisclaimer}\n\n${optOutSentence}`;

const firstEmail = {
  subject: "A practical enquiry idea for Example Services",
  html: `<p>${emailWords}</p><p>${conceptDisclaimer}</p><p>${optOutSentence}</p>`,
  text: emailText,
  wordCount: emailText.trim().split(/\s+/).length,
  optOutSentence,
  conceptDisclaimer,
};

const fallback = EMAIL_ASSET_FALLBACKS["home-property"];

function fallbackVisualSnapshot() {
  return {
    kind: "fallback" as const,
    fallbackAssetKey: fallback.key,
    pathname: fallback.pathname,
    sha256: fallback.sha256,
    altText:
      "Concept showing a service enquiry moving into an organised call-back workflow.",
    conceptDisclaimer,
  };
}

function storedVisualSnapshot() {
  return {
    kind: "stored" as const,
    assetId,
    altText:
      "Concept showing a service enquiry moving into an organised call-back workflow.",
    conceptDisclaimer,
  };
}

function baseDraftRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: draftTaskId,
    prospectId,
    status: "completed",
    outputSnapshot: {
      schemaVersion: "1.0",
      email: firstEmail,
      visual: fallbackVisualSnapshot(),
      reviewState: "draft",
    },
    completedAt: new Date("2026-08-15T06:18:00.000Z"),
    businessName: "Example Services Limited",
    websiteUrl: "https://example.test",
    prospectVersion: 2,
    fitScore: 91,
    recommendedOffer: "Website and enquiry workflow",
    estimatedOneOffMinPence: 450_000,
    estimatedOneOffMaxPence: 650_000,
    contactFirstName: "Alex",
    contactLastName: "Morgan",
    contactEmail: "alex@example.test",
    normalisedEmail: "alex@example.test",
    subscriberType: "corporate",
    corporateStatus: "active",
    ...overrides,
  };
}

type FakeRoute = { match: RegExp; rows: readonly object[] };

function createFakeGrowthDb(routes: readonly FakeRoute[]): GrowthQueryExecutor {
  const query = async (strings: TemplateStringsArray) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    const route = routes.find(({ match }) => match.test(text));
    if (!route) throw new Error(`No fake route matched query: ${text}`);
    return route.rows;
  };

  return query as unknown as GrowthQueryExecutor;
}

function routesFor(overrides: {
  draft?: readonly object[];
  hasEnrollment?: boolean;
  suppressed?: boolean;
  asset?: readonly object[];
  citations?: readonly object[];
}): FakeRoute[] {
  return [
    { match: /"businessName"/, rows: overrides.draft ?? [baseDraftRow()] },
    {
      match: /from growth\.sequence_enrollments/,
      rows: [{ exists: overrides.hasEnrollment ?? false }],
    },
    {
      match: /from growth\.suppressions/,
      rows: [{ exists: overrides.suppressed ?? false }],
    },
    { match: /"reviewStatus"/, rows: overrides.asset ?? [] },
    {
      match: /"claimSummary"/,
      rows: overrides.citations ?? [
        {
          id: "e1",
          sourceType: "companies_house",
          sourceUrl:
            "https://find-and-update.company-information.service.gov.uk/company/12345678",
          claimSummary: "Active limited company.",
          verifiedAt: "2026-08-15T05:20:00.000Z",
        },
      ],
    },
  ];
}

test("returns a complete review for a fallback-visual draft: subject, recipient, sender, copy, image, disclaimer, citations, legal basis", async () => {
  const db = createFakeGrowthDb(routesFor({}));

  const result = await getMessageReview(
    draftTaskId,
    founderEmail,
    siteOrigin,
    db,
  );

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.equal(result.data.subject, firstEmail.subject);
  assert.equal(result.data.contactEmail, "alex@example.test");
  assert.equal(result.data.contactName, "Alex Morgan");
  assert.equal(result.data.founderEmail, founderEmail);
  assert.ok(result.data.wordCount >= 140 && result.data.wordCount <= 220);
  assert.match(result.data.previewHtml, /<img[^>]+alt="/);
  assert.match(result.data.previewText, new RegExp(optOutSentence));
  assert.match(result.data.previewHtml, new RegExp(conceptDisclaimer));
  assert.deepEqual(result.data.editableParagraphs, [
    emailWords,
    conceptDisclaimer,
    optOutSentence,
  ]);
  assert.equal(result.data.citations.length, 1);
  assert.equal(result.data.citations[0]?.sourceType, "companies_house");
  assert.equal(result.data.visualKind, "fallback");
  assert.equal(result.data.eligibility.ready, true);
});

test("resolves a stored (approved) visual asset from the database", async () => {
  const db = createFakeGrowthDb(
    routesFor({
      draft: [
        baseDraftRow({
          outputSnapshot: {
            schemaVersion: "1.0",
            email: firstEmail,
            visual: storedVisualSnapshot(),
            reviewState: "draft",
          },
        }),
      ],
      asset: [
        {
          url: `https://blob.example.public.blob.vercel-storage.com/growth-email-assets/${assetId}.webp`,
          width: 1200,
          height: 630,
          byteSize: 120_000,
          altText: storedVisualSnapshot().altText,
          reviewStatus: "approved",
        },
      ],
    }),
  );

  const result = await getMessageReview(draftTaskId, founderEmail, siteOrigin, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.data.visualKind, "stored");
  assert.equal(result.data.visualReviewStatus, "approved");
  assert.equal(result.data.imageByteSize, 120_000);
  assert.equal(result.data.eligibility.ready, true);
});

test("blocks approval and explains why for a suppressed contact", async () => {
  const db = createFakeGrowthDb(routesFor({ suppressed: true }));
  const result = await getMessageReview(draftTaskId, founderEmail, siteOrigin, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.data.eligibility.ready, false);
  assert.ok(result.data.eligibility.reasons.some((r) => /suppressed/.test(r)));
});

test("blocks approval and explains why for a non-corporate or inactive contact", async () => {
  const db = createFakeGrowthDb(
    routesFor({ draft: [baseDraftRow({ corporateStatus: "inactive" })] }),
  );
  const result = await getMessageReview(draftTaskId, founderEmail, siteOrigin, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.data.eligibility.ready, false);
  assert.ok(
    result.data.eligibility.reasons.some((r) => /corporate subscriber/.test(r)),
  );
});

test("blocks approval and explains why for an unapproved stored visual", async () => {
  const db = createFakeGrowthDb(
    routesFor({
      draft: [
        baseDraftRow({
          outputSnapshot: {
            schemaVersion: "1.0",
            email: firstEmail,
            visual: storedVisualSnapshot(),
            reviewState: "draft",
          },
        }),
      ],
      asset: [
        {
          url: `https://blob.example.public.blob.vercel-storage.com/growth-email-assets/${assetId}.webp`,
          width: 1200,
          height: 630,
          byteSize: 120_000,
          altText: storedVisualSnapshot().altText,
          reviewStatus: "pending",
        },
      ],
    }),
  );

  const result = await getMessageReview(draftTaskId, founderEmail, siteOrigin, db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.data.eligibility.ready, false);
  assert.ok(result.data.eligibility.reasons.some((r) => /not been approved/.test(r)));
});

test("reports unavailable when the referenced visual asset is missing", async () => {
  const db = createFakeGrowthDb(
    routesFor({
      draft: [
        baseDraftRow({
          outputSnapshot: {
            schemaVersion: "1.0",
            email: firstEmail,
            visual: storedVisualSnapshot(),
            reviewState: "draft",
          },
        }),
      ],
      asset: [],
    }),
  );

  const result = await getMessageReview(draftTaskId, founderEmail, siteOrigin, db);
  assert.equal(result.status, "unavailable");
  if (result.status !== "unavailable") return;
  assert.match(result.reason, /missing/);
});

test("reports unavailable when the stored draft fails safety validation", async () => {
  const db = createFakeGrowthDb(
    routesFor({
      draft: [
        baseDraftRow({
          outputSnapshot: {
            schemaVersion: "1.0",
            email: { ...firstEmail, wordCount: 5 },
            visual: fallbackVisualSnapshot(),
            reviewState: "draft",
          },
        }),
      ],
    }),
  );

  const result = await getMessageReview(draftTaskId, founderEmail, siteOrigin, db);
  assert.equal(result.status, "unavailable");
});

test("reports unavailable once the draft has already been approved or sent", async () => {
  const alreadyEnrolled = createFakeGrowthDb(
    routesFor({ hasEnrollment: true }),
  );
  const enrolledResult = await getMessageReview(
    draftTaskId,
    founderEmail,
    siteOrigin,
    alreadyEnrolled,
  );
  assert.equal(enrolledResult.status, "unavailable");

  const alreadyApproved = createFakeGrowthDb(
    routesFor({
      draft: [
        baseDraftRow({
          outputSnapshot: {
            schemaVersion: "1.0",
            email: firstEmail,
            visual: fallbackVisualSnapshot(),
            reviewState: "approved",
          },
        }),
      ],
    }),
  );
  const approvedResult = await getMessageReview(
    draftTaskId,
    founderEmail,
    siteOrigin,
    alreadyApproved,
  );
  assert.equal(approvedResult.status, "unavailable");
});

test("rejects a malformed draft ID without querying the database", async () => {
  const db = createFakeGrowthDb([]);
  const result = await getMessageReview("not-a-uuid", founderEmail, siteOrigin, db);
  assert.deepEqual(result, {
    status: "unavailable",
    reason: "This draft could not be found.",
  });
});

test("reports unavailable for a missing draft", async () => {
  const db = createFakeGrowthDb(routesFor({ draft: [] }));
  const result = await getMessageReview(draftTaskId, founderEmail, siteOrigin, db);
  assert.deepEqual(result, {
    status: "unavailable",
    reason: "This draft could not be found.",
  });
});

test("fails safe with a correlation ID when a query throws", async () => {
  const db = (async () => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const result = await getMessageReview(
    draftTaskId,
    founderEmail,
    siteOrigin,
    db,
    () => "test-correlation-id",
  );

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.correlationId, "test-correlation-id");
  assert.doesNotMatch(result.message, /connection refused/);
});
