"use client";
import { Notice, PortalSelect } from "@/components/portal/ui";
import { invoiceChoices } from "@/lib/operations/onboarding/display";
import { portalRoles } from "@/lib/operations/auth/types";
import type { JourneyComposerProps } from "./journey-composer-types";
import type { useJourneyComposer } from "./use-journey-composer";
import { WelcomePacketPreview } from "./welcome-packet-preview";
import styles from "./welcome-packet.module.css";
type StageProps = Readonly<{
  props: JourneyComposerProps;
  composer: ReturnType<typeof useJourneyComposer>;
}>;
export function JourneySetupStage({
  props,
  composer,
}: StageProps): React.JSX.Element {
  return (
    <div className={styles.editor}>
      <PortalSelect
        label="Client agreement"
        value={composer.agreementId}
        disabled={composer.pending}
        onChange={(e) => {
          composer.setAgreementId(e.target.value);
          composer.setDirty(true);
        }}
      >
        <option value="">Select agreement</option>
        {props.agreements.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label} · revision {a.version}
          </option>
        ))}
      </PortalSelect>
      <PortalSelect
        label="Project contact"
        value={composer.contactId}
        disabled={composer.pending}
        onChange={(e) => {
          composer.setContactId(e.target.value);
          composer.setDirty(true);
        }}
      >
        <option value="">Select contact</option>
        {props.contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.email}
          </option>
        ))}
      </PortalSelect>
      <p>
        Checklist template: selecting a packet applies its published checklist
        together with the welcome content.
      </p>
      <div className={styles.facts}>
        <h3>Recorded project facts</h3>
        <p>
          {composer.agreement?.draft.goals ||
            "Select an agreement to load the project goal."}
        </p>
        <p>
          {composer.agreement?.draft.scope ||
            "The recorded scope will populate the packet."}
        </p>
        <p>Unconfirmed milestone dates: To be agreed.</p>
      </div>
      {!props.agreements.length || !props.contacts.length ? (
        <Notice tone="warning">
          Create an agreement and a project contact before selecting a packet.
        </Notice>
      ) : null}
    </div>
  );
}
export function JourneyAccessStage({
  props,
  composer,
}: StageProps): React.JSX.Element {
  return (
    <div className={styles.editor}>
      <div className={styles.facts}>
        <h3>Welcome recipient</h3>
        <p>{composer.contact?.name ?? "Choose a contact in Setup"}</p>
        <p>{composer.contact?.email}</p>
        <p>Organisation: {props.organisationName}</p>
      </div>
      <PortalSelect
        label="Recipient portal role"
        value={composer.role}
        disabled={composer.pending}
        onChange={(e) => {
          const role = portalRoles.find((r) => r === e.target.value);
          if (role) {
            composer.setRole(role);
            composer.setDirty(true);
          }
        }}
      >
        {portalRoles
          .filter((r) => r === "owner" || r === "billing_contact")
          .map((role) => (
            <option key={role} value={role}>
              {role === "owner"
                ? "Owner · workspace and billing"
                : "Billing contact · financial access"}
            </option>
          ))}
      </PortalSelect>
      <p>
        Proposal recipients and their permissions receive a separate review
        before access is approved.
      </p>
      {composer.packet ? (
        <WelcomePacketPreview
          content={composer.packet}
          clientName={props.organisationName}
        />
      ) : (
        <Notice tone="warning">
          Select a packet to review its client checklist.
        </Notice>
      )}
    </div>
  );
}
export function JourneyScheduleStage({
  props,
  composer,
}: StageProps): React.JSX.Element {
  const choices = composer.agreement
    ? invoiceChoices(composer.agreement.draft)
    : [];
  const invoiceHint = !composer.agreement
    ? "Select a client agreement in Setup to load its agreed invoices."
    : choices.length === 0
      ? "This agreement has no agreed installments or recurring charges. Review its billing terms before preparing the welcome."
      : undefined;
  return (
    <div className={styles.editor}>
      <div className={styles.facts}>
        <h3>Delivery schedule</h3>
        <p>
          The welcome is queued after approval. Invoice and access follow all
          signatures on the next calendar day at{" "}
          <strong>09:00 Europe/London</strong>.
        </p>
        <p>
          Project milestones: <strong>To be agreed</strong>. Contractual amounts
          and due dates come from the signed agreement.
        </p>
      </div>
      <PortalSelect
        label="First agreed invoice"
        value={composer.obligationKey}
        disabled={composer.pending || choices.length === 0}
        hint={invoiceHint}
        onChange={(e) => {
          composer.setObligationKey(e.target.value);
          composer.setDirty(true);
        }}
      >
        <option value="">Select an obligation</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </PortalSelect>
      {!props.billing ? (
        <Notice tone="warning">
          You can select an invoice and save this draft. Configure billing
          before preparing the welcome.
        </Notice>
      ) : null}
      <p>
        Communication expectation:{" "}
        {props.settings?.responseExpectationHours ?? 48} hours ·{" "}
        {props.settings?.timezone ?? "Europe/London"}
      </p>
    </div>
  );
}
