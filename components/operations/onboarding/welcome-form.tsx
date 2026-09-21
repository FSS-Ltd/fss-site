"use client";
import { useState } from "react";
import { invoiceChoices } from "@/lib/operations/onboarding/display";
import type { JourneyBillingAccount } from "@/lib/operations/onboarding/command-types";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
import {
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
}: {
  agreements: AgreementRecord[];
  contacts: { email: string; name: string }[];
  billing: JourneyBillingAccount;
  pending: boolean;
  onPreview: (command: unknown) => void;
}): React.JSX.Element {
  const [agreementId, setAgreementId] = useState("");
  const selected = agreements.find((a) => a.id === agreementId);
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const value = (name: string) => String(data.get(name) ?? "").trim();
        const agreement = agreements.find((a) => a.id === value("agreementId"));
        if (!agreement) return;
        onPreview({
          action: "preview_welcome",
          agreementId: agreement.id,
          expectedVersion: agreement.version,
          welcome: {
            recipient: value("recipient"),
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
        });
      }}
    >
      <fieldset disabled={pending}>
        <legend>Welcome and first invoice</legend>
        <PortalSelect
          label="Agreement"
          name="agreementId"
          required
          value={agreementId}
          onChange={(e) => setAgreementId(e.target.value)}
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
          defaultValue=""
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
        disabled={pending || !agreements.length || !contacts.length}
        loading={pending}
        type="submit"
      >
        {pending ? "Preparing…" : "Preview welcome"}
      </PortalButton>
    </form>
  );
}
