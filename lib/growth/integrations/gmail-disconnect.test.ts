import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import type { StoredEncryptedToken } from "./token-crypto";
import {
  disconnectGmail,
  type GmailDisconnectDependencies,
} from "./gmail-disconnect";

const encryptedToken: StoredEncryptedToken = {
  version: "v1",
  iv: "initialisation-vector",
  ciphertext: "opaque-ciphertext",
  authTag: "authentication-tag",
};

const input = {
  subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
  encryptionKeys: { v1: Buffer.alloc(32, 7) },
  correlationId: "gmail-disconnect-correlation",
  actorId: "founder-actor-id",
};

function createDependencies(
  overrides: Partial<GmailDisconnectDependencies> = {},
): GmailDisconnectDependencies {
  return {
    decryptToken: () => "refresh-token",
    revokeToken: async () => true,
    disconnectStoredConnection: async (_db, value) => ({
      connectionId: "connection-id",
      providerRevocation: await value.confirmProviderRevocation({
        encryptedRefreshToken: JSON.stringify(encryptedToken),
        encryptionKeyVersion: "v1",
      }),
      pausedEnrollmentCount: 2,
    }),
    ...overrides,
  };
}

test("decrypts and confirms provider revocation before local disconnect", async () => {
  const events: string[] = [];
  const dependencies = createDependencies({
    decryptToken: (stored, keys) => {
      events.push("decrypt");
      assert.deepEqual(stored, encryptedToken);
      assert.equal(keys, input.encryptionKeys);
      return "refresh-token";
    },
    revokeToken: async (token) => {
      events.push("revoke");
      assert.equal(token, "refresh-token");
      return true;
    },
    disconnectStoredConnection: async (_db, value) => {
      events.push("transaction-start");
      assert.deepEqual(
        {
          subjectEmail: value.subjectEmail,
          correlationId: value.correlationId,
          actorId: value.actorId,
        },
        {
          subjectEmail: input.subjectEmail,
          correlationId: input.correlationId,
          actorId: input.actorId,
        },
      );
      const providerRevocation = await value.confirmProviderRevocation({
        encryptedRefreshToken: JSON.stringify(encryptedToken),
        encryptionKeyVersion: "v1",
      });
      events.push("transaction-finish");
      return {
        connectionId: "connection-id",
        providerRevocation,
        pausedEnrollmentCount: 2,
      };
    },
  });

  const result = await disconnectGmail({} as GrowthDb, input, dependencies);

  assert.deepEqual(events, [
    "transaction-start",
    "decrypt",
    "revoke",
    "transaction-finish",
  ]);
  assert.deepEqual(result, {
    connectionId: "connection-id",
    providerRevocation: "confirmed",
    pausedEnrollmentCount: 2,
  });
});

test("continues the local security disconnect when stored credentials are invalid", async () => {
  let providerCalled = false;
  const dependencies = createDependencies({
    revokeToken: async () => {
      providerCalled = true;
      return true;
    },
    disconnectStoredConnection: async (_db, value) => ({
      connectionId: "connection-id",
      providerRevocation: await value.confirmProviderRevocation({
        encryptedRefreshToken: "not-json",
        encryptionKeyVersion: "v1",
      }),
      pausedEnrollmentCount: 1,
    }),
  });

  const result = await disconnectGmail({} as GrowthDb, input, dependencies);

  assert.equal(providerCalled, false);
  assert.equal(result.providerRevocation, "unconfirmed");
  assert.equal(result.pausedEnrollmentCount, 1);
});

test("continues the local security disconnect when Google cannot confirm revocation", async () => {
  const dependencies = createDependencies({
    revokeToken: async () => false,
  });

  const result = await disconnectGmail({} as GrowthDb, input, dependencies);

  assert.equal(result.providerRevocation, "unconfirmed");
});
