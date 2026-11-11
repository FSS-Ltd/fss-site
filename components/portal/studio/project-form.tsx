"use client";

import { useState, type FormEvent } from "react";
import {
  Notice,
  PageHeader,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
  PortalTextarea,
} from "@/components/portal/ui";
import type { StaffProjectDetail } from "@/lib/operations/projects/staff-service";
import { projectStatuses } from "@/lib/operations/projects/types";
import styles from "./project-form.module.css";

type ProjectUpdateResponse = Readonly<{ error?: string; version?: number }>;

function formValue(data: FormData, name: string): string {
  return String(data.get(name) ?? "").trim();
}

function nullableDate(value: string): string | null {
  return value || null;
}

function nullableInteger(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function responseError(body: unknown): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return "We could not save this project. Your edits are still here. Please try again.";
}

export function StudioProjectForm({
  project,
}: Readonly<{ project: StaffProjectDetail }>): React.JSX.Element {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [publicCopy, setPublicCopy] = useState({
    outcome: project.outcome,
    summary: project.summary,
    title: project.title,
  });

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    const metadata = {
      agreementId: project.agreementId,
      deliverables: lines(formValue(data, "deliverables")),
      internalEstimateMinutes: nullableInteger(
        formValue(data, "internalEstimateMinutes"),
      ),
      internalNotes: formValue(data, "internalNotes"),
      outcome: formValue(data, "outcome"),
      ownerDisplay: formValue(data, "ownerDisplay"),
      scheduleDependencies: lines(formValue(data, "scheduleDependencies")),
      scheduleEvidence: formValue(data, "scheduleEvidence") || null,
      status: formValue(data, "status"),
      summary: formValue(data, "summary"),
      targetDate: nullableDate(formValue(data, "targetDate")),
      title: formValue(data, "title"),
      visibility: formValue(data, "visibility"),
    };
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/portal/admin/projects/${encodeURIComponent(project.id)}`,
        {
          body: JSON.stringify({
            action: "update",
            expectedVersion: project.version,
            metadata,
            projectId: project.id,
            reviewReference: formValue(data, "reviewReference"),
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(responseError(body));
        return;
      }
      const result = body as ProjectUpdateResponse;
      if (typeof result.version !== "number") {
        setMessage("The saved project response was incomplete. Refresh and try again.");
        return;
      }
      window.location.reload();
    } catch {
      setMessage(
        "We could not save this project. Your edits are still here. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="project-editor-heading">
      <PageHeader
        description="Update retained project details with the current version. Client-visible details and internal delivery notes stay separate."
        eyebrow="FSS Studio · Projects"
        title="Edit project"
      />
      <form className={styles.form} onSubmit={submit} aria-busy={pending}>
        <div className={styles.sections}>
          <PortalCard
            description="These details can be shown in the client workspace when the project visibility is set to Client."
            title="Public project details"
          >
            <PortalField label="Project title" required>
              <input
                defaultValue={project.title}
                disabled={pending}
                maxLength={160}
                name="title"
                onChange={(event) =>
                  setPublicCopy((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </PortalField>
            <PortalTextarea
              defaultValue={project.summary}
              disabled={pending}
              label="Project summary"
              maxLength={4000}
              name="summary"
              onChange={(event) =>
                setPublicCopy((current) => ({
                  ...current,
                  summary: event.target.value,
                }))
              }
              required
              rows={4}
            />
            <PortalTextarea
              defaultValue={project.outcome}
              disabled={pending}
              label="Agreed outcome"
              maxLength={4000}
              name="outcome"
              onChange={(event) =>
                setPublicCopy((current) => ({
                  ...current,
                  outcome: event.target.value,
                }))
              }
              required
              rows={4}
            />
            <PortalTextarea
              defaultValue={project.deliverables.join("\n")}
              disabled={pending}
              hint="One client-visible deliverable per line."
              label="Deliverables"
              maxLength={8000}
              name="deliverables"
              required
              rows={5}
            />
            <PortalSelect
              defaultValue={project.visibility}
              disabled={pending}
              label="Client visibility"
              name="visibility"
              required
            >
              <option value="client">Visible to the client</option>
              <option value="internal">Internal only</option>
            </PortalSelect>
          </PortalCard>
          <PortalCard
            description="Operational context stays inside FSS Studio and is never included in the client presentation preview."
            title="Internal delivery notes"
          >
            <PortalField label="Delivery owner" required>
              <input
                defaultValue={project.ownerDisplay}
                disabled={pending}
                maxLength={160}
                name="ownerDisplay"
              />
            </PortalField>
            <PortalSelect
              defaultValue={project.status}
              disabled={pending}
              label="Delivery status"
              name="status"
              required
            >
              {projectStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </PortalSelect>
            <PortalField label="Target date" hint="Optional">
              <input
                defaultValue={project.targetDate ?? ""}
                disabled={pending}
                name="targetDate"
                type="date"
              />
            </PortalField>
            <PortalTextarea
              defaultValue={project.scheduleDependencies.join("\n")}
              disabled={pending}
              hint="One internal dependency per line."
              label="Schedule dependencies"
              maxLength={4000}
              name="scheduleDependencies"
              rows={4}
            />
            <PortalTextarea
              defaultValue={project.scheduleEvidence ?? ""}
              disabled={pending}
              label="Schedule evidence"
              maxLength={4000}
              name="scheduleEvidence"
              rows={3}
            />
            <PortalTextarea
              defaultValue={project.internalNotes}
              disabled={pending}
              label="Internal notes"
              maxLength={10000}
              name="internalNotes"
              rows={6}
            />
            <PortalField label="Internal estimate (minutes)" hint="Optional">
              <input
                defaultValue={project.internalEstimateMinutes ?? ""}
                disabled={pending}
                max={2147483647}
                min={0}
                name="internalEstimateMinutes"
                type="number"
              />
            </PortalField>
          </PortalCard>
        </div>
        <PortalCard
          description="This preview intentionally contains only the fields that may be client-visible."
          title="Client presentation preview"
        >
          <div className={styles.publicPreview}>
            <h3>{publicCopy.title}</h3>
            <p>{publicCopy.summary}</p>
            <p>{publicCopy.outcome}</p>
          </div>
        </PortalCard>
        <PortalCard title="Review record">
          <PortalField label="Review reference" required>
            <input
              defaultValue="Reviewed client project update"
              disabled={pending}
              maxLength={200}
              name="reviewReference"
            />
          </PortalField>
        </PortalCard>
        <div className={styles.actions}>
          <PortalButton loading={pending} type="submit">
            Save project
          </PortalButton>
          {message ? <Notice tone="error">{message}</Notice> : null}
        </div>
      </form>
    </section>
  );
}
