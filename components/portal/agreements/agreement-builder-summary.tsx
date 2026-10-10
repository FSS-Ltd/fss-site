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
  const lines = agreement.lines ?? [];
  const oneOffLines = lines.filter((line) => line.recurrenceMonths === 0);
  const recurringLines = lines.filter((line) => line.recurrenceMonths > 0);
  const fixedRecurringLines =
    !commercialOffer || commercialOffer.spec.cash?.mode === "fixed"
      ? recurringLines
      : [];
  const clientProposedLines =
    commercialOffer?.spec.cash?.mode === "client_proposed"
      ? recurringLines
      : [];
  const revenueShareLines =
    commercialOffer && commercialOffer.spec.cash === null && share
      ? recurringLines
      : [];
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
        <dt>One-off fees</dt>
        <dd>
          {oneOffLines.length
            ? oneOffLines.map((line, index) => (
                <p key={index}>
                  {line.description}:{" "}
                  {formatGbp(totalLinePence(line), agreement.currency)}
                  {` · from ${line.startDate}`}
                  {line.endDate ? ` to ${line.endDate}` : ""}
                </p>
              ))
            : "No one-off fee included."}
        </dd>
      </div>
      {fixedRecurringLines.length ? (
        <div>
          <dt>Fixed recurring services</dt>
          <dd>
            {fixedRecurringLines.map((line, index) => (
              <p key={index}>
                {line.description}:{" "}
                {formatGbp(totalLinePence(line), agreement.currency)}
                {` every ${line.recurrenceMonths} month(s) · from ${line.startDate}`}
                {line.endDate ? ` to ${line.endDate}` : ""}
              </p>
            ))}
          </dd>
        </div>
      ) : null}
      {clientProposedLines.length ? (
        <div>
          <dt>Client-proposed monthly services</dt>
          <dd>
            {clientProposedLines.map((line, index) => (
              <p key={index}>
                {line.description}: amount proposed by the client monthly
                {` · from ${line.startDate}`}
                {line.endDate ? ` to ${line.endDate}` : ""}
              </p>
            ))}
          </dd>
        </div>
      ) : null}
      {revenueShareLines.length ? (
        <div>
          <dt>Services covered by revenue share</dt>
          <dd>
            {revenueShareLines.map((line) => line.description).join(", ")}
          </dd>
        </div>
      ) : null}
      <div>
        <dt>One-off payment schedule</dt>
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
              ? "Client proposes the monthly recurring amount for staff approval."
              : commercialOffer.spec.cash
                ? "Recurring service amounts are fixed."
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
