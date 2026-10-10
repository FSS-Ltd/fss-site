import type { Currency } from "@/lib/operations/money";
import { CreditCard } from "lucide-react";
import { Notice, PageHeader, PortalCard } from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { HostedBillingAction } from "./hosted-action";
import { BillingSetupPanel } from "./billing-setup-panel";
import type { BillingSetupStatus } from "@/lib/operations/billing/setup-service";
import { InvoiceList } from "./invoice-list";
import {
  billingAmount,
  billingDate,
  nextOpenInvoice,
  type InvoiceSummary,
} from "./presentation";
import styles from "./billing.module.css";

export function ClientBillingOverview({
  canManage,
  managementCurrencies = ["GBP"],
  setupCurrency,
  setup,
  invoices,
  nextPayment,
  organisationId,
  pagination,
}: {
  canManage: boolean;
  managementCurrencies?: readonly Currency[];
  setupCurrency: Currency;
  setup: BillingSetupStatus;
  invoices: readonly InvoiceSummary[];
  nextPayment?: InvoiceSummary | null;
  organisationId: string;
  pagination?: React.ReactNode;
}): React.JSX.Element {
  const payment = nextPayment ?? nextOpenInvoice(invoices);

  return (
    <div className={styles.workspace}>
      <PageHeader
        breadcrumbs={[
          { href: portalPath("/portal"), label: "Your workspace" },
          { label: "Billing" },
        ]}
        description="Review invoices and payment details without changing your agreement."
        eyebrow="Your account, clearly"
        title="Billing"
      />
      <div className={styles.summaryGrid}>
        <PortalCard title="Next payment">
          {payment ? (
            <div className={styles.summaryValue}>
              <strong>
                {billingAmount(payment.amountRemainingPence, payment.currency)}
              </strong>
              <span>
                {payment.dueDate
                  ? `Due ${billingDate(payment.dueDate)}`
                  : "Due date to be confirmed"}
              </span>
            </div>
          ) : (
            <p className={styles.note}>No open invoice is currently due.</p>
          )}
        </PortalCard>
        <PortalCard
          title="Payment setup"
          description="Choose how to pay future invoices. Adding details through Stripe makes no charge today."
        >
          <BillingSetupPanel
            canManage={canManage}
            currency={setupCurrency}
            status={setup}
            organisationId={organisationId}
          />
          {canManage && managementCurrencies.length > 0
            ? managementCurrencies.map((currency) => (
                <HostedBillingAction
                  key={currency}
                  command={{ action: "manage", organisationId, currency }}
                  variant="secondary"
                >
                  <CreditCard aria-hidden="true" size={16} />
                  {setup.status === "not_started"
                    ? "Open billing management"
                    : "Manage saved payment method"}
                  {managementCurrencies.length > 1 ? ` (${currency})` : ""}
                </HostedBillingAction>
              ))
            : null}
        </PortalCard>
      </div>
      <Notice tone="info">
        Direct Debit payments can take a few working days to settle. Open an
        invoice for its latest status before making another payment.
      </Notice>
      <section aria-labelledby="invoice-heading">
        <h2 className={styles.sectionTitle} id="invoice-heading">
          Invoices
        </h2>
        <InvoiceList invoices={invoices} organisationId={organisationId} />
        {pagination}
      </section>
      <Notice tone="info">
        To change or cancel a service, contact your FSS team. Your agreement’s
        notice and cancellation terms apply.
      </Notice>
    </div>
  );
}
