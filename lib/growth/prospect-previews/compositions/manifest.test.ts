import assert from "node:assert/strict";
import test from "node:test";

import {
  createProspectPreviewCompositionManifest,
  getMergedProspectPreviewCompositionBySlug,
} from "./manifest";
import {
  buildCompositionDigest,
  type ProspectPreviewComposition,
} from "./types";

function createComposition(
  prospectId: string,
  slug: string,
): ProspectPreviewComposition {
  const draft = {
    schemaVersion: "1.0" as const,
    prospectId,
    slug,
    family: "automotive" as const,
    visualDirection: "precision-dark" as const,
    heroTreatment: "workshop-geometry" as const,
    sectionOrder: [
      "hero",
      "proof",
      "services",
      "journey",
      "locality",
      "owner-cta",
    ] satisfies ProspectPreviewComposition["sectionOrder"],
    journey: {
      type: "mot-request" as const,
      completionMessage: "Your preferred time is ready for a follow-up.",
    },
    copy: {
      businessName: slug === "marden-garage" ? "Marden Garage" : "Dunkley's of Deal",
      locality: "Kent",
      headline: "Vehicle care made easier to book.",
      primaryCta: "Request an MOT slot",
    },
    content: {
      businessGoal: "Help drivers book vehicle care without uncertainty.",
      homepageSections: {
        schemaVersion: "1.0" as const,
        summary: "Make service routes clear.",
        items: ["MOT booking"],
      },
      conversionPlan: {
        schemaVersion: "1.0" as const,
        summary: "Offer one clear route into the workshop.",
        items: ["Show the next available MOT step"],
      },
      trustSignals: {
        schemaVersion: "1.0" as const,
        summary: "Give drivers clear evidence before booking.",
        items: ["Explain workshop experience"],
      },
    },
  };
  return { ...draft, digest: buildCompositionDigest(draft) };
}

test("looks up merged packages by slug and prospect ID", () => {
  const marden = createComposition(
    "9ab61ccb-f75f-49b7-9147-e239817ec9c1",
    "marden-garage",
  );
  const dunkleys = createComposition(
    "a59a2772-6a4a-43ba-9c2a-4b8222372e73",
    "dunkleys-of-deal",
  );
  const manifest = createProspectPreviewCompositionManifest([marden, dunkleys]);

  assert.equal(manifest.getBySlug("marden-garage")?.digest, marden.digest);
  assert.equal(manifest.getByProspectId(dunkleys.prospectId)?.slug, "dunkleys-of-deal");
  assert.equal(manifest.getBySlug("not-a-real-prospect"), null);
});

test("rejects duplicate generated package identities", () => {
  const marden = createComposition(
    "9ab61ccb-f75f-49b7-9147-e239817ec9c1",
    "marden-garage",
  );

  assert.throws(() =>
    createProspectPreviewCompositionManifest([
      marden,
      { ...marden, digest: buildCompositionDigest(marden) },
    ]),
  );
});

test("does not resolve an ungenerated package from the merged manifest", () => {
  assert.equal(getMergedProspectPreviewCompositionBySlug("marden-garage"), null);
});
