import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb, GrowthTransaction } from "../db/types";
import { postgresProspectPreviewApprovalRepository } from "./approval-repository";

test("locks approval state, publishes the preview, saves the email, and audits atomically", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });
    if (text.startsWith("select p.id as \"prospectId\"")) {
      return [
        {
          prospectId: "prospect-id",
          prospectStatus: "ready_for_email_review",
          prospectVersion: 3,
          previewId: "preview-id",
          publicId: "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm",
          previewStatus: "draft",
          previewVersion: 1,
          assessmentStatus: "pending_review",
          draftId: "draft-id",
          draftStatus: "completed",
          outputSnapshot: { schemaVersion: "1.0" },
          completedAt: new Date("2026-08-26T09:00:00.000Z"),
        },
      ];
    }
    if (text.startsWith("select exists")) return [{ exists: false }];
    if (text.startsWith("update growth.prospects")) return [{ id: "prospect-id" }];
    if (text.startsWith("update growth.prospect_previews")) return [{ id: "preview-id" }];
    if (text.startsWith("update growth.agent_tasks")) return [{ id: "draft-id" }];
    return [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const db = {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
  } as unknown as GrowthDb;

  const result = await postgresProspectPreviewApprovalRepository.withTransaction(
    db,
    async (tx) => {
      const state = await tx.lockApprovalState("prospect-id");
      await tx.publishPreviewAndSaveEmail({
        prospectId: "prospect-id",
        expectedProspectVersion: 3,
        previewId: "preview-id",
        expectedPreviewVersion: 1,
        draftTaskId: "draft-id",
        outputSnapshot: { schemaVersion: "1.0", draftVersion: 2 },
        approvedAt: new Date("2026-08-26T10:00:00.000Z"),
        approvedBy: "a".repeat(64),
      });
      await tx.appendApprovalAudit({
        correlationId: "approval-correlation-id",
        actorId: "a".repeat(64),
        prospectId: "prospect-id",
        previewId: "preview-id",
      });
      return state;
    },
  );

  assert.equal(result?.preview.publicId, "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm");
  assert.match(queries[0]?.text ?? "", /growth\.prospect_previews/);
  assert.match(queries[0]?.text ?? "", /for update of p, pp, wa, at$/);
  assert.match(queries[1]?.text ?? "", /growth\.sequence_enrollments/);
  assert.match(queries[2]?.text ?? "", /version = version \+ 1/);
  assert.match(queries[3]?.text ?? "", /status = 'published'/);
  assert.match(queries[3]?.text ?? "", /approved_by = \?/);
  assert.match(queries[4]?.text ?? "", /set output_snapshot = \?/);
  assert.match(queries[5]?.text ?? "", /insert into growth\.audit_log/);
  assert.deepEqual(queries[5]?.values.slice(0, 6), [
    "approval-correlation-id",
    "founder",
    "a".repeat(64),
    "prospect_preview.approved",
    "prospect_preview",
    "preview-id",
  ]);
});
