import assert from "node:assert/strict";
import test from "node:test";

import {
  formatGrowthCurrency,
  formatGrowthDate,
  formatGrowthDateTime,
  formatGrowthEvidenceCount,
  formatGrowthPercentage,
  formatGrowthStatusLabel,
  formatGrowthTime,
} from "./formatters";

test("formats dates and times in the Europe/London timezone", () => {
  const summerInstant = "2026-08-16T23:30:00.000Z";

  assert.equal(formatGrowthDate(summerInstant), "17 Aug 2026");
  assert.equal(formatGrowthTime(summerInstant), "00:30");
  assert.equal(formatGrowthDateTime(summerInstant), "17 Aug 2026, 00:30");

  assert.equal(formatGrowthTime("2026-01-16T23:30:00.000Z"), "23:30");
  assert.equal(
    formatGrowthDateTime("2026-08-16T23:30:00+01:00"),
    "16 Aug 2026, 23:30",
  );
});

test("formats integer pence as GBP without hiding partial pounds", () => {
  assert.equal(formatGrowthCurrency(1_850_000), "£18,500");
  assert.equal(formatGrowthCurrency(123_450), "£1,234.50");
  assert.equal(formatGrowthCurrency(-99), "-£0.99");
});

test("formats ratios as percentages", () => {
  assert.equal(formatGrowthPercentage(0.98), "98%");
  assert.equal(formatGrowthPercentage(0.162), "16.2%");
  assert.equal(formatGrowthPercentage(-0.05), "-5%");
});

test("turns machine statuses into readable labels", () => {
  assert.equal(
    formatGrowthStatusLabel("first_email_ready"),
    "First email ready",
  );
  assert.equal(formatGrowthStatusLabel("DO-NOT-CONTACT"), "Do not contact");
  assert.equal(formatGrowthStatusLabel("  "), "Unknown");
});

test("formats evidence counts with explicit empty and plural states", () => {
  assert.equal(formatGrowthEvidenceCount(0), "No evidence");
  assert.equal(formatGrowthEvidenceCount(1), "1 evidence item");
  assert.equal(formatGrowthEvidenceCount(7), "7 evidence items");
});

test("rejects invalid formatter inputs", () => {
  assert.throws(() => formatGrowthDate("not-a-date"), RangeError);
  assert.throws(() => formatGrowthDateTime("2026-08-16T23:30:00"), RangeError);
  assert.throws(() => formatGrowthDate("2026-08-16"), RangeError);
  assert.throws(() => formatGrowthDateTime("2026-02-30T00:00:00Z"), RangeError);
  assert.throws(() => formatGrowthCurrency(1.5), RangeError);
  assert.throws(() => formatGrowthPercentage(Number.NaN), RangeError);
  assert.throws(() => formatGrowthEvidenceCount(-1), RangeError);
});
