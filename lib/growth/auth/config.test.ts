import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import type { GrowthServerEnv } from "../config/env";
import { createGrowthAuthConfig, GROWTH_GOOGLE_AUTH_SCOPES } from "./config";

const env: GrowthServerEnv = {
  databaseUrl: "postgresql://example.test/database",
  authSecret: "a".repeat(32),
  googleAuthClientId: "google-client-id",
  googleAuthClientSecret: "google-client-secret",
  ownerEmail: "j.ntagengwa@faithfulsoftware.dev",
  tokenEncryptionKey: "b".repeat(32),
  automationsEnabled: false,
};

test("requests only identity scopes from Google", () => {
  assert.equal(GROWTH_GOOGLE_AUTH_SCOPES, "openid email profile");
  assert.doesNotMatch(GROWTH_GOOGLE_AUTH_SCOPES, /gmail/i);
});

test("routes sign-in and authorization errors to the founder login", () => {
  assert.deepEqual(createGrowthAuthConfig(env).pages, {
    signIn: "/growth/login",
    error: "/growth/login",
  });
});

test("protects Growth OS routes with the verified founder session", async () => {
  const authorized = createGrowthAuthConfig(env).callbacks?.authorized;
  assert.ok(authorized);

  const loginRequest = new NextRequest("https://fss.test/growth/login");
  assert.equal(await authorized({ auth: null, request: loginRequest }), true);

  const dashboardRequest = new NextRequest(
    "https://fss.test/growth/prospects?status=new",
  );
  assert.equal(
    await authorized({
      auth: {
        user: {
          email: env.ownerEmail,
          founderEmailVerified: true,
        },
        expires: "2026-08-18T00:00:00.000Z",
      },
      request: dashboardRequest,
    }),
    true,
  );

  const denied = await authorized({
    auth: {
      user: {
        email: env.ownerEmail,
        founderEmailVerified: false,
      },
      expires: "2026-08-18T00:00:00.000Z",
    },
    request: dashboardRequest,
  });
  assert.ok(denied instanceof Response);
  assert.equal(denied.status, 307);
  assert.equal(denied.headers.get("location"), "https://fss.test/growth/login");
  assert.match(
    denied.headers.get("set-cookie") ?? "",
    /growth\.callback_path=%2Fgrowth%2Fprospects%3Fstatus%3Dnew/,
  );
  assert.match(denied.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.match(denied.headers.get("set-cookie") ?? "", /SameSite=lax/i);
  assert.match(denied.headers.get("set-cookie") ?? "", /Secure/);
});

test("allows only the verified founder OAuth profile", async () => {
  const signIn = createGrowthAuthConfig(env).callbacks?.signIn;
  assert.ok(signIn);

  assert.equal(
    await signIn({
      user: {},
      profile: {
        email: "J.Ntagengwa@faithfulsoftware.dev",
        email_verified: true,
      },
    }),
    true,
  );
  assert.equal(
    await signIn({
      user: {},
      profile: {
        email: "colleague@faithfulsoftware.dev",
        email_verified: true,
      },
    }),
    false,
  );
  assert.equal(
    await signIn({
      user: {},
      profile: { email: env.ownerEmail, email_verified: false },
    }),
    false,
  );
});

test("carries the verified-provider claim into the signed session", async () => {
  const callbacks = createGrowthAuthConfig(env).callbacks;
  const jwt = callbacks?.jwt;
  const session = callbacks?.session;
  assert.ok(jwt);
  assert.ok(session);

  const token = await jwt({
    token: { email: env.ownerEmail },
    user: { email: env.ownerEmail },
    profile: { email: env.ownerEmail, email_verified: true },
    trigger: "signIn",
  });
  assert.ok(token);
  assert.equal(token.founderEmailVerified, true);

  const refreshedToken = await jwt({ token, user: {} });
  assert.ok(refreshedToken);
  const updatedToken = await jwt({
    token: refreshedToken,
    user: {},
    trigger: "update",
    session: {
      email: "attacker@example.test",
      founderEmailVerified: false,
    },
  });
  assert.ok(updatedToken);
  assert.equal(updatedToken.email, env.ownerEmail);
  assert.equal(updatedToken.founderEmailVerified, true);

  const sessionInput = {
    session: {
      user: { email: env.ownerEmail },
      expires: "2026-08-18T00:00:00.000Z",
    },
    token: updatedToken,
    newSession: undefined,
  };
  // Auth.js combines its database and JWT callback parameters in one public
  // type. This configuration uses JWT sessions, so this is the exact runtime
  // shape even though it cannot satisfy the database-session intersection.
  const result = await session(sessionInput as Parameters<typeof session>[0]);
  assert.ok(result.user && "founderEmailVerified" in result.user);
  assert.equal(result.user.founderEmailVerified, true);
});
