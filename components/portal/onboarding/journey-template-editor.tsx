"use client";

import { useRef, useState, type FormEvent } from "react";
import { FilePenLine, Send } from "lucide-react";
import { parseOnboardingTemplateDraft } from "@/lib/operations/onboarding/workspace-schema";
import type {
  OnboardingTaskDefinition,
  OnboardingWorkspaceTemplateDraft,
} from "@/lib/operations/onboarding/workspace-types";
import {
  Notice,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
  StatusBadge,
} from "@/components/portal/ui";
import { JourneyChecklistEditor } from "./journey-checklist-editor";

type JourneyTemplateEditorProps = Readonly<{
  commandEndpoint: string;
  initialTaskId?: string;
  initialTemplateId?: string;
  templates: readonly OnboardingWorkspaceTemplateDraft[];
}>;

type TemplateDraftResult = Readonly<{
  kind: "template_draft";
  templateId: string;
  draftVersion: number;
}>;

type TemplateVersionResult = Readonly<{
  kind: "template_version";
  templateVersionId: string;
  version: number;
}>;

function responseError(body: unknown): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return "The template could not be saved. Refresh and try again.";
}

function isTemplateDraftResult(value: unknown): value is TemplateDraftResult {
  return (
    value !== null &&
    typeof value === "object" &&
    "kind" in value &&
    value.kind === "template_draft" &&
    "templateId" in value &&
    typeof value.templateId === "string" &&
    "draftVersion" in value &&
    typeof value.draftVersion === "number"
  );
}

function isTemplateVersionResult(
  value: unknown,
): value is TemplateVersionResult {
  return (
    value !== null &&
    typeof value === "object" &&
    "kind" in value &&
    value.kind === "template_version" &&
    "templateVersionId" in value &&
    typeof value.templateVersionId === "string" &&
    "version" in value &&
    typeof value.version === "number"
  );
}

function newTemplateId(): string {
  return crypto.randomUUID();
}

function initialTemplate(
  templates: readonly OnboardingWorkspaceTemplateDraft[],
  templateId?: string,
): OnboardingWorkspaceTemplateDraft | undefined {
  return (
    templates.find((template) => template.id === templateId) ?? templates[0]
  );
}

export function JourneyTemplateEditor({
  commandEndpoint,
  initialTaskId,
  initialTemplateId,
  templates,
}: JourneyTemplateEditorProps): React.JSX.Element {
  const initial = initialTemplate(templates, initialTemplateId);
  const templateId = useRef(initial?.id ?? "");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    initial?.id ?? "",
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [tasks, setTasks] = useState<OnboardingTaskDefinition[]>(() => [
    ...(initial?.tasks ?? []),
  ]);
  const [expectedVersion, setExpectedVersion] = useState(
    initial?.draftVersion ?? 0,
  );
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function selectTemplate(nextTemplateId: string): void {
    const template = templates.find((item) => item.id === nextTemplateId);
    setSelectedTemplateId(nextTemplateId);
    if (!template) return;
    templateId.current = template.id;
    setName(template.name);
    setTasks([...template.tasks]);
    setExpectedVersion(template.draftVersion);
    setDraftVersion(null);
    setMessage(null);
  }

  function createTemplate(): void {
    templateId.current = "";
    setSelectedTemplateId("");
    setName("");
    setTasks([]);
    setExpectedVersion(0);
    setDraftVersion(null);
    setMessage(null);
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const reviewReference = new FormData(event.currentTarget).get(
      "reviewReference",
    );
    if (typeof reviewReference !== "string") return;
    try {
      parseOnboardingTemplateDraft({ name, tasks });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Review the template fields.",
      );
      return;
    }
    if (!templateId.current) templateId.current = newTemplateId();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(commandEndpoint, {
        body: JSON.stringify({
          action: "save_template_draft",
          expectedVersion,
          name,
          reviewReference,
          tasks,
          templateId: templateId.current,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(responseError(body));
        return;
      }
      if (!isTemplateDraftResult(body)) {
        setMessage(
          "The saved draft response was incomplete. Refresh and try again.",
        );
        return;
      }
      templateId.current = body.templateId;
      setExpectedVersion(body.draftVersion);
      setDraftVersion(body.draftVersion);
      setMessage(`Template draft version ${body.draftVersion} saved.`);
    } catch {
      setMessage(
        "The template could not be saved. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function publishTemplate(): Promise<void> {
    if (!templateId.current || !draftVersion) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(commandEndpoint, {
        body: JSON.stringify({
          action: "publish_template",
          expectedDraftVersion: draftVersion,
          reviewReference: "Publish reviewed welcome template",
          templateId: templateId.current,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(responseError(body));
        return;
      }
      if (!isTemplateVersionResult(body)) {
        setMessage(
          "The publication response was incomplete. Refresh and try again.",
        );
        return;
      }
      setMessage(
        `Published template version ${body.version}. Refresh to review it.`,
      );
      setDraftVersion(null);
    } catch {
      setMessage(
        "The template could not be published. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const selectedTask = initialTaskId
    ? tasks.find((task) => task.id === initialTaskId)
    : null;

  return (
    <section aria-labelledby="welcome-template-heading">
      <PortalCard
        description="Create and publish an approved checklist version for this client. Existing journeys retain the version already bound to them."
        headingId="welcome-template-heading"
        title="Welcome templates"
        tone="accent"
      >
        <PortalSelect
          label="Approved template"
          onChange={(event) => selectTemplate(event.target.value)}
          value={selectedTemplateId}
        >
          <option value="">New welcome template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} · draft {template.draftVersion} · published{" "}
              {template.publishedVersion}
            </option>
          ))}
        </PortalSelect>
        <PortalButton
          onClick={createTemplate}
          type="button"
          variant="secondary"
        >
          Create new template
        </PortalButton>
      </PortalCard>

      <form aria-busy={pending} onSubmit={saveDraft}>
        <PortalCard title="Template editor">
          <PortalField label="Template name" required>
            <input
              maxLength={160}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </PortalField>
          <PortalField label="Review reference" required>
            <input maxLength={200} name="reviewReference" required />
          </PortalField>
          <JourneyChecklistEditor onChange={setTasks} tasks={tasks} />
          {selectedTask ? (
            <Notice tone="info">
              Client preview: {selectedTask.title} ·{" "}
              {selectedTask.required ? "Required" : "Optional"} ·{" "}
              {selectedTask.instructions}
            </Notice>
          ) : null}
          <PortalButton disabled={pending} loading={pending} type="submit">
            <FilePenLine aria-hidden="true" size={16} /> Save checklist draft
          </PortalButton>
          {message ? <p role="status">{message}</p> : null}
        </PortalCard>
      </form>

      <PortalCard title="Versioned publishing">
        <StatusBadge status={draftVersion ? "warning" : "info"}>
          {draftVersion
            ? `Draft version ${draftVersion} ready to publish`
            : "Save a reviewed draft before publishing"}
        </StatusBadge>
        <Notice tone="warning">
          Publishing creates a new version. Active journeys retain their
          approved checklist and are never rewritten by this action.
        </Notice>
        <PortalButton
          disabled={!draftVersion || pending}
          loading={pending}
          onClick={publishTemplate}
          type="button"
        >
          <Send aria-hidden="true" size={16} /> Publish template version
        </PortalButton>
      </PortalCard>
    </section>
  );
}
