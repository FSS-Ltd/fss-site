"use client";
import { useId, useState } from "react";
import { PortalButton, type PortalButtonVariant } from "@/components/portal/ui";
import type { PortalBillingCommand } from "@/lib/operations/http/billing-handler";
import styles from "./billing.module.css";

export function HostedBillingAction({
  command,
  children,
  variant = "secondary",
}: {
  command: PortalBillingCommand;
  children: React.ReactNode;
  variant?: PortalButtonVariant;
}): React.JSX.Element {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  async function openBilling() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/portal/billing/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        typeof result !== "object" ||
        !result ||
        !("url" in result) ||
        typeof result.url !== "string"
      ) {
        setError(
          response.status === 401
            ? "Sign in again to open billing."
            : "We couldn’t open billing. Please try again.",
        );
        setPending(false);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("Check your connection and try again.");
      setPending(false);
    }
  }
  return (
    <div className={styles.actionGroup}>
      <PortalButton
        type="button"
        onClick={openBilling}
        aria-describedby={error ? errorId : undefined}
        loading={pending}
        variant={variant}
      >
        {children}
      </PortalButton>
      {error && (
        <p className={styles.error} role="alert" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
