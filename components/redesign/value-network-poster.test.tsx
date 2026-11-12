import assert from "node:assert/strict";
import test from "node:test";
import { posterLabelShifts } from "./value-network-poster";

test("poster labels slide in where the stage crops the view box", () => {
  // Mid widths crop the sides, so a label near the right edge moves inward.
  const mid = posterLabelShifts(1024);
  assert.ok(mid.some((dx) => dx < 0));
  // The hub is never moved.
  assert.equal(mid[mid.length - 1], 0);
  // A stage as wide as the view box shows everything: nothing moves.
  assert.ok(posterLabelShifts(1900).every((dx) => dx === 0));
});
