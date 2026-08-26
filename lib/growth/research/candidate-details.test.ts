import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthTransaction } from "../db/types";
import { insertCandidateDetails } from "./candidate-details";
import { createValidResearchRunFixture } from "./ingestion-schema.test-fixture";

test("stores the sourced email narrative with the first-email draft", async () => {
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
  const candidate = createValidResearchRunFixture().prospects[0]!;

  await insertCandidateDetails(transaction, {
    runId: "11111111-1111-4111-8111-111111111111",
    candidateIndex: 0,
    candidate,
    inserted: {
      businessId: "22222222-2222-4222-8222-222222222222",
      contactId: "33333333-3333-4333-8333-333333333333",
      prospectId: "44444444-4444-4444-8444-444444444444",
    },
    visual: {
      kind: "fallback",
      fallbackAssetKey: "home-property",
      pathname: "/growth/email/fallbacks/home-property.png",
      sha256: "a".repeat(64),
      altText: "Concept showing a service enquiry moving into an organised call-back workflow.",
      conceptDisclaimer: candidate.visual.conceptDisclaimer,
    },
    externalRunId: "research-run-id",
    promptVersion: "weekday-research-v1",
  });

  const taskInsert = queries.find((query) =>
    query.text.includes("insert into growth.agent_tasks"),
  );
  const outputSnapshot = taskInsert?.values[3] as {
    emailNarrative?: unknown;
  };

  assert.deepEqual(outputSnapshot.emailNarrative, candidate.emailNarrative);
});
