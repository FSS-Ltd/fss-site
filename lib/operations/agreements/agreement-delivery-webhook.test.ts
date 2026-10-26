import assert from "node:assert/strict";
import test from "node:test";
import { applyAgreementDeliveryEvent } from "./agreement-delivery-webhook";
import type { OperationsDb } from "../db/client";

const payload = {
  type: "email.delivered" as const,
  created_at: "2026-10-26T21:00:00Z",
  data: {
    email_id: "provider-id",
    from: "FSS <hello@faithfulsoftware.dev>",
    to: ["signer@example.test"],
    tags: { operations_job: "10000000-0000-4000-8000-000000000001" },
  },
};

for (const from of [
  "FSS <hello@faithfulsoftware.dev>",
  "FSS <hello@faithfulsoftwaresolutions.co.uk>",
]) {
  test(`records delivery for ${from}`, async () => {
    const values: unknown[][] = [];
    // Only the tagged-query boundary is used; no postgres connection is created.
    const db = (async (
      _sql: TemplateStringsArray,
      ...parameters: unknown[]
    ) => {
      values.push(parameters);
    }) as unknown as OperationsDb;
    await applyAgreementDeliveryEvent(db, "event-id", {
      ...payload,
      data: { ...payload.data, from },
    });
    assert.deepEqual(values, [
      [
        payload.data.tags.operations_job,
        "event-id",
        "delivered",
        "provider-id",
        "signer@example.test",
        payload.created_at,
      ],
    ]);
  });
}

test("ignores delivery events from an unrelated sender", async () => {
  let queries = 0;
  // This fake only records whether the webhook attempts a tagged query.
  const db = (async () => {
    queries++;
  }) as unknown as OperationsDb;
  await applyAgreementDeliveryEvent(db, "event-id", {
    ...payload,
    data: { ...payload.data, from: "Other <other@example.test>" },
  });
  assert.equal(queries, 0);
});
