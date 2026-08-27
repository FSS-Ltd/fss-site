import assert from "node:assert/strict";
import test from "node:test";

import { parseExperienceBrief } from "./experience-brief";

const evidenceIds = {
  services: "00000000-0000-4000-8000-000000000001",
  mot: "00000000-0000-4000-8000-000000000002",
  colours: "00000000-0000-4000-8000-000000000003",
  logo: "00000000-0000-4000-8000-000000000004",
};

const mardenExperienceBrief = {
  schemaVersion: "1.1",
  hero: {
    statement: "Start your MOT, service or repair request with your registration.",
    supportingStatement:
      "Marden Garage can see the right vehicle details before arranging the next step.",
    evidenceIds: [evidenceIds.services, evidenceIds.mot],
  },
  journey: {
    title: "Get your vehicle ready for the workshop",
    primaryCta: "Start with your registration",
    completionMessage:
      "Your workshop request is ready to review with Marden Garage.",
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
        id: "service",
        label: "What do you need help with?",
        kind: "service-selection",
        control: "single-select",
        requiredFields: ["service"],
        options: ["MOT", "Service", "Repair"],
      },
      {
        id: "timing",
        label: "When would you like to visit?",
        kind: "timing",
        control: "single-select",
        requiredFields: ["timing"],
        options: ["This week", "Next week", "I am flexible"],
      },
      {
        id: "notes",
        label: "Anything the workshop should know?",
        kind: "notes",
        control: "textarea",
        requiredFields: [],
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
    brandColors: ["#19374A", "#F3EFE8"],
    colourEvidenceIds: [evidenceIds.colours],
    logoEvidenceId: evidenceIds.logo,
    logoAssetId: null,
    onSiteImageEvidenceId: null,
    onSiteImageAssetId: null,
    approvedHeroMediaAssetId: null,
  },
};

test("parses a research-backed Marden journey that starts with a registration", () => {
  const brief = parseExperienceBrief(mardenExperienceBrief);

  assert.equal(brief.hero.evidenceIds.length, 2);
  assert.equal(brief.journey.steps[0]?.control, "registration");
  assert.deepEqual(brief.journey.steps[1]?.options, ["MOT", "Service", "Repair"]);
});

test("rejects a selectable journey step without researched options", () => {
  const invalidBrief = structuredClone(mardenExperienceBrief);
  invalidBrief.journey.steps[1]!.options = [];

  assert.throws(() => parseExperienceBrief(invalidBrief), /options/i);
});

test("rejects remote assets in a source package", () => {
  const invalidBrief = {
    ...mardenExperienceBrief,
    visual: {
      ...mardenExperienceBrief.visual,
      logoAssetId: "https://mardengarage.example/logo.svg",
    },
  };

  assert.throws(() => parseExperienceBrief(invalidBrief), /uuid/i);
});
