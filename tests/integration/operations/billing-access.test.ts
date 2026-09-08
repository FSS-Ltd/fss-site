import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import {
  createBillingFixture,
  removeBillingFixture,
  billingFounder,
} from "./billing-fixtures";
import { createBillingSchedule } from "../../../lib/operations/billing/schedules";
import { executePortalBillingCommand } from "../../../lib/operations/http/billing-access";
import type { HostedBillingProvider } from "../../../lib/operations/billing/portal-session";
import { PortalAccessDenied } from "../../../lib/operations/auth/types";
import { withPortalTransaction } from "../../../lib/operations/db/portal-client";
import { loadInvoices } from "../../../lib/operations/billing/invoice-repository";
const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);
test("billing hosted access enforces tenant, billing roles, revoked membership and provider context with actual RLS", async () => {
  const admin = postgres(url, { max: 1 });
  const db = postgres(url, {
    max: 2,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 2,
    connection: { options: "-c role=operations_portal" },
  });
  const f = await createBillingFixture(admin, db);
  const other = await createBillingFixture(admin, db);
  let providerCalls = 0;
  const provider: HostedBillingProvider = {
    retrieveConfiguration: async () => ({
      active: true,
      livemode: false,
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        customer_update: { enabled: false },
        subscription_cancel: { enabled: false },
        subscription_update: { enabled: false },
      },
    }),
    createSession: async () => {
      providerCalls++;
      return {
        customer: "cus_accessTest",
        livemode: false,
        url: "https://billing.stripe.com/p/session/synthetic",
      };
    },
    retrieveInvoice: async () => {
      providerCalls++;
      return {
        customer: "cus_accessTest",
        livemode: false,
        hosted_invoice_url: "https://invoice.stripe.com/i/synthetic",
      };
    },
  };
  try {
    const [scheduleId] = await createBillingSchedule(
      db,
      billingFounder,
      f.scope,
      f.agreementId,
      2,
      f.correlationId,
    );
    await admin`insert into operations.billing_customers(organisation_id,account_id,environment,provider_customer_id,created_by,correlation_id) values(${f.organisationId},${f.scope.accountId},'test','cus_accessTest',${billingFounder.actorId},${f.correlationId})`;
    const [invoice] = await admin<
      { id: string }[]
    >`insert into operations.invoices(organisation_id,schedule_id,account_id,environment,provider_invoice_id,number,status,currency,total_pence,amount_paid_pence,amount_remaining_pence,due_date,issued_snapshot,projected_at,created_by,correlation_id) values(${f.organisationId},${scheduleId},${f.scope.accountId},'test','in_accessTest','TEST-001','open','GBP',6000,2000,4000,'2026-10-01','{}',now(),${billingFounder.actorId},${f.correlationId}) returning id`;
    const execute = (
      action: "manage" | "invoice" = "manage",
      invoiceId = invoice.id,
      adapter = provider,
    ) =>
      executePortalBillingCommand(
        portal,
        f.identity,
        f.scope,
        action === "manage"
          ? { action, organisationId: f.organisationId }
          : { action, organisationId: f.organisationId, invoiceId },
        adapter,
        "bpc_synthetic",
        "https://fss.test/portal/billing",
        f.correlationId,
      );
    for (const role of ["owner", "billing_contact"]) {
      await admin`update operations.memberships set role=${role} where organisation_id=${f.organisationId}`;
      assert.match(await execute(), /^https:\/\/billing.stripe.com/);
      assert.match(await execute("invoice"), /^https:\/\/invoice.stripe.com/);
      const rows = await withPortalTransaction(
        portal,
        f.identity,
        f.organisationId,
        f.correlationId,
        (tx) => loadInvoices(tx, f.scope),
      );
      assert.equal(rows[0].amountPaidPence, "2000");
    }
    for (const role of ["contributor", "viewer"]) {
      await admin`update operations.memberships set role=${role} where organisation_id=${f.organisationId}`;
      const before = providerCalls;
      await assert.rejects(execute(), PortalAccessDenied);
      await assert.rejects(execute("invoice"), PortalAccessDenied);
      assert.equal(providerCalls, before);
      assert.deepEqual(
        await withPortalTransaction(
          portal,
          f.identity,
          f.organisationId,
          f.correlationId,
          (tx) => loadInvoices(tx, f.scope),
        ),
        [],
      );
    }
    await admin`update operations.memberships set role='owner' where organisation_id=${f.organisationId}`;
    await assert.rejects(execute("invoice", randomUUID()), PortalAccessDenied);
    await assert.rejects(
      executePortalBillingCommand(
        portal,
        other.identity,
        f.scope,
        { action: "manage", organisationId: f.organisationId },
        provider,
        "bpc_synthetic",
        "https://fss.test",
        f.correlationId,
      ),
      PortalAccessDenied,
    );
    await assert.rejects(
      execute("manage", invoice.id, {
        ...provider,
        createSession: async (input) => {
          const result = await provider.createSession(input);
          await admin`update operations.memberships set revoked_at=now() where organisation_id=${f.organisationId}`;
          return result;
        },
      }),
      PortalAccessDenied,
    );
    const before = providerCalls;
    await assert.rejects(execute(), PortalAccessDenied);
    assert.equal(providerCalls, before);
  } finally {
    await removeBillingFixture(admin, f);
    await removeBillingFixture(admin, other);
    await portal.end();
    await db.end();
    await admin.end();
  }
});
