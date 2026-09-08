import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import {
  getPortalDb,
  withPortalTransaction,
} from "@/lib/operations/db/portal-client";
import { readBillingConfiguration } from "@/lib/operations/billing/configuration";
import { loadInvoices } from "@/lib/operations/billing/invoice-repository";
import { loadBillingCustomer } from "@/lib/operations/billing/customer-repository";
import { InvoiceList } from "@/components/portal/billing/invoice-list";
import { HostedBillingAction } from "@/components/portal/billing/hosted-action";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/projects.module.css";
import billing from "@/components/portal/billing/billing.module.css";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  let configuration;
  try {
    configuration = readBillingConfiguration();
  } catch {
    return <PortalUnavailable />;
  }
  if (!configuration.enabled) return <PortalUnavailable />;
  let data;
  try {
    const scope = {
      organisationId: context.organisationId,
      accountId: configuration.accountId,
      mode: configuration.mode,
    };
    data = await withPortalTransaction(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
      async (tx, membership) => {
        if (!hasPortalCapability(membership.role, "billing.read"))
          throw new PortalAccessDenied();
        const invoices = await loadInvoices(tx, scope);
        const customer = await loadBillingCustomer(tx, scope);
        return {
          invoices,
          canManage:
            Boolean(customer) &&
            hasPortalCapability(membership.role, "billing.manage"),
        };
      },
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href="/portal">
        Your workspace
      </Link>
      <p className={styles.eyebrow}>Your account, clearly</p>
      <h1 className={styles.title}>Billing</h1>
      <p className={styles.copy}>
        Your invoices and payment details, in one place.
      </p>
      <section className={billing.management} aria-labelledby="payment-details">
        <div>
          <h2 id="payment-details">Payment details</h2>
          <p>
            {data.canManage
              ? "Update your payment method securely with Stripe."
              : "Payment management will be available when billing is set up."}
          </p>
        </div>
        {data.canManage && (
          <HostedBillingAction
            primary
            command={{
              action: "manage",
              organisationId: context.organisationId,
            }}
          >
            Manage payment method
          </HostedBillingAction>
        )}
      </section>
      <section aria-labelledby="invoice-heading">
        <h2 id="invoice-heading" className={billing.sectionTitle}>
          Invoices
        </h2>
        <p className={styles.copy}>
          Direct Debit payments can take a few working days to settle. Open an
          invoice for its latest status before making another payment.
        </p>
        <InvoiceList
          invoices={data.invoices}
          organisationId={context.organisationId}
        />
        {data.invoices.length === 100 && (
          <p className={styles.note}>
            Showing your latest 100 invoices. Open payment management for your
            full invoice history.
          </p>
        )}
      </section>
      <p className={styles.copy}>
        To change or cancel a service, contact your FSS team. Your agreement’s
        notice and cancellation terms apply.
      </p>
    </div>
  );
}
