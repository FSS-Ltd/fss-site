"use client";

import { useState, type FormEvent } from "react";
import { portalPath } from "@/lib/operations/auth/portal-url";
import {
  Notice,
  PageHeader,
  PortalButton,
  PortalCard,
  PortalField,
} from "@/components/portal/ui";
import styles from "./client-form.module.css";

type CreateClientResponse = Readonly<{
  error?: string;
  fields?: Record<string, string>;
  organisationId?: string;
}>;

function isCreateClientResponse(value: unknown): value is CreateClientResponse {
  return value !== null && typeof value === "object";
}

function formValue(data: FormData, name: string): string {
  return String(data.get(name) ?? "").trim();
}

export function StudioClientForm({
  embedded = false,
  defaultTimezone = "Europe/London",
  onCancel,
}: Readonly<{
  embedded?: boolean;
  defaultTimezone?: string;
  onCancel?: () => void;
}> = {}): React.JSX.Element {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const client = {
      displayName: formValue(data, "displayName"),
      legalName: formValue(data, "legalName"),
      primaryContact: {
        email: formValue(data, "primaryContactEmail"),
        name: formValue(data, "primaryContactName"),
        role: formValue(data, "primaryContactRole"),
      },
      reviewReference: formValue(data, "reviewReference"),
      timezone: formValue(data, "timezone"),
    };

    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const response = await fetch("/api/portal/admin/clients", {
        body: JSON.stringify(client),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !isCreateClientResponse(body) ||
        typeof body.organisationId !== "string"
      ) {
        const reply = isCreateClientResponse(body) ? body : {};
        setErrors(reply.fields ?? {});
        setMessage(
          reply.error ??
            "We could not save the client. Your details are still here. Please try again.",
        );
        return;
      }
      window.location.assign(
        portalPath(
          `/portal/admin/clients/${encodeURIComponent(body.organisationId)}`,
        ),
      );
    } catch {
      setMessage(
        "We could not save the client. Your details are still here. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label={embedded ? "New client details" : undefined}>
      {!embedded && (
        <PageHeader
          breadcrumbs={[
            { href: portalPath("/portal/admin/clients"), label: "Clients" },
            { label: "Add a client" },
          ]}
          description="Start with the organisation and its primary contact. Access, invitations and messages are reviewed separately."
          eyebrow="FSS Studio · Clients"
          title="Add a client"
        />
      )}
      <form className={styles.form} onSubmit={submit} aria-busy={pending}>
        <div className={styles.formSections}>
          <PortalCard
            description="Use the name the client recognises and the legal entity that will enter agreements."
            title="Organisation"
          >
            <PortalField
              error={errors.displayName}
              label="Display name"
              required
            >
              <input disabled={pending} maxLength={200} name="displayName" />
            </PortalField>
            <PortalField
              error={errors.legalName}
              label="Legal entity name"
              required
            >
              <input disabled={pending} maxLength={200} name="legalName" />
            </PortalField>
            <PortalField error={errors.timezone} label="Time zone" required>
              <input
                defaultValue={defaultTimezone}
                disabled={pending}
                maxLength={100}
                name="timezone"
              />
            </PortalField>
          </PortalCard>
          <PortalCard
            description="This records the contact and job title only. It does not create portal access."
            title="Primary contact"
          >
            <PortalField
              error={errors["primaryContact.name"]}
              label="Full name"
              required
            >
              <input
                disabled={pending}
                maxLength={200}
                name="primaryContactName"
              />
            </PortalField>
            <PortalField
              error={errors["primaryContact.email"]}
              label="Email address"
              required
            >
              <input
                disabled={pending}
                maxLength={254}
                name="primaryContactEmail"
                type="email"
              />
            </PortalField>
            <PortalField
              error={errors["primaryContact.role"]}
              label="Role"
              required
            >
              <input
                disabled={pending}
                maxLength={200}
                name="primaryContactRole"
              />
            </PortalField>
          </PortalCard>
        </div>
        <PortalCard
          description="This is retained with the client record as the reviewed reason for this change."
          title="Review record"
        >
          <PortalField
            error={errors.reviewReference}
            label="Review reference"
            required
          >
            <input
              defaultValue="Create reviewed client record"
              disabled={pending}
              maxLength={200}
              name="reviewReference"
            />
          </PortalField>
        </PortalCard>
        {!embedded ? (
          <Notice tone="info">
            <strong>What saving does</strong>
            <br />
            Creates the client record only. Invitations, agreements and welcome
            messages each have their own review step.
          </Notice>
        ) : null}
        <div className={styles.formActions}>
          {onCancel ? (
            <PortalButton
              disabled={pending}
              onClick={onCancel}
              type="button"
              variant="secondary"
            >
              Cancel
            </PortalButton>
          ) : null}
          <PortalButton loading={pending} type="submit">
            Save client
          </PortalButton>
          {message ? <Notice tone="error">{message}</Notice> : null}
        </div>
      </form>
    </section>
  );
}
