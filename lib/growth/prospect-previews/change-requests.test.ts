import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import { createPreviewChangeRequest } from "./change-requests";

const PROSPECT_ID = "08c6085e-a7d4-4c85-a188-0e6e44f3d8f0";
const ACTOR_ID = "a".repeat(64);

function createFakeDb(
  rows: readonly object[],
  queries: Array<{ text: string; values: readonly unknown[] }>,
): GrowthDb {
  const tx = async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return strings
      .join("")
      .includes("insert into growth.prospect_preview_change_requests")
      ? rows
      : [];
  };
  return Object.assign(tx, {
    begin: async (callback: (value: typeof tx) => Promise<unknown>) =>
      callback(tx),
  }) as unknown as GrowthDb;
}

test("stores feedback only for a matching generated composition", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const result = await createPreviewChangeRequest(
    {
      prospectId: PROSPECT_ID,
      compositionDigest: "b".repeat(64),
      notes:
        "Use the quieter professional-services hero and keep the consultation journey.",
      createdBy: ACTOR_ID,
    },
    createFakeDb(
      [{ id: "9bf67812-197d-4ef7-910b-838718358409", generationPrNumber: 321 }],
      queries,
    ),
  );

  assert.deepEqual(result, {
    id: "9bf67812-197d-4ef7-910b-838718358409",
    generationPrNumber: 321,
  });
  assert.match(
    queries[2]?.text ?? "",
    /insert into growth\.prospect_preview_change_requests/i,
  );
  assert.match(queries[2]?.text ?? "", /pp\.composition_digest\s*=\s*\?/);
  assert.match(
    queries[2]?.text ?? "",
    /pp\.generation_status in \('pr_open',\s*'merged_draft'\)/,
  );
  assert.doesNotMatch(queries[2]?.text ?? "", /email|contact|company_number/i);
  assert.ok(queries[2]?.values.includes(PROSPECT_ID));
});

test("rejects outer-spaced feedback before querying the database", async () => {
  let queries = 0;
  const db = (async () => {
    queries += 1;
    return [];
  }) as unknown as GrowthDb;

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

test("pilot request without a stable request id fails closed", async () => {
  const transaction = Object.assign(async () => [], {});
  let step = 0;
  const tx = async () => (++step === 2 ? [{ slot: 1 }] : []);
  const db = Object.assign(transaction, {
    begin: async (callback: (value: unknown) => Promise<unknown>) =>
      callback(tx),
  }) as unknown as import("../db/types").GrowthDb;
  await assert.rejects(
    createPreviewChangeRequest(
      {
        prospectId: PROSPECT_ID,
        compositionDigest: "b".repeat(64),
        notes: "Change the hero.",
        createdBy: ACTOR_ID,
      },
      db,
    ),
    /pilot_request_id_required/,
  );
});
