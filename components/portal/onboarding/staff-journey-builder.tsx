"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  FilePenLine,
  ListChecks,
  UsersRound,
} from "lucide-react";
import {
  Notice,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
  PortalTextarea,
  StatusBadge,
} from "@/components/portal/ui";

type BuilderAgreement = Readonly<{
  id: string;
  label: string;
  version: number;
}>;
type BuilderContact = Readonly<{ id: string; name: string; email: string }>;
type BuilderTemplate = Readonly<{ id: string; name: string; version: number }>;

export const journeyBuilderStages = [
  "setup",
  "content",
  "access",
  "schedule",
  "activate",
] as const;

export type JourneyBuilderStage = (typeof journeyBuilderStages)[number];

export function isJourneyBuilderStage(
  value: string | undefined,
): value is JourneyBuilderStage {
  return journeyBuilderStages.some((stage) => stage === value);
}

type StaffJourneyBuilderProps = Readonly<{
  agreements: readonly BuilderAgreement[];
  commandEndpoint: string;
  contacts: readonly BuilderContact[];
  initialStage?: JourneyBuilderStage;
  templates: readonly BuilderTemplate[];
}>;

type JourneyDraftResult = Readonly<{
  kind: "journey_draft";
  draftId: string;
  version: number;
}>;

function formValue(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

function isJourneyDraftResult(value: unknown): value is JourneyDraftResult {
  return (
    value !== null &&
    typeof value === "object" &&
    "kind" in value &&
    value.kind === "journey_draft" &&
    "draftId" in value &&
    typeof value.draftId === "string" &&
    "version" in value &&
    typeof value.version === "number"
  );
}

function errorMessage(body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  )
    return body.error;
  return "The draft could not be saved. Refresh and try again.";
}

export function StaffJourneyBuilder({
  agreements,
  commandEndpoint,
  contacts,
  initialStage = "setup",
  templates,
}: StaffJourneyBuilderProps): React.JSX.Element {
  const draftId = useRef<string | null>(null);
  const [expectedVersion, setExpectedVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveDraft(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const agreement = agreements.find(
      (candidate) => candidate.id === formValue(data, "agreementId"),
    );
    if (!agreement) return;
    const journeyDraftId = draftId.current ?? crypto.randomUUID();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(commandEndpoint, {
        body: JSON.stringify({
          action: "save_journey_draft",
          agreementId: agreement.id,
          contactId: formValue(data, "contactId"),
          content: {
            welcomeBody: formValue(data, "welcomeBody"),
            welcomeSubject: formValue(data, "welcomeSubject"),
          },
          draftId: journeyDraftId,
          expectedAgreementVersion: agreement.version,
          expectedVersion,
          recipientRole: formValue(data, "recipientRole"),
          reviewReference: formValue(data, "reviewReference"),
          stage: formValue(data, "stage"),
          templateVersionId: formValue(data, "templateVersionId"),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(errorMessage(body));
        return;
      }
      if (!isJourneyDraftResult(body) || !body.draftId) {
        setMessage("The draft response was incomplete. Refresh and try again.");
        return;
      }
      draftId.current = body.draftId;
      setExpectedVersion(body.version);
      setMessage(`Journey draft version ${body.version} saved.`);
    } catch {
      setMessage(
        "The draft could not be saved. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const unavailable =
    !agreements.length || !contacts.length || !templates.length;

  return (
    <section aria-label="Journey builder">
      <PortalCard
        description="Save the named client, agreement, contact and immutable checklist version before you prepare the exact welcome approval."
        headingId="journey-builder-heading"
        title="Prepare a warm welcome"
        tone="accent"
      >
        <form aria-busy={pending} onSubmit={saveDraft}>
          <PortalSelect label="Client agreement" name="agreementId" required>
            <option value="">Select the current agreement</option>
            {agreements.map((agreement) => (
              <option key={agreement.id} value={agreement.id}>
                {agreement.label} · version {agreement.version}
              </option>
            ))}
          </PortalSelect>
          <PortalSelect label="Welcome recipient" name="contactId" required>
            <option value="">Select a client contact</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name} · {contact.email}
              </option>
            ))}
          </PortalSelect>
          <PortalSelect
            label="Checklist template"
            name="templateVersionId"
            required
          >
            <option value="">Select a published template version</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · version {template.version}
              </option>
            ))}
          </PortalSelect>
          <PortalSelect
            defaultValue="owner"
            label="Recipient role"
            name="recipientRole"
            required
          >
            <option value="owner">Owner</option>
            <option value="contributor">Contributor</option>
            <option value="billing_contact">Billing contact</option>
            <option value="viewer">Viewer</option>
          </PortalSelect>
          <PortalSelect
            defaultValue={initialStage}
            label="Builder stage"
            name="stage"
            required
          >
            <option value="setup">Client and agreement</option>
            <option value="content">Welcome content</option>
            <option value="access">Access</option>
            <option value="schedule">Schedule</option>
            <option value="activate">Activate</option>
          </PortalSelect>
          <PortalField label="Review reference" required>
            <input maxLength={200} name="reviewReference" required />
          </PortalField>
          <PortalTextarea
            label="Welcome subject"
            maxLength={160}
            name="welcomeSubject"
            required
            rows={2}
          />
          <PortalTextarea
            label="Welcome copy"
            maxLength={10000}
            name="welcomeBody"
            required
            rows={6}
          />
          <PortalButton disabled={unavailable} loading={pending} type="submit">
            <FilePenLine aria-hidden="true" size={16} />
            Save journey draft
          </PortalButton>
          {message ? <p role="status">{message}</p> : null}
        </form>
      </PortalCard>

      <PortalCard title="Preflight">
        <div>
          <StatusBadge status="info">Server checked at preview</StatusBadge>
          <p>
            Preparing the exact welcome approval checks the saved draft version,
            agreement revision, recipient, template, billing and signing state.
          </p>
          <Notice tone="info">
            A saved draft does not send a message or start a journey. Activation
            remains available only after the server returns a passing preflight.
          </Notice>
        </div>
      </PortalCard>
      <PortalCard title="What this preserves">
        <ul>
          <li>
            <ListChecks aria-hidden="true" size={16} /> The selected checklist
            version.
          </li>
          <li>
            <UsersRound aria-hidden="true" size={16} /> The named client
            recipient and role.
          </li>
          <li>
            <CheckCircle2 aria-hidden="true" size={16} /> Server-owned
            activation checks.
          </li>
        </ul>
      </PortalCard>
      {unavailable ? (
        <Notice tone="warning">
          Add an agreement, active client contact and published checklist
          template before a journey draft can be saved.
        </Notice>
      ) : null}
    </section>
  );
}
