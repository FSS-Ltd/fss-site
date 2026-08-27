import assert from "node:assert/strict";
import test from "node:test";

import {
  createDraftPreviewSnapshot,
  deriveHistoricalEmailNarrative,
  renderPreviewFirstEmail,
} from "./content";
import { createValidResearchRunFixture } from "../research/ingestion-schema.test-fixture";

const narrative = {
  openingStrength: {
    text: "the services page gives visitors a clear explanation of the work provided",
    evidenceSourceUrl: "https://example.test/services",
    kind: "first_party_service" as const,
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
};

test("creates a public preview snapshot without contact or evidence data", () => {
  const candidate = createValidResearchRunFixture().prospects[0]!;

  const snapshot = createDraftPreviewSnapshot(candidate);

  assert.equal(snapshot.businessName, "Example Services");
  assert.equal(snapshot.primaryCta, "Request a call-back");
  assert.equal("contact" in snapshot, false);
  assert.equal("evidence" in snapshot, false);
});

test("keeps only opaque evidence references when creating an evidence-backed draft", () => {
  const baseCandidate = createValidResearchRunFixture().prospects[0]!;
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
      experienceBrief: {
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
      },
    },
  };

  const snapshot = createDraftPreviewSnapshot(candidate);

  assert.equal(snapshot.schemaVersion, "1.1");
  if (snapshot.schemaVersion === "1.1") {
    assert.equal(snapshot.experienceBrief.visual.logoAssetId, null);
    assert.equal(snapshot.experienceBrief.hero.evidenceIds[0], "00000000-0000-4000-8000-000000000001");
  }
  assert.equal(JSON.stringify(snapshot).includes("https://example.test"), false);
});

test("renders a compliant first email with the source-backed narrative and preview URL", () => {
  const email = renderPreviewFirstEmail({
    subject: "A clearer first enquiry journey for Example Heating",
    narrative,
    previewUrl: "https://faithfulsoftware.dev/preview/p/opaque-public-id",
    optOutSentence:
      "If you would rather not hear from me, reply and I will not contact you again.",
    conceptDisclaimer:
      "This is a private concept, not a connected live service.",
  });

  assert.match(email.text, /One thing that came through clearly/i);
  assert.match(email.text, /A few parts of the current journey could be clearer/i);
  assert.match(email.text, /I didn’t want to just list off concerns/i);
  assert.match(
    email.html,
    /https:\/\/faithfulsoftware\.dev\/preview\/p\/opaque-public-id/,
  );
  assert.ok(email.wordCount >= 140 && email.wordCount <= 220);
});

test("does not invent a historical narrative without two usable observations", () => {
  const narrativeForHistory = deriveHistoricalEmailNarrative({
    trustSignals: {
      schemaVersion: "1.0",
      summary: "Present visible service information.",
      items: ["Services"],
    },
    conversionPlan: {
      schemaVersion: "1.0",
      summary: "Clarify the enquiry route.",
      items: ["Clear contact action"],
    },
    firstPartyEvidenceUrl: "https://example.test/services",
  });

  assert.equal(narrativeForHistory, null);
});
