import assert from "node:assert/strict";
import test from "node:test";

import { FounderAuthorizationError } from "./require-founder";
import { enforceFounderPrivatePreviewAccess } from "./private-preview-access";

test("allows a verified founder to continue to a private draft preview", async () => {
  const founder = { actorId: "actor-id", email: "founder@example.test" };

  const result = await enforceFounderPrivatePreviewAccess(
    async () => founder,
    () => {
      throw new Error("Unexpected not found");
    },
  );

  assert.equal(result, founder);
});

test("hides a private draft preview when founder authorization fails", async () => {
  const notFoundSignal = new Error("NEXT_NOT_FOUND");

  await assert.rejects(
    () =>
      enforceFounderPrivatePreviewAccess(
        async () => {
          throw new FounderAuthorizationError();
        },
        () => {
          throw notFoundSignal;
        },
      ),
    (error) => error === notFoundSignal,
  );
});

test("rethrows unexpected private preview authorization failures", async () => {
  const unexpected = new Error("Authentication provider unavailable");

  await assert.rejects(
    () =>
      enforceFounderPrivatePreviewAccess(
        async () => {
          throw unexpected;
        },
        () => {
          throw new Error("Unexpected not found");
        },
      ),
    (error) => error === unexpected,
  );
});
