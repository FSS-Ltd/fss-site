"use client";

import { useState, type FormEvent } from "react";
import {
  currencies,
  currencyLabel,
  currencySchema,
  type Currency,
} from "@/lib/operations/money";
import {
  Notice,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
} from "@/components/portal/ui";
import styles from "./client-form.module.css";

export function StudioClientCurrencyForm({
  billingCurrency,
  currencyVersion,
  organisationId,
}: Readonly<{
  billingCurrency: Currency;
  currencyVersion: number;
  organisationId: string;
}>): React.JSX.Element {
  const [reviewError, setReviewError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const selected = currencySchema.safeParse(data.get("billingCurrency"));
    if (!selected.success) return;
    const reviewReference = String(data.get("reviewReference") ?? "").trim();
    if (!reviewReference) {
      setReviewError("Enter a review reference.");
      return;
    }
    setReviewError(undefined);
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/portal/admin/clients/${encodeURIComponent(organisationId)}/currency`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            billingCurrency: selected.data,
            expectedCurrencyVersion: currencyVersion,
            reviewReference,
          }),
        },
      );
      setFailed(!response.ok);
      if (!response.ok) {
        setMessage(
          response.status === 409
            ? "This client's currency changed or the client is unavailable. Reload before saving again."
            : "We could not save the currency. Check the details and try again.",
        );
        return;
      }
      setMessage("Billing currency saved for future drafts.");
      window.location.reload();
    } catch {
      setFailed(true);
      setMessage(
        "We could not save the currency. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <PortalCard
      title="Billing currency"
      description="Sets the default for future drafts. Existing drafts, agreements, schedules and invoices keep their recorded currency."
    >
      <form className={styles.form} onSubmit={submit} aria-busy={pending}>
        <PortalSelect
          label="Billing currency"
          required
          key={`${billingCurrency}:${currencyVersion}`}
          name="billingCurrency"
          defaultValue={billingCurrency}
          disabled={pending}
        >
          {currencies.map((currency) => (
            <option key={currency} value={currency}>
              {currencyLabel(currency)}
            </option>
          ))}
        </PortalSelect>
        <PortalField error={reviewError} label="Review reference" required>
          <input name="reviewReference" maxLength={200} disabled={pending} />
        </PortalField>
        <div className={styles.formActions}>
          <PortalButton loading={pending} type="submit">
            Save currency
          </PortalButton>
        </div>
        {message ? (
          <Notice tone={failed ? "error" : "success"}>{message}</Notice>
        ) : null}
      </form>
    </PortalCard>
  );
}
