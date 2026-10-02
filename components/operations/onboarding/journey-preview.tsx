"use client";
import { invoiceChoices } from "@/lib/operations/onboarding/display";
import { useEffect, useState, useRef } from "react";
import type {
  JourneyPreview as Preview,
  JourneyView,
  JourneyBillingAccount,
} from "@/lib/operations/onboarding/command-types";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import type { OnboardingWorkspaceJourneyDraft } from "@/lib/operations/onboarding/workspace-types";
import type { WelcomePack } from "@/lib/operations/onboarding/welcome-packs";
import { canStartOnboardingJourney } from "@/lib/operations/onboarding/readiness";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { useJourneyCommand } from "./use-journey-command";
import { WelcomeForm } from "./welcome-form";
import { ProposalForm } from "./proposal-form";
import { ProposalAccessPreview } from "./proposal-access-preview";
import { EmailPreview } from "./email-preview";
import {
  PortalActionLink,
  PortalButton,
  PortalCard,
  PortalCheckbox,
  StatusBadge,
} from "@/components/portal/ui";
import styles from "../agreements/agreements.module.css";
function PreviewDocument({ base64 }: { base64: string }): React.JSX.Element {
  const link = useRef<HTMLAnchorElement>(null);
  const document = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
    if (link.current) link.current.href = url;
    if (document.current) document.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [base64]);
  return (
    <section aria-label="Exact generated welcome PDF">
      <iframe
        ref={document}
        title="Exact generated welcome PDF"
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        style={{ width: "100%", height: "min(75vh, 800px)" }}
        aria-label="Generated welcome packet"
      />
      <p>
        <a
          ref={link}
          target="_blank"
          rel="noreferrer"
          download="welcome-preview.pdf"
        >
          Download exact welcome PDF
        </a>
      </p>
    </section>
  );
}

function readinessStatus(
  status: "failed" | "needs_action" | "passed",
): "error" | "success" | "warning" {
  if (status === "passed") return "success";
  return status === "failed" ? "error" : "warning";
}
export interface JourneyPreviewProps {
  organisationId: string;
  organisationName: string;
  agreements: AgreementRecord[];
  contacts: { id?: string; email: string; name: string }[];
  approvals: SigningApproval[];
  journeys: JourneyView[];
  billing?: JourneyBillingAccount | null;
  commandEndpoint?: string;
  signingDownloadBase?: string;
  workspaceDrafts?: readonly OnboardingWorkspaceJourneyDraft[];
  welcomePacks?: readonly WelcomePack[];
  renderWelcomePreparation?: (
    prepare: (command: unknown) => Promise<void>,
    pending: boolean,
  ) => React.ReactNode;
  hideWelcomeForm?: boolean;
}
export function JourneyPreview({
  organisationId,
  organisationName,
  agreements,
  contacts,
  approvals,
  journeys,
  billing = null,
  commandEndpoint,
  signingDownloadBase = `/api/growth/operations/clients/${organisationId}/signing`,
  workspaceDrafts,
  welcomePacks = [],
  renderWelcomePreparation,
  hideWelcomeForm = false,
}: JourneyPreviewProps): React.JSX.Element {
  const { submit, pending, message } = useJourneyCommand(
    organisationId,
    commandEndpoint,
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  async function prepare(command: unknown) {
    const result = await submit(command);
    if (result && "preview" in result) {
      setPreview(result.preview);
      setConfirmed(false);
    }
  }
  const available = agreements.filter(
    (a) => !journeys.some((j) => j.agreementId === a.id),
  );
  const previewAgreement =
    preview?.kind === "welcome"
      ? agreements.find((a) => a.id === preview.agreementId)
      : null;
  const invoiceLabel =
    preview?.kind === "welcome" && previewAgreement
      ? invoiceChoices(previewAgreement.draft).find(
          (c) => c.value === preview.snapshot.invoice.obligationKey,
        )?.label
      : null;
  const welcomeCanStart =
    preview?.kind !== "welcome" || canStartOnboardingJourney(preview.readiness);
  return (
    <PortalCard
      description={`${organisationName}: review the exact recipients, content and access before anything is queued. Welcome and proposal have separate approvals.`}
      title="Prepare the next step."
    >
      {!preview && (
        <>
          {renderWelcomePreparation ? (
            renderWelcomePreparation(prepare, pending)
          ) : !hideWelcomeForm ? (
            <details>
              <summary>Prepare a welcome journey</summary>
              {available.length && billing ? (
                <WelcomeForm
                  agreements={available}
                  contacts={contacts}
                  billing={billing}
                  commandEndpoint={commandEndpoint}
                  organisationName={organisationName}
                  pending={pending}
                  onPreview={prepare}
                  workspaceDrafts={workspaceDrafts}
                  welcomePacks={welcomePacks}
                />
              ) : available.length ? (
                <p>
                  Configure billing before preparing a welcome journey. Your
                  existing agreements are ready to use once billing is
                  available.
                </p>
              ) : (
                <p>
                  Create an agreement to prepare another journey. Existing
                  agreements retain their permanent effects.
                </p>
              )}
            </details>
          ) : null}
          {journeys
            .filter((j) => !["completed", "cancelled"].includes(j.state))
            .map((j) => (
              <details key={j.id}>
                <summary>
                  Review proposal for {j.agreementTitle || "agreement"}
                </summary>
                <ProposalForm
                  journey={j}
                  approvals={approvals}
                  contacts={contacts}
                  pending={pending}
                  onPreview={prepare}
                />
              </details>
            ))}
        </>
      )}
      {preview && (
        <div className={styles.form}>
          <h3>
            {preview.kind === "welcome"
              ? "Welcome approval preview"
              : "Proposal approval preview"}
          </h3>
          {preview.kind === "welcome" ? (
            <>
              <section aria-label="Welcome activation preflight">
                <h3>Preflight</h3>
                <ul>
                  {preview.readiness.map((check) => (
                    <li key={check.id}>
                      <StatusBadge status={readinessStatus(check.status)}>
                        {check.reason}
                      </StatusBadge>
                      {check.href && check.status !== "passed" ? (
                        <PortalActionLink
                          href={portalPath(check.href)}
                          variant="secondary"
                        >
                          Resolve this check
                        </PortalActionLink>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
              <EmailPreview email={preview.snapshot.welcome} />
              <PreviewDocument base64={preview.pdfBase64} />
              <p>PDF SHA-256: {preview.snapshot.pdfHash}</p>
              {preview.snapshot.content.pages.map((page, index) => (
                <section key={index}>
                  <h3>{page.title}</h3>
                  {page.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </section>
              ))}
              <h3>First invoice and follow-up</h3>
              <p>
                {invoiceLabel ?? preview.snapshot.invoice.obligationKey} ·{" "}
                {preview.snapshot.invoice.accountId} ·{" "}
                {preview.snapshot.invoice.livemode ? "Live" : "Test"}
              </p>
              <p>
                Invoice and access follow all signatures on the next calendar
                day at 09:00 London. Amounts and due dates come from the
                retained signed agreement. The proposal remains held until
                separately approved.
              </p>
              <h4>{preview.snapshot.thankYou.subject}</h4>
              <p>{preview.snapshot.thankYou.intro}</p>
              <p>
                First invoice: inserted after invoice creation. Portal access:
                resolved for {preview.snapshot.recipient}.
              </p>
              <p>{preview.snapshot.thankYou.nextStep}</p>
              <p>{preview.snapshot.thankYou.requiredAction}</p>
            </>
          ) : (
            <>
              <p>
                Signing revision {preview.snapshot.revision} ·{" "}
                {preview.snapshot.approvalHash}
              </p>
              <a
                href={`${signingDownloadBase}/${preview.snapshot.signingApprovalId}/source`}
              >
                Download approved proposal PDF
              </a>
              <ProposalAccessPreview access={preview.snapshot.access} />
              {[
                ...preview.snapshot.emails,
                ...preview.snapshot.activationEmails,
              ].map((email) => (
                <EmailPreview key={email.to} email={email} />
              ))}
              <p>
                Signing notices are eligible two hours after welcome acceptance,
                or at this approval if later. Additional access recipients
                receive their own activation message after signing.
              </p>
            </>
          )}
          <PortalCheckbox
            checked={confirmed}
            disabled={pending}
            label="I reviewed these exact recipients, content, documents and access."
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <div className={styles.actions}>
            <PortalButton
              disabled={pending || !confirmed || !welcomeCanStart}
              loading={pending}
              onClick={async () => {
                const result = await submit({
                  action:
                    preview.kind === "welcome" ? "start" : "approve_proposal",
                  token: preview.token,
                  confirmed: true,
                });
                if (result) setPreview(null);
              }}
              type="button"
            >
              {pending
                ? "Saving…"
                : preview.kind === "welcome"
                  ? "Start approved welcome"
                  : "Approve proposal and access"}
            </PortalButton>
            <PortalButton
              disabled={pending}
              onClick={() => {
                setPreview(null);
                setConfirmed(false);
              }}
              type="button"
              variant="secondary"
            >
              Back to preparation
            </PortalButton>
          </div>
        </div>
      )}
      <p role="status">{message}</p>
    </PortalCard>
  );
}
