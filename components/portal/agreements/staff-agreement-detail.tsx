import type { AgreementRecord } from "@/lib/operations/agreements/types";
import {
  Notice,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import { penceToGbp } from "@/lib/operations/agreements/money-input";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import { AgreementStatusCard } from "./presentation";
import styles from "./agreements.module.css";

export function StaffAgreementDetail({
  organisationId,
  record,
}: Readonly<{
  organisationId: string;
  record: AgreementRecord;
}>): React.JSX.Element {
  const signed = record.status === "signed" && record.evidence !== null;
  const workspaceHref = `/admin/clients/${encodeURIComponent(organisationId)}/agreements`;
  const evidenceLabel =
    record.evidenceProvenance === "authenticated_portal_electronic_signature"
      ? "Authenticated portal electronic signature evidence"
      : "Manual founder-confirmed evidence";

  return (
    <article className={styles.detail}>
      <div className={styles.detailStatus}>
        <StatusBadge status={signed ? "success" : "warning"}>
          {signed ? "Signed" : "Draft"}
        </StatusBadge>
        <span>Revision {record.revision}</span>
      </div>
      {signed ? (
        <Notice tone="success">
          <strong>Signed and recorded.</strong>
          <p>
            {evidenceLabel} is retained for this exact revision. Service
            activation remains a separate operational step.
          </p>
        </Notice>
      ) : (
        <Notice
          action={
            <PortalActionLink href={workspaceHref}>Continue draft</PortalActionLink>
          }
          tone="warning"
        >
          <strong>This agreement is still a draft.</strong>
          <p>
            Approval is not signature. Prepare and review the exact signing
            document before opening it for the required signers.
          </p>
        </Notice>
      )}
      <PortalCard title="Agreement summary">
        <dl className={styles.summaryList}>
          <div>
            <dt>Scope</dt>
            <dd>{record.draft.scope}</dd>
          </div>
          <div>
            <dt>Responsibilities</dt>
            <dd>{record.draft.responsibilities}</dd>
          </div>
          <div>
            <dt>Required signers</dt>
            <dd>{record.draft.signatories.join(", ")}</dd>
          </div>
          <div>
            <dt>Evidence provenance</dt>
            <dd>{signed ? evidenceLabel : "No signing evidence is recorded."}</dd>
          </div>
        </dl>
      </PortalCard>
      <PortalCard title="Fees and service lines">
        <ul className={styles.schedule}>
          {record.draft.lines.map((line, index) => (
            <li key={`${line.serviceCode}-${index}`}>
              <span>{line.description}</span>
              <span>£{penceToGbp(totalLinePence(line))}</span>
            </li>
          ))}
        </ul>
      </PortalCard>
      {record.evidence ? (
        <PortalCard title="Retained evidence">
          <dl className={styles.summaryList}>
            <div>
              <dt>Completed</dt>
              <dd>{record.evidence.signedDate}</dd>
            </div>
            <div>
              <dt>Signatories</dt>
              <dd>{record.evidence.signatories.join(", ")}</dd>
            </div>
            <div>
              <dt>Signed document fingerprint</dt>
              <dd>{record.evidence.signedDocumentHash}</dd>
            </div>
          </dl>
        </PortalCard>
      ) : null}
      <AgreementStatusCard status={signed ? "signed" : "draft"} />
      <PortalActionLink href={workspaceHref} variant="secondary">
        Back to agreement workspace
      </PortalActionLink>
    </article>
  );
}
