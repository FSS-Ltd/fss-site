import assert from "node:assert/strict";
import test from "node:test";
import { sendAccessOperation } from "./access-operation";
const operation = {
  action: "invite_admin" as const,
  name: "Sam",
  email: "sam@example.test",
  reviewReference: "review-42",
};

test("invitation outcome verifies provider acceptance and preserves the review command", async (context) => {
  let submitted: unknown;
  context.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      submitted = JSON.parse(String(init.body));
      return Response.json({ status: "sent" });
    },
  );
  assert.deepEqual(await sendAccessOperation(operation), { status: "sent" });
  assert.deepEqual(submitted, operation);
});

test("ambiguous and wrong operation outcomes never report success", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ status: "revoked" }),
  );
  await assert.rejects(
    sendAccessOperation(operation),
    /could not be confirmed/,
  );
});

test("access errors retain the dialog's actionable message", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    Response.json(
      {
        error:
          "This membership is no longer active. Refresh the access register.",
      },
      { status: 409 },
    ),
  );
  await assert.rejects(
    sendAccessOperation({
      action: "revoke_admin",
      staffMembershipId: "22222222-2222-4222-8222-222222222222",
      reviewReference: "review-42",
    }),
    /no longer active/,
  );
});
