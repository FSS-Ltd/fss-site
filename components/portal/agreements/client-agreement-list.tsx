import {
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import {
  hasCompleteSigningEvidence,
  toPortalAgreementStatus,
} from "./presentation";
import styles from "./agreements.module.css";

type AgreementListProps = Readonly<{
  approvals: readonly SigningApproval[];
  organisationId: string;
}>;

function agreementHref(approvalId: string, organisationId: string): string {
  const query = new URLSearchParams({ organisationId });
  return `${portalPath(`/portal/agreements/${approvalId}`)}?${query.toString()}`;
}

function statusLabel(approval: SigningApproval): string {
  const complete = hasCompleteSigningEvidence(approval);
  const status = toPortalAgreementStatus({
    allRequiredSignaturesRecorded: complete,
    status: approval.status,
  });

  if (status === "signed") return "All signatures complete";
  if (status === "awaiting_signature") return "Awaiting signature";
  if (status === "superseded") return "Superseded";
  if (status === "voided") return "Unavailable for signing";
  return "Preparing agreement";
}

function AgreementRow({
  approval,
  organisationId,
}: Readonly<{
  approval: SigningApproval;
  organisationId: string;
}>): React.JSX.Element {
  const complete = hasCompleteSigningEvidence(approval);
  const status = toPortalAgreementStatus({
    allRequiredSignaturesRecorded: complete,
    status: approval.status,
  });
  const tone =
    status === "signed"
      ? "success"
      : status === "awaiting_signature"
        ? "warning"
        : status === "voided"
          ? "error"
          : "neutral";

  return (
    <li>
      <PortalCard className={styles.listCard}>
        <div className={styles.cardHeading}>
          <div>
            <p className={styles.version}>Revision {approval.revision}</p>
            <h3>{approval.title}</h3>
          </div>
          <StatusBadge status={tone}>{statusLabel(approval)}</StatusBadge>
        </div>
        <p className={styles.muted}>
          {approval.organisationLegalName} · {approval.requiredSigners.length} required{" "}
          {approval.requiredSigners.length === 1 ? "signer" : "signers"}
        </p>
        <PortalActionLink
          href={agreementHref(approval.id, organisationId)}
          variant={status === "awaiting_signature" ? "primary" : "secondary"}
        >
          {status === "awaiting_signature" ? "Review agreement" : "View agreement"}
        </PortalActionLink>
      </PortalCard>
    </li>
  );
}

function AgreementGroup({
  approvals,
  description,
  empty,
  organisationId,
  title,
}: Readonly<{
  approvals: readonly SigningApproval[];
  description: string;
  empty: string;
  organisationId: string;
  title: string;
}>): React.JSX.Element {
  return (
    <section className={styles.group} aria-labelledby={`${title}-heading`}>
      <div className={styles.groupHeading}>
        <div>
          <h2 id={`${title}-heading`}>{title}</h2>
          <p>{description}</p>
        </div>
        <span aria-label={`${approvals.length} agreements`}>{approvals.length}</span>
      </div>
      {approvals.length ? (
        <ul className={styles.agreementList}>
          {approvals.map((approval) => (
            <AgreementRow
              approval={approval}
              key={approval.id}
              organisationId={organisationId}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{empty}</p>
      )}
    </section>
  );
}

export function ClientAgreementList({
  approvals,
  organisationId,
}: AgreementListProps): React.JSX.Element {
  const actionNeeded = approvals.filter(
    (approval) =>
      toPortalAgreementStatus({
        allRequiredSignaturesRecorded: hasCompleteSigningEvidence(approval),
        status: approval.status,
      }) === "awaiting_signature",
  );
  const signed = approvals.filter(hasCompleteSigningEvidence);
  const archived = approvals.filter(
    (approval) => !actionNeeded.includes(approval) && !signed.includes(approval),
  );

  return (
    <div className={styles.listPage}>
      <AgreementGroup
        approvals={actionNeeded}
        description="Review the exact version before you sign. Viewing an agreement does not record consent."
        empty="There are no agreements waiting for your signature."
        organisationId={organisationId}
        title="Action needed"
      />
      <AgreementGroup
        approvals={signed}
        description="Retained signed copies remain available here."
        empty="No signed agreements are available yet."
        organisationId={organisationId}
        title="Signed agreements"
      />
      {archived.length ? (
        <AgreementGroup
          approvals={archived}
          description="These versions cannot be signed."
          empty=""
          organisationId={organisationId}
          title="Archived agreements"
        />
      ) : null}
    </div>
  );
}
