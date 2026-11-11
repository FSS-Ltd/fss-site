"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Notice,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
  PortalTextarea,
} from "@/components/portal/ui";
import { createStaffRequestSchema } from "@/lib/operations/requests/validation";
import type { StaffRequestCreationClient } from "@/lib/operations/requests/staff-repository";
import { requestPriorities } from "@/lib/operations/requests/types";
import styles from "./requests.module.css";

const requestTypes = ["work", "change", "bug", "help"] as const;
type RequestType = (typeof requestTypes)[number];

const requestTypeLabels: Record<RequestType, string> = {
  bug: "Bug report",
  change: "Change",
  help: "Help",
  work: "Work request",
};

function textValue(data: FormData, name: string): string {
  return String(data.get(name) ?? "").trim();
}

function createdRequestId(body: unknown): string | null {
  if (
    body !== null &&
    typeof body === "object" &&
    "request" in body &&
    body.request !== null &&
    typeof body.request === "object" &&
    "id" in body.request &&
    typeof body.request.id === "string"
  ) {
    return body.request.id;
  }
  return null;
}

export function StaffRequestForm({
  clients,
}: Readonly<{
  clients: StaffRequestCreationClient[];
}>): React.JSX.Element {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [projectId, setProjectId] = useState(clients[0]?.projects[0]?.id ?? "");
  const [type, setType] = useState<RequestType>("work");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const client = clients.find((item) => item.id === clientId);
  const projects = client?.projects ?? [];

  function selectClient(nextClientId: string): void {
    setClientId(nextClientId);
    setProjectId(
      clients.find((client) => client.id === nextClientId)?.projects[0]?.id ??
        "",
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending || !clientId || !projectId) return;
    const formData = new FormData(event.currentTarget);
    idempotencyKey.current ??= crypto.randomUUID();
    const bug = type === "bug";
    const input = createStaffRequestSchema.safeParse({
      projectId,
      title: textValue(formData, "title"),
      description: bug
        ? textValue(formData, "actualBehaviour")
        : textValue(formData, "description"),
      type,
      desiredOutcome: bug
        ? textValue(formData, "expectedBehaviour")
        : textValue(formData, "desiredOutcome"),
      desiredDate: textValue(formData, "desiredDate") || null,
      impact: textValue(formData, "impact"),
      reproductionSteps: bug ? textValue(formData, "reproductionSteps") : "",
      expectedBehaviour: bug ? textValue(formData, "expectedBehaviour") : "",
      actualBehaviour: bug ? textValue(formData, "actualBehaviour") : "",
      priority: textValue(formData, "priority"),
      idempotencyKey: idempotencyKey.current,
    });
    if (!input.success) {
      setMessage("Check the marked fields before creating this request.");
      const firstField = event.currentTarget.elements.namedItem(
        String(input.error.issues[0]?.path[0]),
      );
      if (firstField instanceof HTMLElement) firstField.focus();
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/portal/admin/clients/${encodeURIComponent(clientId)}/requests`,
        {
          body: JSON.stringify(input.data),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const body: unknown = await response.json().catch(() => null);
      const requestId = response.ok ? createdRequestId(body) : null;
      if (!requestId) {
        const error =
          body !== null &&
          typeof body === "object" &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "We could not create this request. Your draft is still here. Try again.";
        setMessage(error);
        return;
      }
      router.push(
        `/admin/clients/${encodeURIComponent(clientId)}/requests/${encodeURIComponent(requestId)}`,
      );
      router.refresh();
    } catch {
      setMessage(
        "We could not create this request. Your draft is still here. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form aria-busy={pending} className={styles.form} onSubmit={submit}>
      <fieldset className={styles.fieldset} disabled={pending}>
        <PortalCard
          description="Choose the client and client-visible project before creating work. The request starts in assessment; it does not approve scope or delivery."
          title="Request details"
        >
          <PortalSelect
            label="Client"
            onChange={(event) => selectClient(event.target.value)}
            required
            value={clientId}
          >
            {clients.length ? null : <option value="">No active clients</option>}
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.displayName}
              </option>
            ))}
          </PortalSelect>
          <PortalSelect
            disabled={!projects.length}
            label="Project"
            onChange={(event) => setProjectId(event.target.value)}
            required
            value={projectId}
          >
            {projects.length ? null : <option value="">No client-visible projects</option>}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </PortalSelect>
          <PortalSelect
            label="Type"
            onChange={(event) => setType(event.target.value as RequestType)}
            value={type}
          >
            {requestTypes.map((requestType) => (
              <option key={requestType} value={requestType}>
                {requestTypeLabels[requestType]}
              </option>
            ))}
          </PortalSelect>
          <PortalField label="Request title" required>
            <input maxLength={160} name="title" />
          </PortalField>
          {type === "bug" ? (
            <>
              <PortalTextarea
                label="Steps to reproduce"
                maxLength={4000}
                name="reproductionSteps"
                required
                rows={4}
              />
              <PortalTextarea
                label="What you expected"
                maxLength={4000}
                name="expectedBehaviour"
                required
                rows={4}
              />
              <PortalTextarea
                label="What happened instead"
                maxLength={4000}
                name="actualBehaviour"
                required
                rows={4}
              />
            </>
          ) : (
            <>
              <PortalTextarea
                label="Description"
                maxLength={10000}
                name="description"
                required
                rows={5}
              />
              <PortalTextarea
                label="Desired outcome"
                maxLength={4000}
                name="desiredOutcome"
                required
                rows={4}
              />
            </>
          )}
        </PortalCard>
        <PortalCard title="Delivery assessment">
          <PortalSelect disabled label="Scope decision" value="assessment_pending">
            <option value="assessment_pending">Assessment pending</option>
          </PortalSelect>
          <PortalSelect defaultValue="normal" label="Operational priority" name="priority" required>
            {requestPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </PortalSelect>
          <PortalField label="Desired date" hint="Optional. This is not an agreed delivery date.">
            <input name="desiredDate" type="date" />
          </PortalField>
          <PortalTextarea label="Impact" maxLength={4000} name="impact" rows={3} />
          <Notice tone="info">
            Public request details are shared with the client. Internal priority
            remains in FSS Studio. An owner and scope decision are recorded when
            FSS acknowledges the request.
          </Notice>
        </PortalCard>
        <PortalButton
          disabled={!clientId || !projectId}
          disabledReason="Choose a client with a client-visible project before creating work."
          loading={pending}
          type="submit"
        >
          Create request
        </PortalButton>
      </fieldset>
      <p aria-atomic="true" className={styles.feedback} role="status">
        {message}
      </p>
    </form>
  );
}
