import assert from "node:assert/strict";
import test from "node:test";

import { getBespokeProspectPage } from "@/components/prospect-previews/bespoke/registry";

import {
  getReviewableBespokePreviewSources,
  getReviewableBespokePreviewSourceBySlug,
  resolveReviewableProspectPreviewSource,
} from "./reviewable-source";

const prospectId = "11111111-1111-4111-8111-111111111111";

test("registers each of the six bespoke sources with a unique review digest", () => {
  const sources = getReviewableBespokePreviewSources();

  assert.deepEqual(sources.map((source) => source.slug).sort(), [
    "acckent-accountants",
    "ete-electrical",
    "hosty-lets",
    "jenkinson-estates",
    "legrys",
    "th-electrical",
  ]);
  assert.equal(new Set(sources.map((source) => source.digest)).size, 6);
  assert.ok(sources.every((source) => getBespokeProspectPage(source.slug)));
});

test("resolves an allowlisted bespoke source by its stored slug", () => {
  const storedSource = getReviewableBespokePreviewSourceBySlug(
    "acckent-accountants",
  );
  assert.ok(storedSource);
  const source = resolveReviewableProspectPreviewSource({
    digest: storedSource.digest,
    prospectId,
    slug: "acckent-accountants",
    resolveComposition: () => null,
  });

  assert.deepEqual(source?.kind, "bespoke");
  assert.equal(source?.slug, "acckent-accountants");
  assert.match(source?.digest ?? "", /^[a-f0-9]{64}$/);
});

test("resolves a generated source only when the stored slug matches the prospect", () => {
  const composition = {
    prospectId,
    slug: "generated-preview",
    digest: "a".repeat(64),
  };

  assert.deepEqual(
    resolveReviewableProspectPreviewSource({
      digest: composition.digest,
      prospectId,
      slug: composition.slug,
      resolveComposition: () => composition,
    }),
    { kind: "composition", slug: composition.slug, digest: composition.digest },
  );
  assert.equal(
    resolveReviewableProspectPreviewSource({
      digest: composition.digest,
      prospectId,
      slug: "different-preview",
      resolveComposition: () => composition,
    }),
    null,
  );
});

test("rejects a slug that is neither a matching composition nor an allowlisted bespoke source", () => {
  assert.equal(
    resolveReviewableProspectPreviewSource({
      digest: "a".repeat(64),
      prospectId,
      slug: "unknown-preview",
      resolveComposition: () => null,
    }),
    null,
  );
});

test("rejects a stale bespoke digest", () => {
  assert.equal(
    resolveReviewableProspectPreviewSource({
      digest: "a".repeat(64),
      prospectId,
      slug: "acckent-accountants",
      resolveComposition: () => null,
    }),
    null,
  );
});
