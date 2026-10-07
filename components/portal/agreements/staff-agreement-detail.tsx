import { SigningForm } from "@/components/operations/signing/signing-form";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
import {
  Notice,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import { formatMoney } from "@/lib/operations/money";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import {
  AgreementStatusCard,
  toPortalAgreementStatus,
  hasCompleteSigningEvidence,
} from "./presentation";
import styles from "./agreements.module.css";

export function StaffAgreementDetail({
  organisationId,
  record,
  signingCommandEndpoint,
  signingApproval,
  signingDownloadBase,
  signingSuccessRedirect,
}: Readonly<{
  organisationId: string;
  record: AgreementRecord;
  signingCommandEndpoint?: string;
  signingApproval?: SigningApproval | null;
  signingDownloadBase?: string;
  signingSuccessRedirect?: string;
}>): React.JSX.Element {
  const currentApproval =
    signingApproval?.agreementId === record.id &&
    signingApproval.revision === record.revision
      ? signingApproval
      : null;
  const openApproval =
    currentApproval &&
    (currentApproval.status === "prepared" ||
      currentApproval.status === "approved")
      ? currentApproval
      : null;
  const completedSigning =
    currentApproval && hasCompleteSigningEvidence(currentApproval)
      ? currentApproval
      : null;
  const manualEvidence = record.status === "signed" && record.evidence !== null;
  const signed = manualEvidence || completedSigning !== null;
  const workspaceHref = portalPath(
    `/portal/admin/clients/${encodeURIComponent(organisationId)}/agreements`,
  );
  const evidenceLabel = completedSigning
    ? "Authenticated portal electronic signature evidence"
    : "Manual founder-confirmed evidence";

  return (
    <article className={styles.detail}>
      <div className={styles.detailStatus}>
        <StatusBadge status={signed ? "success" : "warning"}>
          {signed
            ? "Signed"
            : openApproval?.status === "prepared"
              ? "Ready to publish"
              : openApproval?.status === "approved"
                ? "Open for signing"
                : "Draft"}
        </StatusBadge>
        <span>Revision {record.revision}</span>
      </div>
      {signed ? (
        <Notice tone="success">
          <strong>
            {completedSigning
              ? "Both signatures are complete."
              : "Signed and recorded."}
          </strong>
          <p>
            {evidenceLabel} is retained for this exact revision. Service
            activation remains a separate operational step.
          </p>
        </Notice>
      ) : openApproval ? (
        <Notice
          tone="info"
          action={
            signingSuccessRedirect ? (
              <PortalActionLink href={signingSuccessRedirect}>
                {openApproval.status === "prepared"
                  ? "Review and publish for signing"
                  : "View signing progress"}
              </PortalActionLink>
            ) : undefined
          }
        >
          <strong>
            {openApproval.status === "prepared"
              ? "Ready for your review."
              : "Published for signing."}
          </strong>
          <p>
            {openApproval.status === "prepared"
              ? "Review the prepared PDF and named signers, then approve it to make it visible in the client portal."
              : "The named signers can now open this agreement in their client portal. Publishing does not record a signature."}
          </p>
        </Notice>
      ) : (
        <Notice tone="warning">
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
            <dd>
              {signed ? evidenceLabel : "No signing evidence is recorded."}
            </dd>
          </div>
        </dl>
      </PortalCard>
      <PortalCard title="Fees and service lines">
        <ul className={styles.schedule}>
          {record.draft.lines.map((line, index) => (
            <li key={`${line.serviceCode}-${index}`}>
              <span>{line.description}</span>
              <span>
                {record.draft.revenueShare && line.recurrenceMonths
                  ? "Compensated by revenue share"
                  : formatMoney(totalLinePence(line), record.draft.currency)}
              </span>
            </li>
          ))}
        </ul>
      </PortalCard>
      {completedSigning ? (
        <PortalCard title="Signing record">
          <dl className={styles.summaryList}>
            {completedSigning.signatures.map((signature) => (
              <div key={signature.email}>
                <dt>{signature.email}</dt>
                <dd>
                  {signature.typedName} ·{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "Europe/London",
                  }).format(new Date(signature.signedAt))}
                </dd>
              </div>
            ))}
            <div>
              <dt>Retained signed document</dt>
              <dd>
                Verified signing evidence and the exact approved source are
                retained.
              </dd>
            </div>
          </dl>
          {signingDownloadBase ? (
            <div className={styles.actionRow}>
              <PortalActionLink
                href={`${signingDownloadBase}/signed`}
                variant="secondary"
              >
                Open signed copy
              </PortalActionLink>
              <PortalActionLink
                href={`${signingDownloadBase}/audit`}
                variant="quiet"
              >
                Open signing record
              </PortalActionLink>
            </div>
          ) : null}
        </PortalCard>
      ) : record.evidence ? (
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
      {!openApproval ? (
        <AgreementStatusCard
          status={
            signed
              ? "signed"
              : currentApproval
                ? toPortalAgreementStatus({
                    status: currentApproval.status,
                    allRequiredSignaturesRecorded: false,
                  })
                : "draft"
          }
        />
      ) : null}
      {!signed && !openApproval ? (
        <>
          {signingCommandEndpoint && signingSuccessRedirect ? (
            <PortalCard
              description="Create the retained signing source from this exact revision, then review and approve the named signers in the signing workspace."
              title="Prepare signing"
            >
              <SigningForm
                agreement={{ id: record.id, version: record.version }}
                audience="staff"
                commandEndpoint={signingCommandEndpoint}
                organisationId={organisationId}
                successRedirect={signingSuccessRedirect}
              />
            </PortalCard>
          ) : (
            <Notice tone="info">
              <p>
                Electronic signing is unavailable until the signing feature is
                configured.
              </p>
            </Notice>
          )}
          <PortalCard
            description="Use this only when retained manual evidence is available for every required signer. The server checks its fingerprints against this exact source; this path does not represent provider verification."
            title="Manual evidence"
          >
            <PortalActionLink
              href={`${workspaceHref}/${record.id}/record-signature`}
              variant="secondary"
            >
              Record signed evidence
            </PortalActionLink>
          </PortalCard>
        </>
      ) : null}
      <PortalActionLink href={workspaceHref} variant="secondary">
        Back to agreement workspace
      </PortalActionLink>
    </article>
  );
}
