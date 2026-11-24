import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import {
  authorityGate,
  gateFailure,
  type GateResult,
} from "../../../lib/growth/campaigns/authority-gate";
import { withTransitionClock } from "./reservation-clock";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "PostgreSQL gate enforces inclusive and exclusive bounds and London DST windows",
  { skip: !url },
  async () => {
    if (!url) return;
    const db = postgres(url, { max: 1 });
    const cases = [
      {
        at: "2026-11-18T00:00:00Z",
        day: "2026-11-17",
        expected: "day_changed",
      },
      {
        at: "2026-07-17T23:00:00Z",
        day: "2026-07-17",
        expected: "day_changed",
      },
      { at: "2026-03-29T01:00:00Z", day: "2026-03-29", expected: null },
      { at: "2026-10-25T01:00:00Z", day: "2026-10-25", expected: null },
      {
        at: "2026-10-25T01:00:00Z",
        day: "2026-10-25",
        expected: "outside_window",
        window: {
          timezone: "Europe/London",
          weekdays: [7],
          start: "01:30",
          end: "02:00",
        },
      },
      {
        at: "2026-03-29T01:00:00Z",
        day: "2026-03-29",
        expected: "outside_window",
        window: {
          timezone: "Europe/London",
          weekdays: [7],
          start: "01:00",
          end: "02:00",
        },
      },
      {
        at: "2026-11-17T12:00:00Z",
        day: "2026-11-17",
        expected: "outside_window",
        window: {
          timezone: "Europe/London",
          weekdays: [2],
          start: "11:00",
          end: "12:00",
        },
      },
    ];
    try {
      for (const item of cases) {
        const at = new Date(item.at);
        const gate = await withGrowthTransaction(
          withTransitionClock(db, at, at, false, 1),
          async (tx) => {
            const [row] = await tx<
              GateResult[]
            >`with ${authorityGate(tx, item.day, { validatedAt: new Date(at.getTime() - 1000), expiresAt: new Date(at.getTime() + 1000), validThrough: at }, item.window ?? null)}
          select day_ok as "dayOk", interval_ok as "intervalOk", window_ok as "windowOk", 0::int as writes from authority_gate`;
            return row;
          },
        );
        assert.equal(gateFailure(gate), item.expected, item.at);
      }
      for (const [validated, expires, inclusive, expected] of [
        [-1, 0, 1, "authority_expired"],
        [-1, 1, 0, null],
        [-1, 1, -1, "authority_expired"],
        [1, 2, 2, "authority_expired"],
      ] as const) {
        const at = new Date("2026-11-17T12:00:00Z");
        const gate = await withGrowthTransaction(
          withTransitionClock(db, at, at, false, 1),
          async (tx) => {
            const [row] = await tx<
              GateResult[]
            >`with ${authorityGate(tx, "2026-11-17", { validatedAt: new Date(at.getTime() + validated), expiresAt: new Date(at.getTime() + expires), validThrough: new Date(at.getTime() + inclusive) }, null)}
          select day_ok as "dayOk", interval_ok as "intervalOk", window_ok as "windowOk", 0::int as writes from authority_gate`;
            return row;
          },
        );
        assert.equal(gateFailure(gate), expected);
      }
    } finally {
      await db.end();
    }
  },
);
