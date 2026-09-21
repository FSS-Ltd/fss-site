import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  createStaffProjectRouteHandler,
  type StaffProjectRouteDependencies,
} from "./staff-project-route";
import { ProjectConflict } from "../projects/types";

const projectId = randomUUID();
const correlationId = randomUUID();
const admin = { actorId: "staff-admin" };

function request(
  body = JSON.stringify({ action: "update" }),
  origin = "https://studio.example.test",
): Request {
  return new Request("https://studio.example.test/api/portal/admin/projects/x", {
    body,
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
}

function setup(
  overrides: Partial<StaffProjectRouteDependencies<typeof admin>> = {},
): {
  handler: (request: Request, projectId: string) => Promise<Response>;
  writes: () => number;
} {
  let writes = 0;
  const handler = createStaffProjectRouteHandler({
    authorize: async () => admin,
    createCorrelationId: () => correlationId,
    enabled: true,
    execute: async (actor, receivedProjectId, input, receivedCorrelationId) => {
      writes += 1;
      assert.deepEqual(actor, admin);
      assert.equal(receivedProjectId, projectId);
      assert.deepEqual(input, { action: "update" });
      assert.equal(receivedCorrelationId, correlationId);
      return { id: projectId, version: 4 };
    },
    origin: "https://studio.example.test",
    reportUnexpectedError: () => {},
    ...overrides,
  });
  return { handler, writes: () => writes };
}

test("project update route binds the selected route project before any write", async () => {
  const api = setup();
  for (const [input, id, status] of [
    [request("{}", "https://attacker.example.test"), projectId, 403],
    [request("{"), projectId, 400],
    [request(), "not-a-project", 400],
  ] as const) {
    assert.equal((await api.handler(input, id)).status, status);
  }
  assert.equal(api.writes(), 0);

  const response = await api.handler(request(), projectId);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: projectId, version: 4 });
});

test("project update route returns a safe stale-write response", async () => {
  const api = setup({
    execute: async () => {
      throw new ProjectConflict();
    },
  });
  const response = await api.handler(request(), projectId);
  assert.equal(response.status, 409);
  assert.doesNotMatch(await response.text(), /database|private/i);
});
