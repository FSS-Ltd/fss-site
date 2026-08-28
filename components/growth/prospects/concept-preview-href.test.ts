import assert from "node:assert/strict";
import test from "node:test";

import { getConceptPreviewHref } from "./concept-preview-href";

test("links generated concepts to their bespoke public route", () => {
  assert.equal(
    getConceptPreviewHref({
      prospectId: "11111111-1111-4111-8111-111111111111",
      slug: "example-heating",
    }),
    "/preview/example-heating",
  );
});

test("keeps pending concepts reviewable until they have a slug", () => {
  assert.equal(
    getConceptPreviewHref({
      prospectId: "11111111-1111-4111-8111-111111111111",
      slug: null,
    }),
    "/growth/prospects/11111111-1111-4111-8111-111111111111/preview",
  );
});
