import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompositionDigest,
  validateProspectPreviewComposition,
} from "./types";

const compositionWithoutDigest = {
  schemaVersion: "1.0",
  prospectId: "2f53dca1-7788-493a-8b18-49a68c5b03e1",
  slug: "marden-garage",
  family: "automotive",
  visualDirection: "precision-dark",
  heroTreatment: "workshop-geometry",
  sectionOrder: [
    "hero",
    "proof",
    "services",
    "journey",
    "locality",
    "owner-cta",
  ],
  journey: {
    type: "mot-request",
    completionMessage: "Your preferred time is ready for a follow-up.",
  },
  copy: {
    businessName: "Marden Garage",
    locality: "Marden",
    headline: "A clearer route into vehicle care.",
    primaryCta: "Request an MOT slot",
  },
  content: {
    businessGoal: "Help drivers book the right vehicle care without uncertainty.",
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
  },
} as const;

test("accepts a local-only composition with a digest bound to its content", () => {
  const digest = buildCompositionDigest(compositionWithoutDigest);
  const composition = validateProspectPreviewComposition({
    ...compositionWithoutDigest,
    digest,
  });

  assert.match(composition.digest, /^[a-f0-9]{64}$/);
  assert.equal(
    buildCompositionDigest({
      ...compositionWithoutDigest,
      copy: {
        ...compositionWithoutDigest.copy,
        headline: "A direct route into vehicle care.",
      },
    }),
    "5ff60934899f7c88032384654d4b4f72864b9e5cdf6c8763fb4231ba759bc43e",
  );
});

test("rejects a remote hero asset and duplicate section", () => {
  assert.throws(() =>
    validateProspectPreviewComposition({
      ...compositionWithoutDigest,
      heroTreatment: "https://images.example/hero.webp",
      sectionOrder: ["hero", "proof", "proof", "journey", "owner-cta"],
      digest: "a".repeat(64),
    }),
  );
});
