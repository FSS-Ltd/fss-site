import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { RevenueSummary } from "@/lib/operations/metrics/snapshot-types";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { RevenueMovements } =
  require("./revenue-movements") as typeof import("./revenue-movements");

const revenueSummary: RevenueSummary = {
  active: "180000",
  awaiting: "24000",
  start: "120000",
  new: "60000",
  expansion: "30000",
  reactivation: "12000",
  contraction: "12000",
  churn: "30000",
  cohort: "4",
  retained: "3",
  capped: "90000",
  cohortEnd: "108000",
  signedOneOff: "50000",
  signedDeals: "2",
  totalRows: 1,
  rows: [
    {
      id: "service-line-1",
      organisationId: "organisation-1",
      client: "Example Client",
      service: "Managed service",
      start: "120000",
      end: "180000",
      awaiting: "24000",
      endDate: null,
    },
  ],
};

test("MRR movement visual exposes arithmetic and labelled values", () => {
  const html = renderToStaticMarkup(<RevenueMovements data={revenueSummary} />);

  assert.match(html, /MRR movements/);
  assert.match(html, /Start \+ new \+ expansion/);
  assert.match(html, /aria-label="MRR movement visual"/);
  assert.match(html, /New/);
  assert.match(html, /End/);
  assert.match(html, /−£10\.00/);
  assert.match(html, /style="width:100%"/);
});
