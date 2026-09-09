import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serviceMrr,
  awaitingActivationMrr,
  clientMrr,
  collectedCash,
  type ServiceTerm,
} from "./revenue";
import { retention, movements } from "./retention";
import { invoiceBalance, onTimeRate, daysLate, ageBand } from "./receivables";
import { formatMoney, formatRatio, freshness } from "./definitions";
import { parseMetricFilters } from "./filters";
const term = (
  id: string,
  netPence: bigint,
  recurrenceMonths: ServiceTerm["recurrenceMonths"] = 1,
): ServiceTerm => ({
  id,
  organisationId: id,
  netPence,
  recurrenceMonths,
  startDate: "2026-01-01",
  endDate: null,
  activatedDate: "2026-01-01",
  pauses: [],
  discounts: [],
});
test("worked active annual and signed-awaiting fixture excludes setup and VAT", () => {
  const a = term("A", BigInt(30000)),
    b = term("B", BigInt(120000), 12),
    c = {
      ...term("C", BigInt(50000)),
      startDate: "2026-10-01",
      activatedDate: null,
    };
  const active = serviceMrr(a, "2026-09-08") + serviceMrr(b, "2026-09-08");
  assert.equal(formatMoney(active, BigInt(12)), "£400.00");
  assert.equal(formatMoney(active * BigInt(12), BigInt(12)), "£4,800.00");
  assert.equal(
    formatMoney(awaitingActivationMrr(c, "2026-09-08"), BigInt(12)),
    "£500.00",
  );
  assert.equal(serviceMrr(c, "2026-09-08"), BigInt(0));
  assert.equal(
    serviceMrr(term("setup", BigInt(50000), 0), "2026-09-08"),
    BigInt(0),
  );
  assert.equal(
    serviceMrr(term("q", BigInt(30000), 3), "2026-09-08"),
    BigInt(120000),
  );
});
test("cohort excludes new clients and movements reconcile exactly", () => {
  const start = new Map([
      ["A", BigInt(360000)],
      ["B", BigInt(120000)],
    ]),
    end = new Map([
      ["A", BigInt(420000)],
      ["C", BigInt(240000)],
    ]);
  const r = retention(start, end);
  assert.equal(formatRatio(r.logoRetention), "50%");
  assert.equal(formatRatio(r.grossRevenueRetention), "75%");
  assert.equal(formatRatio(r.netRevenueRetention), "87.5%");
  assert.equal(
    formatMoney(movements(start, end, new Set()).end, BigInt(12)),
    "£550.00",
  );
  assert.equal(retention(new Map(), end).logoRetention, null);
});
test("two services count one retained logo; annual renewal invoice has no effect on MRR", () => {
  const a = term("A", BigInt(30000)),
    b = {
      ...term("B", BigInt(120000), 12),
      organisationId: "A",
      endDate: "2026-08-31",
    };
  const start = clientMrr([a, b], "2026-08-01"),
    end = clientMrr([a, b], "2026-09-08");
  assert.equal(formatRatio(retention(start, end).logoRetention), "100%");
  assert.equal(movements(start, end, new Set()).contraction, BigInt(120000));
  assert.equal(
    serviceMrr(term("annual", BigInt(120000), 12), "2026-01-01"),
    serviceMrr(term("annual", BigInt(120000), 12), "2027-01-01"),
  );
});
test("fractional pennies survive normalization, summation and movement identity", () => {
  const amount = serviceMrr(term("annual", BigInt(1000), 12), "2026-09-08");
  assert.equal(amount, BigInt(1000));
  assert.equal(formatMoney(amount, BigInt(12)), "£0.83");
  const result = movements(
    new Map([["A", amount]]),
    new Map([
      ["A", amount + BigInt(1)],
      ["B", amount],
    ]),
    new Set(["B"]),
  );
  assert.equal(result.reactivation, amount);
  assert.equal(
    result.start +
      result.new +
      result.expansion +
      result.reactivation -
      result.contraction -
      result.churn,
    result.end,
  );
});
test("scheduled end is inclusive, nonbillable pauses and temporary recurring discounts", () => {
  const base = term("A", BigInt(30000));
  assert.equal(
    serviceMrr({ ...base, endDate: "2026-09-08" }, "2026-09-08"),
    BigInt(360000),
  );
  assert.equal(
    serviceMrr({ ...base, endDate: "2026-09-08" }, "2026-09-09"),
    BigInt(0),
  );
  const paused = {
    ...base,
    pauses: [
      { startDate: "2026-09-01", endDate: "2026-09-30", billable: false },
    ],
  };
  assert.equal(serviceMrr(paused, "2026-09-08"), BigInt(0));
  assert.equal(serviceMrr(paused, "2026-10-01"), BigInt(360000));
  assert.equal(
    serviceMrr(
      {
        ...base,
        discounts: [
          {
            startDate: "2026-09-01",
            endDate: "2026-09-30",
            pence: BigInt(10000),
          },
        ],
      },
      "2026-09-08",
    ),
    BigInt(240000),
  );
});
test("five due invoices yield two of four; no eligible invoices is N/A", () => {
  const invoice = {
    status: "paid",
    whollyCredited: false,
    dueDate: "2026-09-01",
    fullyPaidAt: "2026-09-01T22:59:59Z",
  };
  const invoices = [
    invoice,
    invoice,
    { ...invoice, fullyPaidAt: "2026-09-02T00:00:00Z" },
    { ...invoice, status: "open", fullyPaidAt: null },
    { ...invoice, status: "void" },
  ];
  assert.equal(
    formatRatio(onTimeRate(invoices, "2026-09-01", "2026-09-08")),
    "50%",
  );
  assert.equal(onTimeRate([], "2026-09-01", "2026-09-08"), null);
  assert.equal(
    onTimeRate(
      [{ ...invoice, whollyCredited: true }],
      "2026-09-01",
      "2026-09-08",
    ),
    null,
  );
});
test("£1000 less deduplicated £300 allocation and £100 credit leaves £600", () => {
  const allocation = {
    id: "payment1",
    pence: BigInt(30000),
    confirmedAt: "2026-09-01T00:00:00Z",
  };
  assert.equal(
    invoiceBalance({
      totalPence: BigInt(100000),
      status: "open",
      dueDate: "2026-09-01",
      allocations: [allocation, allocation],
      credits: [{ id: "credit1", pence: BigInt(10000), valid: true }],
    }),
    BigInt(60000),
  );
});
test("calendar lateness follows London through summer and winter time", () => {
  assert.equal(daysLate("2026-09-01", "2026-09-01T22:59:59Z"), 0);
  assert.equal(daysLate("2026-09-01", "2026-09-01T23:00:00Z"), 1);
  assert.equal(daysLate("2026-10-24", "2026-10-26T00:00:00Z"), 2);
  assert.equal(daysLate("2026-09-10", "2026-09-08T00:00:00Z"), 0);
  assert.deepEqual([0, 1, 7, 8, 30, 31, 60, 61, 90, 91].map(ageBand), [
    "current",
    "1–7",
    "1–7",
    "8–30",
    "8–30",
    "31–60",
    "31–60",
    "61–90",
    "61–90",
    "91+",
  ]);
});
test("only confirmed cash counts, never pending Bacs or duplicate evidence", () => {
  const p = {
    id: "p1",
    state: "succeeded",
    receivedPence: BigInt(10000),
    confirmedAt: "2026-09-02T00:00:00Z",
  };
  assert.equal(
    collectedCash(
      [p, p, { ...p, id: "p2", state: "processing", confirmedAt: null }],
      "2026-09-01T00:00:00Z",
      "2026-10-01T00:00:00Z",
    ),
    BigInt(10000),
  );
});
test("freshness boundary and filter bounds are explicit", () => {
  assert.equal(freshness(null, "2026-09-08T00:00:00Z"), "unknown");
  assert.equal(
    freshness("2026-09-07T00:00:00Z", "2026-09-08T00:00:00Z"),
    "current",
  );
  assert.equal(
    freshness("2026-09-07T00:00:00Z", "2026-09-08T00:00:01Z"),
    "stale",
  );
  assert.equal(parseMetricFilters({}, "2026-09-08T00:00:00Z").pageSize, 50);
  assert.throws(() =>
    parseMetricFilters({ pageSize: 101 }, "2026-09-08T00:00:00Z"),
  );
  assert.throws(() =>
    parseMetricFilters({ from: "2026-09-09" }, "2026-09-08T00:00:00Z"),
  );
});
test("fractional annual display has an explicit reconciled rounding adjustment", async () => {
  const { displayReconciliation } = await import("./definitions");
  const units = [BigInt(1000), BigInt(1000), BigInt(1000)];
  const result = displayReconciliation(units);
  assert.equal(result.totalPence, BigInt(250));
  assert.equal(result.adjustmentPence, BigInt(1));
});
