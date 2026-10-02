"use client";

import { useState } from "react";
import {
  Notice,
  PortalActionLink,
  PortalButton,
  PortalCard,
  PortalField,
} from "@/components/portal/ui";
import { decimalToMinor, formatMoney } from "@/lib/operations/money";
import { type CommercialOffer } from "@/lib/operations/agreements/commercial-types";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { useCommercialOfferCommand } from "./use-commercial-offer-command";
import { CommercialOfferSummary } from "./commercial-offer-summary";
import styles from "./agreements.module.css";

export function ClientCommercialOffer({
  offer,
}: Readonly<{ offer: CommercialOffer }>): React.JSX.Element {
  const [option, setOption] = useState<"cash" | "revenue_share" | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { pending, error, send } = useCommercialOfferCommand(offer, "client");
  const available = offer.status === "published" || offer.status === "rejected";
  const custom =
    option === "cash"
      ? offer.spec.cash?.mode === "client_proposed"
      : option === "revenue_share" &&
        offer.spec.revenueShare?.mode === "client_proposed";
  const recurring = offer.draft.lines.find((line) => line.recurrenceMonths > 0);
  return (
    <article className={styles.detail}>
      <CommercialOfferSummary offer={offer} />
      {offer.selection ? (
        <PortalCard title="Your submitted terms">
          <p>
            {offer.selection.option === "cash"
              ? offer.selection.recurringAmountMinor
                ? `${formatMoney(offer.selection.recurringAmountMinor, offer.draft.currency)} ${offer.draft.currency} per billing period`
                : "Fixed cash payment schedule"
              : offer.selection.percentageBps !== undefined
                ? `${(offer.selection.percentageBps / 100).toFixed(2)}% revenue share`
                : "Fixed revenue share"}
          </p>
        </PortalCard>
      ) : null}
      {offer.rejectionReason ? (
        <Notice tone="warning">{offer.rejectionReason}</Notice>
      ) : null}
      {offer.status === "proposed" ? (
        <Notice tone="info">
          Awaiting FSS review. Your proposal must be approved before signing.
        </Notice>
      ) : null}
      {offer.approvalId ? (
        <PortalActionLink
          href={`${portalPath(`/portal/agreements/${offer.approvalId}`)}?organisationId=${offer.organisationId}`}
        >
          Continue to signing
        </PortalActionLink>
      ) : null}
      {available ? (
        <PortalCard title="Choose ongoing compensation">
          <form
            aria-busy={pending}
            onSubmit={(event) => {
              event.preventDefault();
              setValidationError(null);
              const data = new FormData(event.currentTarget);
              try {
                if (!option)
                  throw new Error("Choose an ongoing payment option.");
                const recurringAmountMinor =
                  option === "cash" && custom
                    ? decimalToMinor(String(data.get("recurringAmount") ?? ""))
                    : undefined;
                if (
                  recurringAmountMinor &&
                  BigInt(recurringAmountMinor) < BigInt(2000)
                )
                  throw new Error(
                    `Propose at least 20 ${offer.draft.currency} per period.`,
                  );
                const percentageBps =
                  option === "revenue_share" && custom
                    ? Number(
                        decimalToMinor(String(data.get("percentage") ?? "")),
                      )
                    : undefined;
                if (
                  percentageBps !== undefined &&
                  (percentageBps < 1000 || percentageBps > 10000)
                )
                  throw new Error("Propose a percentage between 10% and 100%.");
                void send({
                  action: "select",
                  option,
                  ...(recurringAmountMinor ? { recurringAmountMinor } : {}),
                  ...(percentageBps !== undefined ? { percentageBps } : {}),
                });
              } catch (failure) {
                setValidationError(
                  failure instanceof Error
                    ? failure.message
                    : "Check your proposal.",
                );
              }
            }}
          >
            <fieldset className={styles.compensationFields} disabled={pending}>
              <legend>Available options</legend>
              {offer.spec.cash ? (
                <label className={styles.compensationChoice}>
                  <input
                    name="option"
                    type="radio"
                    value="cash"
                    required
                    checked={option === "cash"}
                    onChange={() => setOption("cash")}
                  />{" "}
                  Cash payment:{" "}
                  {offer.spec.cash.mode === "fixed"
                    ? "reviewed service fees"
                    : `propose an amount, minimum 20 ${offer.draft.currency}`}
                  {recurring && offer.spec.cash.mode === "client_proposed"
                    ? ` every ${recurring.recurrenceMonths} month(s), from ${recurring.startDate}`
                    : ""}
                </label>
              ) : null}
              {offer.spec.revenueShare ? (
                <label className={styles.compensationChoice}>
                  <input
                    name="option"
                    type="radio"
                    value="revenue_share"
                    required
                    checked={option === "revenue_share"}
                    onChange={() => setOption("revenue_share")}
                  />{" "}
                  Revenue share:{" "}
                  {offer.spec.revenueShare.mode === "fixed"
                    ? `${(offer.spec.revenueShare.percentageBps / 100).toFixed(2)}%`
                    : "propose a percentage, minimum 10%"}
                </label>
              ) : null}
              {option === "cash" && custom ? (
                <PortalField
                  label={`Amount per billing period (${offer.draft.currency})`}
                  required
                >
                  <input name="recurringAmount" inputMode="decimal" required />
                </PortalField>
              ) : null}
              {option === "revenue_share" && custom ? (
                <PortalField label="Revenue share (%)" required>
                  <input name="percentage" inputMode="decimal" required />
                </PortalField>
              ) : null}
              {option && !custom ? (
                <PortalActionLink
                  href={`/api/portal/organisations/${offer.organisationId}/commercial-offers/${offer.id}/${option}/document`}
                >
                  Review exact signing PDF
                </PortalActionLink>
              ) : null}
              <p>
                {custom
                  ? "FSS will review your proposal before preparing the agreement for signing."
                  : "Review the exact agreement before signing. Choosing an option is not a signature."}
              </p>
              <PortalButton
                type="submit"
                loading={pending}
                disabled={!option || pending}
              >
                {custom ? "Submit proposal" : "Continue to signing"}
              </PortalButton>
            </fieldset>
            {validationError || error ? (
              <Notice tone="error">{validationError ?? error}</Notice>
            ) : null}
          </form>
        </PortalCard>
      ) : null}
      {!available && offer.status !== "proposed" && !offer.approvalId ? (
        <Notice tone="warning">
          This offer is no longer open. Contact FSS to review the terms.
        </Notice>
      ) : null}
    </article>
  );
}
