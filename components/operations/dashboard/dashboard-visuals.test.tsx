import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { DashboardMetric, DistributionBars, DonutChart } =
  require("./dashboard-visuals") as typeof import("./dashboard-visuals");

test("dashboard visuals retain the complete status meaning in text", () => {
  const html = renderToStaticMarkup(
    <>
      <DashboardMetric
        label="Active MRR"
        signal={{ label: "Up from period start", tone: "positive" }}
        supportingText="Contracted monthly revenue"
        value="£8,400"
      />
      <DonutChart
        description="8 of 10 invoices due in the period were paid on time."
        segments={[
          { label: "On time", tone: "positive", value: 8 },
          { label: "Late", tone: "warning", value: 2 },
        ]}
        title="Payment timing"
      />
      <DistributionBars
        description="Requests grouped by their current state."
        items={[
          { label: "In progress", tone: "brand", value: 4 },
          { label: "Ready for review", tone: "warning", value: 2 },
        ]}
        title="Request queue"
      />
    </>,
  );

  assert.match(html, /Active MRR/);
  assert.match(html, /Up from period start/);
  assert.match(html, /Payment timing/);
  assert.match(html, /8 of 10 invoices due in the period were paid on time/);
  assert.match(html, /On time.*8/);
  assert.match(html, /Late.*2/);
  assert.match(html, /Request queue/);
  assert.match(html, /In progress.*4/);
});
