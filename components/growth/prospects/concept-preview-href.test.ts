import assert from "node:assert/strict";
import test from "node:test";

import {
  getConceptPreviewHref,
} from "./concept-preview-href";

test("opens concept previews by slug", () => {
  assert.equal(
    getConceptPreviewHref({
      slug: "bright-accounting",
    }),
    "/preview/bright-accounting",
  );
});

test("does not fall back to generated database-only preview routes", () => {
  assert.equal(
    getConceptPreviewHref({
      slug: null,
    }),
    null,
  );
});

test("does not build links for malformed preview slugs", () => {
  assert.equal(
    getConceptPreviewHref({
      slug: "../private",
    }),
    null,
  );
});
