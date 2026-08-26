import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { FounderAuthorizationError } from "../auth/require-founder";
import {
  createGmailDisconnectHandler,
  type GmailDisconnectRouteDependencies,
} from "./gmail-disconnect-route-handler";

const routeOrigin = "https://example.test";
const encryptionKey = Buffer.alloc(32, 9);

function createRequest(
  origin: string | null = routeOrigin,
  requestOrigin = routeOrigin,
): NextRequest {
  return new NextRequest(`${requestOrigin}/api/integrations/gmail/disconnect`, {
    method: "POST",
    headers: origin === null ? undefined : { Origin: origin },
  });
}

function createDependencies(
  overrides: Partial<GmailDisconnectRouteDependencies> = {},
): GmailDisconnectRouteDependencies {
  return {
    config: {
      origin: routeOrigin,
      subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
      encryptionKey,
    },
    authorizeFounder: async () => ({
      email: "j.ntagengwa@faithfulsoftware.dev",
      actorId: "founder-actor-id",
    }),
    disconnect: async () => ({
      connectionId: "connection-id",
      providerRevocation: "confirmed",
      pausedEnrollmentCount: 2,
    }),
    createCorrelationId: () => "disconnect-correlation",
    reportUnexpectedError: () => undefined,
    ...overrides,
  };
}

test("disconnects Gmail for the authorised founder and redirects with success", async () => {
  let receivedInput: unknown;
  const handler = createGmailDisconnectHandler(
    createDependencies({
      disconnect: async (input) => {
        receivedInput = input;
        return {
          connectionId: "connection-id",
          providerRevocation: "confirmed",
          pausedEnrollmentCount: 2,
        };
      },
    }),
  );

  const response = await handler(createRequest());

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    `${routeOrigin}/growth/settings?gmail=disconnected`,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(receivedInput, {
    subjectEmail: "j.ntagengwa@faithfulsoftware.dev",
    encryptionKeys: { v1: encryptionKey },
    correlationId: "disconnect-correlation",
    actorId: "founder-actor-id",
  });
});

test("reports an unconfirmed provider revocation after the local disconnect", async () => {
  const handler = createGmailDisconnectHandler(
    createDependencies({
      disconnect: async () => ({
        connectionId: "connection-id",
        providerRevocation: "unconfirmed",
        pausedEnrollmentCount: 1,
      }),
    }),
  );

  const response = await handler(createRequest());

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    `${routeOrigin}/growth/settings?gmail=revocation_unconfirmed`,
  );
});

test("redirects an unauthorized disconnect without calling the service", async () => {
  let disconnectCalled = false;
  const handler = createGmailDisconnectHandler(
    createDependencies({
      authorizeFounder: async () => {
        throw new FounderAuthorizationError();
      },
      disconnect: async () => {
        disconnectCalled = true;
        throw new Error("must not run");
      },
    }),
  );

  const response = await handler(createRequest());

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), `${routeOrigin}/growth/login`);
  assert.equal(disconnectCalled, false);
});

test("rejects a disconnect request without the exact registered origin", async () => {
  let authorizeCalled = false;
  const reports: unknown[] = [];
  const handler = createGmailDisconnectHandler(
    createDependencies({
      authorizeFounder: async () => {
        authorizeCalled = true;
        throw new Error("must not run");
      },
      reportUnexpectedError: (report) => reports.push(report),
    }),
  );

  const response = await handler(createRequest("https://attacker.test"));

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "INVALID_DISCONNECT_ORIGIN",
    message: "The Gmail disconnect origin is invalid.",
    correlationId: "disconnect-correlation",
  });
  assert.equal(authorizeCalled, false);
  assert.equal(reports.length, 1);
});

test("rejects host confusion and requests without an Origin header", async (context) => {
  const requests = [
    {
      name: "untrusted request URL",
      request: createRequest(routeOrigin, "https://attacker.test"),
    },
    {
      name: "missing Origin header",
      request: createRequest(null),
    },
  ];

  for (const { name, request } of requests) {
    await context.test(name, async () => {
      let authorizeCalled = false;
      const handler = createGmailDisconnectHandler(
        createDependencies({
          authorizeFounder: async () => {
            authorizeCalled = true;
            throw new Error("must not run");
          },
        }),
      );

      const response = await handler(request);

      assert.equal(response.status, 400);
      assert.equal(authorizeCalled, false);
    });
  }
});

test("reports an unexpected disconnect failure by correlation only", async () => {
  const failure = new Error("database detail");
  const reports: unknown[] = [];
  const handler = createGmailDisconnectHandler(
    createDependencies({
      disconnect: async () => {
        throw failure;
      },
      reportUnexpectedError: (report) => reports.push(report),
    }),
  );

  const response = await handler(createRequest());

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    `${routeOrigin}/growth/settings?gmail=unexpected_error`,
  );
  assert.deepEqual(reports, [
    { correlationId: "disconnect-correlation", error: failure },
  ]);
});
