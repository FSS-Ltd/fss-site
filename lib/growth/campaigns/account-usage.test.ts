import assert from "node:assert/strict";
import test from "node:test";
import { validUsageProvenance } from "./account-usage";

const capturedAt = new Date("2026-11-17T12:00:00Z");
const messages = [
  { id: "a", sentAt: "2026-11-17T11:59:00.000Z", recipientCount: 2 },
  { id: "b", sentAt: "2026-11-16T13:00:00.000Z", recipientCount: 3 },
];
test("usage counts match unique IDs and exact recipient occurrences in the window", () => {
  assert.equal(validUsageProvenance(messages, 2, 5, capturedAt), true);
  assert.equal(validUsageProvenance(messages, 2, 2, capturedAt), false);
  assert.equal(
    validUsageProvenance([messages[0], messages[0]], 2, 4, capturedAt),
    false,
  );
  assert.equal(validUsageProvenance(messages, 3, 5, capturedAt), false);
  assert.equal(
    validUsageProvenance(
      [{ ...messages[0], sentAt: "2026-11-15T12:00:00.000Z" }, messages[1]],
      2,
      5,
      capturedAt,
    ),
    false,
  );
  assert.equal(
    validUsageProvenance(
      [{ ...messages[0], recipientCount: 0 }, messages[1]],
      2,
      3,
      capturedAt,
    ),
    false,
  );
  assert.equal(validUsageProvenance(["a", "b"], 2, 5, capturedAt), false);
});
