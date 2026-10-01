import assert from "node:assert/strict";
import test from "node:test";
import { EngagementCommandConflict } from "../agreements/engagement-service";
import {
  createStaffEngagementRouteHandler,
  type StaffEngagementRouteDependencies,
} from "./staff-engagement-route";

const organisationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const command = {
  action: "select",
  commandId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  engagementId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
};

function dependencies(
  overrides: Partial<StaffEngagementRouteDependencies<true>> = {},
): StaffEngagementRouteDependencies<true> {
  return {
    authorize: async () => true,
    createCorrelationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    enabled: true,
    execute: async () => ({
      draftId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      draftVersion: 3,
      engagementId: command.engagementId,
    }),
    origin: "https://portal.faithfulsoftware.dev",
    reportUnexpectedError: () => undefined,
    ...overrides,
  };
}

function request(origin = "https://portal.faithfulsoftware.dev") {
  return new Request(
    `${origin}/api/portal/admin/clients/${organisationId}/engagements`,
    {
      body: JSON.stringify(command),
      headers: { "content-type": "application/json", origin },
      method: "POST",
    },
  );
}

test("returns the selected engagement and resumed draft after an authorized command", async () => {
  const response = await createStaffEngagementRouteHandler(dependencies())(
    request(),
    organisationId,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    draftId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    draftVersion: 3,
    engagementId: command.engagementId,
  });
});

test("rejects requests from a different origin before executing the command", async () => {
  let executed = false;
  const response = await createStaffEngagementRouteHandler(
    dependencies({
      execute: async () => {
        executed = true;
        throw new Error();
      },
    }),
  )(request("https://faithfulsoftware.dev"), organisationId);

  assert.equal(response.status, 403);
  assert.equal(executed, false);
});

test("returns conflicts for stale drafts and invalid commands", async () => {
  const response = await createStaffEngagementRouteHandler(
    dependencies({
      execute: async () => {
        throw new EngagementCommandConflict();
      },
    }),
  )(request(), organisationId);

  assert.equal(response.status, 409);
});
