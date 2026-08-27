import assert from "node:assert/strict";
import test from "node:test";

import type { PreviewGenerationCandidate } from "../composition-repository";
import { buildGeneratedPreviewFiles } from "./generated-files";

const candidates: readonly PreviewGenerationCandidate[] = [
  {
    previewId: "b7c63de7-3e17-4347-8f8a-618c1b0d09c8",
    prospectId: "3381388d-503a-4545-844d-6c29dedb2b35",
    snapshot: {
      schemaVersion: "1.0",
      businessName: "Marden Garage",
      sector: "Garage and MOT centre",
      locality: "Marden",
      businessGoal: "Help drivers book the right vehicle care without uncertainty.",
      primaryCta: "Request an MOT slot",
      homepageSections: {
        schemaVersion: "1.0",
        summary: "Make MOT and servicing routes clear.",
        items: ["MOT booking"],
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
  },
  {
    previewId: "d5e63de7-3e17-4347-8f8a-618c1b0d09c8",
    prospectId: "e99a4971-7b37-4822-8119-ee239955aa21",
    snapshot: {
      schemaVersion: "1.0",
      businessName: "Fuggles Beer Cafe",
      sector: "Hospitality and beer cafe",
      locality: "Tunbridge Wells",
      businessGoal: "Make a first visit feel easy to plan.",
      primaryCta: "Plan your table enquiry",
      homepageSections: {
        schemaVersion: "1.0",
        summary: "Make the first visit easier to understand.",
        items: ["A considered welcome"],
      },
      conversionPlan: {
        schemaVersion: "1.0",
        summary: "Offer a simple enquiry route.",
        items: ["Ask for the first useful details"],
      },
      trustSignals: {
        schemaVersion: "1.0",
        summary: "Give guests a clear reason to visit.",
        items: ["Explain the local offer"],
      },
    },
  },
];

test("builds deterministic package and manifest sources from safe draft snapshots", () => {
  const output = buildGeneratedPreviewFiles(candidates);

  assert.deepEqual(
    output.files.map((file) => file.path),
    [
      "lib/growth/prospect-previews/compositions/generated/fuggles-beer-cafe.ts",
      "lib/growth/prospect-previews/compositions/generated/marden-garage.ts",
      "lib/growth/prospect-previews/compositions/manifest.ts",
    ],
  );
  assert.equal(output.unavailable.length, 0);
  assert.equal(output.packages.length, 2);
  assert.match(output.files[0]?.content ?? "", /Fuggles Beer Cafe/);
  assert.match(output.files[2]?.content ?? "", /fugglesBeerCafeComposition/);
  assert.doesNotMatch(output.files[2]?.content ?? "", /email|contact|company_number/i);
});

test("does not create a package for a sector without an allowlisted composition", () => {
  const output = buildGeneratedPreviewFiles([
    {
      ...candidates[0]!,
      prospectId: "9a0fd4c8-2acd-4fd3-83bd-1fb3cc634cb1",
      snapshot: { ...candidates[0]!.snapshot, sector: "Floristry" },
    },
  ]);

  assert.deepEqual(output.packages, []);
  assert.deepEqual(output.unavailable, [
    {
      previewId: "b7c63de7-3e17-4347-8f8a-618c1b0d09c8",
      prospectId: "9a0fd4c8-2acd-4fd3-83bd-1fb3cc634cb1",
      reason: "unsupported_sector",
    },
  ]);
  assert.equal(output.files.length, 1);
  assert.equal(
    output.files[0]?.path,
    "lib/growth/prospect-previews/compositions/manifest.ts",
  );
  assert.match(
    output.files[0]?.content ?? "",
    /createProspectPreviewCompositionManifest\(\[\]\)/,
  );
});
