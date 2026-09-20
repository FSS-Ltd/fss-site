"use client";

import { ArrowRight, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./portal.module.css";

type Status = { kind: "idle" | "pending" | "error"; message?: string };

export function OrganisationOnboarding({
  homePath = "/",
}: {
  homePath?: string;
}): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status.kind === "pending") return;
    const form = new FormData(event.currentTarget);
    setStatus({ kind: "pending" });
    try {
      const response = await fetch("/api/portal/access/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.get("displayName"),
          legalName: form.get("legalName"),
          timezone: form.get("timezone"),
        }),
      });
      if (!response.ok)
        throw new Error("Your organisation could not be created.");
      router.replace(homePath);
      router.refresh();
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Your organisation could not be created.",
      });
    }
  }

  const busy = status.kind === "pending";
  return (
    <section className={styles.authPanel} aria-labelledby="onboarding-heading">
      <div className={styles.identityMark} aria-hidden="true">
        <Building2 size={28} />
      </div>
      <p className={styles.eyebrow}>First-time setup</p>
      <h1 className={styles.heading} id="onboarding-heading">
        Set up your organisation.
      </h1>
      <p className={styles.copy}>
        Add the organisation this portal will represent. You can manage further
        details after setup.
      </p>
      <form className={styles.form} onSubmit={submit} aria-busy={busy}>
        <label className={styles.label} htmlFor="organisation-display-name">
          Organisation name
        </label>
        <input
          autoComplete="organization"
          autoFocus
          className={styles.input}
          id="organisation-display-name"
          maxLength={200}
          name="displayName"
          required
          disabled={busy}
        />
        <label className={styles.label} htmlFor="organisation-legal-name">
          Legal name
        </label>
        <input
          autoComplete="organization"
          className={styles.input}
          id="organisation-legal-name"
          maxLength={200}
          name="legalName"
          required
          disabled={busy}
        />
        <input name="timezone" type="hidden" value="Europe/London" />
        <button className={styles.button} disabled={busy} type="submit">
          <span>{busy ? "Creating organisation…" : "Create organisation"}</span>
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </form>
      <div aria-live="polite" aria-atomic="true">
        {status.kind === "error" ? (
          <p className={`${styles.feedback} ${styles.error}`}>
            {status.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
