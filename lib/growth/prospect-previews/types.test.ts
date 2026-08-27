import assert from "node:assert/strict";
import test from "node:test";

import { parseStoredProspectPreviewSnapshot } from "./types";

const validSnapshot = {
  schemaVersion: "1.0",
  businessName: "Example Heating Ltd",
  sector: "Home services",
  locality: "Canterbury",
  businessGoal: "Turn urgent enquiries into qualified calls.",
  primaryCta: "Request a callback",
  homepageSections: {
    schemaVersion: "1.0",
    summary: "A clear homepage structure.",
    items: ["Hero section"],
  },
  conversionPlan: {
    schemaVersion: "1.0",
    summary: "A simpler contact journey.",
    items: ["Clear enquiry route"],
  },
  trustSignals: {
    schemaVersion: "1.0",
    summary: "Visible local service experience.",
    items: ["Service information"],
  },
};

test("parses a public preview snapshot with only publishable website content", () => {
  const preview = parseStoredProspectPreviewSnapshot(validSnapshot);

  assert.equal(preview.businessName, "Example Heating Ltd");
  assert.equal(preview.homepageSections.items[0], "Hero section");
});

test("rejects a preview snapshot containing a contact email", () => {
  assert.throws(
    () =>
      parseStoredProspectPreviewSnapshot({
        ...validSnapshot,
        contactEmail: "owner@example.test",
      }),
    /unrecognized key/i,
  );
});

test("parses a versioned evidence-backed snapshot without exposing source URLs", () => {
  const preview = parseStoredProspectPreviewSnapshot({
    ...validSnapshot,
    schemaVersion: "1.1",
    experienceBrief: {
      schemaVersion: "1.1",
      hero: {
        statement: "Start your MOT, service or repair request with your registration.",
        supportingStatement:
          "Marden Garage can prepare the workshop conversation with the right vehicle details.",
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
            kind: "vehicle-registration",
            control: "registration",
            requiredFields: ["registration"],
            options: [],
          },
          {
            id: "review",
            label: "Review your request",
            kind: "review",
            control: "review",
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
  });

  assert.equal(preview.schemaVersion, "1.1");
  if (preview.schemaVersion === "1.1") {
    assert.equal(preview.experienceBrief.journey.steps[0]?.control, "registration");
  }
});
