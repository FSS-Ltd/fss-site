import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { FounderAuthorizationError } from "../auth/require-founder";
import type { ConnectGmailInput } from "./gmail-connection";
import { GmailConnectionError } from "./gmail-connection";
import { GoogleOAuthError } from "./google-oauth";
import {
  createGmailCallbackHandler,
  createGmailConnectHandler,
  GMAIL_OAUTH_STATE_COOKIE,
  type GmailOAuthRouteDependencies,
} from "./gmail-oauth-route-handler";

const callbackUrl = "https://example.test/api/integrations/gmail/callback";
const routeConfig = {
  oauthConfig: {
    clientId: "gmail-client-id",
    clientSecret: "gmail-client-secret",
    redirectUri: callbackUrl,
  },
  expectedSubjectEmail: "j.ntagengwa@faithfulsoftware.dev",
  encryptionKey: Buffer.alloc(32, 7),
};

function createDependencies(
  overrides: Partial<GmailOAuthRouteDependencies> = {},
): GmailOAuthRouteDependencies {
  return {
    config: routeConfig,
    authorizeFounder: async () => ({
      email: routeConfig.expectedSubjectEmail,
      actorId: "founder-actor-id",
    }),
    generateState: () => "s".repeat(43),
    buildAuthorizationUrl: (_config, state) =>
      `https://accounts.google.test/o/oauth2/auth?state=${state}`,
    connect: async () => ({
      connectionId: "connection-id",
      subjectEmail: routeConfig.expectedSubjectEmail,
    }),
    createCorrelationId: () => "gmail-correlation-id",
    reportUnexpectedError: () => undefined,
    ...overrides,
  };
}

function callbackRequest(query: string, state = "s".repeat(43)): NextRequest {
  return new NextRequest(`${callbackUrl}${query}`, {
    headers: { cookie: `${GMAIL_OAUTH_STATE_COOKIE}=${state}` },
  });
}

test("starts founder Gmail OAuth with an opaque secure state cookie", async () => {
  const handler = createGmailConnectHandler(createDependencies());

  const response = await handler(
    new NextRequest("https://example.test/api/integrations/gmail/connect"),
  );

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    `https://accounts.google.test/o/oauth2/auth?state=${"s".repeat(43)}`,
  );
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(
    cookie,
    new RegExp(`^${GMAIL_OAUTH_STATE_COOKIE}=${"s".repeat(43)}`),
  );
  assert.match(cookie, /Path=\/api\/integrations\/gmail\/callback/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Max-Age=600/);
  assert.doesNotMatch(cookie, /gmail-client-secret/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("redirects an unauthorized connect request without setting OAuth state", async () => {
  const handler = createGmailConnectHandler(
    createDependencies({
      authorizeFounder: async () => {
        throw new FounderAuthorizationError();
      },
    }),
  );

  const response = await handler(
    new NextRequest("https://example.test/api/integrations/gmail/connect"),
  );

  assert.equal(
    response.headers.get("location"),
    "https://example.test/growth/login",
  );
  assert.equal(response.headers.get("set-cookie"), null);
});

test("redirects an unauthorized callback and consumes its state cookie", async () => {
  let connected = false;
  const handler = createGmailCallbackHandler(
    createDependencies({
      authorizeFounder: async () => {
        throw new FounderAuthorizationError();
      },
      connect: async () => {
        connected = true;
        throw new Error("must not run");
      },
    }),
  );

  const response = await handler(
    callbackRequest(`?code=code&state=${"s".repeat(43)}`),
  );

  assert.equal(connected, false);
  assert.equal(
    response.headers.get("location"),
    "https://example.test/growth/login",
  );
  assert.match(
    response.headers.get("set-cookie") ?? "",
    new RegExp(`^${GMAIL_OAUTH_STATE_COOKIE}=;`),
  );
});

test("rejects a mismatched or duplicated callback state before connecting", async (t) => {
  for (const query of [
    "?code=code&state=wrong-state",
    `?code=code&state=${"s".repeat(43)}&state=${"s".repeat(43)}`,
  ]) {
    await t.test(query, async () => {
      let connected = false;
      const handler = createGmailCallbackHandler(
        createDependencies({
          connect: async () => {
            connected = true;
            throw new Error("must not run");
          },
        }),
      );

      const response = await handler(callbackRequest(query));

      assert.equal(connected, false);
      assert.equal(
        response.headers.get("location"),
        "https://example.test/growth?gmail=state_error",
      );
      assert.match(
        response.headers.get("set-cookie") ?? "",
        new RegExp(
          `^${GMAIL_OAUTH_STATE_COOKIE}=; Path=/api/integrations/gmail/callback;`,
        ),
      );
    });
  }
});

test("returns a safe callback error for a Google denial", async () => {
  let connected = false;
  const handler = createGmailCallbackHandler(
    createDependencies({
      connect: async () => {
        connected = true;
        throw new Error("must not run");
      },
    }),
  );

  const response = await handler(
    callbackRequest(
      `?error=access_denied&error_description=private-detail&state=${"s".repeat(43)}`,
    ),
  );

  assert.equal(connected, false);
  assert.equal(
    response.headers.get("location"),
    "https://example.test/growth?gmail=provider_error",
  );
  assert.doesNotMatch(response.headers.get("location") ?? "", /private-detail/);
});

test("rejects a missing or duplicated authorization code", async (t) => {
  for (const query of [
    `?state=${"s".repeat(43)}`,
    `?code=one&code=two&state=${"s".repeat(43)}`,
  ]) {
    await t.test(query, async () => {
      let connected = false;
      const handler = createGmailCallbackHandler(
        createDependencies({
          connect: async () => {
            connected = true;
            throw new Error("must not run");
          },
        }),
      );

      const response = await handler(callbackRequest(query));

      assert.equal(connected, false);
      assert.equal(
        response.headers.get("location"),
        "https://example.test/growth?gmail=callback_error",
      );
    });
  }
});

test("connects a valid callback with the founder and server-only config", async () => {
  let connectInput: ConnectGmailInput | undefined;
  const handler = createGmailCallbackHandler(
    createDependencies({
      connect: async (input) => {
        connectInput = input;
        return {
          connectionId: "connection-id",
          subjectEmail: routeConfig.expectedSubjectEmail,
        };
      },
    }),
  );

  const response = await handler(
    callbackRequest(`?code=authorization-code&state=${"s".repeat(43)}`),
  );

  assert.deepEqual(connectInput, {
    authorizationCode: "authorization-code",
    oauthConfig: routeConfig.oauthConfig,
    expectedSubjectEmail: routeConfig.expectedSubjectEmail,
    encryptionKey: routeConfig.encryptionKey,
    correlationId: "gmail-correlation-id",
    actorId: "founder-actor-id",
  });
  assert.equal(
    response.headers.get("location"),
    "https://example.test/growth?gmail=connected",
  );
  assert.match(response.headers.get("set-cookie") ?? "", /Expires=/);
});

test("maps connection policy failures without exposing provider details", async (t) => {
  for (const scenario of [
    {
      error: new GmailConnectionError(
        "MISSING_REFRESH_TOKEN",
        "Google did not issue a Gmail refresh token.",
      ),
      status: "missing_refresh_token",
    },
    {
      error: new GmailConnectionError(
        "UNAUTHORIZED_GOOGLE_IDENTITY",
        "The authorised Google account cannot be connected.",
      ),
      status: "identity_error",
    },
    {
      error: new GoogleOAuthError(
        "TOKEN_EXCHANGE_FAILED",
        "Google token exchange failed.",
      ),
      status: "provider_error",
    },
  ] as const) {
    await t.test(scenario.status, async () => {
      const handler = createGmailCallbackHandler(
        createDependencies({
          connect: async () => {
            throw scenario.error;
          },
        }),
      );

      const response = await handler(
        callbackRequest(`?code=code&state=${"s".repeat(43)}`),
      );

      assert.equal(
        response.headers.get("location"),
        `https://example.test/growth?gmail=${scenario.status}`,
      );
      assert.doesNotMatch(
        response.headers.get("location") ?? "",
        /Google|account/,
      );
    });
  }
});

test("rejects callbacks delivered on an origin other than the registered URI", async () => {
  let connected = false;
  const reports: Array<{ correlationId: string; error: unknown }> = [];
  const handler = createGmailCallbackHandler(
    createDependencies({
      connect: async () => {
        connected = true;
        throw new Error("must not run");
      },
      reportUnexpectedError: (report) => reports.push(report),
    }),
  );
  const request = new NextRequest(
    `https://preview.example.test/api/integrations/gmail/callback?code=code&state=${"s".repeat(43)}`,
    { headers: { cookie: `${GMAIL_OAUTH_STATE_COOKIE}=${"s".repeat(43)}` } },
  );

  const response = await handler(request);

  assert.equal(connected, false);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "INVALID_CALLBACK_ORIGIN",
    message: "The Gmail OAuth callback origin is invalid.",
    correlationId: "gmail-correlation-id",
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.correlationId, "gmail-correlation-id");
  assert.equal(reports[0]?.error instanceof Error, true);
});

test("reports unexpected callback failures by opaque correlation only", async () => {
  const failure = new Error("provider secret detail");
  const reports: Array<{ correlationId: string; error: unknown }> = [];
  const handler = createGmailCallbackHandler(
    createDependencies({
      connect: async () => {
        throw failure;
      },
      reportUnexpectedError: (report) => reports.push(report),
    }),
  );

  const response = await handler(
    callbackRequest(`?code=code&state=${"s".repeat(43)}`),
  );

  assert.equal(
    response.headers.get("location"),
    "https://example.test/growth?gmail=unexpected_error",
  );
  assert.deepEqual(reports, [
    { correlationId: "gmail-correlation-id", error: failure },
  ]);
  assert.doesNotMatch(response.headers.get("location") ?? "", /secret|detail/);
});
