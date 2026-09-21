import assert from "node:assert/strict";
import test from "node:test";
import { PortalAccessDenied } from "../auth/types";
import {
  createPortalSupportRequestHandler,
  type PortalSupportRequestHandlerDependencies,
} from "./client-support-handler";

const organisationId = "10000000-0000-4000-8000-000000000001";
const idempotencyKey = "20000000-0000-4000-8000-000000000001";
const correlationId = "30000000-0000-4000-8000-000000000001";
const identity = {
  userId: "40000000-0000-4000-8000-000000000001",
  email: "owner@example.test",
  emailVerified: true as const,
};

function request(
  body: unknown = {
    category: "project_question",
    idempotencyKey,
    message: "Could you clarify the next review date?",
    organisationId,
    subject: "Review date",
  },
  origin = "https://portal.example.test",
): Request {
  return new Request(
    "https://portal.example.test/api/portal/support/requests",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body),
    },
  );
}

function setup(
  overrides: Partial<PortalSupportRequestHandlerDependencies> = {},
): {
  calls: Array<{
    command: unknown;
    organisationId: string;
    userId: string;
  }>;
  handler: (request: Request) => Promise<Response>;
} {
  const calls: Array<{
    command: unknown;
    organisationId: string;
    userId: string;
  }> = [];
  const dependencies: PortalSupportRequestHandlerDependencies = {
    configured: true,
    consumeRateLimit: async () => true,
    create: async (
      verifiedIdentity,
      scopedOrganisationId,
      _correlationId,
      command,
    ) => {
      calls.push({
        command,
        organisationId: scopedOrganisationId,
        userId: verifiedIdentity.userId,
      });
      return {
        id: "50000000-0000-4000-8000-000000000001",
        reference: "FSS-SUP-0123456789ABCDEF0123456789ABCDEF",
      };
    },
    createCorrelationId: () => correlationId,
    enabled: true,
    getIdentity: async () => identity,
    origin: "https://portal.example.test",
    reportUnexpectedError: () => undefined,
    ...overrides,
  };
  return { calls, handler: createPortalSupportRequestHandler(dependencies) };
}

test("support commands carry only the verified identity and selected organisation", async () => {
  const { calls, handler } = setup();

  const response = await handler(request());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(calls, [
    {
      command: {
        category: "project_question",
        idempotencyKey,
        message: "Could you clarify the next review date?",
        subject: "Review date",
      },
      organisationId,
      userId: identity.userId,
    },
  ]);
  assert.deepEqual(await response.json(), {
    request: {
      id: "50000000-0000-4000-8000-000000000001",
      reference: "FSS-SUP-0123456789ABCDEF0123456789ABCDEF",
    },
  });
});

test("support commands cannot mutate when access, origin, or command bounds fail", async () => {
  for (const [name, overrides, candidate] of [
    ["disabled", { enabled: false }, request()],
    ["unconfigured", { configured: false }, request()],
    ["anonymous", { getIdentity: async () => null }, request()],
    ["limited", { consumeRateLimit: async () => false }, request()],
    ["cross-origin", {}, request(undefined, "https://evil.example.test")],
    [
      "forged identity",
      {},
      request({
        category: "project_question",
        idempotencyKey,
        message: "Question",
        organisationId,
        subject: "Question",
        userId: identity.userId,
      }),
    ],
  ] as const) {
    const { calls, handler } = setup(overrides);
    assert.notEqual((await handler(candidate)).status, 200, name);
    assert.deepEqual(calls, [], name);
  }
});

test("tenant denials remain private and leave the support command unacknowledged", async () => {
  const { handler } = setup({
    create: async () => {
      throw new PortalAccessDenied();
    },
  });

  const response = await handler(request());

  assert.equal(response.status, 404);
  assert.doesNotMatch(await response.text(), /database|membership/i);
});
