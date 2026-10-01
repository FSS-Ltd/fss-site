import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Download,
  ReceiptText,
} from "lucide-react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { HostedBillingAction } from "./hosted-action";
import { PaymentStatus } from "./payment-status";
import { billingAmount, billingDate, type InvoiceDetail } from "./presentation";
import styles from "./billing.module.css";

function invoiceNotice(invoice: InvoiceDetail): React.ReactNode {
  if (invoice.status === "paid")
    return (
      <Notice tone="success">
        <CheckCircle2 aria-hidden="true" size={18} /> Payment confirmed.
      </Notice>
    );
  if (invoice.paymentState === "failed")
    return (
      <Notice tone="error">
        <CircleAlert aria-hidden="true" size={18} /> The payment did not
        complete. Review your payment method or contact FSS.
      </Notice>
    );
  return (
    <Notice tone="info">
      Payments can take a few working days to settle. Check this page before
      making another payment.
    </Notice>
  );
}

export function ClientInvoiceDetail({
  canOpenHostedInvoice,
  invoice,
  organisationId,
}: {
  canOpenHostedInvoice: boolean;
  invoice: InvoiceDetail;
  organisationId: string;
}): React.JSX.Element {
  const isPaid = invoice.status === "paid";
  const isActionable = invoice.status === "open" || invoice.status === "paid";

  return (
    <div className={styles.workspace}>
      <PageHeader
        breadcrumbs={[
          { href: portalPath("/portal"), label: "Your workspace" },
          { href: portalPath("/portal/billing"), label: "Billing" },
          { label: invoice.number ?? "Invoice" },
        ]}
        description="A record of this invoice and its latest payment state."
        eyebrow="Invoice"
        title={invoice.number ?? "Invoice being prepared"}
      />
      {invoiceNotice(invoice)}
      <div className={styles.detailGrid}>
        <PortalCard title="Payment summary">
          <div className={styles.detailHeading}>
            <strong className={styles.detailAmount}>
              {billingAmount(invoice.totalPence, invoice.currency)}
            </strong>
            <PaymentStatus invoice={invoice} />
          </div>
          <dl className={styles.details}>
            {invoice.dueDate ? (
              <div>
                <dt>Due</dt>
                <dd>
                  <time dateTime={invoice.dueDate}>
                    {billingDate(invoice.dueDate)}
                  </time>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Paid</dt>
              <dd>
                {billingAmount(invoice.amountPaidPence, invoice.currency)}
              </dd>
            </div>
            <div>
              <dt>Remaining</dt>
              <dd>
                {billingAmount(invoice.amountRemainingPence, invoice.currency)}
              </dd>
            </div>
            {invoice.issuedAt ? (
              <div>
                <dt>Issued</dt>
                <dd>
                  <time dateTime={invoice.issuedAt}>
                    {billingDate(invoice.issuedAt)}
                  </time>
                </dd>
              </div>
            ) : null}
          </dl>
          {canOpenHostedInvoice && isActionable ? (
            <HostedBillingAction
              command={{
                action: "invoice",
                invoiceId: invoice.id,
                organisationId,
              }}
              variant="primary"
            >
              {isPaid ? (
                <>
                  <Download aria-hidden="true" size={16} /> Download receipt
                </>
              ) : (
                <>
                  <ReceiptText aria-hidden="true" size={16} /> Pay securely
                </>
              )}
            </HostedBillingAction>
          ) : null}
        </PortalCard>
        <PortalCard title="Invoice details">
          {invoice.lines.length > 0 ? (
            <ul className={styles.lines}>
              {invoice.lines.map((line, index) => (
                <li key={`${line.description ?? "line"}-${index}`}>
                  <span>{line.description ?? "Invoice item"}</span>
                  <strong>
                    {billingAmount(line.amountPence, invoice.currency)}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>
              Invoice line items are not available for this record.
            </p>
          )}
        </PortalCard>
      </div>
      <PortalActionLink
        href={`${portalPath("/portal/billing")}?${new URLSearchParams({ organisationId }).toString()}`}
        variant="quiet"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Back to billing
      </PortalActionLink>
    </div>
  );
}
