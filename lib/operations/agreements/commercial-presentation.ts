import { formatMoney } from "@/lib/operations/money";
import type { CommercialOffer } from "./commercial-types";

export function submittedCommercialTerms(
  offer: CommercialOffer,
): string | null {
  if (offer.recordedStatus !== "proposed" || !offer.selection) return null;
  if (offer.selection.option === "revenue_share")
    return `${(Number(offer.selection.percentageBps) / 100).toFixed(2)}% revenue share`;

  const months =
    offer.draft.lines.find((line) => line.recurrenceMonths > 0)
      ?.recurrenceMonths ?? 1;
  const interval = months === 1 ? "per month" : `every ${months} months`;
  return `${formatMoney(offer.selection.recurringAmountMinor ?? "0", offer.draft.currency)} ${offer.draft.currency} ${interval}`;
}
