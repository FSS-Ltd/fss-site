"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileSignature,
  FileUp,
  ReceiptText,
} from "lucide-react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalButton,
  PortalCard,
  PortalCheckbox,
  PortalField,
  StatusBadge,
} from "@/components/portal/ui";
import type { ClientOnboardingTask } from "@/lib/operations/onboarding/client-workspace";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { PortalWorkspaceDocument } from "@/lib/operations/workspaces/types";
import styles from "./client-onboarding.module.css";

type TaskCommandResult = Readonly<{ taskId: string; state: "complete" }>;

type ClientOnboardingTaskDetailProps = Readonly<{
  documents?: readonly PortalWorkspaceDocument[];
  organisationId: string;
  task: ClientOnboardingTask;
}>;

function gettingStartedHref(organisationId: string): string {
  return `${portalPath("/portal/getting-started")}?organisationId=${encodeURIComponent(organisationId)}`;
}

function taskEndpoint(organisationId: string, taskId: string): string {
  return `/api/portal/organisations/${encodeURIComponent(organisationId)}/onboarding/tasks/${encodeURIComponent(taskId)}`;
}

function messageFromResponse(body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  )
    return body.error;
  return "We could not save this task. Refresh and try again.";
}

function taskIcon(task: ClientOnboardingTask): React.JSX.Element {
  if (task.kind === "profile")
    return <FileSignature aria-hidden="true" size={22} />;
  if (task.kind === "upload") return <FileUp aria-hidden="true" size={22} />;
  if (task.kind === "booking")
    return <CalendarDays aria-hidden="true" size={22} />;
  if (task.kind === "billing")
    return <ReceiptText aria-hidden="true" size={22} />;
  return <CheckCircle2 aria-hidden="true" size={22} />;
}

function TaskHeading({
  organisationId,
  task,
}: Pick<
  ClientOnboardingTaskDetailProps,
  "organisationId" | "task"
>): React.JSX.Element {
  return (
    <>
      <PortalActionLink
        className={styles.returnLink}
        href={gettingStartedHref(organisationId)}
        variant="quiet"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Return to your launch checklist
      </PortalActionLink>
      <PageHeader
        description={task.instructions}
        eyebrow="Launch task"
        title={task.title}
      />
    </>
  );
}

function CompleteTask({
  task,
}: Pick<ClientOnboardingTaskDetailProps, "task">): React.JSX.Element {
  return (
    <PortalCard title="Task complete" tone="dark">
      <div className={styles.detailCard}>
        <CheckCircle2 aria-hidden="true" size={28} />
        <p className={styles.leadCopy}>
          {task.completionDetail ?? "FSS has recorded this required step."}
        </p>
      </div>
    </PortalCard>
  );
}

function ProfileTaskForm({
  organisationId,
  task,
}: Pick<
  ClientOnboardingTaskDetailProps,
  "organisationId" | "task"
>): React.JSX.Element {
  const [preferredName, setPreferredName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!preferredName.trim()) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(taskEndpoint(organisationId, task.id), {
        body: JSON.stringify({
          action: "complete_profile",
          taskId: task.id,
          expectedTemplateVersionId: task.templateVersionId,
          profile: {
            preferredName: preferredName.trim(),
            jobTitle: jobTitle.trim() || null,
            phone: phone.trim() || null,
          },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(messageFromResponse(body));
        return;
      }
      const result = body as TaskCommandResult;
      if (result.taskId !== task.id || result.state !== "complete") {
        setMessage(
          "We could not confirm the saved task. Refresh and try again.",
        );
        return;
      }
      setMessage("Your project details are saved.");
      window.setTimeout(() => window.location.reload(), 250);
    } catch {
      setMessage(
        "We could not save this task. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <PortalCard
      description="These details are used for your project contact record. They do not change anyone’s portal role or access."
      title="Confirm your project details"
    >
      <form aria-busy={pending} className={styles.form} onSubmit={submit}>
        <PortalField label="Preferred name" required>
          <input
            autoComplete="name"
            maxLength={160}
            onChange={(event) => setPreferredName(event.target.value)}
            required
            value={preferredName}
          />
        </PortalField>
        <PortalField label="Job title" hint="Optional">
          <input
            autoComplete="organization-title"
            maxLength={160}
            onChange={(event) => setJobTitle(event.target.value)}
            value={jobTitle}
          />
        </PortalField>
        <PortalField label="Phone number" hint="Optional">
          <input
            autoComplete="tel"
            maxLength={50}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            value={phone}
          />
        </PortalField>
        <div className={styles.formActions}>
          <PortalButton
            disabled={!preferredName.trim()}
            loading={pending}
            type="submit"
          >
            Save project details
          </PortalButton>
        </div>
        {message ? (
          <p className={styles.formFeedback} role="status">
            {message}
          </p>
        ) : null}
      </form>
    </PortalCard>
  );
}

function UploadTaskForm({
  documents = [],
  organisationId,
  task,
}: ClientOnboardingTaskDetailProps): React.JSX.Element {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggleDocument(documentId: string, checked: boolean): void {
    setSelected((current) =>
      checked
        ? [...new Set([...current, documentId])]
        : current.filter((id) => id !== documentId),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected.length) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(taskEndpoint(organisationId, task.id), {
        body: JSON.stringify({
          action: "attach_cleared_documents",
          taskId: task.id,
          expectedTemplateVersionId: task.templateVersionId,
          documentIds: selected,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(messageFromResponse(body));
        return;
      }
      const result = body as TaskCommandResult;
      if (result.taskId !== task.id || result.state !== "complete") {
        setMessage(
          "We could not confirm the saved task. Refresh and try again.",
        );
        return;
      }
      setMessage("Your selected documents are attached to this task.");
      window.setTimeout(() => window.location.reload(), 250);
    } catch {
      setMessage(
        "We could not save this task. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <PortalCard
      description="Choose documents already shared with your workspace. FSS verifies their safety and organisation scope before recording this task."
      title="Share project assets"
    >
      <form aria-busy={pending} className={styles.form} onSubmit={submit}>
        <Notice tone="success">
          <strong>Safety checks passed.</strong> Only cleared documents from
          your organisation are available to select.
        </Notice>
        {documents.length ? (
          <ul
            className={styles.documentChoices}
            aria-label="Cleared project documents"
          >
            {documents.map((document) => (
              <li className={styles.documentChoice} key={document.id}>
                <PortalCheckbox
                  checked={selected.includes(document.id)}
                  label={document.title}
                  onChange={(event) =>
                    toggleDocument(document.id, event.target.checked)
                  }
                />
                <div>
                  <span className={styles.documentTitle}>
                    {document.projectTitle}
                  </span>
                  <span className={styles.documentMeta}>
                    {document.kind === "file"
                      ? document.filename
                      : "Approved link"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Notice tone="info">
            There are no cleared documents ready to attach. Return when FSS has
            shared the agreed project assets.
          </Notice>
        )}
        <div className={styles.formActions}>
          <PortalButton
            disabled={!selected.length || !documents.length}
            disabledReason={
              documents.length
                ? "Choose at least one cleared document."
                : "No cleared documents are available yet."
            }
            loading={pending}
            type="submit"
          >
            Attach selected documents
          </PortalButton>
        </div>
        {message ? (
          <p className={styles.formFeedback} role="status">
            {message}
          </p>
        ) : null}
      </form>
    </PortalCard>
  );
}

function TaskAction({
  organisationId,
  task,
}: Pick<
  ClientOnboardingTaskDetailProps,
  "organisationId" | "task"
>): React.JSX.Element {
  if (task.action.type === "open_booking")
    return (
      <PortalCard
        description="Choose a London time that suits your project team. Booking a session does not mark this task complete; FSS records the confirmed booking."
        title="Book your launch session"
      >
        <div className={styles.formActions}>
          <PortalActionLink
            href={task.action.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            Open booking in a new tab
            <ExternalLink aria-hidden="true" size={16} />
          </PortalActionLink>
        </div>
      </PortalCard>
    );
  if (task.action.type === "view_agreement")
    return (
      <Notice
        action={
          <PortalActionLink
            href={`${portalPath("/portal/agreements")}?organisationId=${encodeURIComponent(organisationId)}`}
          >
            View agreement
          </PortalActionLink>
        }
        tone="info"
      >
        Review the current agreement in your workspace. Its completion is
        recorded from the signed agreement, not from this page.
      </Notice>
    );
  if (task.action.type === "view_billing")
    return (
      <Notice
        action={
          <PortalActionLink
            href={`${portalPath("/portal/billing")}?organisationId=${encodeURIComponent(organisationId)}`}
          >
            View billing
          </PortalActionLink>
        }
        tone="info"
      >
        Review your approved invoice in billing. Its completion is recorded from
        the billing service.
      </Notice>
    );
  return (
    <Notice tone="info">
      FSS will record this task when the agreed project evidence is ready.
    </Notice>
  );
}

export function ClientOnboardingTaskDetail({
  documents,
  organisationId,
  task,
}: ClientOnboardingTaskDetailProps): React.JSX.Element {
  return (
    <main className={styles.taskPage}>
      <TaskHeading organisationId={organisationId} task={task} />
      <PortalCard title="Task status">
        <div className={styles.detailCard}>
          {taskIcon(task)}
          <StatusBadge
            status={
              task.state === "complete"
                ? "success"
                : task.state === "blocked"
                  ? "warning"
                  : "info"
            }
          >
            {task.state === "complete"
              ? "Complete"
              : task.state === "blocked"
                ? "Blocked"
                : "Available"}
          </StatusBadge>
          <p className={styles.taskMeta}>{task.ownerLabel}</p>
        </div>
      </PortalCard>
      {task.state === "complete" ? <CompleteTask task={task} /> : null}
      {task.state === "blocked" ? (
        <Notice tone="warning">
          <strong>Complete the previous required step first.</strong> This task
          will become available when its dependency has recorded completion.
        </Notice>
      ) : null}
      {task.state === "available" && task.action.type === "complete_profile" ? (
        <ProfileTaskForm organisationId={organisationId} task={task} />
      ) : null}
      {task.state === "available" &&
      task.action.type === "attach_cleared_documents" ? (
        <UploadTaskForm
          documents={documents}
          organisationId={organisationId}
          task={task}
        />
      ) : null}
      {task.state === "available" &&
      task.action.type !== "complete_profile" &&
      task.action.type !== "attach_cleared_documents" ? (
        <TaskAction organisationId={organisationId} task={task} />
      ) : null}
    </main>
  );
}
