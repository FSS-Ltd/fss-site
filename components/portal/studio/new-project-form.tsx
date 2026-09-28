"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Notice,
  PageHeader,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
  PortalTextarea,
} from "@/components/portal/ui";
import styles from "./project-form.module.css";

type AgreementChoice = Readonly<{ id: string; title: string }>;

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getError(body: unknown): string {
  return body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : "We could not create this project. Please try again.";
}

export function NewStudioProjectForm({
  agreements,
  organisationId,
  organisationName,
}: Readonly<{
  agreements: readonly AgreementChoice[];
  organisationId: string;
  organisationName: string;
}>): React.JSX.Element {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const agreementId = String(data.get("agreementId") ?? "");
    const title = String(data.get("title") ?? "").trim();
    const summary = String(data.get("summary") ?? "").trim();
    const outcome = String(data.get("outcome") ?? "").trim();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/portal/admin/clients/${encodeURIComponent(organisationId)}/projects`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "create",
            reviewReference: String(data.get("reviewReference") ?? "").trim(),
            metadata: {
              agreementId,
              title,
              summary,
              outcome,
              deliverables: lines(String(data.get("deliverables") ?? "")),
              status: "planned",
              ownerDisplay: String(data.get("ownerDisplay") ?? "").trim(),
              targetDate: String(data.get("targetDate") ?? "") || null,
              scheduleDependencies: [],
              scheduleEvidence: null,
              internalNotes: "",
              internalEstimateMinutes: null,
              visibility: "client",
            },
          }),
        },
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(getError(body));
        return;
      }
      if (
        body === null ||
        typeof body !== "object" ||
        !("id" in body) ||
        typeof body.id !== "string"
      ) {
        setError("The project response was incomplete. Refresh and try again.");
        return;
      }
      router.push(`/portal/admin/projects/${encodeURIComponent(body.id)}/edit`);
      router.refresh();
    } catch {
      setError(
        "We could not create this project. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label="Plan a project">
      <PageHeader
        description={`Plan the agreed delivery for ${organisationName}. The project will be linked to its agreement.`}
        eyebrow="FSS Studio · Projects"
        title="Plan a project"
      />
      <form className={styles.form} onSubmit={submit} aria-busy={pending}>
        <PortalCard title="Project plan">
          <PortalSelect label="Agreement" name="agreementId" required>
            <option value="">Choose an agreement</option>
            {agreements.map((agreement) => (
              <option key={agreement.id} value={agreement.id}>
                {agreement.title}
              </option>
            ))}
          </PortalSelect>
          <PortalField label="Project title" required>
            <input disabled={pending} maxLength={160} name="title" required />
          </PortalField>
          <PortalTextarea
            disabled={pending}
            label="Project summary"
            maxLength={4000}
            name="summary"
            required
            rows={3}
          />
          <PortalTextarea
            disabled={pending}
            label="Agreed outcome"
            maxLength={4000}
            name="outcome"
            required
            rows={3}
          />
          <PortalTextarea
            disabled={pending}
            hint="One deliverable per line."
            label="Deliverables"
            maxLength={8000}
            name="deliverables"
            rows={4}
          />
          <div className={styles.sections}>
            <PortalField label="Delivery owner" required>
              <input
                defaultValue="Your FSS team"
                disabled={pending}
                maxLength={160}
                name="ownerDisplay"
                required
              />
            </PortalField>
            <PortalField label="Target date" hint="Optional">
              <input disabled={pending} name="targetDate" type="date" />
            </PortalField>
          </div>
        </PortalCard>
        <PortalCard title="Review record">
          <PortalField
            label="Review reference"
            hint="Record the approved project plan or scope review."
            required
          >
            <input
              disabled={pending}
              maxLength={200}
              name="reviewReference"
              required
            />
          </PortalField>
        </PortalCard>
        <div className={styles.actions}>
          <PortalButton loading={pending} type="submit">
            Create project
          </PortalButton>
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </form>
    </section>
  );
}
