import assert from "node:assert/strict";
import test from "node:test";

import { parseGrowthServerEnv } from "@/lib/growth/config/env";

import {
  createGmailDisconnectRouteConfig,
  gmailRouteUnavailable,
} from "./runtime";

const gmailEnvironmentKeys = [
  "GOOGLE_GMAIL_CLIENT_ID",
  "GOOGLE_GMAIL_CLIENT_SECRET",
  "GOOGLE_GMAIL_REDIRECT_URI",
] as const;

test("loads Gmail OAuth route modules without reading optional configuration", async () => {
  const previousValues = new Map(
    gmailEnvironmentKeys.map((key) => [key, process.env[key]]),
  );
  for (const key of gmailEnvironmentKeys) delete process.env[key];

  try {
    const [connectRoute, callbackRoute, disconnectRoute] = await Promise.all([
      import("./connect/route"),
      import("./callback/route"),
      import("./disconnect/route"),
    ]);

    assert.equal(typeof connectRoute.GET, "function");
    assert.equal(typeof callbackRoute.GET, "function");
    assert.equal(typeof disconnectRoute.POST, "function");
    assert.equal(connectRoute.runtime, "nodejs");
    assert.equal(callbackRoute.runtime, "nodejs");
    assert.equal(disconnectRoute.runtime, "nodejs");
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("returns a correlated standard error when Gmail configuration is unavailable", async () => {
  const originalConsoleError = console.error;
  const logs: unknown[][] = [];
  console.error = (...values: unknown[]) => logs.push(values);

  try {
    const response = gmailRouteUnavailable(
      "callback",
      new Error("secret configuration detail"),
      "gmail-route-correlation",
    );

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(await response.json(), {
      ok: false,
      code: "GMAIL_OAUTH_UNAVAILABLE",
      message: "The Gmail connection is temporarily unavailable.",
      correlationId: "gmail-route-correlation",
    });
    assert.deepEqual(logs, [
      [
        "Growth OS Gmail OAuth callback route unavailable.",
        {
          correlationId: "gmail-route-correlation",
          errorName: "Error",
        },
      ],
    ]);
  } finally {
    console.error = originalConsoleError;
  }
});

test("keeps disconnect available without Gmail OAuth client configuration", () => {
  const encryptionKey = Buffer.alloc(32, 17);
  const environment = parseGrowthServerEnv({
    DATABASE_URL: "postgresql://growth.example.test/database",
    AUTH_SECRET: "a".repeat(32),
    GOOGLE_AUTH_CLIENT_ID: "auth-client-id",
    GOOGLE_AUTH_CLIENT_SECRET: "auth-client-secret",
    GROWTH_OS_OWNER_EMAIL: "j.ntagengwa@faithfulsoftware.dev",
    TOKEN_ENCRYPTION_KEY: encryptionKey.toString("base64"),
    GROWTH_OS_AUTOMATIONS_ENABLED: "false",
  });

  assert.deepEqual(
    createGmailDisconnectRouteConfig(environment, "https://example.test/app"),
    {
      origin: "https://example.test",
      subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
      encryptionKey,
    },
  );
});
