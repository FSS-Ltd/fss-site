"use client";

import { useState, type FormEvent } from "react";
import {
  Notice,
  PageHeader,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
  StatusBadge,
} from "@/components/portal/ui";
import type { StudioSettings as StudioSettingsModel } from "@/lib/operations/studio/settings";
import styles from "./operations-queues.module.css";

type SaveResponse = Readonly<{ error?: string; revision?: number; createdAt?: string }>;

function healthTone(available: boolean): "success" | "warning" {
  return available ? "success" : "warning";
}

function errorMessage(body: unknown): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string")
    return body.error;
  return "We could not save this settings draft. Your edits are still here.";
}

export function StudioSettings({
  settings,
}: Readonly<{ settings: StudioSettingsModel }>): React.JSX.Element {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const draft = settings.draft;
  const approvedSenders = settings.approvedReplyTo;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const replyToValue = form.get("replyTo");
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/portal/admin/settings", {
        body: JSON.stringify({
          deliveryCapacity: String(form.get("deliveryCapacity") ?? ""),
          displayName: String(form.get("displayName") ?? "").trim(),
          expectedRevision: draft?.revision ?? 0,
          replyTo: typeof replyToValue === "string" && replyToValue ? replyToValue : null,
          responseExpectationHours: Number(form.get("responseExpectationHours")),
          timezone: String(form.get("timezone") ?? "").trim(),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(errorMessage(body));
        return;
      }
      const saved = body as SaveResponse;
      if (typeof saved.revision !== "number" || typeof saved.createdAt !== "string") {
        setMessage("The saved draft response was incomplete. Refresh before trying again.");
        return;
      }
      setMessage(`Settings draft revision ${saved.revision} saved.`);
      window.setTimeout(() => window.location.reload(), 600);
    } catch {
      setMessage("We could not save this settings draft. Your edits are still here.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.page} aria-labelledby="studio-settings-heading">
      <PageHeader
        description="Draft how Studio should present its client experience. Runtime configuration and secrets stay outside this workspace."
        eyebrow="FSS Studio · Settings"
        title="Studio settings"
      />
      <Notice tone="info">
        Saving a draft does not rewrite active approvals, change a sender, enable a provider or alter any deployment configuration.
      </Notice>
      <form onSubmit={submit} className={styles.page} aria-busy={pending}>
        <PortalCard title="Studio identity">
          <PortalField label="Display name" required>
            <input defaultValue={draft?.displayName ?? "Faithful Software Solutions"} disabled={pending} maxLength={160} name="displayName" required />
          </PortalField>
          <PortalSelect defaultValue={draft?.replyTo ?? ""} disabled={pending || approvedSenders.length === 0} label="Reply-to address" name="replyTo">
            {approvedSenders.length === 0 ? <option value="">No approved sender is configured</option> : <><option value="">No reply-to address</option>{approvedSenders.map((sender) => <option key={sender} value={sender}>{sender}</option>)}</>}
          </PortalSelect>
          {approvedSenders.length === 0 ? <p className={styles.empty}>An approved sender must be supplied through deployment configuration. Sender credentials are never editable here.</p> : null}
          <PortalField label="Timezone" required>
            <input defaultValue={draft?.timezone ?? "Europe/London"} disabled={pending} maxLength={100} name="timezone" required />
          </PortalField>
        </PortalCard>
        <PortalCard title="Response expectation">
          <PortalField hint="Between 1 and 168 hours." label="Response expectation (hours)" required>
            <input defaultValue={draft?.responseExpectationHours ?? 48} disabled={pending} max={168} min={1} name="responseExpectationHours" required type="number" />
          </PortalField>
          <PortalSelect defaultValue={draft?.deliveryCapacity ?? "standard"} disabled={pending} label="Delivery capacity" name="deliveryCapacity" required>
            <option value="standard">Standard</option>
            <option value="limited">Limited</option>
            <option value="priority">Priority</option>
          </PortalSelect>
        </PortalCard>
        <PortalCard title="Integration health">
          <ul className={styles.list}>
            {settings.integrationHealth.map((integration) => (
              <li key={integration.name} className={styles.row}>
                <div className={styles.rowSummary}><h2>{integration.name}</h2><p>{integration.detail}</p></div>
                <StatusBadge status={healthTone(integration.available)}>{integration.available ? "Available" : "Unavailable"}</StatusBadge>
              </li>
            ))}
          </ul>
        </PortalCard>
        <PortalButton loading={pending} type="submit">Save settings draft</PortalButton>
        {message ? <p role="status" className={styles.empty}>{message}</p> : null}
      </form>
    </section>
  );
}
