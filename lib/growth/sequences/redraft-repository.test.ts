import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb, GrowthTransaction } from "../db/types";
import { postgresFirstEmailRedraftRepository } from "./redraft-repository";

test("locks the draft, inserts a pending redraft task, and audits atomically", async () => {
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
          researchRunId: "run-id",
          status: "completed",
          outputSnapshot: { schemaVersion: "1.0" },
          completedAt: new Date("2026-08-17T06:00:00.000Z"),
        },
      ];
    }
    if (text.startsWith("select exists")) return [{ exists: false }];
    if (text.startsWith("insert into growth.agent_tasks")) {
      return [{ id: "redraft-task-id" }];
    }
    return [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const db = {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
  } as unknown as GrowthDb;

  const result = await postgresFirstEmailRedraftRepository.withTransaction(
    db,
    async (tx) => {
      const draft = await tx.lockDraft("draft-id");
      const created = await tx.createRedraftTask({
        researchRunId: "run-id",
        prospectId: "prospect-id",
        draftTaskId: "draft-id",
        reason: "The offer needs to reference their new service line.",
      });
      await tx.appendRedraftAudit({
        correlationId: "correlation-id",
        actorId: "founder-actor",
        draftTaskId: "draft-id",
      });
      return { draft, created };
    },
  );

  assert.equal(result.draft?.id, "draft-id");
  assert.equal(result.created.redraftTaskId, "redraft-task-id");
  assert.match(queries[0]?.text ?? "", /task_type = 'first_email_draft'/);
  assert.match(queries[2]?.text ?? "", /insert into growth\.agent_tasks/);
  assert.deepEqual(queries[2]?.values, [
    "run-id",
    "prospect-id",
    {
      schemaVersion: "1.0",
      redraftOfDraftTaskId: "draft-id",
      reason: "The offer needs to reference their new service line.",
    },
    "redraft:draft-id",
  ]);
  assert.match(queries[3]?.text ?? "", /insert into growth\.audit_log/);
  assert.deepEqual(queries[3]?.values.slice(0, 6), [
    "correlation-id",
    "founder",
    "founder-actor",
    "first_email.redraft_requested",
    "agent_task",
    "draft-id",
  ]);
});

test("returns the existing redraft task on a duplicate idempotency key", async () => {
  const transaction = (async (strings: TemplateStringsArray) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    if (text.startsWith("insert into growth.agent_tasks")) return [];
    if (text.startsWith("select id from growth.agent_tasks")) {
      return [{ id: "existing-redraft-task-id" }];
    }
    return [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const db = {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
  } as unknown as GrowthDb;

  const result = await postgresFirstEmailRedraftRepository.withTransaction(
    db,
    (tx) =>
      tx.createRedraftTask({
        researchRunId: "run-id",
        prospectId: "prospect-id",
        draftTaskId: "draft-id",
        reason: "The offer needs to reference their new service line.",
      }),
  );

  assert.equal(result.redraftTaskId, "existing-redraft-task-id");
});

test("returns null for an unknown draft", async () => {
  const transaction = (async (strings: TemplateStringsArray) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    return text.startsWith("select at.id") ? [] : [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const db = {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
  } as unknown as GrowthDb;

  await postgresFirstEmailRedraftRepository.withTransaction(db, async (tx) => {
    assert.equal(await tx.lockDraft("missing"), null);
  });
});
