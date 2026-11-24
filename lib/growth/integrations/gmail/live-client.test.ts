import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../../db/types";
import { encryptRefreshToken } from "../token-crypto";
import { createLiveGmailClient, GmailNotConnectedError } from "./live-client";

const encryptionKey = Buffer.alloc(32, 9);

function fakeDb(row: Record<string, unknown> | undefined): GrowthQueryExecutor {
  return (async () => (row ? [row] : [])) as unknown as GrowthQueryExecutor;
}

test("builds a live Gmail client from a connected, decrypted credential", async () => {
  const encrypted = encryptRefreshToken("refresh-token-value", {
    version: "v1",
    key: encryptionKey,
  });
  const db = fakeDb({
    encryptedRefreshToken: JSON.stringify(encrypted),
    encryptionKeyVersion: "v1",
  });

  const client = await createLiveGmailClient(db, {
    clientId: "client-id",
    clientSecret: "client-secret",
    subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
    decryptionKeys: { v1: encryptionKey },
  });

  assert.equal(typeof client.createDraft, "function");
});

test("rejects when no Gmail connection is stored", async () => {
  const db = fakeDb(undefined);

  await assert.rejects(
    createLiveGmailClient(db, {
      clientId: "client-id",
      clientSecret: "client-secret",
      subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
      decryptionKeys: { v1: encryptionKey },
    }),
    GmailNotConnectedError,
  );
});

test("rejects when the decryption key version does not match", async () => {
  const encrypted = encryptRefreshToken("refresh-token-value", {
    version: "v1",
    key: encryptionKey,
  });
  const db = fakeDb({
    encryptedRefreshToken: JSON.stringify(encrypted),
    encryptionKeyVersion: "v1",
  });

  await assert.rejects(
    createLiveGmailClient(db, {
      clientId: "client-id",
      clientSecret: "client-secret",
      subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
      decryptionKeys: {},
    }),
  );
});

test("binds a live client to the same credential row and grant", async () => {
  const encrypted = encryptRefreshToken("refresh-token-value", {
    version: "v1",
    key: encryptionKey,
  });
  const { createBoundLiveGmailClient } = await import("./live-client");
  const result = await createBoundLiveGmailClient(
    fakeDb({
      encryptedRefreshToken: JSON.stringify(encrypted),
      encryptionKeyVersion: "v1",
      connectionId: "account",
      googleSubject: "subject",
      grantEpoch: 7,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    }),
    {
      clientId: "id",
      clientSecret: "secret",
      subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
      decryptionKeys: { v1: encryptionKey },
    },
  );
  assert.deepEqual(result.binding, {
    connectionId: "account",
    googleSubject: "subject",
    grantEpoch: 7,
    grantedScopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  });
  assert.equal(typeof result.client.listSentMessages, "function");
});

test("refuses bound observation without the credential row's verified subject", async () => {
  const encrypted = encryptRefreshToken("refresh-token-value", {
    version: "v1",
    key: encryptionKey,
  });
  const { createBoundLiveGmailClient } = await import("./live-client");
  await assert.rejects(
    createBoundLiveGmailClient(
      fakeDb({
        encryptedRefreshToken: JSON.stringify(encrypted),
        encryptionKeyVersion: "v1",
        connectionId: "account",
        googleSubject: null,
        grantEpoch: 7,
        grantedScopes: ["openid", "email"],
      }),
      {
        clientId: "id",
        clientSecret: "secret",
        subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
        decryptionKeys: { v1: encryptionKey },
      },
    ),
    GmailNotConnectedError,
  );
});

test("bound client rejects a connected grant missing required Gmail scope", async () => {
  const encrypted = encryptRefreshToken("refresh-token-value", {
    version: "v1",
    key: encryptionKey,
  });
  const { createBoundLiveGmailClient } = await import("./live-client");
  await assert.rejects(
    createBoundLiveGmailClient(
      fakeDb({
        encryptedRefreshToken: JSON.stringify(encrypted),
        encryptionKeyVersion: "v1",
        connectionId: "account",
        googleSubject: "subject",
        grantEpoch: 1,
        grantedScopes: ["email"],
      }),
      {
        clientId: "id",
        clientSecret: "secret",
        subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
        decryptionKeys: { v1: encryptionKey },
      },
    ),
    GmailNotConnectedError,
  );
});
