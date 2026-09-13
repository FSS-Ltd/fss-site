"use client";
import { portalRoleOptions } from "@/lib/operations/auth/access-dashboard-metrics";
import type { JourneyView } from "@/lib/operations/onboarding/command-types";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import styles from "../agreements/agreements.module.css";
export function ProposalForm({
  journey,
  approvals,
  contacts,
  pending,
  onPreview,
}: {
  journey: JourneyView;
  approvals: SigningApproval[];
  contacts: { email: string; name: string }[];
  pending: boolean;
  onPreview: (command: unknown) => void;
}): React.JSX.Element {
  const current = approvals.filter(
    (a) => a.agreementId === journey.agreementId && a.status === "approved",
  );
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onPreview({
          action: "preview_proposal",
          journeyId: journey.id,
          expectedGeneration: journey.generation,
          expectedProposalApprovalId: journey.proposalApprovalId,
          signingApprovalId: data.get("signingApprovalId"),
          scopeSummary: data.get("scopeSummary"),
          access: contacts.flatMap((c) => {
            const role = data.get(`access-${c.email}`);
            return role ? [{ email: c.email, role }] : [];
          }),
        });
      }}
    >
      <fieldset disabled={pending}>
        <legend>Separate proposal approval</legend>
        <label className={styles.field}>
          Approved signing document
          <select name="signingApprovalId" required defaultValue="">
            <option disabled value="">
              Select revision
            </option>
            {current.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} · revision {a.revision}
              </option>
            ))}
          </select>
        </label>
        {!current.length && (
          <p>Prepare and approve the current document in Signing first.</p>
        )}
        <label className={styles.field}>
          Approved scope summary
          <textarea name="scopeSummary" maxLength={2000} required />
        </label>
        <p>
          Select each signer’s access and the billing recipient’s owner or
          billing role. Additional contacts receive their own approved
          activation email after signing.
        </p>
        {contacts.map((c) => (
          <label key={c.email} className={styles.field}>
            {c.name} · {c.email}
            <select
              name={`access-${c.email}`}
              defaultValue={
                journey.proposal?.access.find((a) => a.email === c.email)
                  ?.role ?? ""
              }
            >
              <option value="">No new access</option>
              {portalRoleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          className={styles.primary}
          disabled={pending || !current.length}
        >
          {pending ? "Preparing…" : "Preview proposal and access"}
        </button>
      </fieldset>
    </form>
  );
}
