import assert from "node:assert/strict";
import test from "node:test";

import { serializeGeneratedComposition } from "./serialize";
import { buildCompositionDigest, type ProspectPreviewComposition } from "./types";

const draft = {
  schemaVersion: "1.0" as const,
  prospectId: "e9ea6188-8f7b-4c99-96bc-e2dd3a959d4c",
  slug: "bright-fox-lettings",
  family: "property" as const,
  visualDirection: "calm-architectural" as const,
  heroTreatment: "property-frame" as const,
  sectionOrder: [
    "hero",
    "locality",
    "proof",
    "journey",
    "services",
    "owner-cta",
  ] satisfies ProspectPreviewComposition["sectionOrder"],
  journey: {
    type: "valuation-request" as const,
    completionMessage: "Your property enquiry is ready for a local follow-up.",
  },
  copy: {
    businessName: "Bright Fox Lettings",
    locality: "Kent",
    headline: "A clearer start for property decisions in Kent.",
    primaryCta: "Request a valuation",
  },
  content: {
    businessGoal: "Make it easier for landlords to take the next practical step.",
    homepageSections: {
      schemaVersion: "1.0" as const,
      summary: "Make the property journey easier to understand.",
      items: ["Letting options"],
    },
    conversionPlan: {
      schemaVersion: "1.0" as const,
      summary: "Offer a clear valuation enquiry route.",
      items: ["Ask only for the first useful details"],
    },
    trustSignals: {
      schemaVersion: "1.0" as const,
      summary: "Show how local experience informs each decision.",
      items: ["Explain the local approach"],
    },
  },
};

const composition: ProspectPreviewComposition = {
  ...draft,
  digest: buildCompositionDigest(draft),
};

test("serialises a stable typed source package", () => {
  const source = serializeGeneratedComposition(composition);

  assert.match(source, /export const brightFoxLettingsComposition/);
  assert.match(source, /satisfies ProspectPreviewComposition/);
  assert.match(source, /"bright-fox-lettings"/);
  assert.equal(source, serializeGeneratedComposition(composition));
});
