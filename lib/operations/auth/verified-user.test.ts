import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readVerifiedPortalUser } from "./verified-user";
test("only server-confirmed nonanonymous email identity crosses the portal boundary", async () => {
  const user = {
    id: randomUUID(),
    email: "Client@example.test",
    email_confirmed_at: "2026-09-07T00:00:00Z",
    is_anonymous: false,
    user_metadata: { role: "owner" },
  };
  assert.deepEqual(
    await readVerifiedPortalUser(async () => ({ data: { user }, error: null })),
    { userId: user.id, email: "client@example.test", emailVerified: true },
  );
  for (const candidate of [
    null,
    { ...user, email_confirmed_at: null },
    { ...user, is_anonymous: true },
    { ...user, id: "forged" },
    { ...user, email: null },
  ])
    assert.equal(
      await readVerifiedPortalUser(async () => ({
        data: { user: candidate },
        error: null,
      })),
      null,
    );
  assert.equal(
    await readVerifiedPortalUser(async () => ({
      data: { user },
      error: { status: 401 },
    })),
    null,
  );
  assert.equal(
    await readVerifiedPortalUser(async () => ({
      data: { user: null },
      error: { name: "AuthSessionMissingError" },
    })),
    null,
  );
  await assert.rejects(
    readVerifiedPortalUser(async () => ({
      data: { user },
      error: { status: 500, message: "provider detail" },
    })),
    /unavailable/,
  );
});
