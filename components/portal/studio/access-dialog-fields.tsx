"use client";

import { Notice, PortalField, PortalSelect } from "@/components/portal/ui";
import { portalRoles, type PortalRole } from "@/lib/operations/auth/types";
import type {
  StudioPortalAccessEntry,
  StudioPortalContact,
} from "@/lib/operations/studio/portal-access";
import { accessRole } from "./access-presentation";
import styles from "./portal-access.module.css";

export type AccessDialogTarget =
  | Readonly<{
      kind: "client";
      contacts: readonly StudioPortalContact[];
      entry?: never;
    }>
  | Readonly<{ kind: "staff"; contacts?: never; entry?: never }>
  | Readonly<{
      kind: "remove";
      entry: StudioPortalAccessEntry;
      contacts?: never;
    }>;

export function AccessDialogFields({
  target: props,
  pending,
  role,
  setRole,
}: Readonly<{
  target: AccessDialogTarget;
  pending: boolean;
  role: PortalRole;
  setRole: (role: PortalRole) => void;
}>): React.JSX.Element {
  return props.kind === "client" ? (
    <>
      <PortalSelect
        disabled={pending}
        label="Client contact"
        name="contact"
        required
      >
        {props.contacts.map((contact) => (
          <option key={contact.id} value={contact.id}>
            {contact.organisationName} · {contact.name} · {contact.email}
          </option>
        ))}
      </PortalSelect>
      <PortalSelect
        disabled={pending}
        label="Portal role"
        name="role"
        onChange={(event) =>
          setRole(
            portalRoles.find((value) => value === event.currentTarget.value) ??
              "contributor",
          )
        }
        value={role}
      >
        {portalRoles.map((value) => (
          <option key={value} value={value}>
            {accessRole(value).label}
          </option>
        ))}
      </PortalSelect>
      <p className={styles.detail}>
        {accessRole(role).detail} Scope: the selected client organisation.
      </p>
    </>
  ) : props.kind === "staff" ? (
    <>
      <PortalField label="Full name" required>
        <input
          autoComplete="name"
          disabled={pending}
          maxLength={200}
          name="name"
        />
      </PortalField>
      <PortalField label="Work email" required>
        <input
          autoComplete="email"
          disabled={pending}
          maxLength={254}
          name="email"
          type="email"
        />
      </PortalField>
      <Notice tone="warning">
        <strong>FSS admin.</strong> Operations access across client
        organisations. This invitation grants staff access and requires founder
        review.
      </Notice>
    </>
  ) : (
    <div className={styles.target}>
      <strong>{props.entry.name}</strong>
      <p>{props.entry.email}</p>
      <p>
        {props.entry.organisationName ?? "New client"} ·{" "}
        {accessRole(props.entry.role).label}
      </p>
      <p>{accessRole(props.entry.role).detail}</p>
    </div>
  );
}
