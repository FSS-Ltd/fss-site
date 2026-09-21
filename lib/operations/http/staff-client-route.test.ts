import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { z } from "zod";
import {
  createStaffClientRouteHandler,
  type StaffClientRouteDependencies,
} from "./staff-client-route";
import { StudioClientDuplicateError } from "../organisations/staff-service";

const correlationId = randomUUID();
const organisationId = randomUUID();
const admin = { actorId: "staff-admin" };

function request(
  body = JSON.stringify({ displayName: "Northstar" }),
  origin = "https://studio.example.test",
  contentType = "application/json",
): Request {
  return new Request("https://studio.example.test/api/portal/admin/clients", {
    body,
    headers: { "content-type": contentType, origin },
    method: "POST",
  });
}

function setup(
  overrides: Partial<StaffClientRouteDependencies<typeof admin>> = {},
): {
  handler: (request: Request) => Promise<Response>;
  reports: Array<{ correlationId: string; errorName: string }>;
  writes: () => number;
} {
  const reports: Array<{ correlationId: string; errorName: string }> = [];
  let writes = 0;
  const handler = createStaffClientRouteHandler({
    authorize: async () => admin,
    createCorrelationId: () => correlationId,
    enabled: true,
    execute: async (actor, input, receivedCorrelationId) => {
      writes += 1;
      assert.deepEqual(actor, admin);
      assert.deepEqual(input, { displayName: "Northstar" });
      assert.equal(receivedCorrelationId, correlationId);
      return { organisationId };
    },
    origin: "https://studio.example.test",
    reportUnexpectedError: (report) => reports.push(report),
    ...overrides,
  });
  return { handler, reports, writes: () => writes };
}

test("client creation route rejects unavailable, foreign and malformed requests before writes", async () => {
  for (const [overrides, input, status] of [
    [{ enabled: false }, request(), 404],
    [{ authorize: async () => { throw new Error("denied"); } }, request(), 403],
    [{}, request("{}", "https://attacker.example.test"), 403],
    [{}, request("{}", "https://studio.example.test", "text/plain"), 415],
    [{}, request("{"), 400],
    [{}, request(JSON.stringify({ value: "x".repeat(65_537) })), 413],
  ] as const) {
    const api = setup(overrides);
    assert.equal((await api.handler(input)).status, status);
    assert.equal(api.writes(), 0);
  }
});

test("client creation route returns only the created organisation ID", async () => {
  const api = setup();
  const response = await api.handler(request());

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-correlation-id"), correlationId);
  assert.deepEqual(await response.json(), { organisationId });
});

test("client creation route maps validation and duplicate errors safely", async () => {
  const validation = z.object({ legalName: z.string() }).safeParse({});
  assert.equal(validation.success, false);
  for (const [error, status] of [
    [new StudioClientDuplicateError(), 409],
    [validation.error, 400],
    [new Error("private database host"), 503],
  ] as const) {
    const api = setup({
      execute: async () => {
        throw error;
      },
    });
    const response = await api.handler(request());
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /private database host/);
  }
});
