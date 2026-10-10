import type { StaffAgreementOverviewRow } from "@/lib/operations/agreements/repository";
import type { StaffSigningReadiness } from "@/lib/operations/agreements/signing-repository";
import { portalPath } from "@/lib/operations/auth/portal-url";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import styles from "./staff-agreement-overview.module.css";

type StaffAgreementOverviewProps = Readonly<{
  agreements: readonly StaffAgreementOverviewRow[];
  signingReadiness: readonly StaffSigningReadiness[];
}>;

function agreementWorkspaceHref(organisationId: string): string {
  return portalPath(
    `/portal/admin/clients/${encodeURIComponent(organisationId)}/agreements`,
  );
}

function signingWorkspaceHref(organisationId: string): string {
  return portalPath(
    `/portal/admin/clients/${encodeURIComponent(organisationId)}/signing`,
  );
}

function AgreementWorkspaceRow({
  organisation,
  status,
}: Readonly<{
  organisation: StaffAgreementOverviewRow;
  status: "draft" | "signed";
}>): React.JSX.Element {
  const draft = status === "draft";
  const count = draft ? organisation.draftCount : organisation.signedCount;

  return (
    <li>
      <PortalCard className={styles.workspaceCard}>
        <div className={styles.cardHeading}>
          <div>
            <h3>{organisation.organisationName}</h3>
            <p>
              {count} {draft ? "draft" : "signed"}{" "}
              {count === 1 ? "agreement" : "agreements"}
            </p>
          </div>
          <StatusBadge status={draft ? "warning" : "success"}>
            {draft ? "Draft work" : "Signed evidence"}
          </StatusBadge>
        </div>
        <p className={styles.cardCopy}>
          {draft
            ? "Resume the saved agreement workspace. Signing approval is distinct from a recorded signature."
            : "Signed evidence is complete. Review the organisation workspace for the retained record and service activation."}
        </p>
        <PortalActionLink
          href={agreementWorkspaceHref(organisation.organisationId)}
          variant={draft ? "primary" : "secondary"}
        >
          {draft ? "Continue draft" : "View agreements"}
        </PortalActionLink>
      </PortalCard>
    </li>
  );
}

function AgreementGroup({
  organisations,
  status,
  title,
}: Readonly<{
  organisations: readonly StaffAgreementOverviewRow[];
  status: "draft" | "signed";
  title: string;
}>): React.JSX.Element {
  return (
    <section
      className={styles.group}
      aria-labelledby={`${status}-agreements-heading`}
    >
      <h2 id={`${status}-agreements-heading`}>{title}</h2>
      {organisations.length ? (
        <ul className={styles.workspaceList}>
          {organisations.map((organisation) => (
            <AgreementWorkspaceRow
              key={organisation.organisationId}
              organisation={organisation}
              status={status}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          {status === "draft"
            ? "No client drafts need attention."
            : "No signed agreements are recorded yet."}
        </p>
      )}
    </section>
  );
}

function signingTone(
  status: StaffSigningReadiness["status"],
): "error" | "info" | "warning" {
  if (status === "expired") return "error";
  if (status === "approved") return "info";
  return "warning";
}

function signingLabel(status: StaffSigningReadiness["status"]): string {
  if (status === "approved") return "Awaiting signature";
  if (status === "expired") return "Signing deadline expired";
  return "Prepared for approval";
}

export function StaffAgreementOverview({
  agreements,
  signingReadiness,
}: StaffAgreementOverviewProps): React.JSX.Element {
  const totals = agreements.reduce(
    (result, organisation) => ({
      agreements: result.agreements + organisation.agreementCount,
      drafts: result.drafts + organisation.draftCount,
      signed: result.signed + organisation.signedCount,
    }),
    { agreements: 0, drafts: 0, signed: 0 },
  );
  const drafts = agreements.filter(
    (organisation) => organisation.draftCount > 0,
  );
  const signed = agreements.filter(
    (organisation) => organisation.signedCount > 0,
  );

  return (
    <div className={styles.page}>
      <PageHeader
        action={
          <PortalActionLink href={portalPath("/portal/admin/clients")}>
            New agreement
          </PortalActionLink>
        }
        breadcrumbs={[{ label: "FSS Studio" }, { label: "Agreements" }]}
        description="Create clear agreements and track every revision, signing step and retained evidence."
        eyebrow="FSS Studio / Agreements"
        title="Agreements"
      />
      <section
        className={styles.metrics}
        aria-label="Agreement portfolio summary"
      >
        <PortalCard title="Client workspaces">
          <p className={styles.metric}>{agreements.length}</p>
        </PortalCard>
        <PortalCard title="Agreements">
          <p className={styles.metric}>{totals.agreements}</p>
        </PortalCard>
        <PortalCard title="Drafts to review">
          <p className={styles.metric}>{totals.drafts}</p>
        </PortalCard>
        <PortalCard title="Signed revisions">
          <p className={styles.metric}>{totals.signed}</p>
        </PortalCard>
      </section>
      <Notice tone="info">
        <strong>Approval is not signature.</strong>
        <p>
          A document can be approved and queued for signing before every
          required signature and retained final document are complete.
        </p>
      </Notice>
      <AgreementGroup
        organisations={drafts}
        status="draft"
        title="Draft & awaiting signature"
      />
      <AgreementGroup organisations={signed} status="signed" title="Signed" />
      {signingReadiness.length ? (
        <section
          className={styles.group}
          aria-labelledby="signing-activity-heading"
        >
          <h2 id="signing-activity-heading">Signing activity</h2>
          <ul className={styles.workspaceList}>
            {signingReadiness.map((approval) => (
              <li key={approval.approvalId}>
                <PortalCard className={styles.workspaceCard}>
                  <div className={styles.cardHeading}>
                    <div>
                      <h3>{approval.title}</h3>
                      <p>{approval.organisationName}</p>
                    </div>
                    <StatusBadge status={signingTone(approval.status)}>
                      {signingLabel(approval.status)}
                    </StatusBadge>
                  </div>
                  <PortalActionLink
                    href={signingWorkspaceHref(approval.organisationId)}
                    variant="secondary"
                  >
                    Review signing status
                  </PortalActionLink>
                </PortalCard>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
