import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb, GrowthTransaction } from "../db/types";
import { postgresFirstEmailRevisionRepository } from "./first-email-revision-repository";

test("locks one draft, stores its snapshot, and appends an audit atomically", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });
    if (text.startsWith("select at.id")) {
      return [
        {
          id: "draft-id",
          prospectId: "prospect-id",
          status: "completed",
          outputSnapshot: { schemaVersion: "1.0" },
          completedAt: new Date("2026-08-17T06:00:00.000Z"),
        },
      ];
    }
    if (text.startsWith("select exists")) return [{ exists: false }];
    if (text.startsWith("update growth.agent_tasks")) {
      return [{ id: "draft-id" }];
    }
    return [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const db = {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
  } as unknown as GrowthDb;

  const result = await postgresFirstEmailRevisionRepository.withTransaction(
    db,
    async (tx) => {
      const draft = await tx.lockDraft("draft-id");
      await tx.saveDraftRevision({
        draftTaskId: "draft-id",
        outputSnapshot: { schemaVersion: "1.0", draftVersion: 2 },
      });
      await tx.appendRevisionAudit({
        correlationId: "correlation-id",
        actorId: "founder-actor",
        draftTaskId: "draft-id",
      });
      return draft;
    },
  );

  assert.equal(result?.id, "draft-id");
  assert.match(queries[0]?.text ?? "", /task_type = 'first_email_draft'/);
  assert.match(queries[0]?.text ?? "", /for update of at$/);
  assert.deepEqual(queries[0]?.values, ["draft-id"]);
  assert.match(queries[1]?.text ?? "", /growth\.sequence_enrollments/);
  assert.deepEqual(queries[1]?.values, ["prospect-id"]);
  assert.match(queries[2]?.text ?? "", /set output_snapshot = \?/);
  assert.match(queries[2]?.text ?? "", /updated_at = now\(\)/);
  assert.deepEqual(queries[2]?.values, [
    { schemaVersion: "1.0", draftVersion: 2 },
    "draft-id",
  ]);
  assert.match(queries[3]?.text ?? "", /insert into growth\.audit_log/);
  assert.deepEqual(queries[3]?.values.slice(0, 6), [
    "correlation-id",
    "founder",
    "founder-actor",
    "email_draft.revised",
    "agent_task",
    "draft-id",
  ]);
});

test("returns null for an unknown draft and fails a missing update", async () => {
  const transaction = (async (strings: TemplateStringsArray) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    return text.startsWith("select at.id") ? [] : [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const db = {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
  } as unknown as GrowthDb;

  await postgresFirstEmailRevisionRepository.withTransaction(db, async (tx) => {
    assert.equal(await tx.lockDraft("missing"), null);
    await assert.rejects(
      tx.saveDraftRevision({
        draftTaskId: "missing",
        outputSnapshot: {},
      }),
      /could not be stored/i,
    );
  });
});
