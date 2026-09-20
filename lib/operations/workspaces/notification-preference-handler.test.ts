import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationPreferenceHandler } from "./notification-preference-handler";

const identity = {
  userId: "00000000-0000-4000-8000-000000000010",
  email: "owner@example.test",
  emailVerified: true as const,
};

test("notification preference commands require the portal origin and retain a server-bound organisation", async () => {
  const updates: Array<{ organisationId: string; enabled: boolean }> = [];
  const handler = createNotificationPreferenceHandler({
    enabled: true,
    origin: "https://portal.example.test",
    authorize: async () => identity,
    update: async (_identity, organisationId, _correlationId, command) => {
      updates.push({ organisationId, enabled: command.requestEmailEnabled });
      return { requestEmailEnabled: command.requestEmailEnabled };
    },
    createCorrelationId: () => "00000000-0000-4000-8000-000000000011",
    reportUnexpectedError: () => undefined,
  });

  const rejected = await handler(
    new Request(
      "https://portal.example.test/api/portal/notification-preferences",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationId: "00000000-0000-4000-8000-000000000012",
          requestEmailEnabled: false,
        }),
      },
    ),
  );
  assert.equal(rejected.status, 403);

  const accepted = await handler(
    new Request(
      "https://portal.example.test/api/portal/notification-preferences",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://portal.example.test",
        },
        body: JSON.stringify({
          organisationId: "00000000-0000-4000-8000-000000000012",
          requestEmailEnabled: false,
        }),
      },
    ),
  );
  assert.equal(accepted.status, 200);
  assert.deepEqual(updates, [
    { organisationId: "00000000-0000-4000-8000-000000000012", enabled: false },
  ]);
});
