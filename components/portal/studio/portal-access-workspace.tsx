"use client";

import { useState, type FormEvent } from "react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
  StatusBadge,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { portalRoles } from "@/lib/operations/auth/types";
import type {
  StudioPortalAccessEntry,
  StudioPortalAccessOverview,
} from "@/lib/operations/studio/portal-access";
import styles from "./operations-queues.module.css";

type AccessFilterState = "all" | "active" | "pending" | "revoked" | "expired" | "provider_failed" | "inactive";

type ResponseBody = Readonly<{ error?: string; status?: "sent" | "revoked" }>;

const roleLabels: Record<(typeof portalRoles)[number], string> = {
  billing_contact: "Billing contact",
  contributor: "Contributor",
  owner: "Owner",
  viewer: "Viewer",
};

const stateLabels: Record<StudioPortalAccessEntry["state"], string> = {
  active: "Active",
  expired: "Expired",
  inactive: "Client inactive",
  pending: "Invitation pending",
  provider_failed: "Delivery failed",
  revoked: "Revoked",
};

function stateTone(state: StudioPortalAccessEntry["state"]): "success" | "info" | "warning" | "error" | "neutral" {
  if (state === "active") return "success";
  if (state === "pending") return "info";
  if (state === "expired" || state === "provider_failed") return "error";
  if (state === "revoked") return "neutral";
  return "warning";
}

function pageHref(page: number, query: string, state: AccessFilterState): string {
  const search = new URLSearchParams({ page: String(page) });
  if (query) search.set("query", query);
  if (state !== "all") search.set("state", state);
  return portalPath(`/portal/admin/portal-access?${search.toString()}`);
}

function responseMessage(body: unknown): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string")
    return body.error;
  return "The access outcome could not be confirmed. Refresh the register before trying again.";
}

async function sendOperation(operation: object): Promise<ResponseBody> {
  const response = await fetch("/api/portal/admin/portal-access", {
    body: JSON.stringify(operation),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(responseMessage(body));
  return body as ResponseBody;
}

function date(value: string | null): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(parsed);
}

function InviteClientAccess({
  contacts,
  onComplete,
}: Readonly<{
  contacts: StudioPortalAccessOverview["contacts"];
  onComplete: (message: string) => void;
}>): React.JSX.Element {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const available = contacts.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const selection = String(form.get("contact") ?? "");
    const [organisationId, contactId] = selection.split(":");
    if (!organisationId || !contactId) {
      setMessage("Choose an active client contact before requesting access.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const outcome = await sendOperation({
        action: "invite_existing_client",
        contactId,
        organisationId,
        reviewReference: String(form.get("reviewReference") ?? "").trim(),
        role: String(form.get("role") ?? ""),
      });
      if (outcome.status !== "sent") throw new Error("The invitation was not accepted by the provider.");
      onComplete("Invitation request accepted by the provider. Access begins only after the client accepts it.");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The invitation could not be requested.");
    } finally {
      setPending(false);
    }
  }

  return (
    <PortalCard
      description="Select an existing active client contact. The server reloads that contact before an invitation can be requested."
      title="Invite a client contact"
    >
      <form onSubmit={submit} className={styles.filters} aria-busy={pending}>
        <PortalSelect disabled={!available || pending} label="Client contact" name="contact" required>
          {available ? contacts.map((contact) => (
            <option key={contact.id} value={`${contact.organisationId}:${contact.id}`}>
              {contact.organisationName} · {contact.name} · {contact.email}
            </option>
          )) : <option value="">No active contacts are available</option>}
        </PortalSelect>
        <PortalSelect defaultValue="contributor" disabled={!available || pending} label="Portal role" name="role" required>
          {portalRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
        </PortalSelect>
        <PortalField label="Review reference" required>
          <input disabled={!available || pending} maxLength={200} name="reviewReference" required />
        </PortalField>
        <PortalButton disabled={!available} loading={pending} type="submit">
          Request invitation
        </PortalButton>
      </form>
      <Notice tone="info">
        <strong>Before sending.</strong> Review the contact, client and role. The result reports the provider request, not client acceptance or email reading.
      </Notice>
      {message ? <p role="status" className={styles.empty}>{message}</p> : null}
    </PortalCard>
  );
}

function RevokeAccess({
  entry,
  onComplete,
}: Readonly<{
  entry: StudioPortalAccessEntry;
  onComplete: (message: string) => void;
}>): React.JSX.Element | null {
  const [pending, setPending] = useState(false);
  if (!entry.membershipId || entry.state !== "active") return null;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const outcome = await sendOperation({
        action: "revoke_membership",
        membershipId: entry.membershipId,
        organisationId: entry.organisationId,
        reviewReference: String(form.get("reviewReference") ?? "").trim(),
      });
      if (outcome.status !== "revoked") throw new Error("The membership was not removed.");
      onComplete(`Access removed for ${entry.name}. The client can no longer use this organisation workspace.`);
    } catch (error) {
      onComplete(error instanceof Error ? error.message : "Access could not be removed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.filters} onSubmit={submit} aria-busy={pending}>
      <PortalField label={`Removal reference for ${entry.name}`} required>
        <input disabled={pending} maxLength={200} name="reviewReference" required />
      </PortalField>
      <PortalButton loading={pending} type="submit" variant="destructive">Remove access</PortalButton>
    </form>
  );
}

export function PortalAccessWorkspace({
  data,
}: Readonly<{ data: StudioPortalAccessOverview }>): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const currentState: AccessFilterState = data.state ?? "all";
  return (
    <section className={styles.page} aria-labelledby="portal-access-heading">
      <PageHeader
        description="Client memberships and invitations remain scoped to a single organisation. Every request needs a recorded review reference."
        eyebrow="FSS Studio · Access"
        title="People and portal access"
      />
      <InviteClientAccess contacts={data.contacts} onComplete={(next) => {
        setMessage(next);
        window.setTimeout(() => window.location.reload(), 600);
      }} />
      <PortalCard title="Access register">
        <form className={styles.filters} method="get">
          <PortalField label="Search people or clients">
            <input defaultValue={data.query} maxLength={100} name="query" type="search" />
          </PortalField>
          <PortalSelect defaultValue={currentState} label="Access state" name="state">
            <option value="all">All states</option>
            <option value="active">Active</option>
            <option value="pending">Invitation pending</option>
            <option value="provider_failed">Delivery failed</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
            <option value="inactive">Client inactive</option>
          </PortalSelect>
          <PortalButton type="submit" variant="secondary">Apply filter</PortalButton>
        </form>
      </PortalCard>
      {message ? <Notice tone="info">{message}</Notice> : null}
      {data.items.length === 0 ? (
        <PortalCard title="No matching access records"><p className={styles.empty}>No client memberships or invitations match this server-scoped view.</p></PortalCard>
      ) : (
        <ul className={styles.list} aria-label="Client portal access register">
          {data.items.map((entry) => (
            <li key={entry.id}>
              <PortalCard>
                <div className={styles.row}>
                  <div className={styles.rowSummary}>
                    <h2>{entry.name}</h2>
                    <p>{entry.organisationName} · {entry.email}</p>
                    <p>{roleLabels[entry.role]}</p>
                  </div>
                  <dl className={styles.rowMeta}>
                    <div><dt>Invitation</dt><dd>{date(entry.invitedAt)}</dd></div>
                    <div><dt>Expires</dt><dd>{date(entry.expiresAt)}</dd></div>
                    <div><dt>Last verified</dt><dd>{date(entry.lastVerifiedAt)}</dd></div>
                  </dl>
                  <StatusBadge status={stateTone(entry.state)}>{stateLabels[entry.state]}</StatusBadge>
                </div>
                <RevokeAccess entry={entry} onComplete={setMessage} />
              </PortalCard>
            </li>
          ))}
        </ul>
      )}
      {(data.page > 1 || data.hasNext) ? (
        <nav className={styles.pagination} aria-label="Access register pages">
          {data.page > 1 ? <PortalActionLink href={pageHref(data.page - 1, data.query, currentState)} variant="secondary">Previous page</PortalActionLink> : <span />}
          {data.hasNext ? <PortalActionLink href={pageHref(data.page + 1, data.query, currentState)} variant="secondary">Next page</PortalActionLink> : <span />}
        </nav>
      ) : null}
    </section>
  );
}
