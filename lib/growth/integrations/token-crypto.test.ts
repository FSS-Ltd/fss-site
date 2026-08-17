import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptRefreshToken,
  encryptRefreshToken,
  parseTokenEncryptionKey,
  type StoredEncryptedToken,
} from "./token-crypto";

const encryptionKey = Buffer.alloc(32, 7);

test("encrypts and decrypts a Gmail refresh token", () => {
  const encrypted = encryptRefreshToken("refresh-token", {
    version: "v1",
    key: encryptionKey,
  });

  assert.notEqual(encrypted.ciphertext, "refresh-token");
  assert.equal(encrypted.version, "v1");
  assert.equal(Buffer.from(encrypted.iv, "base64").byteLength, 12);
  assert.equal(Buffer.from(encrypted.authTag, "base64").byteLength, 16);
  assert.equal(
    decryptRefreshToken(encrypted, { v1: encryptionKey }),
    "refresh-token",
  );
});

test("uses a fresh IV for every encrypted token", () => {
  const first = encryptRefreshToken("refresh-token", {
    version: "v1",
    key: encryptionKey,
  });
  const second = encryptRefreshToken("refresh-token", {
    version: "v1",
    key: encryptionKey,
  });

  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("rejects a modified authentication tag", () => {
  const encrypted = encryptRefreshToken("refresh-token", {
    version: "v1",
    key: encryptionKey,
  });
  const modifiedTag = Buffer.from(encrypted.authTag, "base64");
  modifiedTag[0] ^= 1;

  assert.throws(
    () =>
      decryptRefreshToken(
        { ...encrypted, authTag: modifiedTag.toString("base64") },
        { v1: encryptionKey },
      ),
    /Unable to decrypt refresh token/,
  );
});

test("rejects decryption with the wrong key", () => {
  const encrypted = encryptRefreshToken("refresh-token", {
    version: "v1",
    key: encryptionKey,
  });

  assert.throws(
    () => decryptRefreshToken(encrypted, { v1: Buffer.alloc(32, 8) }),
    /Unable to decrypt refresh token/,
  );
});

test("rejects an unsupported key version", () => {
  const unsupported: StoredEncryptedToken = {
    version: "v2",
    iv: Buffer.alloc(12).toString("base64"),
    ciphertext: Buffer.from("ciphertext").toString("base64"),
    authTag: Buffer.alloc(16).toString("base64"),
  };

  assert.throws(
    () => decryptRefreshToken(unsupported, { v1: encryptionKey }),
    /Unsupported refresh token key version/,
  );
});

test("parses only strict base64 32-byte environment keys", () => {
  assert.deepEqual(
    parseTokenEncryptionKey(encryptionKey.toString("base64")),
    encryptionKey,
  );

  for (const invalidKey of [
    "",
    "not-base64!",
    Buffer.alloc(31).toString("base64"),
    Buffer.alloc(33).toString("base64"),
  ]) {
    assert.throws(
      () => parseTokenEncryptionKey(invalidKey),
      /exactly 32 bytes of base64-encoded key material/,
    );
  }
});

test("rejects malformed stored envelopes before decryption", () => {
  const encrypted = encryptRefreshToken("refresh-token", {
    version: "v1",
    key: encryptionKey,
  });

  for (const malformed of [
    { ...encrypted, iv: "not-base64!" },
    { ...encrypted, iv: Buffer.alloc(11).toString("base64") },
    { ...encrypted, authTag: Buffer.alloc(15).toString("base64") },
    { ...encrypted, ciphertext: "" },
  ]) {
    assert.throws(
      () => decryptRefreshToken(malformed, { v1: encryptionKey }),
      /Invalid encrypted refresh token envelope/,
    );
  }
});

test("rejects blank refresh tokens and invalid raw keys", () => {
  assert.throws(
    () =>
      encryptRefreshToken(" ", {
        version: "v1",
        key: encryptionKey,
      }),
    /Refresh token must not be blank/,
  );
  assert.throws(
    () =>
      encryptRefreshToken("refresh-token", {
        version: "v1",
        key: Buffer.alloc(31),
      }),
    /exactly 32 bytes/,
  );
});
