import assert from "node:assert/strict";
import test from "node:test";

import type {
  GrowthDb,
  GrowthQueryExecutor,
  GrowthTransaction,
} from "../types";
import {
  disconnectStoredGmailConnection,
  listIntegrationConnectionHealth,
  storeConnectedGmailConnection,
} from "./integration-connections";

test("returns a bounded, secret-free integration health projection", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const rows = [
    {
      provider: "gmail" as const,
      status: "connected" as const,
      lastSyncedAt: new Date("2026-08-17T06:00:00.000Z"),
    },
  ];
  const db = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    queries.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return rows;
  }) as unknown as GrowthQueryExecutor;

  const result = await listIntegrationConnectionHealth(
    db,
    " Founder@Example.Test ",
    5,
  );

  assert.deepEqual(result, rows);
  assert.deepEqual(queries[0]?.values, ["founder@example.test", 5]);
  const queryText = queries[0]?.text ?? "";
  const projection = queryText.split(" from ")[0] ?? "";
  assert.match(queryText, /where ic\.subject_email = \?/);
  assert.match(queryText, /limit \?/);
  assert.doesNotMatch(
    queryText,
    /encrypted_refresh_token|provider_cursor|last_error_code/i,
  );
  assert.doesNotMatch(projection, /subject_email/i);
});

test("rejects unbounded integration health requests", async () => {
  const db = (() => []) as unknown as GrowthQueryExecutor;

  await assert.rejects(
    () => listIntegrationConnectionHealth(db, "founder@example.test", 6),
    {
      name: "RangeError",
    },
  );
});

test("rejects a blank integration subject before querying", async () => {
  const db = (() => []) as unknown as GrowthQueryExecutor;

  await assert.rejects(() => listIntegrationConnectionHealth(db, "  "), {
    name: "TypeError",
  });
});

test("upserts a connected Gmail row and audit event in one transaction", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });
    return text.startsWith("insert into growth.integration_connections")
      ? [{ id: "gmail-connection-id" }]
      : [];
  }) as unknown as GrowthTransaction;
  const transactionWithJson = transaction as unknown as {
    json: (value: unknown) => unknown;
  };
  transactionWithJson.json = (value) => value;

  const db = {
    begin: async <T>(
      operation: (tx: GrowthTransaction) => Promise<T>,
    ): Promise<T> => operation(transaction),
  } as unknown as GrowthDb;
  const storedToken = {
    version: "v1",
    iv: "iv",
    ciphertext: "ciphertext",
    authTag: "tag",
  } as const;

  const id = await storeConnectedGmailConnection(db, {
    subjectEmail: "founder@example.test",
    encryptedRefreshToken: storedToken,
    grantedScopes: ["openid", "email", "gmail.modify"],
    accessTokenExpiresAt: new Date("2026-08-17T13:00:00.000Z"),
    correlationId: "gmail-connect-correlation",
    actorId: "founder-actor-id",
  });

  assert.equal(id, "gmail-connection-id");
  assert.equal(queries.length, 2);
  assert.match(
    queries[0]?.text ?? "",
    /on conflict \(provider, subject_email\) do update/,
  );
  assert.match(queries[0]?.text ?? "", /version = ic\.version \+ 1/);
  assert.deepEqual(queries[0]?.values, [
    "founder@example.test",
    JSON.stringify(storedToken),
    "v1",
    ["openid", "email", "gmail.modify"],
    new Date("2026-08-17T13:00:00.000Z"),
  ]);
  assert.match(queries[1]?.text ?? "", /insert into growth\.audit_log/);
  assert.deepEqual(queries[1]?.values.slice(0, 6), [
    "gmail-connect-correlation",
    "founder",
    "founder-actor-id",
    "integration.gmail.connected",
    "integration_connection",
    "gmail-connection-id",
  ]);
});

test("fails closed when the Gmail upsert returns no connection", async () => {
  const transaction = (async () => []) as unknown as GrowthTransaction;
  const transactionWithJson = transaction as unknown as {
    json: (value: unknown) => unknown;
  };
  transactionWithJson.json = (value) => value;
  const db = {
    begin: async <T>(
      operation: (tx: GrowthTransaction) => Promise<T>,
    ): Promise<T> => operation(transaction),
  } as unknown as GrowthDb;

  await assert.rejects(
    storeConnectedGmailConnection(db, {
      subjectEmail: "founder@example.test",
      encryptedRefreshToken: {
        version: "v1",
        iv: "iv",
        ciphertext: "ciphertext",
        authTag: "tag",
      },
      grantedScopes: ["openid"],
      accessTokenExpiresAt: new Date("2026-08-17T13:00:00.000Z"),
      correlationId: "correlation",
      actorId: "actor",
    }),
    /could not be stored/i,
  );
});

test("locks, revokes, clears, pauses, and audits Gmail state in one transaction", async () => {
  const events: string[] = [];
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });
    if (text.startsWith("select ic.id")) {
      return [
        {
          id: "connection-id",
          encryptedRefreshToken: "encrypted-envelope",
          encryptionKeyVersion: "v1",
        },
      ];
    }
    if (text.startsWith("update growth.sequence_enrollments")) {
      return [{ id: "sequence-1" }, { id: "sequence-2" }];
    }
    return [];
  }) as unknown as GrowthTransaction;
  const transactionWithJson = transaction as unknown as {
    json: (value: unknown) => unknown;
  };
  transactionWithJson.json = (value) => value;
  const db = {
    begin: async <T>(
      operation: (tx: GrowthTransaction) => Promise<T>,
    ): Promise<T> => operation(transaction),
  } as unknown as GrowthDb;

  const result = await disconnectStoredGmailConnection(db, {
    subjectEmail: " Founder@Example.Test ",
    correlationId: "disconnect-correlation",
    actorId: "founder-actor",
    confirmProviderRevocation: async (credential) => {
      events.push("provider-revocation");
      assert.deepEqual(credential, {
        encryptedRefreshToken: "encrypted-envelope",
        encryptionKeyVersion: "v1",
      });
      return "confirmed";
    },
  });

  assert.deepEqual(events, ["provider-revocation"]);
  assert.deepEqual(result, {
    connectionId: "connection-id",
    providerRevocation: "confirmed",
    pausedEnrollmentCount: 2,
  });
  assert.match(queries[0]?.text ?? "", /for update$/);
  assert.deepEqual(queries[0]?.values, ["founder@example.test"]);
  assert.match(
    queries[1]?.text ?? "",
    /encrypted_refresh_token = null.*status = 'revoked'/,
  );
  assert.deepEqual(queries[1]?.values, ["confirmed", "connection-id"]);
  assert.match(
    queries[2]?.text ?? "",
    /where se\.status = 'active'.*returning se\.id/,
  );
  assert.match(
    queries[2]?.text ?? "",
    /growth\.email_messages.*em\.channel = 'gmail'/,
  );
  assert.equal(
    queries.filter((query) => /insert into growth\.audit_log/.test(query.text))
      .length,
    3,
  );
});

test("disconnect is fail-safe and idempotent when no Gmail credential exists", async () => {
  let providerRevocationCalled = false;
  const queries: string[] = [];
  const transaction = (async (strings: TemplateStringsArray) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push(text);
    if (text.startsWith("select ic.id")) return [];
    if (text.startsWith("update growth.sequence_enrollments")) return [];
    return [];
  }) as unknown as GrowthTransaction;
  const transactionWithJson = transaction as unknown as {
    json: (value: unknown) => unknown;
  };
  transactionWithJson.json = (value) => value;
  const db = {
    begin: async <T>(
      operation: (tx: GrowthTransaction) => Promise<T>,
    ): Promise<T> => operation(transaction),
  } as unknown as GrowthDb;

  const result = await disconnectStoredGmailConnection(db, {
    subjectEmail: "founder@example.test",
    correlationId: "disconnect-correlation",
    actorId: "founder-actor",
    confirmProviderRevocation: async () => {
      providerRevocationCalled = true;
      return "confirmed";
    },
  });

  assert.equal(providerRevocationCalled, false);
  assert.deepEqual(result, {
    connectionId: null,
    providerRevocation: "not_required",
    pausedEnrollmentCount: 0,
  });
  assert.equal(
    queries.some((query) =>
      query.startsWith("update growth.integration_connections"),
    ),
    false,
  );
});
