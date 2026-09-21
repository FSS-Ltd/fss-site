import {
  Notice,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { penceToGbp } from "@/lib/operations/agreements/money-input";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import {
  AgreementStatusCard,
  hasCompleteSigningEvidence,
  toPortalAgreementStatus,
} from "./presentation";
import styles from "./agreements.module.css";

type ClientAgreementDetailProps = Readonly<{
  approval: SigningApproval;
  email: string;
  organisationId: string;
}>;

function agreementPath(
  approvalId: string,
  organisationId: string,
  suffix = "",
): string {
  const query = new URLSearchParams({ organisationId });
  return `${portalPath(`/portal/agreements/${approvalId}${suffix}`)}?${query.toString()}`;
}

function downloadPath(
  approval: SigningApproval,
  kind: "source" | "signed" | "audit",
): string {
  return `/api/portal/organisations/${encodeURIComponent(approval.organisationId)}/signing/${encodeURIComponent(approval.id)}/${kind}`;
}

function formatGbp(pence: string): string {
  return `£${penceToGbp(pence)}`;
}

function oneOffTotal(approval: SigningApproval): string {
  return approval.draft.lines
    .filter((line) => line.recurrenceMonths === 0)
    .reduce((total, line) => total + BigInt(totalLinePence(line)), BigInt(0))
    .toString();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function CompletionNotice({
  approval,
  ownSignature,
}: Readonly<{
  approval: SigningApproval;
  ownSignature: SigningApproval["signatures"][number] | undefined;
}>): React.JSX.Element | null {
  if (hasCompleteSigningEvidence(approval)) {
    return (
      <Notice
        action={
          <PortalActionLink href={downloadPath(approval, "signed")} variant="secondary">
            Download signed agreement
          </PortalActionLink>
        }
        tone="success"
      >
        <strong>Your signed agreement is ready.</strong>
        <p>
          Revision {approval.revision}. All required parties have signed this agreement.
        </p>
      </Notice>
    );
  }

  if (ownSignature) {
    return (
      <Notice tone="info">
        <strong>Your signature is recorded, awaiting the remaining signers.</strong>
        <p>
          We will retain the signed copy once every required signature has been
          verified.
        </p>
      </Notice>
    );
  }

  if (approval.status === "approved") {
    return (
      <Notice
        action={
          <PortalActionLink href={agreementPath(approval.id, approval.organisationId, "/sign")}>
            Continue to signing
          </PortalActionLink>
        }
        tone="warning"
      >
        <strong>Your signature is needed.</strong>
        <p>
          You will review and sign this exact revision with your verified email.
        </p>
      </Notice>
    );
  }

  return null;
}

export function ClientAgreementDetail({
  approval,
  email,
}: ClientAgreementDetailProps): React.JSX.Element {
  const complete = hasCompleteSigningEvidence(approval);
  const status = toPortalAgreementStatus({
    allRequiredSignaturesRecorded: complete,
    status: approval.status,
  });
  const ownSignature = approval.signatures.find(
    (signature) => signature.email === email.trim().toLowerCase(),
  );
  const oneOff = oneOffTotal(approval);
  const milestones = approval.draft.installments.length;

  return (
    <article className={styles.detail}>
      <div className={styles.detailStatus}>
        <StatusBadge status={complete ? "success" : "info"}>
          Revision {approval.revision}
        </StatusBadge>
        <span>{approval.organisationLegalName}</span>
      </div>
      <CompletionNotice approval={approval} ownSignature={ownSignature} />
      <div className={styles.metrics} aria-label="Agreement financial summary">
        <PortalCard title="One-off total">
          <p className={styles.metric}>{formatGbp(oneOff)}</p>
        </PortalCard>
        <PortalCard title="Initial deposit">
          <p className={styles.metric}>{formatGbp(approval.draft.requiredDepositPence)}</p>
        </PortalCard>
        <PortalCard title="Delivery milestones">
          <p className={styles.metric}>{milestones}</p>
        </PortalCard>
      </div>
      <PortalCard
        description="This summary helps you review the version. The retained agreement remains the governing document."
        title="At a glance"
      >
        <dl className={styles.summaryList}>
          <div>
            <dt>What we will deliver</dt>
            <dd>{approval.draft.scope}</dd>
          </div>
          <div>
            <dt>What you provide</dt>
            <dd>{approval.draft.responsibilities}</dd>
          </div>
          <div>
            <dt>Payment schedule</dt>
            <dd>
              {milestones
                ? `${formatGbp(approval.draft.requiredDepositPence)} deposit and ${milestones} recorded ${milestones === 1 ? "payment" : "payments"}. ${approval.draft.taxTreatment}`
                : `Payment terms are recorded in the agreement. ${approval.draft.taxTreatment}`}
            </dd>
          </div>
          <div>
            <dt>Support &amp; changes</dt>
            <dd>{approval.draft.support}</dd>
          </div>
        </dl>
      </PortalCard>
      <PortalCard title="Payment schedule">
        {approval.draft.installments.length ? (
          <ul className={styles.schedule}>
            {approval.draft.installments.map((installment) => (
              <li key={`${installment.dueDate}-${installment.amountPence}`}>
                <span>{formatGbp(installment.amountPence)}</span>
                <time dateTime={installment.dueDate}>{formatDate(installment.dueDate)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No one-off payment schedule is recorded.</p>
        )}
      </PortalCard>
      <PortalCard title="Parties and responsibilities">
        <dl className={styles.summaryList}>
          <div>
            <dt>Client</dt>
            <dd>{approval.organisationLegalName}</dd>
          </div>
          <div>
            <dt>Service provider</dt>
            <dd>Faithful Software Solutions Ltd</dd>
          </div>
          <div>
            <dt>Required signers</dt>
            <dd>{approval.requiredSigners.join(", ")}</dd>
          </div>
          <div>
            <dt>Billing contact</dt>
            <dd>{approval.draft.billingContact}</dd>
          </div>
        </dl>
      </PortalCard>
      <PortalCard title="Full agreement">
        <p className={styles.prose}>{approval.draft.terms}</p>
        <p className={styles.prose}>{approval.draft.goals}</p>
        <div className={styles.actionRow}>
          <PortalActionLink href={downloadPath(approval, "source")} variant="secondary">
            Download agreement PDF
          </PortalActionLink>
          {complete ? (
            <PortalActionLink href={downloadPath(approval, "audit")} variant="quiet">
              Download signing record
            </PortalActionLink>
          ) : null}
        </div>
      </PortalCard>
      <AgreementStatusCard status={status} />
      {complete ? (
        <Notice
          action={
            <PortalActionLink href={agreementPath(approval.id, approval.organisationId)} variant="secondary">
              View agreement
            </PortalActionLink>
          }
          tone="info"
        >
          <strong>What happens next</strong>
          <p>
            Return to getting started for the remaining setup tasks. Billing and
            access follow the approved welcome sequence.
          </p>
        </Notice>
      ) : null}
    </article>
  );
}
