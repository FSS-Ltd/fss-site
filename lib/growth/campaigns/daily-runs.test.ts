import assert from "node:assert/strict";
import test from "node:test";
import { isLondonSummarySlot } from "./daily-runs";

test("selects the London 17:30 slot through both daylight-saving changes", () => {
  for (const value of [
    "2026-03-28T17:30:00Z",
    "2026-03-29T16:30:00Z",
    "2026-10-24T16:30:00Z",
    "2026-10-25T17:30:00Z",
  ])
    assert.equal(isLondonSummarySlot(new Date(value)), true, value);
  for (const value of [
    "2026-03-28T16:30:00Z",
    "2026-03-29T17:30:00Z",
    "2026-10-24T17:30:00Z",
    "2026-10-25T16:30:00Z",
    "2026-01-05T17:29:59Z",
    "2026-01-05T17:35:00Z",
  ])
    assert.equal(isLondonSummarySlot(new Date(value)), false, value);
  assert.equal(isLondonSummarySlot(new Date(NaN)), false);
});
