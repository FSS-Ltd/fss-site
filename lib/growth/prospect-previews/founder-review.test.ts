import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import {
  getFounderDraftProspectPreview,
  getFounderDraftProspectPreviewSummaries,
} from "./founder-review";

const prospectId = "11111111-1111-4111-8111-111111111111";

const content = {
  schemaVersion: "1.0" as const,
  businessName: "Example Heating Ltd",
  sector: "Home services",
  locality: "Canterbury",
  businessGoal: "Turn urgent enquiries into qualified calls.",
  primaryCta: "Request a callback",
  homepageSections: {
    schemaVersion: "1.0" as const,
    summary: "A clear homepage structure.",
    items: ["Hero section"],
  },
  conversionPlan: {
    schemaVersion: "1.0" as const,
    summary: "A simpler contact journey.",
    items: ["Clear enquiry route"],
  },
  trustSignals: {
    schemaVersion: "1.0" as const,
    summary: "Visible local service experience.",
    items: ["Service information"],
  },
};

function createFakeGrowthDb(
  rows: readonly object[],
  queries?: Array<{ text: string; values: readonly unknown[] }>,
): GrowthQueryExecutor {
  return (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries?.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return rows;
  }) as unknown as GrowthQueryExecutor;
}

test("lists each draft preview with the versions required for founder approval", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const result = await getFounderDraftProspectPreviewSummaries(
    createFakeGrowthDb([
      {
        businessName: "Example Heating Ltd",
        compositionDigest: "a".repeat(64),
        generationPrNumber: 412,
        generationStatus: "merged_draft",
        previewVersion: 2,
        prospectId,
        prospectStatus: "ready_for_email_review",
        prospectVersion: 5,
        slug: "example-heating",
      },
    ], queries),
  );

  assert.deepEqual(result, {
    status: "ready",
    data: [
      {
        businessName: "Example Heating Ltd",
        compositionDigest: "a".repeat(64),
        generationPrNumber: 412,
        generationStatus: "merged_draft",
        previewVersion: 2,
        prospectId,
        prospectStatus: "ready_for_email_review",
        prospectVersion: 5,
        slug: "example-heating",
      },
    ],
  });
  assert.match(queries[0]?.text ?? "", /where pp\.status = 'draft'/);
  assert.match(queries[0]?.text ?? "", /pp\.slug/);
  assert.doesNotMatch(queries[0]?.text ?? "", /public_id/i);
});

test("explains when no draft concept previews are awaiting founder review", async () => {
  const result = await getFounderDraftProspectPreviewSummaries(
    createFakeGrowthDb([]),
  );

  assert.deepEqual(result, {
    status: "empty",
    reason: "No private concept previews are awaiting approval.",
  });
});

test("loads a valid draft snapshot only for a well-formed prospect ID", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const result = await getFounderDraftProspectPreview(
    prospectId,
    createFakeGrowthDb(
      [{ prospectId, content, slug: "example-heating" }],
      queries,
    ),
  );

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.data.prospectId, prospectId);
  assert.equal(result.data.content.businessName, "Example Heating Ltd");
  assert.equal(result.data.slug, "example-heating");
  assert.match(queries[0]?.text ?? "", /and pp\.status = 'draft'/);
  assert.match(queries[0]?.text ?? "", /pp\.slug/);
  assert.deepEqual(queries[0]?.values, [prospectId]);
  assert.doesNotMatch(queries[0]?.text ?? "", /public_id/i);
});

test("does not query malformed prospect IDs", async () => {
  let queries = 0;
  const db = (async () => {
    queries += 1;
    return [];
  }) as unknown as GrowthQueryExecutor;

  const result = await getFounderDraftProspectPreview("not-a-uuid", db);

  assert.deepEqual(result, { status: "not_found" });
  assert.equal(queries, 0);
});
