import assert from "node:assert/strict";
import test from "node:test";

import { gmailRouteUnavailable } from "./runtime";

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
    const [connectRoute, callbackRoute] = await Promise.all([
      import("./connect/route"),
      import("./callback/route"),
    ]);

    assert.equal(typeof connectRoute.GET, "function");
    assert.equal(typeof callbackRoute.GET, "function");
    assert.equal(connectRoute.runtime, "nodejs");
    assert.equal(callbackRoute.runtime, "nodejs");
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
