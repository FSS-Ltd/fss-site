import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../types";
import { findBusinessIdentityByCompanyNumber } from "./businesses";
import { findContactIdentityByEmail } from "./contacts";
import { findProspectSummaryById } from "./prospects";

type RecordedQuery = {
  text: string;
  values: readonly unknown[];
};

function createRecordingQuery(rows: readonly object[]): {
  db: GrowthQueryExecutor;
  queries: RecordedQuery[];
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
    return rows;
  };

  // Repository tests need only the shared tagged-query surface.
  return { db: query as unknown as GrowthQueryExecutor, queries };
}

test("finds a business identity by normalised company number", async () => {
  const expected = {
    id: "00000000-0000-0000-0000-000000000001",
    legalName: "Example Limited",
    companyNumber: "12345678",
    corporateStatus: "active" as const,
    version: 2,
  };
  const { db, queries } = createRecordingQuery([expected]);

  const result = await findBusinessIdentityByCompanyNumber(db, " 12 34 56 78 ");

  assert.deepEqual(result, expected);
  assert.deepEqual(queries[0]?.values, ["12345678"]);
  assert.match(queries[0]?.text ?? "", /b\.legal_name as "legalName"/);
  assert.doesNotMatch(queries[0]?.text ?? "", /select\s+\*/i);
});

test("finds a contact identity by normalised email", async () => {
  const expected = {
    id: "00000000-0000-0000-0000-000000000002",
    businessId: "00000000-0000-0000-0000-000000000001",
    email: "person@example.test",
    subscriberType: "corporate" as const,
    lawfulBasis: "legitimate_interests" as const,
    version: 3,
  };
  const { db, queries } = createRecordingQuery([expected]);

  const result = await findContactIdentityByEmail(db, " Person@Example.Test ");

  assert.deepEqual(result, expected);
  assert.deepEqual(queries[0]?.values, ["person@example.test"]);
  assert.match(queries[0]?.text ?? "", /c\.business_id as "businessId"/);
  assert.doesNotMatch(queries[0]?.text ?? "", /select\s+\*/i);
});

test("returns a safe prospect summary by ID", async () => {
  const expected = {
    id: "00000000-0000-0000-0000-000000000003",
    businessName: "Example Limited",
    contactName: "Ada Lovelace",
    status: "qualified" as const,
    fitScore: 91,
    nextAction: "Review first email",
    nextActionDueAt: new Date("2026-08-18T09:00:00.000Z"),
  };
  const { db, queries } = createRecordingQuery([expected]);

  const result = await findProspectSummaryById(db, expected.id);

  assert.deepEqual(result, expected);
  assert.deepEqual(queries[0]?.values, [expected.id]);
  assert.match(queries[0]?.text ?? "", /nullif\(\s*concat_ws/);
  assert.doesNotMatch(
    queries[0]?.text ?? "",
    /select\s+\*|encrypted_refresh_token/i,
  );
});

test("returns null when a repository lookup has no match", async () => {
  const { db } = createRecordingQuery([]);

  assert.equal(await findBusinessIdentityByCompanyNumber(db, "12345678"), null);
  assert.equal(await findContactIdentityByEmail(db, "none@example.test"), null);
  assert.equal(
    await findProspectSummaryById(db, "00000000-0000-0000-0000-000000000099"),
    null,
  );
});
