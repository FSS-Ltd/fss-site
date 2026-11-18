import assert from "node:assert/strict";
import test from "node:test";
import { parseGmailRecipients } from "./recipients";

test("recipient parsing preserves header identity and normalizes addresses", () => {
  assert.deepEqual(
    parseGmailRecipients({
      to: '"Owner" <Owner@Example.com>',
      cc: "Other@example.com",
      bcc: null,
    }),
    { to: ["owner@example.com"], cc: ["other@example.com"], bcc: [] },
  );
  assert.equal(parseGmailRecipients({ to: null, cc: null, bcc: null }), null);
  assert.equal(
    parseGmailRecipients({ to: "owner@example.com,", cc: null, bcc: null }),
    null,
  );
});
