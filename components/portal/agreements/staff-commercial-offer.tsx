"use client";

import { useState } from "react";
import {
  Notice,
  PortalActionLink,
  PortalButton,
  PortalCard,
  PortalField,
  PortalTextarea,
} from "@/components/portal/ui";
import {
  decimalToMinor,
  formatMoney,
  minorToDecimal,
} from "@/lib/operations/money";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import type { CommercialOffer } from "@/lib/operations/agreements/commercial-types";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { useCommercialOfferCommand } from "./use-commercial-offer-command";
import { CommercialOfferSummary } from "./commercial-offer-summary";
import styles from "./agreements.module.css";

export function StaffCommercialOffer({
  offer,
}: Readonly<{ offer: CommercialOffer }>): React.JSX.Element {
  const { pending, error, send } = useCommercialOfferCommand(offer, "staff");
  const [validationError, setValidationError] = useState<string | null>(null);
  const proposal = offer.selection;
  return (
    <article className={styles.detail}>
      <CommercialOfferSummary offer={offer} />
      <PortalCard title="Client offer link">
        <p>Share this within the client&apos;s existing portal access.</p>
        <PortalActionLink
          href={`${portalPath(`/portal/agreements/offers/${offer.id}`)}?organisationId=${offer.organisationId}`}
        >
          Open client offer
        </PortalActionLink>
      </PortalCard>
      {offer.status === "proposed" && proposal ? (
        <PortalCard title="Review client proposal">
          <p>
            {proposal.option === "cash"
              ? `${formatMoney(proposal.recurringAmountMinor ?? "0", offer.draft.currency)} per billing period`
              : `${(Number(proposal.percentageBps) / 100).toFixed(2)}% revenue share`}
          </p>
          <form
            aria-busy={pending}
            onSubmit={(event) => {
              event.preventDefault();
              setValidationError(null);
              const data = new FormData(event.currentTarget);
              try {
                const draft =
                  proposal.option === "cash"
                    ? {
                        ...offer.draft,
                        lines: offer.draft.lines.map((line, index) => {
                          if (!line.recurrenceMonths) return line;
                          const total = BigInt(
                            decimalToMinor(
                              String(data.get(`line-${index}`) ?? ""),
                            ),
                          );
                          const discountPence = decimalToMinor(
                            String(data.get(`discount-${index}`) ?? ""),
                          );
                          const taxPence = decimalToMinor(
                            String(data.get(`tax-${index}`) ?? ""),
                          );
                          const net =
                            total + BigInt(discountPence) - BigInt(taxPence);
                          if (
                            net < BigInt(0) ||
                            net % BigInt(line.quantity) !== BigInt(0)
                          )
                            throw new Error(
                              "Each allocation must support the recorded quantity, tax and discount exactly.",
                            );
                          return {
                            ...line,
                            discountPence,
                            taxPence,
                            unitPence: (net / BigInt(line.quantity)).toString(),
                          };
                        }),
                      }
                    : undefined;
                const sum = draft?.lines
                  .filter((line) => line.recurrenceMonths)
                  .reduce(
                    (total, line) => total + BigInt(totalLinePence(line)),
                    BigInt(0),
                  )
                  .toString();
                if (
                  proposal.option === "cash" &&
                  sum !== proposal.recurringAmountMinor
                )
                  throw new Error(
                    "Allocations must equal the client's exact proposed total.",
                  );
                void send({ action: "approve", ...(draft ? { draft } : {}) });
              } catch (failure) {
                setValidationError(
                  failure instanceof Error
                    ? failure.message
                    : "Check the allocations.",
                );
              }
            }}
          >
            <fieldset disabled={pending}>
              <legend>Accepted service allocation</legend>
              {proposal.option === "cash" ? (
                offer.draft.lines.map((line, index) =>
                  line.recurrenceMonths ? (
                    <div key={index} className={styles.fieldGrid}>
                      <PortalField
                        label={`${line.description}: total per period (${offer.draft.currency})`}
                        required
                      >
                        <input
                          name={`line-${index}`}
                          inputMode="decimal"
                          defaultValue={minorToDecimal(totalLinePence(line))}
                          required
                        />
                      </PortalField>
                      <PortalField
                        label={`${line.description}: discount (${offer.draft.currency})`}
                        required
                      >
                        <input
                          name={`discount-${index}`}
                          inputMode="decimal"
                          defaultValue={minorToDecimal(line.discountPence)}
                          required
                        />
                      </PortalField>
                      <PortalField
                        label={`${line.description}: recorded tax (${offer.draft.currency})`}
                        required
                      >
                        <input
                          name={`tax-${index}`}
                          inputMode="decimal"
                          defaultValue={minorToDecimal(line.taxPence)}
                          required
                        />
                      </PortalField>
                    </div>
                  ) : null,
                )
              ) : (
                <p>
                  Approve the exact client-proposed percentage and published
                  share terms.
                </p>
              )}
              <PortalButton loading={pending} type="submit">
                Approve proposal and prepare signing
              </PortalButton>
            </fieldset>
          </form>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send({
                action: "reject",
                reason: String(
                  new FormData(event.currentTarget).get("reason") ?? "",
                ),
              });
            }}
          >
            <PortalTextarea
              label="Reason for rejecting"
              name="reason"
              required
              disabled={pending}
            />
            <PortalButton type="submit" variant="secondary" disabled={pending}>
              Reject proposal
            </PortalButton>
          </form>
        </PortalCard>
      ) : null}
      {offer.rejectionReason ? (
        <Notice tone="warning">{offer.rejectionReason}</Notice>
      ) : null}
      {offer.agreementId ? (
        <PortalActionLink
          href={portalPath(
            `/portal/admin/clients/${offer.organisationId}/agreements/${offer.agreementId}`,
          )}
        >
          Open selected agreement
        </PortalActionLink>
      ) : null}
      {["published", "proposed", "rejected"].includes(offer.status) ? (
        <PortalButton
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => void send({ action: "withdraw" })}
        >
          Withdraw offer
        </PortalButton>
      ) : null}
      {error || validationError ? (
        <Notice tone="error">{validationError ?? error}</Notice>
      ) : null}
    </article>
  );
}
