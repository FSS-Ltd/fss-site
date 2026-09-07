import assert from "node:assert/strict";
import test from "node:test";
import { createPortalInviteToken, hashPortalInviteToken } from "./invites";

test("invitation tokens contain 256 random bits and persist only a stable hash", () => {
  const first = createPortalInviteToken();
  const second = createPortalInviteToken();
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.token, first.tokenHash);
  assert.equal(hashPortalInviteToken(first.token), first.tokenHash);
});
