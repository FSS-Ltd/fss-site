import assert from "node:assert/strict";
import test from "node:test";

import {
  getConceptPreviewHref,
  getFounderConceptPreviewHref,
} from "./concept-preview-href";

test("keeps drafted generated concepts inside the founder review route", () => {
  assert.equal(
    getConceptPreviewHref({
      prospectId: "11111111-1111-4111-8111-111111111111",
    }),
    "/growth/prospects/11111111-1111-4111-8111-111111111111/preview",
  );
});

test("uses a registered bespoke source when a legacy draft has no stored slug", () => {
  assert.equal(
    getFounderConceptPreviewHref({
      prospectId: "11111111-1111-4111-8111-111111111111",
      sourceSlug: "example-heating",
    }),
    "/preview/example-heating",
  );
});

test("does not treat a generated database slug as a bespoke public source", () => {
  assert.equal(
    getFounderConceptPreviewHref({
      prospectId: "11111111-1111-4111-8111-111111111111",
      sourceSlug: null,
    }),
    "/growth/prospects/11111111-1111-4111-8111-111111111111/preview",
  );
});
