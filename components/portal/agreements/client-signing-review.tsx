import { SigningForm } from "@/components/operations/signing/signing-form";
import { Notice, PortalActionLink, PortalCard } from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import {
  hasCompleteSigningEvidence,
  clientSigningProgress,
} from "./presentation";
import styles from "./agreements.module.css";

type ClientSigningReviewProps = Readonly<{
  approval: SigningApproval;
  email: string;
  organisationId: string;
  signerName?: string;
}>;

function agreementPath(approvalId: string, organisationId: string): string {
  const query = new URLSearchParams({ organisationId });
  return `${portalPath(`/portal/agreements/${approvalId}`)}?${query.toString()}`;
}

function sourceDownloadPath(approval: SigningApproval): string {
  return `/api/portal/organisations/${encodeURIComponent(approval.organisationId)}/signing/${encodeURIComponent(approval.id)}/source`;
}

export function ClientSigningReview({
  approval,
  email,
  organisationId,
  signerName,
}: ClientSigningReviewProps): React.JSX.Element {
  const normalisedEmail = email.trim().toLowerCase();
  const ownSignature = approval.signatures.find(
    (signature) => signature.email.toLowerCase() === normalisedEmail,
  );
  const isNamedSigner = approval.requiredSigners.some(
    (signer) => signer.toLowerCase() === normalisedEmail,
  );
  const complete = hasCompleteSigningEvidence(approval);
  const progress = clientSigningProgress(approval, email);
  const signingOpen = progress === "ready";
  const shownName = signerName?.trim() || normalisedEmail;
  const backHref = agreementPath(approval.id, organisationId);

  return (
    <article className={styles.detail}>
      <PortalCard
        description="The exact document is retained against this revision. Download an accessible copy before taking an action."
        title={`Agreement revision ${approval.revision}`}
      >
        <p className={styles.prose}>{approval.draft.terms}</p>
        <div className={styles.actionRow}>
          <PortalActionLink
            href={sourceDownloadPath(approval)}
            variant="secondary"
          >
            Download agreement PDF
          </PortalActionLink>
          <PortalActionLink href={backHref} variant="quiet">
            Back to agreement
          </PortalActionLink>
        </div>
      </PortalCard>
      <Notice tone="info">
        <strong>
          {isNamedSigner
            ? `Signing as ${shownName}`
            : "Read-only agreement review"}
        </strong>
        <p>
          {isNamedSigner
            ? `You are a designated signer for ${approval.organisationLegalName}. Your verified email is ${normalisedEmail}.`
            : `You can review this agreement for ${approval.organisationLegalName}, but ${normalisedEmail} is not a named signer.`}
        </p>
      </Notice>
      {signingOpen ? (
        <PortalCard
          description="Your signature is recorded only after the approved signing command confirms it."
          title="Your signature"
        >
          <SigningForm
            approval={approval}
            audience="portal"
            organisationId={organisationId}
          />
        </PortalCard>
      ) : progress === "processing" ? (
        <Notice tone="info">
          <strong>Preparing your signed agreement.</strong>
          <p>
            All required signatures are recorded. Return to the agreement for
            your final copy when processing is complete.
          </p>
        </Notice>
      ) : ownSignature && (complete || progress === "recorded") ? (
        <Notice tone={complete ? "success" : "info"}>
          <strong>
            {complete
              ? "Your signed agreement is ready."
              : "Your signature is already recorded."}
          </strong>
          <p>
            {complete
              ? "All required signatures have been retained for this agreement."
              : "We are awaiting the remaining signers before the final document is retained."}
          </p>
        </Notice>
      ) : !isNamedSigner ? (
        <Notice tone="info">
          <strong>No signature is needed from your account.</strong>
          <p>Only the named signers can sign this revision.</p>
        </Notice>
      ) : (
        <Notice tone="warning">
          <strong>This signing request is not open.</strong>
          <p>
            Its current state does not allow another signature. Review the
            agreement or contact FSS for the next step.
          </p>
        </Notice>
      )}
    </article>
  );
}
