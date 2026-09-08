import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  billingAmount,
  invoiceStatus,
  type InvoiceSummary,
} from "./presentation";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { InvoiceList } =
  require("./invoice-list") as typeof import("./invoice-list");
const invoice: InvoiceSummary = {
  id: "10000000-0000-4000-8000-000000000001",
  number: "FSS-001",
  status: "open",
  currency: "GBP",
  totalPence: "120000",
  amountPaidPence: "20000",
  amountDuePence: "120000",
  amountOverpaidPence: "0",
  amountRemainingPence: "100000",
  dueDate: "2026-09-22",
  projectedAt: "2026-09-08T10:00:00Z",
  paymentState: null,
  mandateState: null,
};
test("invoice view identifies partial payment and uses meaningful individually named actions", () => {
  const html = renderToStaticMarkup(
    <InvoiceList organisationId={invoice.id} invoices={[invoice]} />,
  );
  assert.match(html, /Part paid/);
  assert.match(html, /£1,200.00/);
  assert.match(html, /£1,000.00/);
  assert.match(html, /aria-label="Invoices"/);
  assert.match(html, /View invoice<span[^>]*> FSS-001/);
  assert.match(html, /Last checked/);
  assert.doesNotMatch(html, /https:\/\/.*stripe|customerId|providerInvoiceId/);
});
test("preparing invoices do not expose a payment action and empty states explain what follows", () => {
  const draft = renderToStaticMarkup(
    <InvoiceList
      organisationId={invoice.id}
      invoices={[{ ...invoice, status: "draft", number: null }]}
    />,
  );
  assert.match(draft, /Preparing/);
  assert.doesNotMatch(draft, /<button/);
  const empty = renderToStaticMarkup(
    <InvoiceList organisationId={invoice.id} invoices={[]} />,
  );
  assert.match(empty, /No invoices yet/);
  assert.match(empty, /once they have been issued/);
});
test("processing payments never imply settlement and inactive mandates request new consent", () => {
  const html = renderToStaticMarkup(
    <InvoiceList
      organisationId={invoice.id}
      invoices={[
        {
          ...invoice,
          amountPaidPence: "0",
          paymentState: "processing",
          mandateState: "inactive",
        },
      ]}
    />,
  );
  assert.match(html, /Payment processing/);
  assert.match(html, /wait for confirmation before making another payment/);
  assert.match(html, /new consent required/);
  assert.doesNotMatch(html, />Paid<\/span>/);
});
test("overpayments remain visible separately from the invoice and account balance", () => {
  const html = renderToStaticMarkup(
    <InvoiceList
      organisationId={invoice.id}
      invoices={[
        {
          ...invoice,
          status: "paid",
          totalPence: "6000",
          amountDuePence: "8000",
          amountPaidPence: "12000",
          amountRemainingPence: "0",
          amountOverpaidPence: "4000",
          paymentState: "succeeded",
        },
      ]}
    />,
  );
  assert.match(html, /Amount due, including account balance/);
  assert.match(html, /£80.00/);
  assert.match(html, /Overpaid/);
  assert.match(html, /£40.00/);
  assert.match(html, /reviewing the extra payment/);
});
test("payment labels distinguish written-off invoices from paid and money never rounds through Number", () => {
  assert.equal(
    invoiceStatus({
      status: "uncollectible",
      amountPaidPence: "0",
      paymentState: null,
    }),
    "Contact FSS",
  );
  assert.equal(
    invoiceStatus({ status: "open", amountPaidPence: "0", paymentState: null }),
    "Awaiting payment",
  );
  assert.equal(
    billingAmount("900719925474099199"),
    "£9,007,199,254,740,991.99",
  );
});
