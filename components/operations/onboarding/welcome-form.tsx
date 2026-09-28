"use client";

import { useState } from "react";
import { invoiceChoices } from "@/lib/operations/onboarding/display";
import type { JourneyBillingAccount } from "@/lib/operations/onboarding/command-types";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
import type { OnboardingWorkspaceJourneyDraft } from "@/lib/operations/onboarding/workspace-types";
import type { WelcomePack } from "@/lib/operations/onboarding/welcome-packs";
import { WelcomePackClientFields } from "./welcome-pack-client-fields";
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

function findPackVersion(packs: readonly WelcomePack[], versionId: string) {
  for (const pack of packs) {
    const version = pack.versions.find((item) => item.id === versionId);
    if (version) return { pack, version };
  }
  return undefined;
}

export function WelcomeForm({
  agreements,
  contacts,
  billing,
  commandEndpoint,
  organisationName,
  pending,
  onPreview,
  workspaceDrafts,
  welcomePacks = [],
}: {
  agreements: AgreementRecord[];
  contacts: { id?: string; email: string; name: string }[];
  billing: JourneyBillingAccount;
  commandEndpoint?: string;
  organisationName: string;
  pending: boolean;
  onPreview: (command: unknown) => void | Promise<void>;
  workspaceDrafts?: readonly OnboardingWorkspaceJourneyDraft[];
  welcomePacks?: readonly WelcomePack[];
}): React.JSX.Element {
  const [agreementId, setAgreementId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [workspaceDraftId, setWorkspaceDraftId] = useState("");
  const [welcomePackVersionId, setWelcomePackVersionId] = useState("");
  const [savingReviewedDraft, setSavingReviewedDraft] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const selectedWorkspaceDraft = workspaceDrafts?.find(
    (draft) => draft.id === workspaceDraftId,
  );
  const agreement = agreements.find((item) => item.id === agreementId);
  const selectedPack = findPackVersion(welcomePacks, welcomePackVersionId);
  const contact = selectedWorkspaceDraft
    ? contacts.find((item) => item.id === selectedWorkspaceDraft.contactId)
    : contacts.find((item) => item.email === recipient);
  const workspaceDraftIsUsable =
    !selectedWorkspaceDraft ||
    (selectedWorkspaceDraft.agreementId === agreementId && Boolean(contact));
  const replacements = {
    client_name: organisationName,
    contact_first_name: contact?.name.split(/\s+/)[0] ?? "",
    agreement_goal: agreement?.draft.goals ?? "",
    agreement_scope: agreement?.draft.scope ?? "",
    sender_name: "Faithful Software Solutions",
  };

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    if (!agreement || !recipient || !workspaceDraftIsUsable) return;
    if (selectedPack && !selectedWorkspaceDraft) return;

    const pages = selectedPack
      ? selectedPack.version.content.guide.map((_page, index) => ({
          title: value(`page-title-${index}`),
          paragraphs: value(`page-${index}`)
            .split(/\n\s*\n/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean),
        }))
      : guidePages.map((title, index) => ({
          title,
          paragraphs: value(`page-${index}`)
            .split(/\n\s*\n/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean),
        }));

    const command = {
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
          clientOrganisationName: organisationName,
          from: value("from"),
          replyTo: value("replyTo"),
          ...(selectedPack
            ? {
                welcomePackVersionId: selectedPack.version.id,
                emailSubject: value("emailSubject"),
                emailBody: value("emailBody"),
              }
            : {}),
          pages,
        },
        thankYou: selectedPack
          ? {
              subject: value("thankYouSubject"),
              intro: value("thankYouIntro"),
              nextStep: value("thankYouNextStep"),
              requiredAction: value("thankYouAction"),
            }
          : {
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
    };
    if (selectedPack && selectedWorkspaceDraft) {
      if (!commandEndpoint) {
        setSaveError(
          "This welcome editor cannot save a reviewed journey draft.",
        );
        return;
      }
      setSavingReviewedDraft(true);
      setSaveError(null);
      try {
        const response = await fetch(commandEndpoint, {
          body: JSON.stringify({
            action: "save_journey_draft",
            agreementId: agreement.id,
            contactId: selectedWorkspaceDraft.contactId,
            content: {
              welcomeSubject: value("emailSubject"),
              welcomeBody: value("emailBody"),
              reviewedWelcome: command.welcome,
            },
            draftId: selectedWorkspaceDraft.id,
            expectedAgreementVersion: agreement.version,
            expectedVersion: selectedWorkspaceDraft.version,
            recipientRole: selectedWorkspaceDraft.recipientRole ?? "owner",
            reviewReference: "Reviewed client welcome content",
            stage: selectedWorkspaceDraft.stage,
            templateVersionId: selectedWorkspaceDraft.templateVersionId,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const body: unknown = await response.json().catch(() => null);
        if (
          !response.ok ||
          body === null ||
          typeof body !== "object" ||
          !("kind" in body) ||
          body.kind !== "journey_draft" ||
          !("version" in body) ||
          typeof body.version !== "number"
        ) {
          setSaveError(
            "The reviewed welcome could not be saved. Refresh and try again.",
          );
          return;
        }
        if (!command.workspace) return;
        command.workspace.expectedDraftVersion = body.version;
      } catch {
        setSaveError(
          "The reviewed welcome could not be saved. Check your connection and try again.",
        );
        return;
      } finally {
        setSavingReviewedDraft(false);
      }
    }
    await onPreview(command);
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <fieldset disabled={pending}>
        <legend>Welcome and first invoice</legend>
        {welcomePacks.length ? (
          <PortalSelect
            label="Shared welcome pack"
            onChange={(event) => setWelcomePackVersionId(event.target.value)}
            value={welcomePackVersionId}
          >
            <option value="">Use the existing welcome form</option>
            {welcomePacks.map((pack) =>
              pack.versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {pack.title} · version {version.version}
                </option>
              )),
            )}
          </PortalSelect>
        ) : null}
        {selectedPack && !selectedWorkspaceDraft ? (
          <Notice tone="warning">
            Apply this pack to the client and save a journey draft before
            preparing its welcome.
          </Notice>
        ) : null}
        {workspaceDrafts?.length ? (
          <PortalSelect
            label="Saved journey setup"
            name="workspaceDraftId"
            onChange={(event) => {
              const draftId = event.target.value;
              const draft = workspaceDrafts.find((item) => item.id === draftId);
              setWorkspaceDraftId(draftId);
              if (!draft) return;
              setAgreementId(draft.agreementId);
              setRecipient(
                contacts.find((item) => item.id === draft.contactId)?.email ??
                  "",
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
          onChange={(event) => setAgreementId(event.target.value)}
          disabled={Boolean(selectedWorkspaceDraft)}
        >
          <option value="" disabled>
            Select agreement
          </option>
          {agreements.map((item) => (
            <option key={item.id} value={item.id}>
              {item.draft.title} · revision {item.revision}
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
          {contacts.map((item) => (
            <option key={item.email} value={item.email}>
              {item.name} · {item.email}
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
                key={
                  name === "contactFirstName"
                    ? (contact?.id ?? "contact")
                    : name
                }
                defaultValue={
                  name === "contactFirstName"
                    ? replacements.contact_first_name
                    : name === "senderName"
                      ? "Faithful Software Solutions"
                      : undefined
                }
                name={name}
                type={name === "from" || name === "replyTo" ? "email" : "text"}
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
          {agreement &&
            invoiceChoices(agreement.draft).map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
        </PortalSelect>
        <p>
          Billing uses the configured {billing.livemode ? "live" : "test"}{" "}
          account. FSS will send from its approved sender address.
        </p>
        <p>Sender organisation: Faithful Software Solutions.</p>
        <PortalTextarea
          label="Client’s primary goal"
          key={agreementId}
          name="primaryGoal"
          defaultValue={agreement?.draft.goals ?? ""}
          required
          maxLength={2_000}
        />
        <PortalTextarea
          label="Proposed outcome summary"
          key={`${agreementId}-scope`}
          name="outcomeSummary"
          defaultValue={agreement?.draft.scope ?? ""}
          required
          maxLength={2_000}
        />
      </fieldset>

      {selectedPack ? (
        <WelcomePackClientFields
          disabled={pending}
          replacements={replacements}
          version={selectedPack.version}
        />
      ) : (
        <>
          <fieldset disabled={pending}>
            <legend>Welcome guide</legend>
            <p>
              Use approved client facts. Each section becomes one readable PDF
              page.
            </p>
            {guidePages.map((title, index) => (
              <PortalTextarea
                key={title}
                label={title}
                name={`page-${index}`}
                required
                maxLength={6_000}
                rows={4}
              />
            ))}
          </fieldset>
          <fieldset disabled={pending}>
            <legend>Post-signature thank-you</legend>
            <PortalTextarea
              label="Opening"
              name="intro"
              required
              maxLength={2_000}
              rows={3}
            />
            <PortalTextarea
              label="Contractual next step"
              name="nextStep"
              required
              maxLength={2_000}
              rows={3}
            />
            <PortalTextarea
              label="Required client action"
              name="requiredAction"
              required
              maxLength={2_000}
              rows={3}
            />
          </fieldset>
        </>
      )}

      <PortalButton
        disabled={
          pending ||
          savingReviewedDraft ||
          !agreement ||
          !recipient ||
          !workspaceDraftIsUsable ||
          (Boolean(selectedPack) && !selectedWorkspaceDraft)
        }
        loading={pending || savingReviewedDraft}
        type="submit"
      >
        {savingReviewedDraft
          ? "Saving reviewed content…"
          : pending
            ? "Preparing…"
            : "Preview welcome"}
      </PortalButton>
      {saveError ? <Notice tone="error">{saveError}</Notice> : null}
    </form>
  );
}
