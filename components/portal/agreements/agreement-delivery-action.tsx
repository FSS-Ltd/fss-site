"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notice, PortalButton } from "@/components/portal/ui";
import type { NotificationDelivery } from "@/lib/operations/agreements/agreement-notification-repository";

export function AgreementDeliveryAction({
  source,
  delivery,
  endpoint,
}: Readonly<{
  source: Readonly<{ type: "signing" | "offer"; id: string }>;
  delivery: NotificationDelivery;
  endpoint: string;
}>): React.JSX.Element {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend(): Promise<void> {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          source.type === "signing"
            ? {
                action: "resend_delivery",
                approvalId: source.id,
                notificationId: delivery.id,
                expectedVersion: delivery.sendVersion,
                requestId: crypto.randomUUID(),
              }
            : {
                offerId: source.id,
                expectedVersion: delivery.sendVersion,
                requestId: crypto.randomUUID(),
              },
        ),
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        const message =
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof body.message === "string"
            ? body.message
            : typeof body === "object" &&
                body !== null &&
                "error" in body &&
                typeof body.error === "string"
              ? body.error
              : "The email could not be resent.";
        throw new Error(message);
      }
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The email could not be resent.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PortalButton
        type="button"
        variant="secondary"
        disabled={pending}
        loading={pending}
        onClick={() => void resend()}
      >
        {source.type === "signing"
          ? "Resend signing email"
          : "Resend offer email"}
      </PortalButton>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </>
  );
}
