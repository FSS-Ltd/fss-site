import assert from "node:assert/strict";
import test from "node:test";

import { verifyAgentRequest } from "./agent-signature";

const BODY = Buffer.from('{"schemaVersion":"1.0"}');
const KEY_ID = "weekday-agent-v1";
const SECRET = "test-secret";
const TIMESTAMP = "1786870800";
const SIGNATURE =
  "0a5ce2f499c8eed4de2aa32558042f57854aa51bdf232101efbfae6505666180";
const NOW = new Date("2026-08-16T09:00:00.000Z");

function verify(
  overrides: Partial<Parameters<typeof verifyAgentRequest>[0]> = {},
) {
  return verifyAgentRequest({
    rawBody: BODY,
    keyId: KEY_ID,
    timestamp: TIMESTAMP,
    signature: SIGNATURE,
    now: NOW,
    configuredKeyId: KEY_ID,
    secret: SECRET,
    ...overrides,
  });
}

test("accepts a valid signature over the exact raw request bytes", () => {
  assert.deepEqual(verify(), { ok: true });
});

test("rejects a signature after the raw body changes", () => {
  assert.deepEqual(
    verify({ rawBody: Buffer.from('{"schemaVersion":"2.0"}') }),
    { ok: false, code: "invalid" },
  );
});

test("rejects timestamps older than five minutes", () => {
  assert.deepEqual(verify({ now: new Date("2026-08-16T09:05:01.000Z") }), {
    ok: false,
    code: "stale",
  });
});

test("rejects timestamps more than five minutes in the future", () => {
  assert.deepEqual(verify({ now: new Date("2026-08-16T08:54:59.000Z") }), {
    ok: false,
    code: "stale",
  });
});

test("accepts timestamps exactly five minutes from server time", () => {
  assert.deepEqual(verify({ now: new Date("2026-08-16T09:05:00.000Z") }), {
    ok: true,
  });
});

test("rejects malformed timestamp and signature encodings", () => {
  assert.deepEqual(verify({ timestamp: "not-a-timestamp" }), {
    ok: false,
    code: "invalid",
  });
  assert.deepEqual(verify({ signature: "not-hex" }), {
    ok: false,
    code: "invalid",
  });
  assert.deepEqual(verify({ signature: "aa" }), {
    ok: false,
    code: "invalid",
  });
});

test("rejects each missing authentication header", () => {
  assert.deepEqual(verify({ keyId: null }), { ok: false, code: "missing" });
  assert.deepEqual(verify({ timestamp: null }), {
    ok: false,
    code: "missing",
  });
  assert.deepEqual(verify({ signature: null }), {
    ok: false,
    code: "missing",
  });
});

test("rejects a different agent key ID", () => {
  assert.deepEqual(verify({ keyId: "retired-agent-v1" }), {
    ok: false,
    code: "key_mismatch",
  });
});

test("rejects signatures created with a blank configured secret", () => {
  assert.deepEqual(
    verify({
      secret: "",
      signature:
        "e1642350fb30cbefc5ef78546717bcfa374ce5bdb053da1881e50722973eaad6",
    }),
    { ok: false, code: "invalid" },
  );
  assert.deepEqual(
    verify({
      secret: "   ",
      signature:
        "6fbf2d38ce77d54956eec99ce1c46b8a35e39fb04f3aaa14781eb45d3d98793a",
    }),
    { ok: false, code: "invalid" },
  );
});
