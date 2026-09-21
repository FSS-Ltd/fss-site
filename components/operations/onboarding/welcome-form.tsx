"use client";
import { useState } from "react";
import { invoiceChoices } from "@/lib/operations/onboarding/display";
import type { JourneyBillingAccount } from "@/lib/operations/onboarding/command-types";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
import type { OnboardingWorkspaceJourneyDraft } from "@/lib/operations/onboarding/workspace-types";
import {
  Notice,
  PortalButton,
  PortalField,
  PortalSelect,
  PortalTextarea,
} from "@/components/portal/ui";
import styles from "../agreements/agreements.module.css";
const guidePages = [
  "Your priorities",
  "The proposed work",
  "How delivery works",
  "Working together",
  "Progress and next steps",
];
export function WelcomeForm({
  agreements,
  contacts,
  billing,
  pending,
  onPreview,
  workspaceDrafts,
}: {
  agreements: AgreementRecord[];
  contacts: { id?: string; email: string; name: string }[];
  billing: JourneyBillingAccount;
  pending: boolean;
  onPreview: (command: unknown) => void;
  workspaceDrafts?: readonly OnboardingWorkspaceJourneyDraft[];
}): React.JSX.Element {
  const [agreementId, setAgreementId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [workspaceDraftId, setWorkspaceDraftId] = useState("");
  const selectedWorkspaceDraft = workspaceDrafts?.find(
    (draft) => draft.id === workspaceDraftId,
  );
  const selected = agreements.find((agreement) => agreement.id === agreementId);
  const selectedContact = selectedWorkspaceDraft
    ? contacts.find(
        (contact) => contact.id === selectedWorkspaceDraft.contactId,
      )
    : null;
  const workspaceDraftIsUsable =
    !selectedWorkspaceDraft ||
    (selectedWorkspaceDraft.agreementId === agreementId &&
      Boolean(selectedContact));
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const value = (name: string) => String(data.get(name) ?? "").trim();
        const agreement = agreements.find((item) => item.id === agreementId);
        if (!agreement || !recipient || !workspaceDraftIsUsable) return;
        onPreview({
          action: "preview_welcome",
          agreementId: agreement.id,
          expectedVersion: agreement.version,
          welcome: {
            recipient,
            invoice: {
              obligationKey: value("obligationKey"),
              accountId: billing.accountId,
              livemode: billing.livemode,
            },
            content: {
              contactFirstName: value("contactFirstName"),
              primaryGoal: value("primaryGoal"),
              outcomeSummary: value("outcomeSummary"),
              senderName: value("senderName"),
              organisationName: "Faithful Software Solutions",
              from: value("from"),
              replyTo: value("replyTo"),
              pages: guidePages.map((title, i) => ({
                title,
                paragraphs: value(`page-${i}`)
                  .split(/\n\s*\n/)
                  .filter(Boolean),
              })),
            },
            thankYou: {
              subject: "Your FSS agreement and next steps",
              intro: value("intro"),
              nextStep: value("nextStep"),
              requiredAction: value("requiredAction"),
            },
          },
          workspace: selectedWorkspaceDraft
            ? {
                contactId: selectedWorkspaceDraft.contactId,
                draftId: selectedWorkspaceDraft.id,
                expectedDraftVersion: selectedWorkspaceDraft.version,
                recipientRole: selectedWorkspaceDraft.recipientRole ?? "owner",
                templateVersionId: selectedWorkspaceDraft.templateVersionId,
              }
            : undefined,
        });
      }}
    >
      <fieldset disabled={pending}>
        <legend>Welcome and first invoice</legend>
        {workspaceDrafts?.length ? (
          <PortalSelect
            label="Saved journey setup"
            name="workspaceDraftId"
            onChange={(event) => {
              const nextDraftId = event.target.value;
              const nextDraft = workspaceDrafts.find(
                (draft) => draft.id === nextDraftId,
              );
              setWorkspaceDraftId(nextDraftId);
              if (!nextDraft) return;
              setAgreementId(nextDraft.agreementId);
              setRecipient(
                contacts.find((contact) => contact.id === nextDraft.contactId)
                  ?.email ?? "",
              );
            }}
            value={workspaceDraftId}
          >
            <option value="">Prepare without a saved journey draft</option>
            {workspaceDrafts.map((draft) => (
              <option key={draft.id} value={draft.id}>
                Saved {draft.stage} draft · version {draft.version}
              </option>
            ))}
          </PortalSelect>
        ) : null}
        <PortalSelect
          label="Agreement"
          name="agreementId"
          required
          value={agreementId}
          onChange={(e) => setAgreementId(e.target.value)}
          disabled={Boolean(selectedWorkspaceDraft)}
        >
          <option value="" disabled>
            Select agreement
          </option>
          {agreements.map((a) => (
            <option key={a.id} value={a.id}>
              {a.draft.title} · revision {a.revision}
            </option>
          ))}
        </PortalSelect>
        <PortalSelect
          label="Welcome and billing recipient"
          name="recipient"
          required
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          disabled={Boolean(selectedWorkspaceDraft)}
        >
          <option value="" disabled>
            Select contact
          </option>
          {contacts.map((c) => (
            <option key={c.email} value={c.email}>
              {c.name} · {c.email}
            </option>
          ))}
        </PortalSelect>
        {!workspaceDraftIsUsable ? (
          <Notice tone="warning">
            This saved journey setup no longer matches an available agreement or
            contact. Return to the builder and save a new draft.
          </Notice>
        ) : null}
        <div className={styles.grid}>
          {[
            ["contactFirstName", "Contact first name"],
            ["senderName", "Sender name"],
            ["from", "Approved sender email"],
            ["replyTo", "Reply email"],
          ].map(([name, label]) => (
            <PortalField key={name} label={label} required>
              <input
                name={name}
                type={["from", "replyTo"].includes(name) ? "email" : "text"}
                required
                maxLength={200}
              />
            </PortalField>
          ))}
        </div>
        <PortalSelect
          label="First agreed invoice"
          name="obligationKey"
          required
          key={agreementId}
          defaultValue=""
        >
          <option value="" disabled>
            Select an obligation
          </option>
          {selected &&
            invoiceChoices(selected.draft).map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
        </PortalSelect>
        <p>
          Billing uses the configured {billing.livemode ? "live" : "test"}{" "}
          account. Sender organisation: Faithful Software Solutions.
        </p>
        <PortalTextarea
          label="Client’s primary goal"
          name="primaryGoal"
          required
          maxLength={2000}
        />
        <PortalTextarea
          label="Proposed outcome summary"
          name="outcomeSummary"
          required
          maxLength={2000}
        />
      </fieldset>
      <fieldset disabled={pending}>
        <legend>Welcome guide</legend>
        <p>
          Template: FSS client welcome guide. Use approved client facts. Each
          section becomes one readable PDF page. Separate paragraphs with a
          blank line.
        </p>
        {guidePages.map((title, i) => (
          <PortalTextarea
            key={title}
            label={title}
            name={`page-${i}`}
            required
            maxLength={6000}
          />
        ))}
      </fieldset>
      <fieldset disabled={pending}>
        <legend>Post-signature thank-you</legend>
        <p>
          The actual first invoice and approved portal access are inserted only
          after their durable steps succeed. No newsletter invitation or
          subscription is included.
        </p>
        {[
          ["intro", "Opening"],
          ["nextStep", "Contractual next step"],
          ["requiredAction", "Required client action"],
        ].map(([name, label]) => (
          <PortalTextarea
            key={name}
            label={label}
            name={name}
            required
            maxLength={2000}
          />
        ))}
      </fieldset>
      <PortalButton
        disabled={
          pending ||
          !agreements.length ||
          !contacts.length ||
          !workspaceDraftIsUsable
        }
        loading={pending}
        type="submit"
      >
        {pending ? "Preparing…" : "Preview welcome"}
      </PortalButton>
    </form>
  );
}
