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
