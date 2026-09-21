"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  Notice,
  PortalButton,
  PortalField,
  PortalTextarea,
} from "@/components/portal/ui";
import styles from "./services.module.css";

type EnquiryResponse = Readonly<{
  error?: string;
  enquiry?: Readonly<{ id: string; reference: string }>;
}>;

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
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">(
    "success",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const interest = String(data.get("interest") ?? "").trim();
    const preferredStart = String(data.get("preferredStart") ?? "").trim();
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
      setMessageTone("error");
      setMessage("Tell us what you would like help with.");
      return;
    }

    requestKey.current ??= crypto.randomUUID();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/portal/services/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          idempotencyKey: requestKey.current,
          interest,
          offerId,
          organisationId,
          preferredStart: preferredStart || null,
        }),
      });
      const body = (await response.json()) as EnquiryResponse;
      if (!response.ok || !body.enquiry) {
        setMessageTone("error");
        setMessage(
          body.error ??
            "We could not save your enquiry. Your message is still here.",
        );
        return;
      }

      setMessageTone("success");
      setMessage(
        `Enquiry ${body.enquiry.reference} received. Your FSS team will review it before proposing any work or price.`,
      );
      requestKey.current = null;
      form.reset();
    } catch {
      setMessageTone("error");
      setMessage(
        "We could not save your enquiry. Your message is still here. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-busy={pending}>
      <PortalTextarea
        disabled={pending}
        label="What would you like help with?"
        maxLength={4000}
        name="interest"
        required
      />
      <PortalField label="Preferred start" hint="Optional">
        <input disabled={pending} maxLength={1000} name="preferredStart" />
      </PortalField>
      {/reception|call/i.test(offerName) ? (
        <section
          className={styles.details}
          aria-labelledby="call-details-heading"
        >
          <h2 id="call-details-heading">Call handling details</h2>
          <PortalField label="Approximate call volume">
            <input disabled={pending} maxLength={1000} name="callVolume" />
          </PortalField>
          <PortalField label="Operating hours">
            <input disabled={pending} maxLength={1000} name="operatingHours" />
          </PortalField>
          <PortalField label="Booking or CRM systems">
            <input disabled={pending} maxLength={1000} name="systems" />
          </PortalField>
          <PortalField label="Transfer contact">
            <input disabled={pending} maxLength={1000} name="transferContact" />
          </PortalField>
          <PortalTextarea
            disabled={pending}
            label="How missed calls should be handled"
            maxLength={1000}
            name="missedCalls"
          />
        </section>
      ) : null}
      <PortalButton loading={pending} type="submit">
        Enquire about {offerName}
      </PortalButton>
      {message ? <Notice tone={messageTone}>{message}</Notice> : null}
      <p className={styles.note}>
        An enquiry starts a conversation. It does not approve work or create a
        charge.
      </p>
    </form>
  );
}
