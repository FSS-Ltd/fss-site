import { test } from "node:test";
import assert from "node:assert/strict";
import {
  proposalDueAt,
  followingLondonMorning,
  retryAt,
  expiredUnknownAttempt,
} from "./schedule";
test("proposal delay is two elapsed hours across DST", () => {
  assert.equal(
    proposalDueAt(new Date("2026-03-29T00:15:00Z")).toISOString(),
    "2026-03-29T02:15:00.000Z",
  );
  assert.equal(
    proposalDueAt(new Date("2026-09-08T10:15:00Z")).toISOString(),
    "2026-09-08T12:15:00.000Z",
  );
  assert.throws(() => proposalDueAt(new Date("invalid")));
});
test("next calendar London morning includes weekends and both DST changes", () => {
  for (const [signed, due] of [
    ["2026-03-28T18:00:00Z", "2026-03-29T08:00:00.000Z"],
    ["2026-10-24T18:00:00Z", "2026-10-25T09:00:00.000Z"],
    ["2026-09-04T17:00:00Z", "2026-09-05T08:00:00.000Z"],
    ["2026-09-08T23:30:00Z", "2026-09-10T08:00:00.000Z"],
  ])
    assert.equal(followingLondonMorning(new Date(signed)).toISOString(), due);
  assert.throws(() => followingLondonMorning(new Date("invalid")));
});
test("retry budget is exactly five delays and honors bounded rate limits", () => {
  const now = new Date("2026-09-08T10:00:00Z");
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(
      (attempt) => (retryAt(now, attempt)!.getTime() - now.getTime()) / 60000,
    ),
    [1, 5, 15, 60, 240],
  );
  assert.equal(retryAt(now, 6), null);
  assert.equal(retryAt(now, 1, 120000)!.getTime() - now.getTime(), 120000);
  assert.equal(expiredUnknownAttempt(null, now), false);
  assert.equal(expiredUnknownAttempt("2026-09-07T10:00:00Z", now), true);
  assert.equal(expiredUnknownAttempt("2026-09-07T10:00:01Z", now), false);
});
