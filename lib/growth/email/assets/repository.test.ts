import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb, GrowthTransaction } from "../../db/types";
import type { PersistEmailAssetInput } from "./service";
import {
  EmailAssetAssociationError,
  persistEmailAssetForRun,
  prospectBelongsToResearchRun,
} from "./repository";

type RecordedQuery = {
  text: string;
  values: readonly unknown[];
};

function createRecordingQuery(rows: readonly object[]): {
  db: GrowthDb;
  queries: RecordedQuery[];
  transactions: { attempts: number; rollbacks: number };
} {
  const queries: RecordedQuery[] = [];
  const transactions = { attempts: 0, rollbacks: 0 };
  const query = async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return rows;
  };
  const db = query as unknown as GrowthDb;
  const transactionalDb = db as unknown as {
    begin: <T>(
      operation: (transaction: GrowthTransaction) => Promise<T>,
    ) => Promise<T>;
  };
  transactionalDb.begin = async (operation) => {
    transactions.attempts += 1;
    try {
      return await operation(query as unknown as GrowthTransaction);
    } catch (error) {
      transactions.rollbacks += 1;
      throw error;
    }
  };

  return { db, queries, transactions };
}

const RUN_ID = "d0f57e79-413f-41dc-b15f-1b609fb29db2";
const PROSPECT_ID = "6322f2e9-a320-4e3c-8fbf-b2f137949e2c";
const ASSET_ID = "c5b2e617-f78d-4d0d-9841-9c240c663be2";

const asset: PersistEmailAssetInput = {
  id: ASSET_ID,
  runId: RUN_ID,
  prospectId: PROSPECT_ID,
  assetKind: "cold_first_email",
  blobUrl: `https://blob.example.test/growth-email-assets/${ASSET_ID}.webp`,
  contentType: "image/webp",
  byteSize: 1024,
  width: 1200,
  height: 630,
  altText:
    "Concept showing a customer enquiry moving into an organised service workflow.",
  promptSummary: "A generic workflow concept with no personal data.",
  sha256: "a".repeat(64),
  reviewStatus: "pending",
  createdBy: "agent_ingestion",
};

test("checks the exact prospect and research-run relationship", async () => {
  const { db, queries } = createRecordingQuery([{ belongs: true }]);

  const result = await prospectBelongsToResearchRun(db, {
    runId: RUN_ID,
    prospectId: PROSPECT_ID,
  });

  assert.equal(result, true);
  assert.deepEqual(queries[0]?.values, [PROSPECT_ID, RUN_ID]);
  assert.match(
    queries[0]?.text ?? "",
    /from growth\.prospects p where p\.id = \? and p\.research_run_id = \?/,
  );
});

test("persists safe asset metadata only when the relationship still matches", async () => {
  const { db, queries, transactions } = createRecordingQuery([
    { id: ASSET_ID, draftUpdated: true },
  ]);

  await persistEmailAssetForRun(db, asset);

  assert.deepEqual(queries[0]?.values, [
    PROSPECT_ID,
    RUN_ID,
    "cold_first_email",
    RUN_ID,
    ASSET_ID,
    "cold_first_email",
    asset.blobUrl,
    "image/webp",
    1024,
    1200,
    630,
    asset.altText,
    asset.promptSummary,
    "a".repeat(64),
    "pending",
    "agent_ingestion",
    RUN_ID,
  ]);
  const queryText = queries[0]?.text ?? "";
  assert.match(queryText, /insert into growth\.email_assets/);
  assert.match(queryText, /from growth\.prospects p/);
  assert.match(queryText, /p\.id = \? and p\.research_run_id = \?/);
  assert.match(queryText, /update growth\.agent_tasks/);
  assert.match(queryText, /jsonb_build_object/);
  assert.match(queryText, /ea\.alt_text/);
  assert.doesNotMatch(queryText, /select\s+\*/i);
  assert.deepEqual(transactions, { attempts: 1, rollbacks: 0 });
});

test("fails persistence if the prospect leaves the referenced run", async () => {
  const { db, transactions } = createRecordingQuery([]);

  await assert.rejects(
    () => persistEmailAssetForRun(db, asset),
    (error) => {
      assert.ok(error instanceof EmailAssetAssociationError);
      return true;
    },
  );
  assert.deepEqual(transactions, { attempts: 1, rollbacks: 1 });
});
