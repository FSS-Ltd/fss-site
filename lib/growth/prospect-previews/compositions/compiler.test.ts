import assert from "node:assert/strict";
import test from "node:test";

import type { StoredProspectPreviewSnapshot } from "../types";
import { buildCompositionFingerprint } from "./types";
import { compileProspectPreviewComposition } from "./compiler";

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
    items: [
      "Show the next available MOT step",
      "Explain what happens after an enquiry",
    ],
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
      colourEvidenceIds: ["00000000-0000-4000-8000-000000000002"],
      logoEvidenceId: null,
      logoAssetId: null,
      onSiteImageEvidenceId: null,
      onSiteImageAssetId: null,
      approvedHeroMediaAssetId: null,
    },
  },
};

function requireComposition(
  result: ReturnType<typeof compileProspectPreviewComposition>,
) {
  if (result.status !== "compiled") {
    assert.fail(`Expected compiled composition but received ${result.reason}.`);
  }
  return result.composition;
}

test("chooses another automotive composition when the first fingerprint is taken", () => {
  const first = requireComposition(
    compileProspectPreviewComposition({
      prospectId: "4b0520de-5b5a-4a07-a079-21fa86f3cc18",
      slug: "marden-garage",
      snapshot: automotiveSnapshot,
      existingFingerprints: new Set(),
    }),
  );
  const second = requireComposition(
    compileProspectPreviewComposition({
      prospectId: "348b8438-2854-4f4a-88a8-d0e6b1b2d737",
      slug: "dunkleys-of-deal",
      snapshot: automotiveSnapshot,
      existingFingerprints: new Set([buildCompositionFingerprint(first)]),
    }),
  );

  assert.notEqual(
    buildCompositionFingerprint(second),
    buildCompositionFingerprint(first),
  );
});

test("compiles the researched Marden hero and registration-first journey without a sector fallback", () => {
  const composition = requireComposition(
    compileProspectPreviewComposition({
      prospectId: "4b0520de-5b5a-4a07-a079-21fa86f3cc18",
      slug: "marden-garage",
      snapshot: automotiveSnapshot,
      existingFingerprints: new Set(),
    }),
  );

  assert.equal(composition.schemaVersion, "1.1");
  if (composition.schemaVersion === "1.1") {
    assert.equal(
      composition.hero.statement,
      "Start your MOT, service or repair request with your registration.",
    );
    assert.equal(composition.journey.type, "evidence-backed");
    assert.equal(composition.journey.steps[0]?.control, "registration");
    assert.equal(composition.journey.steps[1]?.options[0], "MOT");
  }
});

test("does not compile a legacy snapshot without evidence-backed journey data", () => {
  const legacySnapshot = {
    schemaVersion: "1.0" as const,
    businessName: automotiveSnapshot.businessName,
    sector: automotiveSnapshot.sector,
    locality: automotiveSnapshot.locality,
    businessGoal: automotiveSnapshot.businessGoal,
    primaryCta: automotiveSnapshot.primaryCta,
    homepageSections: automotiveSnapshot.homepageSections,
    conversionPlan: automotiveSnapshot.conversionPlan,
    trustSignals: automotiveSnapshot.trustSignals,
  };
  const result = compileProspectPreviewComposition({
    prospectId: "4b0520de-5b5a-4a07-a079-21fa86f3cc18",
    slug: "marden-garage",
    snapshot: legacySnapshot,
    existingFingerprints: new Set(),
  });

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "missing_experience_brief",
  });
});

test("returns unavailable for an unsupported sector", () => {
  const result = compileProspectPreviewComposition({
    prospectId: "2fc6a14f-9f26-4128-8dc9-c0771fdf560a",
    slug: "example-florist",
    snapshot: { ...automotiveSnapshot, sector: "Floristry" },
    existingFingerprints: new Set(),
  });

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "unsupported_sector",
  });
});

test("uses the researched journey for professional and business services", () => {
  const composition = requireComposition(
    compileProspectPreviewComposition({
      prospectId: "f8ff41ea-7f74-4b81-a92c-9c6f3a4fe333",
      slug: "example-business-services",
      snapshot: {
        ...automotiveSnapshot,
        sector: "Professional and business services",
      },
      existingFingerprints: new Set(),
    }),
  );

  assert.equal(composition.family, "professional-services");
  assert.equal(composition.journey.type, "evidence-backed");
});

test("supplies ten distinct property compositions for a full current-ten run", () => {
  const fingerprints = new Set<string>();

  for (let index = 0; index < 10; index += 1) {
    const composition = requireComposition(
      compileProspectPreviewComposition({
        prospectId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        slug: `estate-agent-${index + 1}`,
        snapshot: { ...automotiveSnapshot, sector: "Estate agents" },
        existingFingerprints: fingerprints,
      }),
    );

    assert.equal(composition.family, "property");
    fingerprints.add(buildCompositionFingerprint(composition));
  }

  assert.equal(fingerprints.size, 10);
});
