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
  let values: readonly unknown[] = [];
  const db = (async (
    strings: TemplateStringsArray,
    ...args: readonly unknown[]
  ) => {
    queries.push(strings.join("?"));
    values = args;
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
  assert.ok(values.includes(25));
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

test("respects a smaller shared batch allowance", async () => {
  let values: readonly unknown[] = [];
  const db = (async (
    _strings: TemplateStringsArray,
    ...args: readonly unknown[]
  ) => {
    values = args;
    return [];
  }) as unknown as GrowthDb;
  Object.assign(db, {
    begin: async <T>(f: (tx: GrowthDb) => Promise<T>) => f(db),
  });
  await runFirstPreparationBatch(db, {
    binding,
    workerId: "worker",
    limit: 13,
  });
  assert.ok(values.includes(13));
});

test("Resend preparation claims only its provider without placing credentials in queries", async () => {
  const calls: { sql: string; values: readonly unknown[] }[] = [];
  const db = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    calls.push({ sql: strings.join("?"), values });
    return [];
  }) as unknown as GrowthDb;
  Object.assign(db, {
    begin: async <T>(f: (tx: GrowthDb) => Promise<T>) => f(db),
  });
  const result = await runFirstPreparationBatch(db, {
    workerId: "resend-worker",
    binding: {
      provider: "resend",
      connectionId: "11111111-1111-4111-8111-111111111111",
      runtime: {
        binding: {
          team: "fixture",
          environment: "development",
          sender: "a@example.org",
          domain: "example.org",
          replyTo: "a@example.org",
          sendGeneration: "22222222-2222-4222-8222-222222222222",
          usageGeneration: "33333333-3333-4333-8333-333333333333",
        },
        sendCredential: "synthetic-send",
        usageCredential: "synthetic-usage",
      },
    },
  });
  assert.equal(result.claimed, 0);
  assert.ok(calls.some(({ values }) => values.includes("resend")));
  assert.ok(
    calls.every(
      ({ values }) =>
        !values.includes("synthetic-send") &&
        !values.includes("synthetic-usage"),
    ),
  );
  assert.match(calls[0]?.sql ?? "", /c\.policy->>'provider'=p\.provider/);
});
