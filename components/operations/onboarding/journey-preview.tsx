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
import { useJourneyCommand } from "./use-journey-command";
import { WelcomeForm } from "./welcome-form";
import { ProposalForm } from "./proposal-form";
import { EmailPreview } from "./email-preview";
import styles from "../agreements/agreements.module.css";
function PreviewDocument({ base64 }: { base64: string }): React.JSX.Element {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
    if (link.current) link.current.href = url;
    return () => URL.revokeObjectURL(url);
  }, [base64]);
  return (
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
  );
}
export interface JourneyPreviewProps {
  organisationId: string;
  organisationName: string;
  agreements: AgreementRecord[];
  contacts: { email: string; name: string }[];
  approvals: SigningApproval[];
  journeys: JourneyView[];
  billing?: JourneyBillingAccount | null;
}
export function JourneyPreview({
  organisationId,
  organisationName,
  agreements,
  contacts,
  approvals,
  journeys,
  billing = null,
}: JourneyPreviewProps): React.JSX.Element {
  const { submit, pending, message } = useJourneyCommand(organisationId);
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
  return (
    <article className={styles.card}>
      <h2>Prepare the next step.</h2>
      <p>
        {organisationName}: review the exact recipients, content and access
        before anything is queued. Welcome and proposal have separate approvals.
      </p>
      {!preview && (
        <>
          <details>
            <summary>Prepare a welcome journey</summary>
            {available.length && billing ? (
              <WelcomeForm
                agreements={available}
                contacts={contacts}
                billing={billing}
                pending={pending}
                onPreview={prepare}
              />
            ) : (
              <p>
                Create an agreement to prepare another journey. Existing
                agreements retain their permanent effects.
              </p>
            )}
          </details>
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
                href={`/api/growth/operations/clients/${organisationId}/signing/${preview.snapshot.signingApprovalId}/source`}
              >
                Download approved proposal PDF
              </a>
              <ul>
                {preview.snapshot.access.map((a) => (
                  <li key={a.email}>
                    {a.email}: {a.role.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
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
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={pending}
            />
            I reviewed these exact recipients, content, documents and access.
          </label>
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={pending || !confirmed}
              onClick={async () => {
                const result = await submit({
                  action:
                    preview.kind === "welcome" ? "start" : "approve_proposal",
                  token: preview.token,
                  confirmed: true,
                });
                if (result) setPreview(null);
              }}
            >
              {pending
                ? "Saving…"
                : preview.kind === "welcome"
                  ? "Start approved welcome"
                  : "Approve proposal and access"}
            </button>
            <button
              disabled={pending}
              onClick={() => {
                setPreview(null);
                setConfirmed(false);
              }}
            >
              Back to preparation
            </button>
          </div>
        </div>
      )}
      <p role="status">{message}</p>
    </article>
  );
}
