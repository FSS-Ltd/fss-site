import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthTransaction } from "../db/types";
import {
  insertDraftProspectPreview,
  insertDraftProspectPreviewWithRetry,
} from "./ingestion-repository";

const snapshot = {
  schemaVersion: "1.0" as const,
  businessName: "Example Heating Ltd",
  sector: "Home services",
  locality: "Canterbury",
  businessGoal: "Turn urgent enquiries into qualified calls.",
  primaryCta: "Request a callback",
  homepageSections: {
    schemaVersion: "1.0" as const,
    summary: "A clear homepage structure.",
    items: ["Hero section"],
  },
  conversionPlan: {
    schemaVersion: "1.0" as const,
    summary: "A simpler contact journey.",
    items: ["Clear enquiry route"],
  },
  trustSignals: {
    schemaVersion: "1.0" as const,
    summary: "Visible local service experience.",
    items: ["Service information"],
  },
};

test("inserts a draft preview with an opaque public ID and public snapshot", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });

  await insertDraftProspectPreview(transaction, {
    prospectId: "11111111-1111-4111-8111-111111111111",
    publicId: "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm",
    content: snapshot,
  });

  assert.match(queries[0]?.text ?? "", /insert into growth\.prospect_previews/i);
  assert.match(queries[0]?.text ?? "", /'draft'/i);
  assert.deepEqual(queries[0]?.values, [
    "11111111-1111-4111-8111-111111111111",
    "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm",
    snapshot,
  ]);
});

test("retries only a public-ID unique-key collision", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    if (queries.length === 1) {
      throw {
        code: "23505",
        constraint_name: "prospect_previews_public_id_key",
      };
    }
    return [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const publicIds = [
    "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm",
    "mX9ZhFcRqP9K1d3V8s5-0Y6x7A4NhV2Q",
  ];

  await insertDraftProspectPreviewWithRetry(
    transaction,
    {
      prospectId: "11111111-1111-4111-8111-111111111111",
      content: snapshot,
    },
    () => publicIds.shift()!,
  );

  assert.equal(queries.length, 2);
  assert.equal(queries[1]?.values[1], "mX9ZhFcRqP9K1d3V8s5-0Y6x7A4NhV2Q");
});
