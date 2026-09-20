import assert from "node:assert/strict";
import test from "node:test";

import { signOutOfPortal } from "./portal-sign-out";

test("signs out through Clerk and returns to the portal login page", async () => {
  const calls: Array<{ redirectUrl?: string }> = [];

  await signOutOfPortal(async (options) => {
    calls.push(options ?? {});
  }, "/login");

  assert.deepEqual(calls, [{ redirectUrl: "/login" }]);
});
