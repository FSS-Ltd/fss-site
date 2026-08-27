import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import {
  getPublishedProspectPreview,
  getPublishedProspectPreviewCompositionBySlug,
} from "./public-repository";

const PUBLIC_ID = "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm";
const content = {
  schemaVersion: "1.0",
  businessName: "Example Heating Ltd",
  sector: "Home services",
  locality: "Canterbury",
  businessGoal: "Turn urgent enquiries into qualified calls.",
  primaryCta: "Request a callback",
  homepageSections: {
    schemaVersion: "1.0",
    summary: "A clear homepage structure.",
    items: ["Hero section"],
  },
  conversionPlan: {
    schemaVersion: "1.0",
    summary: "A simpler contact journey.",
    items: ["Clear enquiry route"],
  },
  trustSignals: {
    schemaVersion: "1.0",
    summary: "Visible local service experience.",
    items: ["Service information"],
  },
};

test("returns only a published public snapshot for an opaque ID", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const db = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return [{ publicId: PUBLIC_ID, content }];
  }) as unknown as GrowthDb;

  const result = await getPublishedProspectPreview(PUBLIC_ID, db);

  assert.equal(result?.status, "published");
  assert.equal(result?.content.businessName, "Example Heating Ltd");
  assert.equal("contactEmail" in (result?.content ?? {}), false);
  assert.match(queries[0]?.text ?? "", /status = 'published'/);
  assert.deepEqual(queries[0]?.values, [PUBLIC_ID]);
});

test("does not query draft-shaped public IDs", async () => {
  let queries = 0;
  const db = (async () => {
    queries += 1;
    return [];
  }) as unknown as GrowthDb;

  const result = await getPublishedProspectPreview("not-a-public-id", db);

  assert.equal(result, null);
  assert.equal(queries, 0);
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
