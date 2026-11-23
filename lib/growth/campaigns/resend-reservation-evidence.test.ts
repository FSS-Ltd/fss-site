import assert from "node:assert/strict";
import test from "node:test";
import { matchesResendSubmissionEvidence } from "./resend-reservation-evidence";

test("acceptance proof matches every issued identity and rejects altered facts", () => {
  const expected = {
    version: 1,
    kind: "resend_api_send_email_v1",
    reservationId: "11111111-1111-4111-8111-111111111111",
    accountId: "22222222-2222-4222-8222-222222222222",
    connectionId: "22222222-2222-4222-8222-222222222222",
    sendGeneration: "33333333-3333-4333-8333-333333333333",
    idempotencyKey: "attempt-1",
    bodySha256: "a".repeat(64),
    providerMessageId: "provider-1",
  };
  assert.equal(matchesResendSubmissionEvidence(expected, expected), true);
  assert.equal(
    matchesResendSubmissionEvidence(
      { ...expected, bodySha256: "b".repeat(64) },
      expected,
    ),
    false,
  );
  assert.equal(
    matchesResendSubmissionEvidence(
      { ...expected, sendGeneration: "44444444-4444-4444-8444-444444444444" },
      expected,
    ),
    false,
  );
  assert.equal(
    matchesResendSubmissionEvidence(
      { ...expected, providerMessageId: "provider-2" },
      expected,
    ),
    false,
  );
  assert.equal(
    matchesResendSubmissionEvidence(
      { ...expected, providerThreadId: "fake" },
      expected,
    ),
    false,
  );
  assert.equal(matchesResendSubmissionEvidence(null, expected), false);
});
