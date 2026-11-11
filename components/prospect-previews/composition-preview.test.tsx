import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { StoredProspectPreviewSnapshot } from "@/lib/growth/prospect-previews/types";
import { compileProspectPreviewComposition } from "@/lib/growth/prospect-previews/compositions/compiler";

import { CompositionPreview } from "./composition-preview";

const automotiveSnapshot: StoredProspectPreviewSnapshot = {
  schemaVersion: "1.1",
  businessName: "Marden Garage",
  sector: "Garage and MOT centre",
  locality: "Marden",
  businessGoal: "Help drivers book the right vehicle care without uncertainty.",
  primaryCta: "Request an MOT slot",
  homepageSections: {
    schemaVersion: "1.0",
    summary: "Make MOT and servicing routes clear.",
    items: ["MOT booking", "Servicing overview"],
  },
  conversionPlan: {
    schemaVersion: "1.0",
    summary: "Offer one clear route into the workshop.",
    items: ["Show the next available MOT step"],
  },
  trustSignals: {
    schemaVersion: "1.0",
    summary: "Local drivers need clear evidence before booking.",
    items: ["Explain workshop experience"],
  },
  experienceBrief: {
    schemaVersion: "1.1",
    hero: {
      statement:
        "Start your MOT, service or repair request with your registration.",
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
          id: "service",
          label: "What do you need help with?",
          kind: "service-selection",
          control: "single-select",
          requiredFields: ["service"],
          options: ["MOT", "Service", "Repair"],
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
};

const hospitalitySnapshot: StoredProspectPreviewSnapshot = {
  ...automotiveSnapshot,
  businessName: "Fuggles Beer Cafe",
  sector: "Hospitality and beer cafe",
  locality: "Tunbridge Wells",
  businessGoal: "Make a first visit feel easy to plan.",
  primaryCta: "Plan your table enquiry",
  experienceBrief: {
    ...automotiveSnapshot.experienceBrief,
    hero: {
      statement: "Plan a first visit around the table that suits your group.",
      supportingStatement:
        "Fuggles Beer Cafe can start with the details that make a table enquiry useful.",
      evidenceIds: ["00000000-0000-4000-8000-000000000001"],
    },
    journey: {
      title: "Plan your table enquiry",
      primaryCta: "Choose your table details",
      completionMessage: "Your table enquiry is ready to review.",
      steps: [
        {
          id: "visit",
          label: "When are you hoping to visit?",
          kind: "timing",
          control: "single-select",
          requiredFields: ["timing"],
          options: ["This week", "Next week", "I am flexible"],
        },
        {
          id: "review",
          label: "Review your table enquiry",
          kind: "review",
          control: "review",
          requiredFields: [],
          options: [],
        },
      ],
    },
  },
};

function compileOrFail(
  prospectId: string,
  slug: string,
  snapshot: StoredProspectPreviewSnapshot,
) {
  const result = compileProspectPreviewComposition({
    prospectId,
    slug,
    snapshot,
    existingFingerprints: new Set(),
  });
  if (result.status !== "compiled") {
    assert.fail(`Expected composition but received ${result.reason}.`);
  }
  return result.composition;
}

test("renders an automotive package in its configured section order", () => {
  const composition = compileOrFail(
    "ae3f91cc-9b3e-4e1d-a50e-e28f6cde1b85",
    "marden-garage",
    automotiveSnapshot,
  );
  const markup = renderToStaticMarkup(
    <CompositionPreview composition={composition} mode="review" />,
  );

  assert.match(markup, /Private website concept/);
  assert.match(markup, /Start your MOT, service or repair request with your registration/);
  assert.match(markup, /prospect-reveal/);
});

test("renders the hospitality journey without automotive content", () => {
  const composition = compileOrFail(
    "e474cc01-419e-43f0-9650-065c234b8a07",
    "fuggles-beer-cafe",
    hospitalitySnapshot,
  );
  const markup = renderToStaticMarkup(
    <CompositionPreview composition={composition} mode="public" />,
  );

  assert.match(markup, /Plan a first visit around the table that suits your group/);
  assert.match(markup, /When are you hoping to visit/);
  assert.doesNotMatch(markup, /MOT request/);
  assert.doesNotMatch(markup, /Vehicle care made easier to book/);
});
