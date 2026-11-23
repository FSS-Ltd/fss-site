import assert from "node:assert/strict";
import test from "node:test";
import type { GrowthDb } from "../db/types";
import { runFirstPreparationBatch } from "./first-preparation-worker";

const binding = {
  connectionId: "11111111-1111-4111-8111-111111111111",
  googleSubject: "subject",
  grantEpoch: 1,
  grantedScopes: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/gmail.modify",
  ],
};

test("claims only the first preparation stage with a fixed bound", async () => {
  const queries: string[] = [];
  const db = (async (strings: TemplateStringsArray) => {
    queries.push(strings.join("?"));
    return [];
  }) as unknown as GrowthDb;
  Object.assign(db, {
    begin: async <T>(f: (tx: GrowthDb) => Promise<T>) => f(db),
  });
  const result = await runFirstPreparationBatch(db, {
    binding,
    workerId: "worker",
  });
  assert.deepEqual(result, { claimed: 0, prepared: 0, held: 0, retry: 0 });
  assert.match(queries.join(" "), /job_type\s*=\s*'first_preparation'/);
  assert.match(queries.join(" "), /skip locked/i);
  assert.match(queries.join(" "), /limit 25/i);
});

test("invalid worker input cannot claim jobs", async () => {
  const db = (() => {
    throw new Error("unexpected query");
  }) as unknown as GrowthDb;
  await assert.rejects(
    runFirstPreparationBatch(db, { binding, workerId: "" }),
    /invalid_batch/,
  );
});
