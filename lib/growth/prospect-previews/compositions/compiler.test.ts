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
    items: ["Show the next available MOT step", "Explain what happens after an enquiry"],
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

  assert.deepEqual(result, { status: "unavailable", reason: "unsupported_sector" });
});
