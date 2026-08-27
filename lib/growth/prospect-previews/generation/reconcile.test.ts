import assert from "node:assert/strict";
import test from "node:test";

import {
  reconcileProspectPreviewGenerationRun,
  type ProspectPreviewGenerationReconciliationRepository,
} from "./reconcile";

const records = [
  {
    previewId: "11111111-1111-4111-8111-111111111111",
    prospectId: "21111111-1111-4111-8111-111111111111",
    compositionDigest: "a".repeat(64),
    pullRequestNumber: 412,
  },
  {
    previewId: "12222222-2222-4222-8222-222222222222",
    prospectId: "22222222-2222-4222-8222-222222222222",
    compositionDigest: "b".repeat(64),
    pullRequestNumber: 413,
  },
  {
    previewId: "13333333-3333-4333-8333-333333333333",
    prospectId: "23333333-3333-4333-8333-333333333333",
    compositionDigest: "c".repeat(64),
    pullRequestNumber: 414,
  },
] as const;

test("marks only merged source packages with matching digests ready for founder approval", async () => {
  const marked: string[] = [];
  const repository: ProspectPreviewGenerationReconciliationRepository = {
    async listOpenPreviews() {
      return records;
    },
    async markMergedDraft(input) {
      marked.push(input.previewId);
      return true;
    },
  };

  const result = await reconcileProspectPreviewGenerationRun({
    repository,
    github: {
      async getPullRequest(number) {
        if (number === 412) {
          return {
            number,
            state: "closed",
            mergedAt: new Date("2026-08-27T07:00:00.000Z"),
          };
        }
        if (number === 413) return { number, state: "open", mergedAt: null };
        return { number, state: "closed", mergedAt: null };
      },
    },
    resolveComposition: (prospectId) =>
      prospectId === records[0].prospectId
        ? {
            prospectId,
            digest: records[0].compositionDigest,
          }
        : null,
  });

  assert.deepEqual(result, { merged: 1, waiting: 1, closed: 1, invalid: 0 });
  assert.deepEqual(marked, [records[0].previewId]);
});

test("fails closed when a merged pull request does not contain the stored composition", async () => {
  let marks = 0;
  const repository: ProspectPreviewGenerationReconciliationRepository = {
    async listOpenPreviews() {
      return [records[0]];
    },
    async markMergedDraft() {
      marks += 1;
      return true;
    },
  };

  const result = await reconcileProspectPreviewGenerationRun({
    repository,
    github: {
      async getPullRequest(number) {
        return {
          number,
          state: "closed",
          mergedAt: new Date("2026-08-27T07:00:00.000Z"),
        };
      },
    },
    resolveComposition: () => null,
  });

  assert.deepEqual(result, { merged: 0, waiting: 0, closed: 0, invalid: 1 });
  assert.equal(marks, 0);
});
