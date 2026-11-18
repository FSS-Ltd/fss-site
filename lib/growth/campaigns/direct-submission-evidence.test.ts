import assert from "node:assert/strict";
import test from "node:test";
import { matchesDirectSubmissionEvidence as matches } from "./direct-submission-evidence";

const proof = {
  version: 1,
  kind: "gmail_api_send_message_v1",
  reservationId: "00000000-0000-4000-8000-000000000001",
  accountId: "account",
  connectionId: "00000000-0000-4000-8000-000000000002",
  googleSubject: "subject",
  grantEpoch: 1,
  rfcMessageId: "<id@example.test>",
  rawSha256: "a".repeat(64),
  providerMessageId: "provider-id",
  providerThreadId: "thread-id",
};

test("direct submission proof rejects missing, malformed and crossed identity", () => {
  assert.equal(matches(proof, proof), true);
  for (const key of [
    "reservationId",
    "accountId",
    "connectionId",
    "googleSubject",
    "grantEpoch",
    "rfcMessageId",
    "rawSha256",
    "providerMessageId",
    "providerThreadId",
    "kind",
    "version",
  ] as const) {
    assert.equal(matches({ ...proof, [key]: "wrong" }, proof), false, key);
  }
  assert.equal(matches({ ...proof, extra: true }, proof), false);
  assert.equal(matches(null, proof), false);
});
