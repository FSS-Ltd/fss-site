"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "./services.module.css";

export function OfferEnquiryForm({
  offerId,
  offerName,
  organisationId,
}: {
  offerId: string;
  offerName: string;
  organisationId: string;
}): React.JSX.Element {
  const requestKey = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const interest = String(data.get("interest") ?? "").trim();
    const context = Object.fromEntries(
      [
        "callVolume",
        "operatingHours",
        "systems",
        "transferContact",
        "missedCalls",
      ]
        .map((name) => [name, String(data.get(name) ?? "").trim()] as const)
        .filter(([, value]) => value),
    );
    if (!interest) {
      setMessage("Tell us what you would like to achieve.");
      return;
    }
    requestKey.current ??= crypto.randomUUID();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/portal/services/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationId,
          offerId,
          idempotencyKey: requestKey.current,
          interest,
          context,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(
          body.error ??
            "We could not save your enquiry. Your message is still here.",
        );
        return;
      }
      setMessage(
        "Enquiry received. Your FSS team will review it before proposing any work or price.",
      );
      form.reset();
    } catch {
      setMessage(
        "We could not save your enquiry. Your message is still here. Try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form className={styles.form} onSubmit={submit} aria-busy={pending}>
      <label>
        What would you like to achieve?
        <textarea
          name="interest"
          required
          maxLength={4000}
          disabled={pending}
        />
      </label>
      {/reception|call/i.test(offerName) && (
        <fieldset className={styles.details} disabled={pending}>
          <legend>Call handling details</legend>
          <label>
            Approximate call volume
            <input name="callVolume" maxLength={1000} />
          </label>
          <label>
            Operating hours
            <input name="operatingHours" maxLength={1000} />
          </label>
          <label>
            Booking or CRM systems
            <input name="systems" maxLength={1000} />
          </label>
          <label>
            Transfer contact
            <input name="transferContact" maxLength={1000} />
          </label>
          <label>
            How missed calls should be handled
            <textarea name="missedCalls" maxLength={1000} />
          </label>
        </fieldset>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Enquire about this service"}
      </button>
      <p className={styles.message} role="status" aria-live="polite">
        {message}
      </p>
      <p className={styles.note}>
        An enquiry starts a conversation. It does not approve work or create a
        charge.
      </p>
    </form>
  );
}
