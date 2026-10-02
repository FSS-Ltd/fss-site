import { PortalCard, StatusBadge } from "@/components/portal/ui";
import { formatMoney } from "@/lib/operations/money";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import type { CommercialOffer } from "@/lib/operations/agreements/commercial-types";
import styles from "./agreements.module.css";

export function CommercialOfferSummary({
  offer,
}: Readonly<{ offer: CommercialOffer }>): React.JSX.Element {
  const setup = offer.draft.lines
    .filter((line) => line.recurrenceMonths === 0)
    .reduce((sum, line) => sum + BigInt(totalLinePence(line)), BigInt(0))
    .toString();
  return (
    <>
      <StatusBadge status="info">
        {offer.status} · version {offer.version}
      </StatusBadge>
      <PortalCard title="Fixed setup fee">
        <p className={styles.metric}>
          {formatMoney(setup, offer.draft.currency)} {offer.draft.currency}
        </p>
        <p>This remains payable with either ongoing option.</p>
        <ul className={styles.schedule}>
          {offer.draft.installments.map((item, index) => (
            <li key={index}>
              {formatMoney(item.amountPence, offer.draft.currency)} ·{" "}
              {item.dueDate}
            </li>
          ))}
        </ul>
        <p>
          Required deposit:{" "}
          {formatMoney(offer.draft.requiredDepositPence, offer.draft.currency)}
        </p>
        <p>{offer.draft.taxTreatment}</p>
      </PortalCard>
      {offer.spec.cash?.mode === "fixed" ? (
        <PortalCard title="Recurring payment schedule">
          <ul className={styles.schedule}>
            {offer.draft.lines
              .filter((line) => line.recurrenceMonths > 0)
              .map((line, index) => (
                <li key={index}>
                  {line.description}:{" "}
                  {formatMoney(totalLinePence(line), offer.draft.currency)}{" "}
                  {offer.draft.currency} every {line.recurrenceMonths} month(s),
                  from {line.startDate}
                  {line.endDate ? ` to ${line.endDate}` : ", no end date"}
                </li>
              ))}
          </ul>
        </PortalCard>
      ) : null}
      <PortalCard title="Services and contract dates">
        <ul className={styles.schedule}>
          {offer.draft.lines.map((line, index) => (
            <li key={index}>
              {line.description}: from {line.startDate}
              {line.endDate ? ` to ${line.endDate}` : ", no end date"}
            </li>
          ))}
        </ul>
        <p>
          Minimum term: {offer.draft.minimumTermMonths} months. Notice:{" "}
          {offer.draft.noticeDays} days.
        </p>
      </PortalCard>
      <PortalCard title="Scope and responsibilities">
        <p>{offer.draft.scope}</p>
        <p>{offer.draft.responsibilities}</p>
        <p>{offer.draft.terms}</p>
      </PortalCard>
      {offer.spec.revenueShare ? (
        <PortalCard title="Revenue-share terms">
          <dl className={styles.summaryList}>
            <div>
              <dt>Percentage</dt>
              <dd>
                {offer.spec.revenueShare.mode === "fixed"
                  ? `${(offer.spec.revenueShare.percentageBps / 100).toFixed(2)}%`
                  : offer.selection?.option === "revenue_share" &&
                      offer.selection.percentageBps !== undefined
                    ? `${(offer.selection.percentageBps / 100).toFixed(2)}% proposed`
                    : "Client-proposed, minimum 10%"}
              </dd>
            </div>
            <div>
              <dt>Revenue source</dt>
              <dd>{offer.spec.revenueShare.revenueSource}</dd>
            </div>
            <div>
              <dt>Calculation basis</dt>
              <dd>{offer.spec.revenueShare.calculationBasis}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{offer.spec.revenueShare.duration}</dd>
            </div>
            <div>
              <dt>Reporting</dt>
              <dd>{offer.spec.revenueShare.reportingRequirements}</dd>
            </div>
            <div>
              <dt>Payment terms</dt>
              <dd>{offer.spec.revenueShare.paymentTerms}</dd>
            </div>
          </dl>
          <p>
            Revenue share replaces recurring cash charges. Reporting and share
            collection are managed separately.
          </p>
        </PortalCard>
      ) : null}
    </>
  );
}
