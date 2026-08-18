import assert from "node:assert/strict";
import test from "node:test";

import { scheduleFollowUp, scheduleFollowUps } from "./schedule";

test("schedules Day 5, 11, and 20 as calendar offsets and moves weekend targets to Monday", () => {
  // 2026-08-18 is a Tuesday (BST). Day 5 (+4) lands on Saturday 2026-08-22,
  // Day 11 (+10) lands on Friday 2026-08-28, Day 20 (+19) lands on Sunday
  // 2026-09-06.
  const firstSentAt = new Date(Date.UTC(2026, 7, 18, 12, 0, 0));

  const followUps = scheduleFollowUps(firstSentAt);

  assert.equal(followUps.day_5.toISOString(), "2026-08-24T09:00:00.000Z");
  assert.equal(followUps.day_11.toISOString(), "2026-08-28T09:00:00.000Z");
  assert.equal(followUps.day_20.toISOString(), "2026-09-07T09:00:00.000Z");
});

test("preserves the 10:00 local send time across the UK spring daylight-saving change", () => {
  // 2026-03-26 is a Thursday (GMT). Day 5 (+4) lands on Monday 2026-03-30,
  // after British Summer Time starts on 2026-03-29.
  const firstSentAt = new Date(Date.UTC(2026, 2, 26, 12, 0, 0));

  const dueAt = scheduleFollowUp(firstSentAt, "day_5");

  assert.equal(dueAt.toISOString(), "2026-03-30T09:00:00.000Z");
});

test("preserves the 10:00 local send time across the UK autumn daylight-saving change", () => {
  // 2026-10-22 is a Thursday (BST). Day 5 (+4) lands on Monday 2026-10-26,
  // after British Summer Time ends on 2026-10-25.
  const firstSentAt = new Date(Date.UTC(2026, 9, 22, 12, 0, 0));

  const dueAt = scheduleFollowUp(firstSentAt, "day_5");

  assert.equal(dueAt.toISOString(), "2026-10-26T10:00:00.000Z");
});

test("does not shift a follow-up that already lands on a weekday", () => {
  // 2026-08-18 is a Tuesday. Day 11 (+10) lands on Friday 2026-08-28.
  const firstSentAt = new Date(Date.UTC(2026, 7, 18, 12, 0, 0));

  const dueAt = scheduleFollowUp(firstSentAt, "day_11");

  assert.equal(dueAt.toISOString(), "2026-08-28T09:00:00.000Z");
});
