import assert from "node:assert/strict";
import test from "node:test";

import {
  reconcileBespokeProspectPreviews,
  type BespokePreviewReconciliationRepository,
} from "./bespoke-reconciliation";

const pendingRows = [
  ["acckent.com", "acckent-accountants"],
  ["legrys.com", "legrys"],
  ["hostylets.co.uk", "hosty-lets"],
  ["eteelectric.co.uk", "ete-electrical"],
  ["jenkinsonestates.co.uk", "jenkinson-estates"],
  ["th-electrical.co.uk", "th-electrical"],
].map(([websiteHost, slug], index) => ({
  previewId: `00000000-0000-4000-8000-00000000000${index + 1}`,
  prospectId: `10000000-0000-4000-8000-00000000000${index + 1}`,
  websiteHost,
  slug,
}));

function createRepository(rows = pendingRows): {
  repository: BespokePreviewReconciliationRepository;
  updates: Array<{ previewId: string; slug: string }>;
} {
  const updates: Array<{ previewId: string; slug: string }> = [];
  return {
    repository: {
      async withTransaction(operation) {
        return operation({
          async listPendingDrafts() {
            return rows;
          },
          async markMergedDraft(input) {
            updates.push({ previewId: input.previewId, slug: input.slug });
            return true;
          },
        });
      },
    },
    updates,
  };
}

const release = {
  pullRequestNumber: 456,
  branch: "fix/reconcile-bespoke-concepts",
  generatedAt: new Date("2026-09-05T16:00:00.000Z"),
};

test("plans exactly the six expected pending bespoke drafts without writing by default", async () => {
  const { repository, updates } = createRepository();

  const result = await reconcileBespokeProspectPreviews({
    repository,
    release,
    apply: false,
  });

  assert.equal(result.status, "ready");
  assert.equal(result.previews.length, 6);
  assert.deepEqual(updates, []);
});

test("marks each expected pending bespoke draft merged when explicitly applied", async () => {
  const { repository, updates } = createRepository();

  const result = await reconcileBespokeProspectPreviews({
    repository,
    release,
    apply: true,
  });

  assert.equal(result.status, "applied");
  assert.deepEqual(
    updates.map((entry) => entry.slug).sort(),
    pendingRows.map((entry) => entry.slug).sort(),
  );
});

test("fails closed without writing when an expected host is missing", async () => {
  const { repository, updates } = createRepository(pendingRows.slice(1));

  await assert.rejects(
    reconcileBespokeProspectPreviews({ repository, release, apply: true }),
    /expected six/i,
  );
  assert.deepEqual(updates, []);
});

test("fails closed without writing when an expected host has duplicate pending drafts", async () => {
  const duplicate = {
    ...pendingRows[0]!,
    previewId: "90000000-0000-4000-8000-000000000001",
  };
  const { repository, updates } = createRepository([...pendingRows, duplicate]);

  await assert.rejects(
    reconcileBespokeProspectPreviews({ repository, release, apply: true }),
    /duplicate/i,
  );
  assert.deepEqual(updates, []);
});
