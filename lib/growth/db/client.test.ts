import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "./types";

function asGrowthDb(fake: object): GrowthDb {
  // Unit fakes implement only the collaborator exercised by each test.
  return fake as GrowthDb;
}

const REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "AUTH_SECRET",
  "GOOGLE_AUTH_CLIENT_ID",
  "GOOGLE_AUTH_CLIENT_SECRET",
  "GROWTH_OS_OWNER_EMAIL",
  "TOKEN_ENCRYPTION_KEY",
  "GROWTH_OS_AUTOMATIONS_ENABLED",
] as const;

test("loads without reading the server environment", async () => {
  const previousValues = new Map(
    REQUIRED_ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  for (const key of REQUIRED_ENV_KEYS) delete process.env[key];

  try {
    await assert.doesNotReject(import("./client"));
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("configures the transaction pooler without prepared statements", async () => {
  const { createPostgresOptions } = await import("./client");

  assert.deepEqual(createPostgresOptions(), {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
});

test("passes the connection string and pooler options to the SQL factory", async () => {
  const { createGrowthDb } = await import("./client");
  const expectedDb = asGrowthDb({ name: "fake-growth-db" });
  const calls: unknown[][] = [];

  const result = createGrowthDb(
    "postgresql://app@example.test:6543/postgres",
    (...args: unknown[]) => {
      calls.push(args);
      return expectedDb;
    },
  );

  assert.equal(result, expectedDb);
  assert.deepEqual(calls, [
    [
      "postgresql://app@example.test:6543/postgres",
      {
        prepare: false,
        max: 5,
        idle_timeout: 20,
        connect_timeout: 10,
      },
    ],
  ]);
});

test("returns the operation result when a transaction commits", async () => {
  const { withGrowthTransaction } = await import("./client");
  const events: string[] = [];
  const transaction = { name: "fake-transaction" };
  const db = {
    async begin(
      operation: (value: typeof transaction) => Promise<string>,
    ): Promise<string> {
      events.push("begin");
      try {
        const result = await operation(transaction);
        events.push("commit");
        return result;
      } catch (error) {
        events.push("rollback");
        throw error;
      }
    },
  };

  const result = await withGrowthTransaction(asGrowthDb(db), async (tx) => {
    assert.equal(tx, transaction);
    events.push("operation");
    return "committed";
  });

  assert.equal(result, "committed");
  assert.deepEqual(events, ["begin", "operation", "commit"]);
});

test("propagates the error when a transaction rolls back", async () => {
  const { withGrowthTransaction } = await import("./client");
  const expectedError = new Error("operation failed");
  const events: string[] = [];
  const db = {
    async begin(operation: () => Promise<never>): Promise<never> {
      events.push("begin");
      try {
        return await operation();
      } catch (error) {
        events.push("rollback");
        throw error;
      }
    },
  };

  await assert.rejects(
    withGrowthTransaction(asGrowthDb(db), async () => {
      events.push("operation");
      throw expectedError;
    }),
    expectedError,
  );
  assert.deepEqual(events, ["begin", "operation", "rollback"]);
});

test("creates the shared client on first access and reuses it", async () => {
  const previousValues = new Map(
    REQUIRED_ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  Object.assign(process.env, {
    DATABASE_URL: "postgresql://app@example.test:6543/postgres",
    AUTH_SECRET: "a".repeat(32),
    GOOGLE_AUTH_CLIENT_ID: "client-id",
    GOOGLE_AUTH_CLIENT_SECRET: "client-secret",
    GROWTH_OS_OWNER_EMAIL: "j.ntagengwa@faithfulsoftware.dev",
    TOKEN_ENCRYPTION_KEY: "b".repeat(32),
    GROWTH_OS_AUTOMATIONS_ENABLED: "false",
  });
  delete process.env.DIRECT_DATABASE_URL;

  try {
    const { getGrowthDb } = await import("./client");
    const first = getGrowthDb();
    const second = getGrowthDb();

    assert.equal(second, first);
    await first.end();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
