import assert from "node:assert/strict";
import test from "node:test";
import { withinSubmissionClock } from "./submission-clock";

const clock = {
  londonDay: "2026-01-05",
  bounds: {
    validatedAt: new Date("2026-01-05T08:00:00Z"),
    expiresAt: new Date("2026-01-06T00:00:00Z"),
    validThrough: null,
  },
  window: {
    timezone: "Europe/London",
    weekdays: [1],
    start: "09:00",
    end: "17:00",
  },
};
test("checks current day, authority and recipient window", () => {
  assert.equal(
    withinSubmissionClock(clock, new Date("2026-01-05T09:00:00Z")),
    true,
  );
  for (const at of [
    "2026-01-05T08:59:59Z",
    "2026-01-05T17:00:00Z",
    "2026-01-06T00:00:00Z",
  ])
    assert.equal(withinSubmissionClock(clock, new Date(at)), false);
  assert.equal(withinSubmissionClock(clock, new Date(NaN)), false);
});
