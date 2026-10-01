import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_, key) => String(key) }),
  };
};

const { BillingOperations } =
  require("./billing-operations") as typeof import("./billing-operations");

test("renders retained billing figures without a payment-completion action", () => {
  const html = renderToStaticMarkup(
    <BillingOperations
      data={{
        totalsByCurrency: [
          {
            currency: "GBP",
            dueThisMonthPence: "720000",
            overduePence: "240000",
          },
        ],
        hasNext: false,
        items: [
          {
            amountPence: "240000",
            currency: "GBP",
            category: "overdue_review",
            dueDate: "2026-09-12",
            id: "55555555-5555-4555-8555-555555555555",
            lastObservedAt: "2026-09-18T10:00:00.000Z",
            organisationId: "44444444-4444-4444-8444-444444444444",
            organisationName: "Elm & Co",
            providerReference: "in_test123",
          },
        ],
        page: 1,
        reconciliationCount: 1,
      }}
    />,
  );

  assert.match(html, /Billing operations/);
  assert.match(html, /£7,200/);
  assert.match(html, /in_test123/);
  assert.match(html, /Provider reconciliation required/);
  assert.doesNotMatch(html, /Mark paid/);
});

test("renders separate currency totals without combining balances", () => {
  const html = renderToStaticMarkup(
    <BillingOperations
      data={{
        totalsByCurrency: [
          { currency: "GBP", dueThisMonthPence: "1000", overduePence: "0" },
          { currency: "USD", dueThisMonthPence: "2500", overduePence: "100" },
          { currency: "EUR", dueThisMonthPence: "3000", overduePence: "200" },
        ],
        items: [],
        hasNext: false,
        page: 1,
        reconciliationCount: 0,
      }}
    />,
  );
  assert.match(html, /£10.00/);
  assert.match(html, /\$25.00/);
  assert.match(html, /€30.00/);
  assert.doesNotMatch(html, /65.00/);
});
