import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import {
  getPublishedProspectPreviewSlug,
  getPublishedProspectPreviewCompositionBySlug,
} from "./public-repository";

const PUBLIC_ID = "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm";

test("returns only a published slug for an opaque preview ID", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const db = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return [{ slug: "example-heating" }];
  }) as unknown as GrowthDb;

  const result = await getPublishedProspectPreviewSlug(PUBLIC_ID, db);

  assert.equal(result, "example-heating");
  assert.match(queries[0]?.text ?? "", /status = 'published'/);
  assert.match(queries[0]?.text ?? "", /generation_status = 'published'/);
  assert.doesNotMatch(queries[0]?.text ?? "", /content_snapshot/i);
  assert.deepEqual(queries[0]?.values, [PUBLIC_ID]);
});

test("does not query draft-shaped public IDs", async () => {
  let queries = 0;
  const db = (async () => {
    queries += 1;
    return [];
  }) as unknown as GrowthDb;

  const result = await getPublishedProspectPreviewSlug("not-a-public-id", db);

  assert.equal(result, null);
  assert.equal(queries, 0);
});

test("does not return malformed or missing published preview slugs", async () => {
  const db = (async () => [{ slug: "../private" }]) as unknown as GrowthDb;
  const missingSlugDb = (async () => [{ slug: null }]) as unknown as GrowthDb;

  assert.equal(await getPublishedProspectPreviewSlug(PUBLIC_ID, db), null);
  assert.equal(await getPublishedProspectPreviewSlug(PUBLIC_ID, missingSlugDb), null);
});

test("returns a composition only when its published database digest matches the merged source", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const db = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return [
      {
        prospectId: "f0f5caeec-cbe0-454d-9774-14483ba3a37f",
        slug: "marden-garage",
        compositionDigest: "a".repeat(64),
      },
    ];
  }) as unknown as GrowthDb;
  const composition = {
    prospectId: "f0f5caeec-cbe0-454d-9774-14483ba3a37f",
    slug: "marden-garage",
    digest: "a".repeat(64),
  };

  const result = await getPublishedProspectPreviewCompositionBySlug(
    "marden-garage",
    db,
    () => composition,
  );

  assert.equal(result, composition);
  assert.match(queries[0]?.text ?? "", /status = 'published'/);
  assert.match(queries[0]?.text ?? "", /generation_status = 'published'/);
  assert.deepEqual(queries[0]?.values, ["marden-garage"]);
});

test("does not expose a published slug when its merged source package is absent or stale", async () => {
  const db = (async () => [
    {
      prospectId: "f0f5caeec-cbe0-454d-9774-14483ba3a37f",
      slug: "marden-garage",
      compositionDigest: "a".repeat(64),
    },
  ]) as unknown as GrowthDb;

  assert.equal(
    await getPublishedProspectPreviewCompositionBySlug(
      "marden-garage",
      db,
      () => ({
        prospectId: "f0f5caeec-cbe0-454d-9774-14483ba3a37f",
        slug: "marden-garage",
        digest: "b".repeat(64),
      }),
    ),
    null,
  );
  assert.equal(
    await getPublishedProspectPreviewCompositionBySlug(
      "marden-garage",
      db,
      () => null,
    ),
    null,
  );
});
