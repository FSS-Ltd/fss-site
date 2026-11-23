import assert from "node:assert/strict";
import test from "node:test";
import { hasCompleteReplyCoverage } from "../sequences/gmail-sync-coverage";
import { indexReportCoverage, type CoverageRecord } from "./report-coverage";

const time = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, n));
test("indexed coverage preserves complete and gap semantics per account and subject", () => {
  const entries: CoverageRecord[] = [
    {
      connectionId: "a",
      googleSubject: "subject",
      grantEpoch: 1,
      state: "complete",
      observedFrom: time(0),
      observedUntil: time(5),
    },
    {
      connectionId: "a",
      googleSubject: "subject",
      grantEpoch: 2,
      state: "complete",
      observedFrom: time(5),
      observedUntil: time(10),
    },
    {
      connectionId: "a",
      googleSubject: "subject",
      grantEpoch: 2,
      state: "gap",
      observedFrom: time(3),
      observedUntil: time(4),
    },
    {
      connectionId: "b",
      googleSubject: "subject",
      grantEpoch: 1,
      state: "complete",
      observedFrom: time(0),
      observedUntil: time(10),
    },
    {
      connectionId: "a",
      googleSubject: "other",
      grantEpoch: 1,
      state: "gap",
      observedFrom: null,
      observedUntil: time(7),
    },
  ];
  const query = indexReportCoverage(entries);
  for (const account of ["a", "b"])
    for (const subject of ["subject", "other"])
      for (let start = 0; start < 10; start++)
        for (let end = start + 1; end <= 10; end++)
          assert.equal(
            query(account, subject, time(start), time(end)),
            hasCompleteReplyCoverage(
              entries.filter((e) => e.connectionId === account),
              subject,
              time(start),
              time(end),
            ),
          );
  assert.equal(query("a", "subject", time(4), time(10)), true);
  assert.equal(query("a", "subject", time(2), time(5)), false);
  assert.equal(query("b", "subject", time(2), time(5)), true);
});

test("invalid interval vetoes its account and subject only", () => {
  const query = indexReportCoverage([
    {
      connectionId: "a",
      googleSubject: "s",
      grantEpoch: 0,
      state: "complete",
      observedFrom: time(0),
      observedUntil: time(10),
    },
    {
      connectionId: "b",
      googleSubject: "s",
      grantEpoch: 1,
      state: "complete",
      observedFrom: time(0),
      observedUntil: time(10),
    },
  ]);
  assert.equal(query("a", "s", time(1), time(2)), false);
  assert.equal(query("b", "s", time(1), time(2)), true);
});

test("an exact grant epoch must cover the whole window", () => {
  const query = indexReportCoverage([
    {
      connectionId: "a",
      googleSubject: "s",
      grantEpoch: 1,
      state: "complete",
      observedFrom: time(0),
      observedUntil: time(5),
    },
    {
      connectionId: "a",
      googleSubject: "s",
      grantEpoch: 2,
      state: "complete",
      observedFrom: time(5),
      observedUntil: time(10),
    },
    {
      connectionId: "b",
      googleSubject: "s",
      grantEpoch: 1,
      state: "complete",
      observedFrom: time(0),
      observedUntil: time(10),
    },
  ]);
  assert.equal(query("a", "s", time(0), time(10)), true);
  assert.equal(query("a", "s", time(0), time(10), 1), false);
  assert.equal(query("a", "s", time(5), time(10), 2), true);
  assert.equal(query("b", "s", time(0), time(10), 1), true);
});
