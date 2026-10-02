import type { AgreementBuilderDraftContent } from "@/lib/operations/agreements/builder-draft-schema";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import {
  formatGbp,
  type BuilderAgreement,
} from "./agreement-builder-step-support";
import styles from "./agreements.module.css";

export function AgreementBuilderSummary({
  agreement,
  commercialOffer,
}: Readonly<{
  agreement: BuilderAgreement;
  commercialOffer?: AgreementBuilderDraftContent["commercialOffer"];
}>): React.JSX.Element {
  const share = commercialOffer?.spec.revenueShare;
  return (
    <dl className={styles.summaryList}>
      <div>
        <dt>Client outcome</dt>
        <dd>{agreement.goals || "Needs review"}</dd>
      </div>
      <div>
        <dt>Deliverables</dt>
        <dd>{agreement.scope || "Needs review"}</dd>
      </div>
      <div>
        <dt>Boundaries and acceptance</dt>
        <dd>{agreement.terms || "Needs review"}</dd>
      </div>
      <div>
        <dt>Responsibilities and support</dt>
        <dd>
          {agreement.responsibilities || "Needs review"}
          <br />
          {agreement.support}
        </dd>
      </div>
      <div>
        <dt>Service fees</dt>
        <dd>
          {agreement.lines?.map((line, index) => (
            <p key={index}>
              {line.description}:{" "}
              {line.recurrenceMonths > 0 &&
              commercialOffer &&
              commercialOffer.spec.cash?.mode !== "fixed"
                ? commercialOffer.spec.cash
                  ? "Amount proposed by client"
                  : "Covered by revenue share"
                : formatGbp(totalLinePence(line), agreement.currency)}
              {line.recurrenceMonths > 0
                ? ` every ${line.recurrenceMonths} month(s)`
                : " one-off"}
              {` · from ${line.startDate}`}
              {line.endDate ? ` to ${line.endDate}` : ""}
            </p>
          ))}
        </dd>
      </div>
      <div>
        <dt>Payment schedule</dt>
        <dd>
          {agreement.installments?.length
            ? agreement.installments.map((item, index) => (
                <p key={index}>
                  {formatGbp(item.amountPence, agreement.currency)} due{" "}
                  {item.dueDate}
                </p>
              ))
            : "No one-off installments."}
        </dd>
      </div>
      <div>
        <dt>Payment terms</dt>
        <dd>
          {formatGbp(agreement.requiredDepositPence, agreement.currency)}{" "}
          deposit.
          {` Minimum term: ${agreement.minimumTermMonths ?? 0} months. Notice: ${agreement.noticeDays ?? 0} days.`}
          <br />
          {agreement.taxTreatment}
        </dd>
      </div>
      {commercialOffer ? (
        <div>
          <dt>Ongoing choices</dt>
          <dd>
            {commercialOffer.spec.cash?.mode === "client_proposed"
              ? "Client proposes the recurring amount for staff approval."
              : commercialOffer.spec.cash
                ? "Recurring amounts are fixed."
                : "Revenue share only."}
            {share ? (
              <>
                <p>
                  {share.mode === "fixed"
                    ? `${(share.percentageBps / 100).toFixed(2)}% revenue share`
                    : "Client proposes revenue share, minimum 10%."}
                </p>
                <p>
                  Revenue source: {share.revenueSource}
                  <br />
                  Calculation: {share.calculationBasis}
                  <br />
                  Duration: {share.duration}
                  <br />
                  Reporting: {share.reportingRequirements}
                  <br />
                  Payment: {share.paymentTerms}
                </p>
              </>
            ) : null}
            <p>Offer expires {commercialOffer.expiresAt}.</p>
          </dd>
        </div>
      ) : null}
      <div>
        <dt>Billing contact and signers</dt>
        <dd>
          {agreement.billingContact}
          <br />
          {agreement.signatories?.join(", ")}
        </dd>
      </div>
    </dl>
  );
}
