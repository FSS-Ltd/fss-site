import assert from "node:assert/strict";
import test from "node:test";
import { PortalAccessDenied } from "../auth/types";
import {
  createNotificationReadHandler,
  type NotificationReadHandlerDependencies,
} from "./notification-read-handler";

const identity = {
  email: "alex@example.test",
  emailVerified: true as const,
  userId: "11111111-1111-4111-8111-111111111111",
};
const organisationId = "22222222-2222-4222-8222-222222222222";
const notificationId = "33333333-3333-4333-8333-333333333333";

function request(
  body: unknown = { ids: [notificationId] },
  origin = "https://portal.example.test",
): Request {
  return new Request(
    `https://portal.example.test/api/portal/notifications/mark-read?organisationId=${organisationId}`,
    {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", Origin: origin },
      method: "POST",
    },
  );
}

function setup(overrides: Partial<NotificationReadHandlerDependencies> = {}): {
  calls: Array<{
    ids: readonly string[];
    organisationId: string;
    userId: string;
  }>;
  handler: (request: Request) => Promise<Response>;
} {
  const calls: Array<{
    ids: readonly string[];
    organisationId: string;
    userId: string;
  }> = [];
  const dependencies: NotificationReadHandlerDependencies = {
    authorize: async () => identity,
    createCorrelationId: () => "44444444-4444-4444-8444-444444444444",
    enabled: true,
    origin: "https://portal.example.test",
    reportUnexpectedError: () => undefined,
    update: async (
      verifiedIdentity,
      scopedOrganisationId,
      _correlationId,
      ids,
    ) => {
      calls.push({
        ids,
        organisationId: scopedOrganisationId,
        userId: verifiedIdentity.userId,
      });
    },
    ...overrides,
  };
  return { calls, handler: createNotificationReadHandler(dependencies) };
}

test("mark-read commands bind selected notifications to the verified user and organisation", async () => {
  const { calls, handler } = setup();

  const response = await handler(request());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(calls, [
    {
      ids: [notificationId],
      organisationId,
      userId: identity.userId,
    },
  ]);
});

test("mark-read commands reject cross-origin, forged-user, and unavailable targets", async () => {
  for (const [name, overrides, candidate] of [
    ["disabled", { enabled: false }, request()],
    ["anonymous", { authorize: async () => null }, request()],
    ["cross-origin", {}, request(undefined, "https://evil.example.test")],
    [
      "forged user",
      {},
      request({ ids: [notificationId], userId: identity.userId }),
    ],
    [
      "tenant denied",
      {
        update: async () => {
          throw new PortalAccessDenied();
        },
      },
      request(),
    ],
  ] as const) {
    const { calls, handler } = setup(overrides);
    assert.notEqual((await handler(candidate)).status, 200, name);
    assert.deepEqual(calls, [], name);
  }
});
