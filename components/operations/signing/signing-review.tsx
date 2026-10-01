import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import { formatMoney } from "@/lib/operations/money";
import { SigningForm } from "./signing-form";
import ui from "../shared/operations-ui.module.css";
import signingStyles from "./signing.module.css";
import styles from "../agreements/agreements.module.css";
const statusLabels: Record<SigningApproval["status"], string> = {
  prepared: "Ready for founder review",
  approved: "Open for signing",
  completed: "Signed and complete",
  declined: "Declined",
  cancelled: "Cancelled",
  superseded: "Replaced by a newer revision",
  expired: "Signing deadline passed",
};
export function SigningReview({
  approval,
  audience,
  email,
  commandEndpoint,
  downloadBase,
}: {
  approval: SigningApproval;
  audience: "founder" | "staff" | "portal";
  email?: string;
  commandEndpoint?: string;
  downloadBase?: string;
}): React.JSX.Element {
  const d = approval.draft;
  const prefix =
    audience === "portal"
      ? "/api/portal/organisations"
      : "/api/growth/operations/clients";
  const download =
    downloadBase ??
    `${prefix}/${approval.organisationId}/signing/${approval.id}`;
  const ownSignature = approval.signatures.find(
    (signature) => signature.email === email,
  );
  const statusLabel =
    audience === "staff" && approval.status === "prepared"
      ? "Ready for FSS Studio review"
      : statusLabels[approval.status];
  return (
    <article className={styles.card} aria-labelledby={`title-${approval.id}`}>
      <p>
        Revision {approval.revision} ·{" "}
        <span className={ui.statusChip}>{statusLabel}</span>
      </p>
      <h2 id={`title-${approval.id}`}>{approval.title}</h2>
      <p>For {approval.organisationLegalName}</p>
      <p>Service provider: Faithful Software Solutions Ltd</p>
      {approval.expiresAt && (
        <p>Signing closes {new Date(approval.expiresAt).toUTCString()}.</p>
      )}
      <p className={styles.actions}>
        <a href={`${download}/source`}>Download agreement PDF</a>
        {approval.status === "completed" && (
          <>
            <a href={`${download}/signed`}>Download signed PDF</a>
            <a href={`${download}/audit`}>Download signing record</a>
          </>
        )}
      </p>
      <details>
        <summary>Read the complete agreement</summary>
        <dl className={styles.facts}>
          {Object.entries({
            Scope: d.scope,
            Goals: d.goals,
            Terms: d.terms,
            Support: d.support,
            Responsibilities: d.responsibilities,
            "Billing contact": d.billingContact,
            Currency: d.currency,
            "Tax treatment": d.taxTreatment,
            "Notice period": `${d.noticeDays} days`,
            "Minimum term": `${d.minimumTermMonths} months`,
            "Required deposit": formatMoney(d.requiredDepositPence, d.currency),
            "Client assets": d.assetsRequired ? "Required" : "Not required",
          }).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {d.revenueShare ? (
          <section>
            <h3>Ongoing revenue share</h3>
            <p>
              {(d.revenueShare.percentageBps / 100).toFixed(2)}% of{" "}
              {d.revenueShare.revenueSource}
            </p>
            <p>{d.revenueShare.calculationBasis}</p>
            <p>{d.revenueShare.duration}</p>
            <p>{d.revenueShare.reportingRequirements}</p>
            <p>{d.revenueShare.paymentTerms}</p>
          </section>
        ) : null}
        <h3>Services and charges</h3>
        {d.lines.map((line, index) => (
          <section key={index}>
            <h4>{line.description}</h4>
            <p>
              {line.serviceCode} · {line.quantity} ×{" "}
              {formatMoney(line.unitPence, d.currency)} · Discount{" "}
              {formatMoney(line.discountPence, d.currency)} · Tax{" "}
              {formatMoney(line.taxPence, d.currency)}
            </p>
            <p>
              Total {formatMoney(totalLinePence(line), d.currency)},{" "}
              {line.recurrenceMonths === 0
                ? "one-off"
                : `every ${line.recurrenceMonths} month(s)`}
              . From {line.startDate}
              {line.endDate ? ` until ${line.endDate}` : ", no end date"}.
            </p>
          </section>
        ))}
        <h3>One-off installments</h3>
        {d.installments.length ? (
          <ul>
            {d.installments.map((item, index) => (
              <li key={index}>
                {formatMoney(item.amountPence, d.currency)} due {item.dueDate}
              </li>
            ))}
          </ul>
        ) : (
          <p>No one-off installments.</p>
        )}
      </details>
      <h3>Required signers</h3>
      <ul className={signingStyles.signers} role="list">
        {approval.requiredSigners.map((signer) => {
          const signature = approval.signatures.find(
            (item) => item.email === signer,
          );
          return (
            <li key={signer}>
              {signer}:{" "}
              <span className={ui.statusChip}>
                {signature
                  ? `signed as ${signature.typedName} on ${new Date(signature.signedAt).toUTCString()}`
                  : "awaiting signature"}
              </span>
            </li>
          );
        })}
      </ul>
      {approval.status === "approved" &&
        approval.signatures.length === approval.requiredSigners.length && (
          <p role="status">
            All signatures are recorded. Preparing your final documents.
          </p>
        )}
      {audience !== "portal" ? (
        <SigningForm
          organisationId={approval.organisationId}
          approval={approval}
          audience={audience}
          commandEndpoint={commandEndpoint}
        />
      ) : approval.status === "approved" && !ownSignature ? (
        <>
          <p>You are signing as {email}.</p>
          <SigningForm
            organisationId={approval.organisationId}
            approval={approval}
            audience={audience}
          />
        </>
      ) : (
        ownSignature && (
          <p>
            Your signature has been recorded.
            {approval.status === "approved"
              ? " Waiting for the remaining signatures and document processing."
              : ""}
          </p>
        )
      )}
      <details>
        <summary>Document verification</summary>
        <p>Source SHA-256: {approval.sourceHash}</p>
        <p>Approval SHA-256: {approval.approvalHash}</p>
      </details>
    </article>
  );
}
