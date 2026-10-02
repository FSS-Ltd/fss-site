import { ArrowRight, CheckCircle2, Circle, ListChecks } from "lucide-react";
import {
  PageHeader,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import type {
  ClientOnboardingTask,
  ClientOnboardingWorkspace,
} from "@/lib/operations/onboarding/client-workspace";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { ClientWelcomePacketCard } from "./client-welcome-packet";
import { ClientSetupChecklist } from "./client-setup-checklist";
import styles from "./client-onboarding.module.css";

type TaskStatus = Parameters<typeof StatusBadge>[0]["status"];

function taskStatus(task: ClientOnboardingTask): TaskStatus {
  if (task.state === "complete") return "success";
  if (task.state === "blocked") return "warning";
  return "info";
}

function taskStatusLabel(task: ClientOnboardingTask): string {
  if (task.state === "complete") return "Complete";
  if (task.state === "blocked") return "Blocked";
  return "Available";
}

function taskPath(organisationId: string, task: ClientOnboardingTask): string {
  const suffix =
    task.action.type === "attach_cleared_documents"
      ? "/upload"
      : task.action.type === "open_booking"
        ? "/booking"
        : "";
  const path = portalPath(`/portal/onboarding/tasks/${task.id}${suffix}`);
  return `${path}?organisationId=${encodeURIComponent(organisationId)}`;
}

function taskActionLabel(task: ClientOnboardingTask): string {
  if (task.state === "complete") return "Review task";
  if (task.state === "blocked") return "See requirement";
  if (task.action.type === "complete_profile") return "Confirm details";
  if (task.action.type === "attach_cleared_documents") return "Choose files";
  if (task.action.type === "open_booking") return "Book a session";
  if (task.action.type === "view_agreement") return "View agreement";
  if (task.action.type === "view_billing") return "View billing";
  return "View task";
}

function nextTask(
  tasks: readonly ClientOnboardingTask[],
): ClientOnboardingTask | null {
  return (
    tasks.find((task) => task.required && task.state === "available") ?? null
  );
}

export function ClientOnboardingWorkspaceView({
  organisationId,
  workspace,
}: Readonly<{
  organisationId: string;
  workspace: ClientOnboardingWorkspace;
}>): React.JSX.Element {
  const next = nextTask(workspace.tasks);

  return (
    <main className={styles.workspace}>
      <PageHeader
        breadcrumbs={[
          { href: portalPath("/portal"), label: "Your workspace" },
          { label: "Getting started" },
        ]}
        description="Each task reflects a verified part of your project setup. We will only mark it complete when the required evidence is recorded."
        eyebrow="Getting started"
        title="Your launch checklist"
      />

      {workspace.welcomePacket ? (
        <ClientWelcomePacketCard
          organisationId={organisationId}
          packet={workspace.welcomePacket}
        />
      ) : workspace.welcomePacket === null ? (
        <PortalCard title="Your welcome packet">
          <p className={styles.leadCopy}>
            FSS will add your packet once the welcome materials are approved.
          </p>
        </PortalCard>
      ) : null}

      {workspace.requiredTasksComplete ? (
        <PortalCard
          description="Every required launch task has recorded completion. Optional work stays visible below."
          title="Your project is ready to begin"
          tone="dark"
        >
          <div className={styles.leadCard}>
            <CheckCircle2 aria-hidden="true" size={28} />
            <p className={styles.leadCopy}>
              Your FSS team can now move into the agreed delivery work.
            </p>
          </div>
        </PortalCard>
      ) : next ? (
        <PortalCard
          description="Complete this verified task to keep the launch moving."
          title="Your next step"
          tone="accent"
        >
          <div className={styles.leadCard}>
            <div>
              <strong>{next.title}</strong>
              <p className={styles.leadCopy}>{next.instructions}</p>
            </div>
            <PortalActionLink href={taskPath(organisationId, next)}>
              {taskActionLabel(next)}
              <ArrowRight aria-hidden="true" size={16} />
            </PortalActionLink>
          </div>
        </PortalCard>
      ) : (
        <PortalCard
          description="FSS is recording the next verified project step."
          title="We are preparing your next step"
        >
          <p className={styles.leadCopy}>
            You do not need to take action until a task becomes available.
          </p>
        </PortalCard>
      )}

      <PortalCard
        description="These milestones are derived from your agreement, billing, documents and service records."
        title="Recorded milestones"
      >
        <ClientSetupChecklist checklist={workspace.checklist} enabled />
      </PortalCard>

      <section aria-labelledby="launch-tasks-heading">
        <div className={styles.taskTitleRow}>
          <ListChecks aria-hidden="true" size={21} />
          <h2 id="launch-tasks-heading">Launch tasks</h2>
        </div>
        <ol className={styles.taskList}>
          {workspace.tasks.map((task) => (
            <li key={task.id}>
              <PortalCard className={styles.taskCard}>
                <div className={styles.taskContent}>
                  <div className={styles.taskTitleRow}>
                    {task.state === "complete" ? (
                      <CheckCircle2 aria-hidden="true" size={18} />
                    ) : (
                      <Circle aria-hidden="true" size={18} />
                    )}
                    <h3 className={styles.taskTitle}>{task.title}</h3>
                    <StatusBadge status={taskStatus(task)}>
                      {taskStatusLabel(task)}
                    </StatusBadge>
                  </div>
                  <p className={styles.taskCopy}>{task.instructions}</p>
                  <div className={styles.taskMetadata}>
                    <span>{task.ownerLabel}</span>
                    {task.required ? (
                      <span>Required</span>
                    ) : (
                      <span>Optional</span>
                    )}
                    {task.dueAt ? <span>Due {task.dueAt}</span> : null}
                  </div>
                  {task.completionDetail ? (
                    <p className={styles.completionDetail}>
                      {task.completionDetail}
                    </p>
                  ) : null}
                </div>
                <div className={styles.taskActions}>
                  <PortalActionLink
                    href={taskPath(organisationId, task)}
                    variant={
                      task.state === "available" ? "primary" : "secondary"
                    }
                  >
                    {taskActionLabel(task)}
                  </PortalActionLink>
                </div>
              </PortalCard>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
