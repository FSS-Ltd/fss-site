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
  assert.match(email.text, /I didn’t want to simply list concerns/i);
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
