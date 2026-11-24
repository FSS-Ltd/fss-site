import type { DailyOutreachSummary } from "../campaigns/daily-summary";
export const summary: DailyOutreachSummary = {
  version: 1,
  londonDay: "2026-11-21",
  generatedAt: "2026-11-21T17:30:00Z",
  dayStatus: "partial_at_run",
  preparationEvents: 10,
  issuedAttempts: 8,
  acceptedAtRead: 7,
  observedConfirmations: 5,
  confirmedWithinDay: 3,
  observedCrossDay: 1,
  observedUnknownDay: 1,
  unconfirmedAttempts: 2,
  heldJobsAtRead: 4,
  heldReasons: { permission: 1, account: 1, coverage: 1, other: 1 },
  goal: { minimum: 100, target: 150, conditional: true },
  limitations: ["snapshot_at_run_not_closed_day"],
};
