"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  Notice,
  PageHeader,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
  PortalTextarea,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";

const categories = [
  ["project_question", "Project question"],
  ["incident", "Urgent incident"],
  ["workspace_access", "Workspace access"],
  ["billing", "Billing"],
  ["other", "Other"],
] as const;

export function ClientHelp({
  organisationId,
}: {
  organisationId: string;
}): React.JSX.Element {
  const idempotencyKey = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    idempotencyKey.current ??= crypto.randomUUID();
    setPending(true);
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch("/api/portal/support/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          idempotencyKey: idempotencyKey.current,
          organisationId,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        request?: { reference: string };
      };
      if (!response.ok || !payload.request) throw new Error(payload.error);
      setMessage({
        text: `Help request ${payload.request.reference} received. FSS will review it.`,
        tone: "success",
      });
      idempotencyKey.current = null;
      form.reset();
    } catch {
      setMessage({
        text: "We could not save your help request. Your details are still in the form.",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { href: portalPath("/portal"), label: "Your workspace" },
          { label: "Help" },
        ]}
        eyebrow="Support"
        title="How can we help?"
        description="Send FSS a focused request and we will respond through the right route."
      />
      <Notice tone="info">
        A help request does not change your agreement or payment method.
      </Notice>
      <PortalCard title="Create a help request">
        <form onSubmit={submit} aria-busy={pending}>
          <PortalSelect
            label="Support topic"
            name="category"
            required
            defaultValue="project_question"
          >
            {categories.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </PortalSelect>
          <PortalField label="Subject" required>
            <input disabled={pending} maxLength={160} name="subject" />
          </PortalField>
          <PortalTextarea
            disabled={pending}
            label="How can we help?"
            maxLength={10000}
            name="message"
            required
          />
          <PortalButton loading={pending} type="submit">
            Create help request
          </PortalButton>
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        </form>
      </PortalCard>
    </div>
  );
}
