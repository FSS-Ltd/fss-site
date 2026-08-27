import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthTransaction } from "../db/types";
import { insertCandidateDetails } from "./candidate-details";
import { createValidResearchRunFixture } from "./ingestion-schema.test-fixture";

test("stores the sourced email narrative with the first-email draft", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const candidate = createValidResearchRunFixture().prospects[0]!;

  await insertCandidateDetails(transaction, {
    runId: "11111111-1111-4111-8111-111111111111",
    candidateIndex: 0,
    candidate,
    inserted: {
      businessId: "22222222-2222-4222-8222-222222222222",
      contactId: "33333333-3333-4333-8333-333333333333",
      prospectId: "44444444-4444-4444-8444-444444444444",
    },
    visual: {
      kind: "fallback",
      fallbackAssetKey: "home-property",
      pathname: "/growth/email/fallbacks/home-property.png",
      sha256: "a".repeat(64),
      altText: "Concept showing a service enquiry moving into an organised call-back workflow.",
      conceptDisclaimer: candidate.visual.conceptDisclaimer,
    },
    externalRunId: "research-run-id",
    promptVersion: "weekday-research-v1",
  });

  const taskInsert = queries.find((query) =>
    query.text.includes("insert into growth.agent_tasks"),
  );
  const outputSnapshot = taskInsert?.values[3] as {
    emailNarrative?: unknown;
  };

  assert.deepEqual(outputSnapshot.emailNarrative, candidate.emailNarrative);
});

test("persists first-party preview evidence and its opaque experience brief", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const baseCandidate = createValidResearchRunFixture().prospects[0]!;
  const experienceBrief = {
    schemaVersion: "1.1" as const,
    hero: {
      statement:
        "Start your MOT, service or repair request with your registration.",
      supportingStatement:
        "Example Services can prepare the workshop conversation with the right vehicle details.",
      evidenceIds: ["00000000-0000-4000-8000-000000000001"],
    },
    journey: {
      title: "Get your vehicle ready for the workshop",
      primaryCta: "Start with your registration",
      completionMessage: "Your workshop request is ready to review.",
      steps: [
        {
          id: "vehicle",
          label: "Tell us about your vehicle",
          kind: "vehicle-registration" as const,
          control: "registration" as const,
          requiredFields: ["registration" as const],
          options: [],
        },
        {
          id: "review",
          label: "Review your request",
          kind: "review" as const,
          control: "review" as const,
          requiredFields: [],
          options: [],
        },
      ],
    },
    visual: {
      brandColors: ["#19374A"],
      colourEvidenceIds: ["00000000-0000-4000-8000-000000000002"],
      logoEvidenceId: null,
      logoAssetId: null,
      onSiteImageEvidenceId: null,
      onSiteImageAssetId: null,
      approvedHeroMediaAssetId: null,
    },
  };
  const candidate = {
    ...baseCandidate,
    brandEvidence: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        kind: "service-language" as const,
        sourceUrl: "https://example.test/services",
        evidenceText: "MOT, servicing and repairs for local drivers.",
        observedAt: "2026-08-17T05:25:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        kind: "brand-colours" as const,
        sourceUrl: "https://example.test",
        evidenceText: "#19374A",
        observedAt: "2026-08-17T05:25:00.000Z",
      },
    ],
    assessment: {
      ...baseCandidate.assessment,
      experienceBrief,
    },
  };

  await insertCandidateDetails(transaction, {
    runId: "11111111-1111-4111-8111-111111111111",
    candidateIndex: 0,
    candidate,
    inserted: {
      businessId: "22222222-2222-4222-8222-222222222222",
      contactId: "33333333-3333-4333-8333-333333333333",
      prospectId: "44444444-4444-4444-8444-444444444444",
    },
    visual: {
      kind: "fallback",
      fallbackAssetKey: "home-property",
      pathname: "/growth/email/fallbacks/home-property.png",
      sha256: "a".repeat(64),
      altText: "Concept showing a service enquiry moving into an organised call-back workflow.",
      conceptDisclaimer: candidate.visual.conceptDisclaimer,
    },
    externalRunId: "research-run-id",
    promptVersion: "weekday-research-v1",
  });

  const previewEvidenceInsert = queries.find((query) =>
    query.text.includes("insert into growth.prospect_preview_evidence"),
  );
  const assessmentInsert = queries.find((query) =>
    query.text.includes("insert into growth.website_assessments"),
  );

  assert.match(previewEvidenceInsert?.text ?? "", /source_url/);
  assert.deepEqual(previewEvidenceInsert?.values.slice(0, 6), [
    "00000000-0000-4000-8000-000000000001",
    "44444444-4444-4444-8444-444444444444",
    "11111111-1111-4111-8111-111111111111",
    "service_language",
    "https://example.test/services",
    "MOT, servicing and repairs for local drivers.",
  ]);
  assert.match(assessmentInsert?.text ?? "", /experience_brief/);
  assert.ok(assessmentInsert?.values.includes(experienceBrief));
});
