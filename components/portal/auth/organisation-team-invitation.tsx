"use client";

import { useState, type FormEvent } from "react";
import {
  Notice,
  PortalButton,
  PortalField,
  PortalSelect,
} from "@/components/portal/ui";
import type { PortalRole } from "@/lib/operations/auth/types";

const roles: readonly Exclude<PortalRole, "owner">[] = [
  "contributor",
  "billing_contact",
  "viewer",
];

export function OrganisationTeamInvitation({
  organisationId,
}: {
  organisationId: string;
}): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/portal/organisations/${organisationId}/invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            Object.fromEntries(new FormData(event.currentTarget)),
          ),
        },
      );
      if (response.ok) {
        event.currentTarget.reset();
        setMessage(
          "Invitation sent. Access starts when the recipient accepts it.",
        );
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      setMessage(
        body &&
          typeof body === "object" &&
          "message" in body &&
          typeof body.message === "string"
          ? body.message
          : "The invitation could not be sent.",
      );
    } catch {
      setMessage("The invitation could not be sent. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={pending}>
      <PortalField label="Name" required>
        <input
          autoComplete="name"
          disabled={pending}
          maxLength={200}
          name="name"
        />
      </PortalField>
      <PortalField label="Email address" required>
        <input
          autoComplete="email"
          disabled={pending}
          maxLength={254}
          name="email"
          type="email"
        />
      </PortalField>
      <PortalSelect
        defaultValue="contributor"
        disabled={pending}
        label="Role"
        name="role"
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {role.replace("_", " ")}
          </option>
        ))}
      </PortalSelect>
      <PortalButton loading={pending} type="submit">
        Invite team member
      </PortalButton>
      {message ? <Notice tone="info">{message}</Notice> : null}
    </form>
  );
}
