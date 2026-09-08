import Stripe from "stripe";
import { BILLING_STRIPE_API_VERSION } from "../../../lib/operations/billing/client";
export function billingProviderFixture() {
  const requests: { method: string; path: string; params: URLSearchParams }[] =
    [];
  const state = {
    accountId: "acct_billingTest",
    customerId: "cus_synthetic",
    livemode: false,
    customerCreated: false,
    invoiceCreated: false,
    itemCreated: false,
    finalized: false,
    amount: 0,
    dueDate: 0,
    commandId: "",
    subscriptionCustomer: "cus_synthetic",
    subscriptionCreated: false,
    latestInvoiceId: "in_synthetic",
    pricePence: 12000,
    previewCurrency: "gbp",
    truncated: false,
    scheduleId: "",
    scheduleCreated: false,
    startDate: 0,
    phaseCount: 1,
  };
  const invoice = () => ({
    id: "in_synthetic",
    customer: state.customerId,
    livemode: state.livemode,
    currency: "gbp",
    billing_reason: "subscription_create",
    status: state.finalized ? "open" : "draft",
    total: state.amount,
    subtotal: state.amount,
    amount_paid: 0,
    amount_remaining: state.amount,
    number: "SYNTHETIC-1",
    due_date: state.dueDate,
    metadata: { operations_command: state.commandId },
    status_transitions: { finalized_at: 1788846108 },
    lines: {
      has_more: state.truncated,
      data: [
        {
          description: "Signed installment",
          amount: state.amount,
          period: { start: 1788846108, end: 1790035200 },
        },
      ],
    },
  });
  const subscription = () => ({
    id: "sub_synthetic",
    customer: state.subscriptionCustomer,
    livemode: state.livemode,
    latest_invoice: state.latestInvoiceId,
    metadata: { operations_command: state.commandId },
    items: {
      data: [
        {
          id: "si_synthetic",
          price: {
            id: "price_original",
            product: "prod_synthetic",
            unit_amount: state.pricePence,
          },
        },
      ],
    },
  });
  const futureSchedule = () => ({
    id: "sub_sched_synthetic",
    customer: state.subscriptionCustomer,
    livemode: state.livemode,
    status: "not_started",
    subscription: null,
    metadata: {
      operations_schedule: state.scheduleId,
      operations_command: state.commandId,
    },
    phases: Array.from({ length: state.phaseCount }, () => ({
      start_date: state.startDate,
      end_date: state.startDate + 30 * 86400,
      items: [{ price: "price_original", quantity: 1 }],
    })),
  });
  const stripe = new Stripe("sk_test_synthetic", {
    apiVersion: BILLING_STRIPE_API_VERSION,
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (url, init) => {
      const path = new URL(String(url)).pathname;
      const method = init?.method ?? "GET";
      const params = new URLSearchParams(
        typeof init?.body === "string" ? init.body : "",
      );
      requests.push({ method, path, params });
      let body: unknown;
      if (path === "/v1/account") body = { id: state.accountId };
      else if (path === "/v1/customers/search")
        body = { data: [], has_more: false };
      else if (path === "/v1/customers" && method === "POST") {
        state.customerCreated = true;
        body = { id: state.customerId, livemode: state.livemode };
      } else if (path === `/v1/customers/${state.customerId}`)
        body = { id: state.customerId, livemode: state.livemode };
      else if (path === "/v1/invoices/create_preview")
        body = {
          ...invoice(),
          id: "upcoming_synthetic",
          currency: state.previewCurrency,
          total: params.has("schedule")
            ? Number(
                params.get(
                  "schedule_details[phases][0][items][0][price_data][unit_amount]",
                ),
              )
            : 7999,
        };
      else if (path === "/v1/subscription_schedules" && method === "GET")
        body = {
          data: state.scheduleCreated ? [futureSchedule()] : [],
          has_more: false,
        };
      else if (path === "/v1/subscription_schedules" && method === "POST") {
        state.scheduleCreated = true;
        state.scheduleId = params.get("metadata[operations_schedule]") ?? "";
        state.commandId = params.get("metadata[operations_command]") ?? "";
        state.startDate = Number(params.get("start_date"));
        body = futureSchedule();
      } else if (path === "/v1/subscription_schedules/sub_sched_synthetic")
        body = futureSchedule();
      else if (path === "/v1/prices/price_original")
        body = {
          id: "price_original",
          product: "prod_synthetic",
          currency: "gbp",
          unit_amount: state.pricePence,
          recurring: { interval: "month", interval_count: 1 },
        };
      else if (path === "/v1/invoices" && method === "GET")
        body = {
          data: state.invoiceCreated ? [invoice()] : [],
          has_more: false,
        };
      else if (path === "/v1/invoices" && method === "POST") {
        state.invoiceCreated = true;
        state.commandId = params.get("metadata[operations_command]") ?? "";
        state.dueDate = Number(params.get("due_date"));
        body = invoice();
      } else if (path === "/v1/invoiceitems" && method === "GET")
        body = {
          data: state.itemCreated
            ? [
                {
                  id: "ii_synthetic",
                  metadata: { operations_command: state.commandId },
                },
              ]
            : [],
          has_more: false,
        };
      else if (path === "/v1/invoiceitems") {
        state.itemCreated = true;
        state.amount = Number(params.get("amount"));
        body = { id: "ii_synthetic" };
      } else if (path === "/v1/invoices/in_synthetic") body = invoice();
      else if (path === "/v1/invoices/in_synthetic/finalize") {
        state.finalized = true;
        body = invoice();
      } else if (path === "/v1/subscriptions" && method === "GET")
        body = {
          data: state.subscriptionCreated ? [subscription()] : [],
          has_more: false,
        };
      else if (path === "/v1/products") body = { id: "prod_synthetic" };
      else if (path === "/v1/subscriptions" && method === "POST") {
        state.subscriptionCreated = true;
        state.invoiceCreated = true;
        state.commandId = params.get("metadata[operations_command]") ?? "";
        state.amount = Number(params.get("items[0][price_data][unit_amount]"));
        body = subscription();
      } else if (path === "/v1/subscriptions/sub_synthetic" && method === "GET")
        body = subscription();
      else
        throw new Error(
          `Unexpected synthetic provider call: ${method} ${path}`,
        );
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  });
  return { stripe, state, requests };
}
