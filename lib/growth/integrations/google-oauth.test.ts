import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  fetchGoogleIdentity,
  generateGoogleOAuthState,
  GMAIL_AUTOMATION_SCOPES,
  GoogleOAuthError,
  revokeGoogleOAuthToken,
  type GoogleOAuthConfig,
} from "./google-oauth";

const config: GoogleOAuthConfig = {
  clientId: "gmail-client-id",
  clientSecret: "gmail-client-secret",
  redirectUri: "https://example.test/api/integrations/gmail/callback",
};

test("builds the offline Gmail authorization URL with exact scopes", () => {
  const authorizationUrl = new URL(
    buildGoogleAuthorizationUrl(config, "oauth-state"),
  );

  assert.equal(
    authorizationUrl.origin + authorizationUrl.pathname,
    "https://accounts.google.com/o/oauth2/v2/auth",
  );
  assert.equal(authorizationUrl.searchParams.get("client_id"), config.clientId);
  assert.equal(
    authorizationUrl.searchParams.get("redirect_uri"),
    config.redirectUri,
  );
  assert.equal(authorizationUrl.searchParams.get("response_type"), "code");
  assert.equal(authorizationUrl.searchParams.get("access_type"), "offline");
  assert.equal(
    authorizationUrl.searchParams.get("include_granted_scopes"),
    "true",
  );
  assert.equal(authorizationUrl.searchParams.get("prompt"), "consent");
  assert.equal(authorizationUrl.searchParams.get("state"), "oauth-state");
  assert.deepEqual(
    authorizationUrl.searchParams.get("scope")?.split(" "),
    GMAIL_AUTOMATION_SCOPES,
  );
  assert.equal(authorizationUrl.searchParams.get("login_hint"), null);
  assert.equal(authorizationUrl.searchParams.get("hd"), null);
});

test("generates an unpredictable URL-safe OAuth state", () => {
  const first = generateGoogleOAuthState();
  const second = generateGoogleOAuthState();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});

test("exchanges an authorization code using a form-encoded POST", async () => {
  let receivedRequest: Request | undefined;
  const fetchImpl = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    receivedRequest = new Request(input, init);
    return Response.json({
      access_token: "access-token",
      expires_in: 3600,
      refresh_token: "refresh-token",
      scope: GMAIL_AUTOMATION_SCOPES.join(" "),
      token_type: "Bearer",
    });
  };

  const tokens = await exchangeGoogleAuthorizationCode(
    config,
    "authorization-code",
    fetchImpl,
  );

  assert.equal(receivedRequest?.url, "https://oauth2.googleapis.com/token");
  assert.equal(receivedRequest?.method, "POST");
  assert.equal(
    receivedRequest?.headers.get("content-type"),
    "application/x-www-form-urlencoded;charset=UTF-8",
  );
  const body = new URLSearchParams(await receivedRequest?.text());
  assert.deepEqual(Object.fromEntries(body), {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: "authorization-code",
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  assert.deepEqual(tokens, {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresInSeconds: 3600,
    grantedScopes: [...GMAIL_AUTOMATION_SCOPES],
    tokenType: "Bearer",
  });
});

test("accepts Google's canonical email scope in token responses", async () => {
  const canonicalEmailScope = "https://www.googleapis.com/auth/userinfo.email";
  const fetchImpl = async () =>
    Response.json({
      access_token: "access-token",
      expires_in: 3600,
      refresh_token: "refresh-token",
      scope: [
        "openid",
        canonicalEmailScope,
        "https://www.googleapis.com/auth/gmail.modify",
      ].join(" "),
      token_type: "Bearer",
    });

  const tokens = await exchangeGoogleAuthorizationCode(
    config,
    "authorization-code",
    fetchImpl,
  );

  assert.deepEqual(tokens.grantedScopes, [
    "openid",
    canonicalEmailScope,
    "https://www.googleapis.com/auth/gmail.modify",
  ]);
});

test("rejects token responses without every required scope", async () => {
  const fetchImpl = async () =>
    Response.json({
      access_token: "access-token",
      expires_in: 3600,
      refresh_token: "refresh-token",
      scope: "openid email",
      token_type: "Bearer",
    });

  await assert.rejects(
    exchangeGoogleAuthorizationCode(config, "authorization-code", fetchImpl),
    (error: unknown) =>
      error instanceof GoogleOAuthError &&
      error.code === "INVALID_TOKEN_RESPONSE",
  );
});

test("returns a safe token-exchange error without provider details", async () => {
  const fetchImpl = async () =>
    Response.json(
      {
        error: "invalid_grant",
        error_description: "authorization-code-secret-provider-detail",
      },
      { status: 400 },
    );

  await assert.rejects(
    exchangeGoogleAuthorizationCode(config, "authorization-code", fetchImpl),
    (error: unknown) =>
      error instanceof GoogleOAuthError &&
      error.code === "TOKEN_EXCHANGE_FAILED" &&
      !error.message.includes("authorization-code-secret-provider-detail"),
  );
});

test("fetches a typed Google identity with the bearer token", async () => {
  let receivedRequest: Request | undefined;
  const fetchImpl = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    receivedRequest = new Request(input, init);
    return Response.json({
      sub: "google-subject",
      email: "j.ntagengwa@faithfulsoftware.dev",
      email_verified: true,
    });
  };

  const identity = await fetchGoogleIdentity("access-token", fetchImpl);

  assert.equal(
    receivedRequest?.url,
    "https://openidconnect.googleapis.com/v1/userinfo",
  );
  assert.equal(receivedRequest?.method, "GET");
  assert.equal(
    receivedRequest?.headers.get("authorization"),
    "Bearer access-token",
  );
  assert.deepEqual(identity, {
    subject: "google-subject",
    email: "j.ntagengwa@faithfulsoftware.dev",
    emailVerified: true,
  });
});

test("rejects invalid identity responses and blank inputs", async () => {
  const fetchImpl = async () =>
    Response.json({
      sub: "google-subject",
      email: "j.ntagengwa@faithfulsoftware.dev",
      email_verified: "true",
    });

  await assert.rejects(
    fetchGoogleIdentity("access-token", fetchImpl),
    (error: unknown) =>
      error instanceof GoogleOAuthError &&
      error.code === "INVALID_IDENTITY_RESPONSE",
  );
  assert.throws(
    () => buildGoogleAuthorizationUrl(config, " "),
    /OAuth state must not be blank/,
  );
  await assert.rejects(
    exchangeGoogleAuthorizationCode(config, " ", fetchImpl),
    /Authorization code must not be blank/,
  );
  await assert.rejects(
    fetchGoogleIdentity(" ", fetchImpl),
    /Access token must not be blank/,
  );
});

test("revokes a Google refresh token with a form-encoded POST", async () => {
  let receivedRequest: Request | undefined;
  const fetchImpl = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    receivedRequest = new Request(input, init);
    return new Response(null, { status: 200 });
  };

  const revoked = await revokeGoogleOAuthToken("refresh-token", fetchImpl);

  assert.equal(revoked, true);
  assert.equal(receivedRequest?.url, "https://oauth2.googleapis.com/revoke");
  assert.equal(receivedRequest?.method, "POST");
  assert.equal(
    receivedRequest?.headers.get("content-type"),
    "application/x-www-form-urlencoded;charset=UTF-8",
  );
  assert.deepEqual(
    Object.fromEntries(new URLSearchParams(await receivedRequest?.text())),
    { token: "refresh-token" },
  );
});

test("treats provider rejection and network failure as unconfirmed revocation", async () => {
  assert.equal(
    await revokeGoogleOAuthToken(
      "refresh-token",
      async () => new Response(null, { status: 400 }),
    ),
    false,
  );
  assert.equal(
    await revokeGoogleOAuthToken("refresh-token", async () => {
      throw new Error("provider detail");
    }),
    false,
  );
  await assert.rejects(revokeGoogleOAuthToken(" "), /must not be blank/i);
});
