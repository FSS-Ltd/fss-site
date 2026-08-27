import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import { createPreviewChangeRequest } from "./change-requests";

const PROSPECT_ID = "08c6085e-a7d4-4c85-a188-0e6e44f3d8f0";
const ACTOR_ID = "a".repeat(64);

function createFakeDb(
  rows: readonly object[],
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
    return rows;
  }) as unknown as GrowthQueryExecutor;
}

test("stores feedback only for a matching generated composition", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const result = await createPreviewChangeRequest(
    {
      prospectId: PROSPECT_ID,
      compositionDigest: "b".repeat(64),
      notes: "Use the quieter professional-services hero and keep the consultation journey.",
      createdBy: ACTOR_ID,
    },
    createFakeDb([{ id: "9bf67812-197d-4ef7-910b-838718358409", generationPrNumber: 321 }], queries),
  );

  assert.deepEqual(result, {
    id: "9bf67812-197d-4ef7-910b-838718358409",
    generationPrNumber: 321,
  });
  assert.match(queries[0]?.text ?? "", /insert into growth\.prospect_preview_change_requests/i);
  assert.match(queries[0]?.text ?? "", /pp\.composition_digest = \?/);
  assert.match(queries[0]?.text ?? "", /pp\.generation_status in \('pr_open', 'merged_draft'\)/);
  assert.doesNotMatch(queries[0]?.text ?? "", /email|contact|company_number/i);
  assert.deepEqual(queries[0]?.values, [
    "b".repeat(64),
    "Use the quieter professional-services hero and keep the consultation journey.",
    ACTOR_ID,
    PROSPECT_ID,
    "b".repeat(64),
  ]);
});

test("rejects outer-spaced feedback before querying the database", async () => {
  let queries = 0;
  const db = (async () => {
    queries += 1;
    return [];
  }) as unknown as GrowthQueryExecutor;

  await assert.rejects(() =>
    createPreviewChangeRequest(
      {
        prospectId: PROSPECT_ID,
        compositionDigest: "b".repeat(64),
        notes: " Change the hero treatment.",
        createdBy: ACTOR_ID,
      },
      db,
    ),
  );
  assert.equal(queries, 0);
});
