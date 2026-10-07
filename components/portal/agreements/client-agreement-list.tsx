import {
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import {
  hasCompleteSigningEvidence,
  clientSigningProgress,
  toPortalAgreementStatus,
} from "./presentation";
import styles from "./agreements.module.css";

type AgreementListProps = Readonly<{
  approvals: readonly SigningApproval[];
  organisationId: string;
  email: string;
}>;

function agreementHref(approvalId: string, organisationId: string): string {
  const query = new URLSearchParams({ organisationId });
  return `${portalPath(`/portal/agreements/${approvalId}`)}?${query.toString()}`;
}

function statusLabel(approval: SigningApproval, email: string): string {
  const progress = clientSigningProgress(approval, email);
  if (progress === "processing") return "Preparing signed copy";
  if (progress === "recorded") return "Your signature is recorded";
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
  email,
}: Readonly<{
  approval: SigningApproval;
  organisationId: string;
  email: string;
}>): React.JSX.Element {
  const complete = hasCompleteSigningEvidence(approval);
  const status = toPortalAgreementStatus({
    allRequiredSignaturesRecorded: complete,
    status: approval.status,
  });
  const progress = clientSigningProgress(approval, email);
  const tone =
    progress === "processing" || progress === "recorded"
      ? "info"
      : status === "signed"
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
          <StatusBadge status={tone}>
            {statusLabel(approval, email)}
          </StatusBadge>
        </div>
        <p className={styles.muted}>
          {approval.organisationLegalName} · {approval.requiredSigners.length}{" "}
          required{" "}
          {approval.requiredSigners.length === 1 ? "signer" : "signers"}
        </p>
        <PortalActionLink
          href={agreementHref(approval.id, organisationId)}
          variant={progress === "ready" ? "primary" : "secondary"}
        >
          {progress === "ready" ? "Review agreement" : "View agreement"}
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
  email,
  title,
}: Readonly<{
  approvals: readonly SigningApproval[];
  description: string;
  empty: string;
  organisationId: string;
  email: string;
  title: string;
}>): React.JSX.Element {
  return (
    <section
      className={styles.group}
      aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}
    >
      <div className={styles.groupHeading}>
        <div>
          <h2 id={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}>
            {title}
          </h2>
          <p>{description}</p>
        </div>
        <span aria-label={`${approvals.length} agreements`}>
          {approvals.length}
        </span>
      </div>
      {approvals.length ? (
        <ul className={styles.agreementList}>
          {approvals.map((approval) => (
            <AgreementRow
              approval={approval}
              key={approval.id}
              organisationId={organisationId}
              email={email}
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
  email,
}: AgreementListProps): React.JSX.Element {
  if (approvals.length === 0) {
    return (
      <PortalCard title="No agreements shared yet">
        <p className={styles.prose}>
          Your agreement will appear here after FSS has reviewed and published
          it for signing. No action is needed from you yet.
        </p>
      </PortalCard>
    );
  }
  const actionNeeded = approvals.filter(
    (approval) => clientSigningProgress(approval, email) === "ready",
  );
  const signed = approvals.filter(hasCompleteSigningEvidence);
  const inProgress = approvals.filter((approval) =>
    ["recorded", "processing"].includes(clientSigningProgress(approval, email)),
  );
  const archived = approvals.filter(
    (approval) =>
      !actionNeeded.includes(approval) &&
      !signed.includes(approval) &&
      !inProgress.includes(approval),
  );

  return (
    <div className={styles.listPage}>
      <AgreementGroup
        approvals={actionNeeded}
        description="Review the exact version before you sign. Viewing an agreement does not record consent."
        empty="There are no agreements waiting for your signature."
        organisationId={organisationId}
        email={email}
        title="Action needed"
      />
      {inProgress.length ? (
        <AgreementGroup
          approvals={inProgress}
          description="Your part is complete. Follow the remaining signatures and final document here."
          empty=""
          organisationId={organisationId}
          email={email}
          title="In progress"
        />
      ) : null}
      <AgreementGroup
        approvals={signed}
        description="Retained signed copies remain available here."
        empty="No signed agreements are available yet."
        organisationId={organisationId}
        email={email}
        title="Signed agreements"
      />
      {archived.length ? (
        <AgreementGroup
          approvals={archived}
          description="These versions cannot be signed."
          empty=""
          organisationId={organisationId}
          email={email}
          title="Archived agreements"
        />
      ) : null}
    </div>
  );
}
