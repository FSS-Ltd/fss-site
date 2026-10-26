import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import { getOutreachDrafts } from "./outreach-drafts";

function queryExecutor(
  query: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>,
): GrowthQueryExecutor {
  // These tests exercise only the tagged-query boundary, not postgres lifecycle methods.
  return query as unknown as GrowthQueryExecutor;
}

test("lists the latest unsent first-email drafts with review identities and safe contact names", async () => {
  const db = queryExecutor(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("?").replace(/\s+/g, " ");
      assert.match(query, /p.status = 'ready_for_email_review'/);
      assert.match(query, /at.task_type = 'first_email_draft'/);
      assert.match(query, /at.status = 'completed'/);
      assert.match(
        query,
        /order by coalesce\(at.completed_at, at.created_at\) desc, at.id desc limit 1/,
      );
      assert.match(
        query,
        /coalesce\(draft.output_snapshot ->> 'reviewState', 'draft'\) = 'draft'/,
      );
      assert.match(
        query,
        /not exists \( select 1 from growth.sequence_enrollments/,
      );
      assert.match(query, /limit \?/);
      assert.deepEqual(values, [50]);
      return [
        {
          draftTaskId: "11111111-1111-4111-8111-111111111111",
          businessName: "Example Plumbing Ltd",
          contactName: null,
          completedAt: new Date("2026-10-25T06:00:00Z"),
        },
      ];
    },
  );

  assert.deepEqual(await getOutreachDrafts(db), {
    status: "ready",
    rows: [
      {
        draftTaskId: "11111111-1111-4111-8111-111111111111",
        businessName: "Example Plumbing Ltd",
        contactName: "Unnamed contact",
        completedAt: "2026-10-25T06:00:00.000Z",
      },
    ],
  });
});

test("returns an empty queue when no draft awaits review", async () => {
  const db = queryExecutor(async () => []);
  assert.deepEqual(await getOutreachDrafts(db), { status: "ready", rows: [] });
});

test("contains draft-list failures without exposing database details", async () => {
  const db = queryExecutor(async () => {
    throw new Error("private database details");
  });
  assert.deepEqual(await getOutreachDrafts(db, () => "draft-reference"), {
    status: "error",
    message: "Email drafts could not load.",
    correlationId: "draft-reference",
  });
});
