import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  createStaffRequestCreateRouteHandler,
  type StaffRequestCreateRouteDependencies,
} from "./staff-request-create-route";

const organisationId = randomUUID();
const correlationId = randomUUID();
const admin = { actorId: "staff-admin" };

function request(
  body = JSON.stringify({ title: "Prepare client work" }),
  origin = "https://studio.example.test",
): Request {
  return new Request("https://studio.example.test/api/portal/admin/clients/x/requests", {
    body,
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
}

function setup(
  overrides: Partial<StaffRequestCreateRouteDependencies<typeof admin>> = {},
): {
  handler: (request: Request, organisationId: string) => Promise<Response>;
  writes: () => number;
} {
  let writes = 0;
  const handler = createStaffRequestCreateRouteHandler({
    authorize: async () => admin,
    createCorrelationId: () => correlationId,
    enabled: true,
    execute: async (actor, receivedOrganisationId, input, receivedCorrelationId) => {
      writes += 1;
      assert.deepEqual(actor, admin);
      assert.equal(receivedOrganisationId, organisationId);
      assert.deepEqual(input, { title: "Prepare client work" });
      assert.equal(receivedCorrelationId, correlationId);
      return { id: randomUUID(), version: 1 };
    },
    origin: "https://studio.example.test",
    reportUnexpectedError: () => {},
    ...overrides,
  });
  return { handler, writes: () => writes };
}

test("staff request creation binds the authorised client route before writing", async () => {
  const api = setup();
  for (const [input, clientId, status] of [
    [request("{}", "https://attacker.example.test"), organisationId, 403],
    [request("{"), organisationId, 400],
    [request(), "not-a-client", 400],
  ] as const) {
    assert.equal((await api.handler(input, clientId)).status, status);
  }
  assert.equal(api.writes(), 0);

  const response = await api.handler(request(), organisationId);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { request?: { version?: number } };
  assert.equal(body.request?.version, 1);
});

test("staff request creation route returns a safe authorization response", async () => {
  const api = setup({
    authorize: async () => {
      throw new Error("missing grant");
    },
  });
  const response = await api.handler(request(), organisationId);
  assert.equal(response.status, 403);
  assert.doesNotMatch(await response.text(), /missing grant|database/i);
});
