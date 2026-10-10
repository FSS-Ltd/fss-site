import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { InvoiceSummary } from "./presentation";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { ClientBillingOverview } =
  require("./client-billing-overview") as typeof import("./client-billing-overview");
const { ClientInvoiceDetail } =
  require("./client-invoice-detail") as typeof import("./client-invoice-detail");

const organisationId = "11111111-1111-4111-8111-111111111111";
const openInvoice: InvoiceSummary = {
  amountDuePence: "120000",
  amountOverpaidPence: "0",
  amountPaidPence: "0",
  amountRemainingPence: "120000",
  currency: "GBP",
  dueDate: "2026-09-24",
  id: "22222222-2222-4222-8222-222222222222",
  mandateState: null,
  number: "INV-2026-041",
  paymentState: null,
  projectedAt: "2026-09-15T10:00:00.000Z",
  status: "open",
  totalPence: "120000",
};

test("summarises the next persisted payment without implying provider confirmation", () => {
  const html = renderToStaticMarkup(
    <ClientBillingOverview
      canManage
      setupCurrency="GBP"
      setup={{
        method: null,
        status: "not_started",
        brand: null,
        last4: null,
        automaticConsent: false,
      }}
      invoices={[openInvoice]}
      organisationId={organisationId}
    />,
  );

  assert.match(html, /Next payment/);
  assert.match(html, /£1,200\.00/);
  assert.match(html, /View invoice/);
  assert.doesNotMatch(html, /Payment confirmed/);
});

test("offers a receipt only for paid invoices and hides hosted actions without billing access", () => {
  const paid = {
    ...openInvoice,
    amountPaidPence: "120000",
    amountRemainingPence: "0",
    status: "paid" as const,
  };
  const paidHtml = renderToStaticMarkup(
    <ClientInvoiceDetail
      canOpenHostedInvoice
      invoice={{
        ...paid,
        issuedAt: "2026-09-15T09:00:00.000Z",
        lines: [{ amountPence: "120000", description: "Design milestone" }],
      }}
      organisationId={organisationId}
    />,
  );
  const readOnlyHtml = renderToStaticMarkup(
    <ClientInvoiceDetail
      canOpenHostedInvoice={false}
      invoice={{
        ...openInvoice,
        issuedAt: "2026-09-15T09:00:00.000Z",
        lines: [{ amountPence: "120000", description: "Design milestone" }],
      }}
      organisationId={organisationId}
    />,
  );

  assert.match(paidHtml, /Download receipt/);
  assert.match(paidHtml, /Payment confirmed/);
  assert.doesNotMatch(readOnlyHtml, /Pay securely/);
});

test("retained invoice currencies and distinct payment management mappings are presented accurately", () => {
  const html = renderToStaticMarkup(
    <ClientBillingOverview
      canManage
      managementCurrencies={["USD", "EUR"]}
      setupCurrency="USD"
      setup={{
        method: null,
        status: "not_started",
        brand: null,
        last4: null,
        automaticConsent: false,
      }}
      invoices={[
        { ...openInvoice, currency: "USD" },
        {
          ...openInvoice,
          id: "33333333-3333-4333-8333-333333333333",
          currency: "EUR",
        },
      ]}
      organisationId={organisationId}
    />,
  );
  assert.match(html, /\$1,200\.00/);
  assert.match(html, /€1,200\.00/);
  assert.match(html, /Open billing management \(USD\)/);
  assert.match(html, /Open billing management \(EUR\)/);
  assert.doesNotMatch(html, /£1,200/);
});
