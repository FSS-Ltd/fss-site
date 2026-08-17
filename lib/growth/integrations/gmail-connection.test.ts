import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import type {
  GoogleIdentity,
  GoogleOAuthConfig,
  GoogleOAuthTokens,
} from "./google-oauth";
import {
  connectGmail,
  GmailConnectionError,
  type GmailConnectionDependencies,
} from "./gmail-connection";

const oauthConfig: GoogleOAuthConfig = {
  clientId: "gmail-client",
  clientSecret: "gmail-secret",
  redirectUri: "https://example.test/api/integrations/gmail/callback",
};

const tokens: GoogleOAuthTokens = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresInSeconds: 3600,
  grantedScopes: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/gmail.modify",
  ],
  tokenType: "Bearer",
};

const identity: GoogleIdentity = {
  subject: "google-subject",
  email: "J.Ntagengwa@FaithfulSoftware.dev",
  emailVerified: true,
};

function createDependencies(
  overrides: Partial<GmailConnectionDependencies> = {},
): GmailConnectionDependencies {
  return {
    exchangeAuthorizationCode: async () => tokens,
    fetchIdentity: async () => identity,
    encryptToken: () => ({
      version: "v1",
      iv: "initialisation-vector",
      ciphertext: "opaque-ciphertext",
      authTag: "authentication-tag",
    }),
    storeConnection: async () => "connection-id",
    now: () => new Date("2026-08-17T12:00:00.000Z"),
    ...overrides,
  };
}

const input = {
  authorizationCode: "authorization-code",
  oauthConfig,
  expectedSubjectEmail: "j.ntagengwa@faithfulsoftware.dev",
  encryptionKey: Buffer.alloc(32, 7),
  correlationId: "gmail-connect-correlation",
  actorId: "founder-actor-id",
};

test("connects only the verified founder Gmail identity and stores an encrypted token", async () => {
  const calls: string[] = [];
  let storedInput: Parameters<
    GmailConnectionDependencies["storeConnection"]
  >[1];
  const dependencies = createDependencies({
    exchangeAuthorizationCode: async (config, code) => {
      calls.push("exchange");
      assert.deepEqual(config, oauthConfig);
      assert.equal(code, input.authorizationCode);
      return tokens;
    },
    fetchIdentity: async (accessToken) => {
      calls.push("identity");
      assert.equal(accessToken, tokens.accessToken);
      return identity;
    },
    encryptToken: (refreshToken, config) => {
      calls.push("encrypt");
      assert.equal(refreshToken, tokens.refreshToken);
      assert.equal(config.version, "v1");
      assert.equal(config.key, input.encryptionKey);
      return {
        version: "v1",
        iv: "initialisation-vector",
        ciphertext: "opaque-ciphertext",
        authTag: "authentication-tag",
      };
    },
    storeConnection: async (_db, value) => {
      calls.push("store");
      storedInput = value;
      return "connection-id";
    },
    now: () => {
      calls.push("issued-at");
      return new Date("2026-08-17T12:00:00.000Z");
    },
  });

  const result = await connectGmail({} as GrowthDb, input, dependencies);

  assert.deepEqual(calls, [
    "exchange",
    "issued-at",
    "identity",
    "encrypt",
    "store",
  ]);
  assert.deepEqual(storedInput!, {
    subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
    encryptedRefreshToken: {
      version: "v1",
      iv: "initialisation-vector",
      ciphertext: "opaque-ciphertext",
      authTag: "authentication-tag",
    },
    grantedScopes: tokens.grantedScopes,
    accessTokenExpiresAt: new Date("2026-08-17T13:00:00.000Z"),
    correlationId: input.correlationId,
    actorId: input.actorId,
  });
  assert.doesNotMatch(
    JSON.stringify(storedInput!.encryptedRefreshToken),
    /refresh-token/,
  );
  assert.deepEqual(result, {
    connectionId: "connection-id",
    subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
  });
});

test("rejects a token response without a refresh token before identity lookup", async () => {
  let identityFetched = false;
  let stored = false;
  const dependencies = createDependencies({
    exchangeAuthorizationCode: async () => {
      const withoutRefreshToken = { ...tokens };
      delete withoutRefreshToken.refreshToken;
      return withoutRefreshToken;
    },
    fetchIdentity: async () => {
      identityFetched = true;
      return identity;
    },
    storeConnection: async () => {
      stored = true;
      return "connection-id";
    },
  });

  await assert.rejects(connectGmail({} as GrowthDb, input, dependencies), {
    name: "GmailConnectionError",
    code: "MISSING_REFRESH_TOKEN",
    message: "Google did not issue a Gmail refresh token.",
  });
  assert.equal(identityFetched, false);
  assert.equal(stored, false);
});

test("rejects a different Google account before encrypting or storing it", async () => {
  let encrypted = false;
  let stored = false;
  const dependencies = createDependencies({
    fetchIdentity: async () => ({
      ...identity,
      email: "someone.else@example.test",
    }),
    encryptToken: () => {
      encrypted = true;
      throw new Error("must not run");
    },
    storeConnection: async () => {
      stored = true;
      return "connection-id";
    },
  });

  await assert.rejects(connectGmail({} as GrowthDb, input, dependencies), {
    name: "GmailConnectionError",
    code: "UNAUTHORIZED_GOOGLE_IDENTITY",
    message: "The authorised Google account cannot be connected.",
  });
  assert.equal(encrypted, false);
  assert.equal(stored, false);
});

test("rejects an unverified founder Google identity", async () => {
  const dependencies = createDependencies({
    fetchIdentity: async () => ({ ...identity, emailVerified: false }),
  });

  await assert.rejects(connectGmail({} as GrowthDb, input, dependencies), {
    name: GmailConnectionError.name,
    code: "UNAUTHORIZED_GOOGLE_IDENTITY",
  });
});

test("anchors access-token expiry before a delayed identity lookup", async () => {
  const events: string[] = [];
  let storedExpiry: Date | undefined;
  const dependencies = createDependencies({
    exchangeAuthorizationCode: async () => {
      events.push("exchange");
      return tokens;
    },
    now: () => {
      events.push("issued-at");
      return new Date("2026-08-17T12:00:00.000Z");
    },
    fetchIdentity: async () => {
      events.push("identity-start");
      await Promise.resolve();
      events.push("identity-end");
      return identity;
    },
    storeConnection: async (_db, value) => {
      storedExpiry = value.accessTokenExpiresAt;
      return "connection-id";
    },
  });

  await connectGmail({} as GrowthDb, input, dependencies);

  assert.deepEqual(events, [
    "exchange",
    "issued-at",
    "identity-start",
    "identity-end",
  ]);
  assert.deepEqual(storedExpiry, new Date("2026-08-17T13:00:00.000Z"));
});
