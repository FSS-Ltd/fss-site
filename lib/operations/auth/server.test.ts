import assert from "node:assert/strict";
import test from "node:test";
import { createPortalAuthClient } from "./client";
import { PORTAL_SESSION_COOKIE } from "./configuration";
import {
  completePortalLogin,
  getPortalIdentity,
  signOutPortalClient,
  startPortalLogin,
} from "./server";

test("managed auth adapter uses isolated HTTP-only cookies, trusted user lookup and fixed PKCE callback", async (t) => {
  const jar = new Map<string, string>();
  const written: { name: string; httpOnly?: boolean; secure?: boolean }[] = [];
  const calls: { path: string; body: unknown; cache?: RequestCache }[] = [];
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "client@example.test",
    email_confirmed_at: "2026-09-07T00:00:00Z",
    is_anonymous: false,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-09-07T00:00:00Z",
  };
  let failure: string | null = null;
  const jwt =
    [
      { alg: "HS256", typ: "JWT" },
      {
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
    ]
      .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
      .join(".") + ".synthetic-signature";
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      calls.push({
        path: url.pathname,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        cache: init?.cache,
      });
      if (failure)
        return Response.json(
          { error_code: failure, msg: "Synthetic provider error" },
          { status: 400 },
        );
      if (url.pathname.endsWith("/token"))
        return Response.json({
          access_token: jwt,
          refresh_token: "synthetic-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        });
      if (url.pathname.endsWith("/user")) return Response.json(user);
      return Response.json({});
    },
  );
  const previousOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://portal.example.test";
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousOrigin;
  });
  const client = createPortalAuthClient(
    { url: "https://auth.example.test", publishableKey: "sb_publishable_test" },
    {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (updates) => {
        for (const { name, value, options } of updates) {
          jar.set(name, value);
          written.push({
            name,
            httpOnly: options.httpOnly,
            secure: options.secure,
          });
        }
      },
    },
    "https://portal.example.test",
  );
  await startPortalLogin(client, user.email);
  const otp = calls.find((call) => call.path.endsWith("/otp"));
  assert.ok(otp);
  assert.deepEqual(
    Object.assign({}, otp.body, { code_challenge: "redacted" }),
    {
      email: user.email,
      data: {},
      create_user: false,
      gotrue_meta_security: {},
      code_challenge: "redacted",
      code_challenge_method: "s256",
    },
  );
  assert.ok(
    written.some((cookie) => cookie.name.startsWith(PORTAL_SESSION_COOKIE)),
  );
  assert.ok(written.every((cookie) => cookie.httpOnly && cookie.secure));
  assert.deepEqual(await completePortalLogin(client, "synthetic-code"), {
    userId: user.id,
    email: user.email,
    emailVerified: true,
  });
  assert.ok(calls.some((call) => call.path.endsWith("/user")));
  assert.ok(calls.every((call) => call.cache === "no-store"));
  failure = "signup_disabled";
  await startPortalLogin(client, "unknown@example.test");
  failure = "unexpected";
  await assert.rejects(startPortalLogin(client, user.email), /unavailable/);
  await assert.rejects(
    completePortalLogin(client, "replayed-code"),
    /access|sign in/i,
  );
  failure = null;
  await signOutPortalClient(client);
  assert.equal(await getPortalIdentity(client), null);
});
