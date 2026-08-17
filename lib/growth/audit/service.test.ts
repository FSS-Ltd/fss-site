import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb, GrowthTransaction } from "../db/types";
import { appendAuditEvent, type AuditInput } from "./service";

type RecordedQuery = {
  text: string;
  values: readonly unknown[];
};

function createRecordingDb(): {
  db: GrowthDb;
  queries: RecordedQuery[];
  transaction: GrowthTransaction;
} {
  const queries: RecordedQuery[] = [];
  const query = async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return [];
  };

  // The test double implements only the tagged-query collaborator used here.
  return {
    db: query as unknown as GrowthDb,
    queries,
    transaction: query as unknown as GrowthTransaction,
  };
}

const validInput: AuditInput = {
  correlationId: "corr-1",
  actorType: "founder",
  actorId: "founder-email-hash",
  action: "prospect.reviewed",
  entityType: "prospect",
  entityId: "00000000-0000-0000-0000-000000000001",
  metadata: { fitScore: 91, approved: true, reasonCode: "manual_review" },
};

test("appends a parameterised audit event with scalar metadata", async () => {
  const { db, queries } = createRecordingDb();

  await appendAuditEvent(db, validInput);

  assert.deepEqual(queries, [
    {
      text: [
        "insert into growth.audit_log (",
        "correlation_id, actor_type, actor_id, action,",
        "entity_type, entity_id, metadata",
        ") values ( ?, ?, ?, ?, ?, ?, ?::jsonb )",
      ].join(" "),
      values: [
        "corr-1",
        "founder",
        "founder-email-hash",
        "prospect.reviewed",
        "prospect",
        "00000000-0000-0000-0000-000000000001",
        JSON.stringify({
          fitScore: 91,
          approved: true,
          reasonCode: "manual_review",
        }),
      ],
    },
  ]);
});

test("uses an empty metadata object when metadata is omitted", async () => {
  const { db, queries } = createRecordingDb();
  const input = { ...validInput };
  delete input.metadata;

  await appendAuditEvent(db, input);

  assert.equal(queries[0]?.values.at(-1), "{}");
});

test("accepts a null reason code", async () => {
  const { db, queries } = createRecordingDb();

  await appendAuditEvent(db, {
    ...validInput,
    metadata: { reasonCode: null },
  });

  assert.equal(queries[0]?.values.at(-1), '{"reasonCode":null}');
});

test("accepts the transaction query surface", async () => {
  const { queries, transaction } = createRecordingDb();

  await appendAuditEvent(transaction, validInput);

  assert.equal(queries.length, 1);
});

test("rejects unsafe metadata before executing a query", async (t) => {
  const unsafeMetadata: ReadonlyArray<{
    name: string;
    value: unknown;
  }> = [
    { name: "nested object", value: { details: { source: "agent" } } },
    { name: "array", value: { tags: ["qualified"] } },
    { name: "non-finite number", value: { score: Number.NaN } },
    { name: "token", value: { accessToken: "sensitive" } },
    { name: "secret", value: { clientSecret: "sensitive" } },
    { name: "password", value: { passwordHash: "sensitive" } },
    { name: "body copy", value: { messageBody: "Hello" } },
    { name: "HTML", value: { emailHtml: "<p>Hello</p>" } },
    { name: "payload alias", value: { payload: "Bearer sensitive" } },
    { name: "PII alias", value: { contactEmail: "person@example.test" } },
    { name: "message alias", value: { message: "<html>full body</html>" } },
    { name: "invalid approval", value: { approved: "yes" } },
    { name: "out-of-range score", value: { fitScore: 101 } },
    { name: "free-form reason", value: { reasonCode: "Full message body" } },
  ];

  for (const scenario of unsafeMetadata) {
    await t.test(scenario.name, async () => {
      const { db, queries } = createRecordingDb();

      await assert.rejects(
        appendAuditEvent(db, {
          ...validInput,
          metadata: scenario.value as AuditInput["metadata"],
        }),
        /audit metadata/i,
      );
      assert.equal(queries.length, 0);
    });
  }
});
