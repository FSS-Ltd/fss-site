import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedFounderProfile } from "./policy";

const ownerEmail = "j.ntagengwa@faithfulsoftware.dev";

test("accepts only the verified founder email", () => {
  assert.equal(
    isAllowedFounderProfile(
      {
        email: " J.Ntagengwa@faithfulsoftware.dev ",
        emailVerified: true,
      },
      ownerEmail,
    ),
    true,
  );
});

test("rejects another verified Workspace account", () => {
  assert.equal(
    isAllowedFounderProfile(
      {
        email: "colleague@faithfulsoftware.dev",
        emailVerified: true,
      },
      ownerEmail,
    ),
    false,
  );
});

test("rejects an unverified matching address", () => {
  assert.equal(
    isAllowedFounderProfile(
      { email: ownerEmail, emailVerified: false },
      ownerEmail,
    ),
    false,
  );
});

test("rejects a missing profile email", () => {
  assert.equal(
    isAllowedFounderProfile({ emailVerified: true }, ownerEmail),
    false,
  );
});

test("rejects a blank configured owner email", () => {
  assert.equal(
    isAllowedFounderProfile({ email: ownerEmail, emailVerified: true }, "   "),
    false,
  );
});
