import assert from "node:assert/strict";
import test from "node:test";

import { resolveKnownBespokePreviewSlug } from "./preview-slugs";

test("resolves Priority Point and Bridgland from legal or trading names", () => {
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
});
