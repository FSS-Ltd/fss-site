import {
  Notice,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { formatMoney } from "@/lib/operations/money";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import {
  clientSigningProgress,
  hasCompleteSigningEvidence,
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

function formatSignedAt(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    timeZone: "Europe/London",
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value));
}

function SigningRecord({
  approval,
}: Readonly<{
  approval: SigningApproval;
}>): React.JSX.Element | null {
  if (!hasCompleteSigningEvidence(approval)) return null;

  const signatures = approval.requiredSigners.flatMap((requiredSigner) => {
    const signature = approval.signatures.find(
      (candidate) => candidate.email === requiredSigner,
    );
    return signature ? [signature] : [];
  });

  return (
    <PortalCard title="Your record">
      <ul className={styles.schedule}>
        {signatures.map((signature) => (
          <li key={`${signature.email}-${signature.signedAt}`}>
            <span>{signature.typedName}</span>
            <time dateTime={signature.signedAt}>
              Signed {formatSignedAt(signature.signedAt)}
            </time>
          </li>
        ))}
      </ul>
      <dl className={styles.summaryList}>
        <div>
          <dt>Retained copy</dt>
          <dd>
            The signed version and its source revision remain available in
            Agreements.
          </dd>
        </div>
      </dl>
    </PortalCard>
  );
}

function CompletionNotice({
  approval,
  ownSignature,
  email,
}: Readonly<{
  approval: SigningApproval;
  email: string;
  ownSignature: SigningApproval["signatures"][number] | undefined;
}>): React.JSX.Element | null {
  if (hasCompleteSigningEvidence(approval)) {
    return (
      <Notice
        action={
          <PortalActionLink
            href={downloadPath(approval, "signed")}
            variant="secondary"
          >
            Download signed agreement
          </PortalActionLink>
        }
        tone="success"
      >
        <strong>Your signed agreement is ready.</strong>
        <p>
          Revision {approval.revision}. All required parties have signed this
          agreement.
        </p>
      </Notice>
    );
  }

  if (clientSigningProgress(approval, email) === "processing") {
    return (
      <Notice tone="info">
        <strong>Preparing your signed agreement.</strong>
        <p>
          All required signatures are recorded. Your final copy will appear here
          when processing is complete.
        </p>
      </Notice>
    );
  }
  if (ownSignature && approval.status === "approved") {
    return (
      <Notice tone="info">
        <strong>
          Your signature is recorded, awaiting the remaining signers.
        </strong>
        <p>
          We will retain the signed copy once every required signature has been
          verified.
        </p>
      </Notice>
    );
  }

  if (clientSigningProgress(approval, email) === "ready") {
    return (
      <Notice
        action={
          <PortalActionLink
            href={agreementPath(approval.id, approval.organisationId, "/sign")}
          >
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

  if (approval.status === "approved") {
    return (
      <Notice tone="info">
        <strong>Waiting for the named signers.</strong>
        <p>No signature is needed from your account for this revision.</p>
      </Notice>
    );
  }

  if (approval.status === "prepared") {
    return (
      <Notice tone="info">
        <strong>This revision is not yet open for signing.</strong>
        <p>FSS is reviewing the exact document and named signers.</p>
      </Notice>
    );
  }

  if (approval.status === "completed") {
    return (
      <Notice tone="info">
        <strong>Signing evidence is being reviewed.</strong>
        <p>
          The signed copy will appear when every required signature is verified.
        </p>
      </Notice>
    );
  }

  return (
    <Notice tone="info">
      <strong>This signing request is closed.</strong>
      <p>Contact FSS if you need a revised agreement.</p>
    </Notice>
  );
}

export function ClientAgreementDetail({
  approval,
  email,
}: ClientAgreementDetailProps): React.JSX.Element {
  const formatGbp = (amount: string): string =>
    formatMoney(amount, approval.draft.currency);
  const complete = hasCompleteSigningEvidence(approval);
  const ownSignature = approval.signatures.find(
    (signature) => signature.email.toLowerCase() === email.trim().toLowerCase(),
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
      <CompletionNotice
        approval={approval}
        ownSignature={ownSignature}
        email={email}
      />
      <div className={styles.metrics} aria-label="Agreement financial summary">
        <PortalCard title="One-off total">
          <p className={styles.metric}>{formatGbp(oneOff)}</p>
        </PortalCard>
        <PortalCard title="Initial deposit">
          <p className={styles.metric}>
            {formatGbp(approval.draft.requiredDepositPence)}
          </p>
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
      {approval.draft.revenueShare ? (
        <PortalCard title="Ongoing revenue share">
          <p>
            {(approval.draft.revenueShare.percentageBps / 100).toFixed(2)}% of{" "}
            {approval.draft.revenueShare.revenueSource}
          </p>
          <p>{approval.draft.revenueShare.calculationBasis}</p>
          <p>Duration: {approval.draft.revenueShare.duration}</p>
          <p>Reporting: {approval.draft.revenueShare.reportingRequirements}</p>
          <p>Payment terms: {approval.draft.revenueShare.paymentTerms}</p>
          <p>
            The setup fee remains payable. Revenue share replaces recurring cash
            charges.
          </p>
        </PortalCard>
      ) : null}
      <PortalCard title="Payment schedule">
        {approval.draft.installments.length ? (
          <ul className={styles.schedule}>
            {approval.draft.installments.map((installment) => (
              <li key={`${installment.dueDate}-${installment.amountPence}`}>
                <span>{formatGbp(installment.amountPence)}</span>
                <time dateTime={installment.dueDate}>
                  {formatDate(installment.dueDate)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>
            No one-off payment schedule is recorded.
          </p>
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
          <PortalActionLink
            href={downloadPath(approval, "source")}
            variant="secondary"
          >
            Download agreement PDF
          </PortalActionLink>
          {complete ? (
            <PortalActionLink
              href={downloadPath(approval, "audit")}
              variant="quiet"
            >
              Download signing record
            </PortalActionLink>
          ) : null}
        </div>
      </PortalCard>
      <SigningRecord approval={approval} />
      {complete ? (
        <Notice
          action={
            <PortalActionLink
              href={`${portalPath("/portal/getting-started")}?organisationId=${encodeURIComponent(approval.organisationId)}`}
              variant="secondary"
            >
              Continue setup
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
