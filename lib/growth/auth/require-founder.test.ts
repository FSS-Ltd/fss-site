import assert from "node:assert/strict";
import test from "node:test";

import {
  FounderAuthorizationError,
  resolveFounderSession,
} from "./require-founder";

const ownerEmail = "j.ntagengwa@faithfulsoftware.dev";

test("resolves a stable pseudonymous identity for the verified founder", () => {
  const first = resolveFounderSession(
    {
      user: {
        email: " J.Ntagengwa@faithfulsoftware.dev ",
        founderEmailVerified: true,
      },
    },
    ownerEmail,
  );
  const second = resolveFounderSession(
    { user: { email: ownerEmail, founderEmailVerified: true } },
    ownerEmail,
  );

  assert.equal(first.email, ownerEmail);
  assert.equal(first.actorId, second.actorId);
  assert.match(first.actorId, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(first.actorId, /faithfulsoftware/i);
});

test("rejects sessions that did not retain verified-provider proof", () => {
  assert.throws(
    () =>
      resolveFounderSession(
        { user: { email: ownerEmail, founderEmailVerified: false } },
        ownerEmail,
      ),
    FounderAuthorizationError,
  );
});

test("rejects another signed-in account", () => {
  assert.throws(
    () =>
      resolveFounderSession(
        {
          user: {
            email: "colleague@faithfulsoftware.dev",
            founderEmailVerified: true,
          },
        },
        ownerEmail,
      ),
    FounderAuthorizationError,
  );
});

test("rejects a missing session", () => {
  assert.throws(
    () => resolveFounderSession(null, ownerEmail),
    FounderAuthorizationError,
  );
});
