import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { StoredProspectPreviewSnapshot } from "@/lib/growth/prospect-previews/types";
import { compileProspectPreviewComposition } from "@/lib/growth/prospect-previews/compositions/compiler";

import { CompositionPreview } from "./composition-preview";

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
    items: ["Show the next available MOT step"],
  },
  trustSignals: {
    schemaVersion: "1.0",
    summary: "Local drivers need clear evidence before booking.",
    items: ["Explain workshop experience"],
  },
};

const hospitalitySnapshot: StoredProspectPreviewSnapshot = {
  ...automotiveSnapshot,
  businessName: "Fuggles Beer Cafe",
  sector: "Hospitality and beer cafe",
  locality: "Tunbridge Wells",
  businessGoal: "Make a first visit feel easy to plan.",
  primaryCta: "Plan your table enquiry",
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
  assert.match(markup, /Request an MOT slot/);
  assert.match(markup, /MOT request/);
  assert.ok(markup.indexOf("Make MOT and servicing routes clear.") < markup.indexOf("Offer one clear route into the workshop."));
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

  assert.match(markup, /Plan your table enquiry/);
  assert.match(markup, /Table enquiry/);
  assert.doesNotMatch(markup, /MOT request/);
  assert.doesNotMatch(markup, /Vehicle care made easier to book/);
});
