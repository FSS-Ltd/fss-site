"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type {
  CommercialOffer,
  CommercialOfferMutation,
} from "@/lib/operations/agreements/commercial-types";

export function useCommercialOfferCommand(
  offer: CommercialOffer,
  audience: "staff" | "client",
): Readonly<{
  pending: boolean;
  error: string | null;
  send: (command: CommercialOfferMutation) => Promise<void>;
}> {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(command: CommercialOfferMutation): Promise<void> {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const endpoint =
        audience === "staff"
          ? `/api/portal/admin/clients/${offer.organisationId}/commercial-offers`
          : `/api/portal/organisations/${offer.organisationId}/commercial-offers`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...command,
          offerId: offer.id,
          expectedVersion: offer.version,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          body &&
            typeof body === "object" &&
            "message" in body &&
            typeof body.message === "string"
            ? body.message
            : "The offer could not be updated. Please try again.",
        );
      }
      if (
        body &&
        typeof body === "object" &&
        "offer" in body &&
        body.offer &&
        typeof body.offer === "object" &&
        "approvalId" in body.offer &&
        typeof body.offer.approvalId === "string" &&
        audience === "client"
      ) {
        router.push(
          `${portalPath(`/portal/agreements/${body.offer.approvalId}`)}?organisationId=${encodeURIComponent(offer.organisationId)}`,
        );
      } else router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The offer could not be updated.",
      );
    } finally {
      setPending(false);
    }
  }
  return { pending, error, send };
}
