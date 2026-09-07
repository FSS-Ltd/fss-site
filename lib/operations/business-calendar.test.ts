import assert from "node:assert/strict";
import test from "node:test";
import { addOperationsBusinessDays } from "./business-calendar";

for (const [label, from, days, expected] of [
  [
    "ordinary working day",
    "2026-09-07T10:30:00Z",
    1,
    "2026-09-08T10:30:00.000Z",
  ],
  ["after hours", "2026-09-07T20:00:00Z", 1, "2026-09-08T16:00:00.000Z"],
  ["weekend", "2026-09-05T12:00:00Z", 1, "2026-09-07T16:00:00.000Z"],
  [
    "summer bank holiday",
    "2026-08-28T15:00:00Z",
    1,
    "2026-09-01T15:00:00.000Z",
  ],
  [
    "spring clock change",
    "2026-03-27T16:00:00Z",
    1,
    "2026-03-30T15:00:00.000Z",
  ],
  [
    "autumn clock change",
    "2026-10-23T15:00:00Z",
    1,
    "2026-10-26T16:00:00.000Z",
  ],
  ["three-day review", "2026-12-24T16:00:00Z", 3, "2026-12-31T16:00:00.000Z"],
  ["opening boundary", "2026-09-07T07:59:00Z", 1, "2026-09-07T16:00:00.000Z"],
  ["closing boundary", "2026-09-07T16:00:00Z", 1, "2026-09-08T16:00:00.000Z"],
] as const) {
  test(`business deadline accounts for ${label}`, () => {
    const start = new Date(from);
    assert.equal(
      addOperationsBusinessDays(start, days).toISOString(),
      expected,
    );
    assert.equal(start.toISOString(), new Date(from).toISOString());
  });
}
test("business clock rejects invalid dates, intervals and unconfigured holiday years", () => {
  assert.throws(() => addOperationsBusinessDays(new Date("invalid"), 1));
  for (const days of [0, -1, 1.5, 31, NaN, Infinity])
    assert.throws(() =>
      addOperationsBusinessDays(new Date("2026-09-07"), days),
    );
  assert.throws(
    () => addOperationsBusinessDays(new Date("2029-01-02"), 1),
    /calendar/,
  );
  assert.throws(
    () => addOperationsBusinessDays(new Date("2028-12-29T16:00:00Z"), 1),
    /calendar/,
  );
});
