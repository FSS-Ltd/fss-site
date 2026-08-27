import assert from "node:assert/strict";
import test from "node:test";

import { getPreviewSlugs, getProspectPreview } from "./registry";

test("returns the automotive preview record for its registered slug", () => {
  const preview = getProspectPreview("ashford-auto-centre");

  assert.equal(preview?.industry, "automotive");
  assert.equal(preview?.businessName, "Ashford Auto Centre");
  assert.equal(preview?.sellingAngle.primaryGoal, "mot-enquiries");
});

test("returns undefined without exposing data for an unknown slug", () => {
  assert.equal(getProspectPreview("business-that-does-not-exist"), undefined);
});

test("enumerates every preview slug for static route generation", () => {
  assert.deepEqual(getPreviewSlugs(), [
    "ashford-auto-centre",
    "example-plumbing",
  ]);
});
