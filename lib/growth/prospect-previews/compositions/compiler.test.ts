import assert from "node:assert/strict";
import test from "node:test";

import type { StoredProspectPreviewSnapshot } from "../types";
import { buildCompositionFingerprint } from "./types";
import { compileProspectPreviewComposition } from "./compiler";

const automotiveSnapshot: StoredProspectPreviewSnapshot = {
  schemaVersion: "1.0",
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

test("assigns professional and business services to the consultation journey", () => {
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
  assert.equal(composition.journey.type, "consultation-request");
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
