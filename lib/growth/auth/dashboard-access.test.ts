import assert from "node:assert/strict";
import test from "node:test";

import { FounderAuthorizationError } from "./require-founder";
import { enforceFounderDashboardAccess } from "./dashboard-access";

test("allows a successfully authorised founder", async () => {
  let redirected = false;

  await enforceFounderDashboardAccess(
    async () => ({ actorId: "actor-id", email: "founder@example.test" }),
    () => {
      redirected = true;
      throw new Error("Unexpected redirect");
    },
  );

  assert.equal(redirected, false);
});

test("redirects failed founder authorization to the login route", async () => {
  const redirectSignal = new Error("NEXT_REDIRECT");

  await assert.rejects(
    () =>
      enforceFounderDashboardAccess(
        async () => {
          throw new FounderAuthorizationError();
        },
        (path) => {
          assert.equal(path, "/growth/login");
          throw redirectSignal;
        },
      ),
    (error) => error === redirectSignal,
  );
});

test("rethrows unexpected authorization failures", async () => {
  const unexpected = new Error("Authentication provider unavailable");

  await assert.rejects(
    () =>
      enforceFounderDashboardAccess(
        async () => {
          throw unexpected;
        },
        () => {
          throw new Error("Unexpected redirect");
        },
      ),
    (error) => error === unexpected,
  );
});
