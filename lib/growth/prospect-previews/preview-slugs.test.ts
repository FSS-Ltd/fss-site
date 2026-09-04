import assert from "node:assert/strict";
import test from "node:test";

import { resolveKnownBespokePreviewSlug } from "./preview-slugs";

test("resolves known bespoke previews from legal or trading names", () => {
  assert.equal(
    resolveKnownBespokePreviewSlug("PRIORITY POINT LIMITED"),
    "priority-point",
  );
  assert.equal(
    resolveKnownBespokePreviewSlug("Priority Point"),
    "priority-point",
  );
  assert.equal(
    resolveKnownBespokePreviewSlug("BRIDGLAND LIMITED"),
    "bridgland-roofing",
  );
  assert.equal(
    resolveKnownBespokePreviewSlug("Bridgland Roofing"),
    "bridgland-roofing",
  );
  assert.equal(
    resolveKnownBespokePreviewSlug("W. & G. HOLLIS LIMITED"),
    "hollis-motors",
  );
  assert.equal(
    resolveKnownBespokePreviewSlug("Hollis Motors"),
    "hollis-motors",
  );
});

test("resolves the six new bespoke concepts from their legal company names", () => {
  const expectedSlugsByLegalName = [
    ["Hazel Motors (Gillingham) Limited", "hazel-motors"],
    ["Best Roofing Ltd", "best-roofing"],
    ["MD Accountancy Team Ltd", "md-accountancy"],
    ["HILL-WOOD & CO. (KENT) LIMITED", "hill-wood"],
    ["Accountants of Kent Limited", "hilden-park-accountants"],
    ["Tunbridge Wells Roofing Limited", "tunbridge-wells-roofing"],
  ] as const;

  for (const [businessName, slug] of expectedSlugsByLegalName) {
    assert.equal(resolveKnownBespokePreviewSlug(businessName), slug);
  }
});

test("resolves electrical concepts from their legal company names", () => {
  const expectedSlugsByLegalName = [
    ["ETE ELECTRICAL CONTRACTORS LIMITED", "ete-electrical"],
    ["Tumber Hadley Electrical Ltd", "th-electrical"],
  ] as const;

  for (const [businessName, slug] of expectedSlugsByLegalName) {
    assert.equal(resolveKnownBespokePreviewSlug(businessName), slug);
  }
});
