import { executeAgreementCommand } from "../../../lib/operations/agreements/service";
import {
  agreementDraft,
  signatureEvidence,
} from "../../../lib/operations/agreements/fixtures";
import postgres from "postgres";
import { executePortalBillingCommand } from "../../../lib/operations/http/billing-access";
import type { HostedBillingProvider } from "../../../lib/operations/billing/portal-session";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { loadMetricsSnapshot } from "../../../lib/operations/metrics/snapshot-repository";
import { billingFounder } from "./billing-fixtures";
import assert from "node:assert/strict";
import test from "node:test";
import { reconcileBillingInvoice } from "../../../lib/operations/billing/reconciliation";
import type { BillingReconciliationProvider } from "../../../lib/operations/billing/reconciliation-types";
import {
  createReconciliationFixture,
  invoiceSnapshot,
} from "./payment-reconciliation-fixtures";

test("signed currency controls invoices, payments, allocations and adjustments", async () => {
  for (const currency of ["USD", "EUR"] as const) {
    const f = await createReconciliationFixture(currency);
    const portal = postgres(
      requireOperationsTestDatabaseUrl(
        process.env.OPERATIONS_TEST_DATABASE_URL,
      ),
      { max: 1, connection: { options: "-c role=operations_portal" } },
    );
    const snapshot = invoiceSnapshot(f.invoiceIds[0], f.customerId);
    snapshot.invoice.currency = currency.toLowerCase();
    snapshot.payments[0].currency = currency;
    const provider: BillingReconciliationProvider = {
      scope: f.scope,
      async fetchInvoice() {
        return structuredClone(snapshot);
      },
      async resolveEvent() {
        return { invoiceIds: [], mandate: null };
      },
      async listInvoices() {
        return { invoiceIds: [], cursor: null };
      },
    };
    try {
      await reconcileBillingInvoice(f.worker, provider, snapshot.invoice.id);
      const [invoice] = await f.admin<
        { id: string; currency: string }[]
      >`select id,currency from operations.invoices where organisation_id=${f.organisationId}`;
      const [payment] = await f.admin<
        { id: string; currency: string }[]
      >`select id,currency from operations.payments where organisation_id=${f.organisationId}`;
      assert.equal(invoice.currency, currency);
      assert.equal(payment.currency, currency);
      const hosted: HostedBillingProvider = {
        async retrieveConfiguration() {
          return {
            active: true,
            livemode: false,
            features: {
              invoice_history: { enabled: true },
              payment_method_update: { enabled: true },
              customer_update: { enabled: false },
              subscription_cancel: { enabled: false },
              subscription_update: { enabled: false },
            },
          };
        },
        async createSession(input) {
          return {
            customer: input.customer,
            livemode: false,
            url: "https://billing.stripe.com/p/synthetic",
          };
        },
        async retrieveInvoice() {
          return {
            customer: f.customerId,
            livemode: false,
            currency: currency.toLowerCase(),
            hosted_invoice_url: "https://invoice.stripe.com/i/synthetic",
          };
        },
      };
      const open = (
        command: Parameters<typeof executePortalBillingCommand>[3],
        provider = hosted,
      ) =>
        executePortalBillingCommand(
          portal,
          f.identity,
          f.scope,
          command,
          provider,
          "bpc_synthetic",
          "https://fss.test/portal/billing",
          f.correlationId,
        );
      assert.match(
        await open({
          action: "invoice",
          organisationId: f.organisationId,
          invoiceId: invoice.id,
        }),
        /^https:\/\/invoice.stripe.com/,
      );
      assert.match(
        await open({
          action: "manage",
          organisationId: f.organisationId,
          currency,
        }),
        /^https:\/\/billing.stripe.com/,
      );
      assert.match(
        await open({ action: "manage", organisationId: f.organisationId }),
        /^https:\/\/billing.stripe.com/,
      );
      await assert.rejects(
        open({
          action: "manage",
          organisationId: f.organisationId,
          currency: "GBP",
        }),
      );
      await assert.rejects(
        open(
          {
            action: "invoice",
            organisationId: f.organisationId,
            invoiceId: invoice.id,
          },
          {
            ...hosted,
            async retrieveInvoice() {
              return {
                customer: f.customerId,
                livemode: false,
                currency: "gbp",
                hosted_invoice_url: "https://invoice.stripe.com/i/synthetic",
              };
            },
          },
        ),
        /Hosted invoice is unavailable/,
      );
      await assert.rejects(
        f.admin`insert into operations.payment_refunds(organisation_id,account_id,environment,payment_id,provider_refund_id,currency,amount_pence,status) values(${f.organisationId},${f.scope.accountId},'test',${payment.id},'re_crossCurrency','GBP',1,'succeeded')`,
        /currency must match/,
      );
      for (const selected of [currency, "GBP"] as const) {
        const metrics = await loadMetricsSnapshot(
          f.founder,
          billingFounder,
          {
            organisationId: f.organisationId,
            currency: selected,
            from: "2026-09-01",
            to: "2026-10-01",
          },
          { observedAt: "2026-10-01T12:00:00.000Z", providerScope: f.scope },
        );
        assert.equal(
          metrics.revenue.signedOneOff,
          selected === currency ? "12000" : "0",
        );
        assert.equal(
          metrics.receivables?.totalRows,
          selected === currency ? 1 : 0,
        );
      }
      const [otherPayment] = await f.admin<
        { id: string }[]
      >`insert into operations.payments(organisation_id,account_id,environment,provider_payment_id,state,method,currency,amount_pence,received_pence,provider_created_at) values(${f.organisationId},${f.scope.accountId},'test','pi_crossCurrency','pending','card','GBP',1,0,now()) returning id`;
      await assert.rejects(
        f.admin`insert into operations.payment_allocations(organisation_id,invoice_id,payment_id,provider_allocation_id,amount_pence,provider_paid_pence) values(${f.organisationId},${invoice.id},${otherPayment.id},'inpay_crossCurrency',0,0)`,
        /Allocation account mismatch/,
      );
      snapshot.payments[0].currency = "GBP";
      await assert.rejects(
        reconcileBillingInvoice(f.worker, provider, snapshot.invoice.id),
        /scope_mismatch/,
      );
      const [stored] = await f.admin<
        { currency: string }[]
      >`select currency from operations.payments where id=${payment.id}`;
      assert.equal(stored.currency, currency);
      if (currency === "USD") {
        const draft = agreementDraft();
        draft.currency = "EUR";
        const additional = await executeAgreementCommand(
          f.founder,
          billingFounder,
          f.organisationId,
          {
            action: "create",
            engagementId: f.engagementId,
            draft,
          },
          f.correlationId,
        );
        await executeAgreementCommand(
          f.founder,
          billingFounder,
          f.organisationId,
          {
            action: "sign",
            agreementId: additional.id,
            expectedVersion: 1,
            evidence: signatureEvidence(),
          },
          f.correlationId,
        );
        await f.admin`insert into operations.billing_customers(organisation_id,account_id,environment,currency,provider_customer_id,created_by,correlation_id) values(${f.organisationId},${f.scope.accountId},'test','EUR','cus_additionalCurrency',${billingFounder.actorId},${f.correlationId})`;
        await assert.rejects(
          open({ action: "manage", organisationId: f.organisationId }),
        );
        assert.match(
          await open({
            action: "manage",
            organisationId: f.organisationId,
            currency: "USD",
          }),
          /^https:\/\/billing.stripe.com/,
        );
      }
    } finally {
      await portal.end();
      await f.cleanup();
    }
  }
});
