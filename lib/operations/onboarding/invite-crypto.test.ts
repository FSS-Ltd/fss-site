import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptInviteToken,
  encryptInviteToken,
  parseInviteKey,
} from "./invite-crypto";
const key = Buffer.alloc(32, 7);
const job = "11111111-1111-4111-8111-111111111111";
const recipient = "signer@example.test";
const token = Buffer.alloc(32, 9).toString("base64url");
test("invitation encryption binds the token to job, recipient and key", () => {
  const encrypted = encryptInviteToken(token, key, job, recipient);
  assert.equal(
    decryptInviteToken(encrypted, key, job, recipient.toUpperCase()),
    token,
  );
  assert.notEqual(JSON.stringify(encrypted).includes(token), true);
  assert.throws(() =>
    decryptInviteToken(
      encrypted,
      key,
      "22222222-2222-4222-8222-222222222222",
      recipient,
    ),
  );
  assert.throws(() =>
    decryptInviteToken(encrypted, key, job, "other@example.test"),
  );
  assert.throws(() =>
    decryptInviteToken(encrypted, Buffer.alloc(32, 8), job, recipient),
  );
  assert.throws(() =>
    decryptInviteToken(
      { ...encrypted, tag: Buffer.alloc(16).toString("base64") },
      key,
      job,
      recipient,
    ),
  );
  assert.throws(() =>
    decryptInviteToken({ ...encrypted, iv: "" }, key, job, recipient),
  );
  assert.throws(() =>
    decryptInviteToken({ ...encrypted, version: 2 }, key, job, recipient),
  );
  assert.throws(() => encryptInviteToken("bad", key, job, recipient));
  assert.throws(() =>
    encryptInviteToken(token, Buffer.alloc(31), job, recipient),
  );
});
test("invitation key configuration accepts only canonical 256-bit base64", () => {
  assert.deepEqual(parseInviteKey(key.toString("base64")), key);
  for (const raw of [
    undefined,
    "",
    "wrong",
    Buffer.alloc(31).toString("base64"),
    key.toString("base64") + " ",
  ])
    assert.throws(() => parseInviteKey(raw));
});
