import assert from "node:assert/strict";
import test from "node:test";
import { hasCompleteReplyCoverage } from "./gmail-sync-coverage";

const at = (day: number) => new Date(Date.UTC(2026, 10, day));
test("initial unknown history blocks earlier cohorts but not a later proven interval", () => {
  const entries = [
    {
      state: "gap" as const,
      observedFrom: null,
      observedUntil: at(2),
      grantEpoch: 1,
      googleSubject: "subject",
    },
    {
      state: "complete" as const,
      observedFrom: at(2),
      observedUntil: at(4),
      grantEpoch: 1,
      googleSubject: "subject",
    },
  ];
  assert.equal(
    hasCompleteReplyCoverage(entries, "subject", at(1), at(3)),
    false,
  );
  assert.equal(
    hasCompleteReplyCoverage(entries, "subject", at(2), at(4)),
    true,
  );
  assert.equal(hasCompleteReplyCoverage(entries, "other", at(2), at(4)), false);
});

test("a gap or missing range prevents coverage despite overlapping complete intervals", () => {
  const entries = [
    {
      state: "complete" as const,
      observedFrom: at(2),
      observedUntil: at(3),
      grantEpoch: 1,
      googleSubject: "subject",
    },
    {
      state: "complete" as const,
      observedFrom: at(3),
      observedUntil: at(5),
      grantEpoch: 1,
      googleSubject: "subject",
    },
    {
      state: "gap" as const,
      observedFrom: at(3),
      observedUntil: at(4),
      grantEpoch: 1,
      googleSubject: "subject",
    },
  ];
  assert.equal(
    hasCompleteReplyCoverage(entries, "subject", at(2), at(5)),
    false,
  );
  assert.equal(
    hasCompleteReplyCoverage(entries.slice(0, 2), "subject", at(2), at(5)),
    true,
  );
  assert.equal(
    hasCompleteReplyCoverage(entries.slice(0, 1), "subject", at(2), at(5)),
    false,
  );
});

test("joins adjacent intervals from separate grants only when the verified subject matches", () => {
  const entries = [
    {
      state: "complete" as const,
      observedFrom: at(2),
      observedUntil: at(3),
      grantEpoch: 1,
      googleSubject: "subject",
    },
    {
      state: "complete" as const,
      observedFrom: at(3),
      observedUntil: at(4),
      grantEpoch: 2,
      googleSubject: "subject",
    },
  ];
  assert.equal(
    hasCompleteReplyCoverage(entries, "subject", at(2), at(4)),
    true,
  );
  assert.equal(hasCompleteReplyCoverage(entries, "other", at(2), at(4)), false);
});
