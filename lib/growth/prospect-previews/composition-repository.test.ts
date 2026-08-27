import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import {
  getCurrentTenPreviewGenerationInventory,
  listOpenPreviewGenerationRecords,
  listCurrentTenPreviewGenerationCandidates,
  listPreviewGenerationCandidates,
  markPreviewCompositionUnavailable,
  markPreviewGenerationMergedDraft,
  recordPreviewGenerationResult,
} from "./composition-repository";

const EXTERNAL_RUN_ID = "weekday-2026-08-27-0600-europe-london-v1";
const PROSPECT_ID = "1f5caeec-cbe0-454d-9774-14483ba3a37f";
const PREVIEW_ID = "4d5caeec-cbe0-454d-9774-14483ba3a37f";

const content = {
  schemaVersion: "1.0" as const,
  businessName: "Marden Garage",
  sector: "Garage and MOT centre",
  locality: "Marden",
  businessGoal: "Help drivers book the right vehicle care without uncertainty.",
  primaryCta: "Request an MOT slot",
  homepageSections: {
    schemaVersion: "1.0" as const,
    summary: "Make MOT and servicing routes clear.",
    items: ["MOT booking"],
  },
  conversionPlan: {
    schemaVersion: "1.0" as const,
    summary: "Offer one clear route into the workshop.",
    items: ["Show the next available MOT step"],
  },
  trustSignals: {
    schemaVersion: "1.0" as const,
    summary: "Local drivers need clear evidence before booking.",
    items: ["Explain workshop experience"],
  },
};

function createFakeDb(
  responses: readonly object[] | readonly (readonly object[])[],
  queries: Array<{ text: string; values: readonly unknown[] }>,
): GrowthQueryExecutor {
  return (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    const response = Array.isArray(responses[0])
      ? responses[queries.length - 1]
      : responses;
    return response ?? [];
  }) as unknown as GrowthQueryExecutor;
}

test("lists only pending private draft previews for a research run", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const candidates = await listPreviewGenerationCandidates(
    EXTERNAL_RUN_ID,
    createFakeDb(
      [{ previewId: PREVIEW_ID, prospectId: PROSPECT_ID, content }],
      queries,
    ),
  );

  assert.deepEqual(candidates, [
    { previewId: PREVIEW_ID, prospectId: PROSPECT_ID, snapshot: content },
  ]);
  assert.match(queries[0]?.text ?? "", /rr\.external_run_id = \?/);
  assert.match(queries[0]?.text ?? "", /pp\.generation_status = 'pending_pr'/);
  assert.match(queries[0]?.text ?? "", /pp\.status = 'draft'/);
  assert.deepEqual(queries[0]?.values, [EXTERNAL_RUN_ID]);
  assert.doesNotMatch(queries[0]?.text ?? "", /email|contact|company_number/i);
});

test("lists at most eleven assessed historical drafts for the current-ten backfill gate", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const candidates = await listCurrentTenPreviewGenerationCandidates(
    createFakeDb(
      [{ previewId: PREVIEW_ID, prospectId: PROSPECT_ID, content }],
      queries,
    ),
  );

  assert.deepEqual(candidates, [
    { previewId: PREVIEW_ID, prospectId: PROSPECT_ID, snapshot: content },
  ]);
  assert.match(
    queries[0]?.text ?? "",
    /pp\.generation_external_run_id is null/,
  );
  assert.match(
    queries[0]?.text ?? "",
    /inner join growth\.website_assessments wa on wa\.prospect_id = p\.id/,
  );
  assert.match(queries[0]?.text ?? "", /limit 11/);
  assert.match(queries[0]?.text ?? "", /pp\.generation_status = 'pending_pr'/);
  assert.doesNotMatch(queries[0]?.text ?? "", /email|contact|company_number/i);
});

test("summarises the current-ten selection state without selecting prospect data", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const inventory = await getCurrentTenPreviewGenerationInventory(
    createFakeDb(
      [
        [
          {
          activeDrafts: 10,
          assessedDrafts: 10,
          pendingAssessedDrafts: 9,
          eligibleDrafts: 8,
          pendingPr: 8,
          prOpen: 1,
          mergedDraft: 0,
          compositionUnavailable: 1,
          published: 0,
          withdrawn: 0,
        },
        ],
        [{ sector: "Home services", count: 1 }],
      ],
      queries,
    ),
  );

  assert.deepEqual(inventory, {
    activeDrafts: 10,
    assessedDrafts: 10,
    pendingAssessedDrafts: 9,
    eligibleDrafts: 8,
    generationStates: {
      pendingPr: 8,
      prOpen: 1,
      mergedDraft: 0,
      compositionUnavailable: 1,
      published: 0,
      withdrawn: 0,
    },
    unavailableSectors: [{ sector: "Home services", count: 1 }],
  });
  assert.match(queries[0]?.text ?? "", /::integer as "activeDrafts"/);
  assert.match(queries[0]?.text ?? "", /left join growth\.website_assessments wa/);
  assert.doesNotMatch(queries[0]?.text ?? "", /email|contact|company_number/i);
  assert.match(
    queries[1]?.text ?? "",
    /pp\.content_snapshot->>'sector' as "sector"/,
  );
  assert.doesNotMatch(
    queries[1]?.text ?? "",
    /business_name|email|contact|company_number/i,
  );
});

test("records generation metadata only on its matching pending draft", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const updated = await recordPreviewGenerationResult(
    {
      prospectId: PROSPECT_ID,
      slug: "marden-garage",
      compositionDigest: "a".repeat(64),
      generationPrNumber: 321,
      generationBranch: "generated/prospect-previews/2026-08-27",
      reviewDeploymentUrl: null,
      generationExternalRunId: EXTERNAL_RUN_ID,
      generatedAt: new Date("2026-08-27T06:05:00.000Z"),
    },
    createFakeDb([{ id: PREVIEW_ID }], queries),
  );

  assert.equal(updated, true);
  assert.match(queries[0]?.text ?? "", /generation_status = 'pr_open'/);
  assert.match(queries[0]?.text ?? "", /and generation_status = 'pending_pr'/);
  assert.deepEqual(queries[0]?.values, [
    "marden-garage",
    "a".repeat(64),
    321,
    "generated/prospect-previews/2026-08-27",
    null,
    EXTERNAL_RUN_ID,
    new Date("2026-08-27T06:05:00.000Z"),
    PROSPECT_ID,
  ]);
  assert.doesNotMatch(queries[0]?.text ?? "", /email|contact|company_number/i);
});

test("marks an unsupported composition unavailable without publishing or touching email", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const generatedAt = new Date("2026-08-27T06:05:00.000Z");

  const updated = await markPreviewCompositionUnavailable(
    {
      prospectId: PROSPECT_ID,
      generationExternalRunId: EXTERNAL_RUN_ID,
      generatedAt,
    },
    createFakeDb([{ id: PREVIEW_ID }], queries),
  );

  assert.equal(updated, true);
  assert.match(
    queries[0]?.text ?? "",
    /generation_status = 'composition_unavailable'/,
  );
  assert.match(queries[0]?.text ?? "", /and generation_status = 'pending_pr'/);
  assert.deepEqual(queries[0]?.values, [
    EXTERNAL_RUN_ID,
    generatedAt,
    PROSPECT_ID,
  ]);
  assert.doesNotMatch(
    queries[0]?.text ?? "",
    /agent_tasks|email|contact|company_number/i,
  );
});

test("lists only open generated previews and marks a digest-matching package merged", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const records = await listOpenPreviewGenerationRecords(
    createFakeDb(
      [
        {
          previewId: PREVIEW_ID,
          prospectId: PROSPECT_ID,
          compositionDigest: "a".repeat(64),
          pullRequestNumber: 412,
        },
      ],
      queries,
    ),
  );

  assert.deepEqual(records, [
    {
      previewId: PREVIEW_ID,
      prospectId: PROSPECT_ID,
      compositionDigest: "a".repeat(64),
      pullRequestNumber: 412,
    },
  ]);
  assert.match(queries[0]?.text ?? "", /generation_status = 'pr_open'/);
  assert.doesNotMatch(queries[0]?.text ?? "", /email|contact|company_number/i);

  const updated = await markPreviewGenerationMergedDraft(
    { previewId: PREVIEW_ID, compositionDigest: "a".repeat(64) },
    createFakeDb([{ id: PREVIEW_ID }], queries),
  );
  assert.equal(updated, true);
  assert.match(queries[1]?.text ?? "", /generation_status = 'merged_draft'/);
  assert.match(queries[1]?.text ?? "", /and generation_status = 'pr_open'/);
  assert.deepEqual(queries[1]?.values, [PREVIEW_ID, "a".repeat(64)]);
});

test("rejects malformed open preview generation records", async () => {
  await assert.rejects(
    listOpenPreviewGenerationRecords(
      createFakeDb(
        [
          {
            previewId: PREVIEW_ID,
            prospectId: PROSPECT_ID,
            compositionDigest: "not-a-digest",
            pullRequestNumber: 412,
          },
        ],
        [],
      ),
    ),
    { message: "Open preview generation record is invalid." },
  );
});
