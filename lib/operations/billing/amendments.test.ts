import assert from "node:assert/strict";
import test from "node:test";
import { amendmentEffectiveTimestamp } from "./amendments";
test("millisecond ISO amendment dates produce Stripe integer seconds", () => {
  assert.equal(
    amendmentEffectiveTimestamp("2026-09-08T05:41:48.695Z"),
    1788846108,
  );
  assert.equal(amendmentEffectiveTimestamp("2026-09-08T05:41:48Z"), 1788846108);
  assert.throws(() => amendmentEffectiveTimestamp("2026-02-30T00:00:00Z"));
});
