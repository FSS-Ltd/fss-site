import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb, GrowthTransaction } from "../../db/types";
import type { PersistProspectPreviewAssetInput } from "./service";
import {
  PreviewAssetAssociationError,
  findRenderableProspectPreviewAsset,
  persistProspectPreviewAssetForRun,
  sourceEvidenceCanAcceptAsset,
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

const asset: PersistProspectPreviewAssetInput = {
  id: "c5b2e617-f78d-4d0d-9841-9c240c663be2",
  prospectId: "6322f2e9-a320-4e3c-8fbf-b2f137949e2c",
  runId: "d0f57e79-413f-41dc-b15f-1b609fb29db2",
  evidenceId: "bdac107a-2991-4c5e-a6ae-65933c2427cc",
  assetKind: "logo",
  blobUrl:
    "https://blob.example.test/growth-prospect-preview-assets/c5b2e617-f78d-4d0d-9841-9c240c663be2.webp",
  contentType: "image/webp",
  byteSize: 1024,
  width: 960,
  height: 480,
  altText: "Example Services wordmark used on the business website header.",
  sha256: "a".repeat(64),
  reviewStatus: "source_verified",
  createdBy: "agent_ingestion",
};

test("persists an asset only for its run, evidence record, and matching draft visual", async () => {
  const { db, queries, transactions } = createRecordingQuery([
    { id: asset.id, draftUpdated: true },
  ]);

  await persistProspectPreviewAssetForRun(db, asset);

  const query = queries[0];
  assert.match(query?.text ?? "", /insert into growth\.prospect_preview_assets/);
  assert.match(query?.text ?? "", /from growth\.prospect_preview_evidence/);
  assert.match(query?.text ?? "", /update growth\.prospect_previews/);
  assert.match(query?.text ?? "", /logoEvidenceId/);
  assert.match(query?.text ?? "", /logoAssetId/);
  assert.deepEqual(transactions, { attempts: 1, rollbacks: 0 });
});

test("checks the exact first-party evidence source before accepting an upload", async () => {
  const { db, queries } = createRecordingQuery([{ matches: true }]);

  const matches = await sourceEvidenceCanAcceptAsset(db, {
    runId: asset.runId,
    prospectId: asset.prospectId,
    evidenceId: asset.evidenceId,
    sourceUrl: "https://example.test/services",
    assetKind: asset.assetKind,
  });

  assert.equal(matches, true);
  assert.match(queries[0]?.text ?? "", /from growth\.prospect_preview_evidence/);
  assert.match(queries[0]?.text ?? "", /evidence_kind = \?/);
  assert.deepEqual(queries[0]?.values, [
    asset.evidenceId,
    asset.prospectId,
    asset.runId,
    asset.runId,
    "https://example.test/services",
    "logo",
  ]);
});

test("rejects an asset when the evidence does not belong to the draft prospect", async () => {
  const { db, transactions } = createRecordingQuery([]);

  await assert.rejects(
    () => persistProspectPreviewAssetForRun(db, asset),
    (error: unknown) => {
      assert.ok(error instanceof PreviewAssetAssociationError);
      return true;
    },
  );

  assert.deepEqual(transactions, { attempts: 1, rollbacks: 1 });
});

test("finds only an asset that is referenced by a state-appropriate preview", async () => {
  const { db, queries } = createRecordingQuery([
    {
      blobUrl: "https://blob.example.test/private-preview-asset.webp",
      contentType: "image/webp",
    },
  ]);

  const result = await findRenderableProspectPreviewAsset(db, {
    assetId: asset.id,
    isProduction: false,
  });

  assert.deepEqual(result, {
    blobUrl: "https://blob.example.test/private-preview-asset.webp",
    contentType: "image/webp",
  });
  assert.match(queries[0]?.text ?? "", /preview\.content_snapshot #>> '\{experienceBrief,visual,logoAssetId\}'/);
  assert.match(queries[0]?.text ?? "", /preview\.status = 'published'/);
  assert.match(queries[0]?.text ?? "", /preview\.generation_status = 'published'/);
  assert.match(queries[0]?.text ?? "", /asset\.review_status in \('source_verified', 'approved'\)/);
  assert.deepEqual(queries[0]?.values, [asset.id, false, false]);
});
