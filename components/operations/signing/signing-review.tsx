import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import { penceToGbp } from "@/lib/operations/agreements/money-input";
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
}: {
  approval: SigningApproval;
  audience: "founder" | "portal";
  email?: string;
}): React.JSX.Element {
  const d = approval.draft;
  const prefix =
    audience === "founder"
      ? "/api/growth/operations/clients"
      : "/api/portal/organisations";
  const download = `${prefix}/${approval.organisationId}/signing/${approval.id}`;
  const ownSignature = approval.signatures.find(
    (signature) => signature.email === email,
  );
  return (
    <article className={styles.card} aria-labelledby={`title-${approval.id}`}>
      <p>
        Revision {approval.revision} ·{" "}
        <span className={ui.statusChip}>{statusLabels[approval.status]}</span>
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
            "Required deposit": `£${penceToGbp(d.requiredDepositPence)}`,
            "Client assets": d.assetsRequired ? "Required" : "Not required",
          }).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <h3>Services and charges</h3>
        {d.lines.map((line, index) => (
          <section key={index}>
            <h4>{line.description}</h4>
            <p>
              {line.serviceCode} · {line.quantity} × £
              {penceToGbp(line.unitPence)} · Discount £
              {penceToGbp(line.discountPence)} · Tax £
              {penceToGbp(line.taxPence)}
            </p>
            <p>
              Total £{penceToGbp(totalLinePence(line))},{" "}
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
                £{penceToGbp(item.amountPence)} due {item.dueDate}
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
      {audience === "founder" ? (
        <SigningForm
          organisationId={approval.organisationId}
          approval={approval}
          audience={audience}
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
