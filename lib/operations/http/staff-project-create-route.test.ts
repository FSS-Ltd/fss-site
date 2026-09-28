import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  createStaffProjectCreateRouteHandler,
  type StaffProjectCreateRouteDependencies,
} from "./staff-project-create-route";
import { ProjectConflict } from "../projects/types";

const organisationId = randomUUID();
const projectId = randomUUID();
const correlationId = randomUUID();
const actor = { id: "staff" };

function request(
  body = JSON.stringify({ action: "create" }),
  origin = "https://studio.example.test",
): Request {
  return new Request(
    "https://studio.example.test/api/portal/admin/clients/org/projects",
    {
      body,
      headers: { "content-type": "application/json", origin },
      method: "POST",
    },
  );
}

function setup(
  overrides: Partial<StaffProjectCreateRouteDependencies<typeof actor>> = {},
): {
  handler: (request: Request, organisationId: string) => Promise<Response>;
  writes: () => number;
} {
  let writes = 0;
  const handler = createStaffProjectCreateRouteHandler({
    authorize: async () => actor,
    createCorrelationId: () => correlationId,
    enabled: true,
    execute: async (
      receivedActor,
      receivedOrganisationId,
      input,
      receivedCorrelationId,
    ) => {
      writes += 1;
      assert.deepEqual(receivedActor, actor);
      assert.equal(receivedOrganisationId, organisationId);
      assert.deepEqual(input, { action: "create" });
      assert.equal(receivedCorrelationId, correlationId);
      return { id: projectId, version: 1 };
    },
    origin: "https://studio.example.test",
    reportUnexpectedError: () => {},
    ...overrides,
  });
  return { handler, writes: () => writes };
}

test("project creation binds the client organisation and rejects invalid requests before writes", async () => {
  const api = setup();
  for (const [input, id, status] of [
    [request("{}", "https://attacker.example.test"), organisationId, 403],
    [request("{"), organisationId, 400],
    [request(), "not-an-organisation", 400],
  ] as const) {
    assert.equal((await api.handler(input, id)).status, status);
  }
  assert.equal(api.writes(), 0);

  const response = await api.handler(request(), organisationId);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: projectId, version: 1 });
  assert.equal(api.writes(), 1);
});

test("project creation returns a safe agreement scope conflict", async () => {
  const api = setup({
    execute: async () => {
      throw new ProjectConflict("Select an agreement for this client.");
    },
  });
  const response = await api.handler(request(), organisationId);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "Select an agreement for this client.",
  });
});
