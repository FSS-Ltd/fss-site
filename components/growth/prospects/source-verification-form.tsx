"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./campaign-review.module.css";

type Contact = {
  email: string;
  firstName: string | null;
  lastName: string | null;
} | null;
export function SourceVerificationForm({
  prospectId,
  version,
  contact,
}: {
  prospectId: string;
  version: number;
  contact: Contact;
}) {
  const router = useRouter();
  const [initialVersion] = useState(version);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  const retry = useRef<{ payload: string; id: string } | null>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const body = {
      expectedProspectVersion: initialVersion,
      email: text("email"),
      firstName: text("firstName") || null,
      lastName: text("lastName") || null,
      contactSourceUrl: text("contactSourceUrl"),
      contactObservedAt: text("contactObservedAt"),
      observationSourceUrl: text("observationSourceUrl"),
      observation: text("observation"),
      observedAt: text("observedAt"),
    };
    const payload = JSON.stringify(body);
    if (retry.current?.payload !== payload)
      retry.current = { payload, id: crypto.randomUUID() };
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/growth/prospects/${prospectId}/verify-source`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, requestId: retry.current.id }),
        },
      );
      if (!response.ok) {
        setMessage(
          response.status === 409
            ? "The prospect changed or the contact conflicts with another record. Your entries are retained; copy them before refreshing to review the current record."
            : response.status === 401
              ? "Your session has expired. Sign in again; your entries remain here."
              : "Could not save. Check the public source URLs and ISO times with offsets; observations must be within 30 days.",
        );
        if (response.status === 409) router.refresh();
        return;
      }
      retry.current = null;
      setSaved(true);
      setMessage("Evidence recorded. This does not grant permission to send.");
      router.refresh();
    } catch {
      setMessage("Could not save. Your entries are retained; try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <details className={styles.disclosure}>
      <summary>Verify contact and business observation</summary>
      <form onSubmit={submit} className={styles.form}>
        <p>
          Record what you personally verified from public sources. Public
          contact details are not consent. Names are used when creating a
          contact; existing contact names are retained.
        </p>
        {version !== initialVersion && !saved && (
          <p role="alert">
            The prospect changed. Copy your entries, then refresh to review its
            current version.
          </p>
        )}
        <fieldset disabled={pending || saved}>
          <label>
            Contact email
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              defaultValue={contact?.email ?? ""}
            />
          </label>
          <label>
            First name (optional)
            <input
              name="firstName"
              maxLength={100}
              defaultValue={contact?.firstName ?? ""}
            />
          </label>
          <label>
            Last name (optional)
            <input
              name="lastName"
              maxLength={100}
              defaultValue={contact?.lastName ?? ""}
            />
          </label>
          <label>
            Public URL for email
            <input name="contactSourceUrl" type="url" required />
          </label>
          <label>
            Contact observed at (ISO time with offset)
            <input
              name="contactObservedAt"
              required
              placeholder="YYYY-MM-DDTHH:MM:SSZ"
            />
          </label>
          <label>
            Public URL for business observation
            <input name="observationSourceUrl" type="url" required />
          </label>
          <label>
            Business observation
            <textarea name="observation" required maxLength={500} />
          </label>
          <label>
            Observation time (ISO time with offset)
            <input
              name="observedAt"
              required
              placeholder="YYYY-MM-DDTHH:MM:SSZ"
            />
          </label>
        </fieldset>
        <button
          type="submit"
          disabled={pending || saved || version !== initialVersion}
        >
          {pending ? "Saving…" : "Record evidence"}
        </button>
        {message && (
          <p ref={feedback} tabIndex={-1} role={saved ? "status" : "alert"}>
            {message}
          </p>
        )}
      </form>
    </details>
  );
}
