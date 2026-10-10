"use client";

import { useState } from "react";
import { PortalCheckbox, StatusBadge } from "@/components/portal/ui";
import type { Currency } from "@/lib/operations/money";
import type {
  BillingSetupMethod,
  BillingSetupStatus,
} from "@/lib/operations/billing/setup-service";
import { HostedBillingAction } from "./hosted-action";
import styles from "./billing.module.css";

const statusLabels: Record<BillingSetupStatus["status"], string> = {
  not_started: "No payment details saved",
  pending: "Setup awaiting completion",
  active: "Payment details saved",
  pending_mandate: "Direct Debit mandate pending",
  revoked: "Payment method unavailable",
  expired: "Card expired",
  failed: "Setup failed",
  cancelled: "Setup cancelled",
};

export function BillingSetupPanel({
  canManage,
  currency,
  status,
  organisationId,
}: Readonly<{
  canManage: boolean;
  currency: Currency;
  status: BillingSetupStatus;
  organisationId: string;
}>): React.JSX.Element {
  const [method, setMethod] = useState<BillingSetupMethod>(
    currency === "GBP" ? "bacs_debit" : "card",
  );
  const [automaticConsent, setAutomaticConsent] = useState(false);
  return (
    <div className={styles.setupPanel}>
      <p>
        <StatusBadge
          status={
            status.status === "active"
              ? "success"
              : status.status === "failed" ||
                  status.status === "revoked" ||
                  status.status === "expired"
                ? "warning"
                : "neutral"
          }
        >
          {statusLabels[status.status]}
        </StatusBadge>
      </p>
      {status.last4 ? (
        <p>
          {status.method === "bacs_debit"
            ? "Bank account"
            : (status.brand ?? "Card")}{" "}
          ending {status.last4}.
          {status.automaticConsent
            ? " Automatic collection was authorised for future eligible charges."
            : " Future invoices remain payable manually."}
        </p>
      ) : null}
      {status.status === "pending_mandate" ? (
        <p>
          Bank verification can take a few working days. Automatic collection
          will wait for an active mandate.
        </p>
      ) : null}
      {status.automaticConsent ? (
        <p>
          For changes to existing automatic schedules, use “Manage saved payment
          method” below.
        </p>
      ) : null}
      {canManage ? (
        <fieldset className={styles.setupChoices}>
          <legend>Choose a payment method</legend>
          {currency === "GBP" ? (
            <label>
              <input
                type="radio"
                name="setup-method"
                value="bacs_debit"
                checked={method === "bacs_debit"}
                onChange={() => setMethod("bacs_debit")}
              />
              Direct Debit
            </label>
          ) : null}
          <label>
            <input
              type="radio"
              name="setup-method"
              value="card"
              checked={method === "card"}
              onChange={() => setMethod("card")}
            />
            Debit or credit card
          </label>
          <PortalCheckbox
            checked={automaticConsent}
            onChange={(event) => setAutomaticConsent(event.target.checked)}
            label="I authorise FSS to collect eligible future recurring charges automatically using this payment method"
            hint="This does not pay existing invoices or change scheduled payments, agreed amounts, dates or cancellation terms."
          />
          <HostedBillingAction
            command={{
              action: "setup",
              organisationId,
              currency,
              method,
              automaticConsent,
            }}
            variant="primary"
          >
            Continue securely with Stripe
          </HostedBillingAction>
        </fieldset>
      ) : (
        <p>
          Only an organisation owner or billing contact can update payment
          details.
        </p>
      )}
    </div>
  );
}
