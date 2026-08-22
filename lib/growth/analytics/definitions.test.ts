import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_METRIC_DEFINITIONS,
  computeRate,
  CONVERSION_RATE_DEFINITIONS,
  currentLondonMonthKey,
  FUNNEL_METRIC_DEFINITIONS,
  resolveLondonMonthRange,
  resolveUtcWindow,
  VALUE_METRIC_DEFINITIONS,
} from "./definitions";

test("resolveUtcWindow converts a London summer day range to a half-open UTC window", () => {
  const window = resolveUtcWindow({ startDate: "2026-08-01", endDate: "2026-08-01" });
  // London is BST (UTC+1) in August.
  assert.equal(window.startUtc.toISOString(), "2026-07-31T23:00:00.000Z");
  assert.equal(window.endUtc.toISOString(), "2026-08-01T23:00:00.000Z");
});

test("resolveUtcWindow converts a London winter day range to a half-open UTC window", () => {
  const window = resolveUtcWindow({ startDate: "2026-01-15", endDate: "2026-01-15" });
  // London is GMT (UTC+0) in January.
  assert.equal(window.startUtc.toISOString(), "2026-01-15T00:00:00.000Z");
  assert.equal(window.endUtc.toISOString(), "2026-01-16T00:00:00.000Z");
});

test("resolveUtcWindow spans a full month range inclusively", () => {
  const window = resolveUtcWindow({ startDate: "2026-08-01", endDate: "2026-08-31" });
  // London is still BST (UTC+1) on 1 September.
  assert.equal(window.startUtc.toISOString(), "2026-07-31T23:00:00.000Z");
  assert.equal(window.endUtc.toISOString(), "2026-08-31T23:00:00.000Z");
});

test("resolveUtcWindow spans a range that crosses a month boundary", () => {
  const window = resolveUtcWindow({ startDate: "2026-07-28", endDate: "2026-08-03" });
  assert.equal(window.startUtc.toISOString(), "2026-07-27T23:00:00.000Z");
  assert.equal(window.endUtc.toISOString(), "2026-08-03T23:00:00.000Z");
});

test("resolveUtcWindow rejects an end date before the start date", () => {
  assert.throws(
    () => resolveUtcWindow({ startDate: "2026-08-10", endDate: "2026-08-01" }),
    RangeError,
  );
});

test("resolveUtcWindow rejects a malformed calendar date", () => {
  assert.throws(
    () => resolveUtcWindow({ startDate: "2026/08/01", endDate: "2026-08-01" }),
    RangeError,
  );
});

test("resolveLondonMonthRange resolves a 31-day month", () => {
  assert.deepEqual(resolveLondonMonthRange("2026-08"), {
    startDate: "2026-08-01",
    endDate: "2026-08-31",
  });
});

test("resolveLondonMonthRange resolves February in a leap year", () => {
  assert.deepEqual(resolveLondonMonthRange("2028-02"), {
    startDate: "2028-02-01",
    endDate: "2028-02-29",
  });
});

test("resolveLondonMonthRange resolves February in a non-leap year", () => {
  assert.deepEqual(resolveLondonMonthRange("2026-02"), {
    startDate: "2026-02-01",
    endDate: "2026-02-28",
  });
});

test("resolveLondonMonthRange rejects a malformed or out-of-range month", () => {
  assert.throws(() => resolveLondonMonthRange("2026-8"), RangeError);
  assert.throws(() => resolveLondonMonthRange("2026-13"), RangeError);
});

test("currentLondonMonthKey reads the London calendar month from a UTC instant near midnight", () => {
  // 2026-01-01T00:30:00Z is still 2025-12-31 in London (GMT, no offset) - not a boundary case,
  // so pick an instant that actually differs from its UTC calendar date: late evening BST.
  assert.equal(currentLondonMonthKey(new Date("2026-07-31T23:30:00.000Z")), "2026-08");
  assert.equal(currentLondonMonthKey(new Date("2026-08-15T12:00:00.000Z")), "2026-08");
});

test("computeRate returns null for a zero denominator instead of a misleading 0", () => {
  assert.equal(computeRate(5, 0), null);
  assert.equal(computeRate(0, 0), null);
});

test("computeRate divides normally for a positive denominator", () => {
  assert.equal(computeRate(3, 12), 0.25);
  assert.equal(computeRate(0, 12), 0);
});

test("every metric definition has a unique id", () => {
  const ids = ALL_METRIC_DEFINITIONS.map((definition) => definition.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every funnel and value metric documents a non-empty numerator and inclusion time", () => {
  for (const definition of [...FUNNEL_METRIC_DEFINITIONS, ...VALUE_METRIC_DEFINITIONS]) {
    assert.ok(definition.numerator.trim().length > 0, definition.id);
    assert.ok(definition.inclusionTime.trim().length > 0, definition.id);
  }
});

test("every conversion rate documents its denominator and empty-denominator behaviour", () => {
  for (const definition of CONVERSION_RATE_DEFINITIONS) {
    assert.equal(definition.kind, "rate");
    assert.ok(definition.denominator && definition.denominator.trim().length > 0, definition.id);
    assert.ok(definition.emptyDenominatorBehaviour.includes("null"), definition.id);
  }
});

test("value metrics never claim an agreed or won figure is recognised revenue", () => {
  for (const definition of VALUE_METRIC_DEFINITIONS) {
    assert.doesNotMatch(definition.numerator.toLowerCase(), /\bis\b[^.]*\brecognised revenue\b/);
  }
});
