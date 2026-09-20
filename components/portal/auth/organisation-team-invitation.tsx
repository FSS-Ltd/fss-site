"use client";

import { useState, type FormEvent } from "react";
import type { PortalRole } from "@/lib/operations/auth/types";

const roles: readonly Exclude<PortalRole, "owner">[] = [
  "contributor",
  "billing_contact",
  "viewer",
];

export function OrganisationTeamInvitation({ organisationId }: { organisationId: string }): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/portal/organisations/${organisationId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    setPending(false);
    if (response.ok) {
      event.currentTarget.reset();
      setMessage("Invitation sent. Access starts when the recipient accepts it.");
      return;
    }
    const body: unknown = await response.json().catch(() => null);
    setMessage(body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "The invitation could not be sent.");
  }

  return (
    <form onSubmit={submit}>
      <label>Name<input name="name" autoComplete="name" maxLength={200} required disabled={pending} /></label>
      <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending} /></label>
      <label>Role<select name="role" defaultValue="contributor" disabled={pending}>{roles.map((role) => <option key={role} value={role}>{role.replace("_", " ")}</option>)}</select></label>
      <button type="submit" disabled={pending}>{pending ? "Sending…" : "Invite team member"}</button>
      {message && <p aria-live="polite">{message}</p>}
    </form>
  );
}
