"use client";
import Link from "next/link";
import { useState } from "react";
import type { CrmTask, CrmWorkspace } from "@/lib/growth/crm/workspace-query";
import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import { CommandButton, CommandForm } from "./command-form";
import { FieldGroup, FormField } from "./form-field";
import { fieldText, localDateTime, localInstant } from "./form-values";
import styles from "./crm.module.css";

function TaskItem({
  task,
  prospectId,
  prospectVersion,
  now,
}: {
  task: CrmTask;
  prospectId: string;
  prospectVersion: number;
  now: string;
}) {
  const overdue = !task.completedAt && task.dueAt < now;
  return (
    <li className={styles.item}>
      <div className={styles.actions}>
        <strong>{task.title}</strong>
        <span className={`${styles.tag} ${overdue ? styles.overdue : ""}`}>
          {task.completedAt ? "Completed" : overdue ? "Overdue" : "Upcoming"}
        </span>
      </div>
      <time dateTime={task.dueAt}>Due {formatGrowthDateTime(task.dueAt)}</time>
      <div className={styles.actions}>
        <CommandButton
          label={task.completedAt ? "Reopen task" : "Complete task"}
          command={{
            kind: "task_status",
            prospectId,
            taskId: task.id,
            expectedVersion: task.version,
            completed: !task.completedAt,
          }}
        />
        {!task.completedAt && (
          <CommandButton
            label="Make next step"
            command={{
              kind: "promote_task",
              prospectId,
              taskId: task.id,
              expectedVersion: task.version,
              prospectVersion,
            }}
          />
        )}
      </div>
      <details>
        <summary>Edit task</summary>
        <CommandForm
          label={`Edit task ${task.title}`}
          submitLabel="Save task"
          buildCommand={(data) => ({
            kind: "update_task",
            prospectId,
            taskId: task.id,
            expectedVersion: task.version,
            title: fieldText(data, "title"),
            dueAt: localInstant(fieldText(data, "dueAt")),
          })}
        >
          <FormField
            label="Task title"
            name="title"
            defaultValue={task.title}
            required
            maxLength={300}
          />
          <FormField
            label="Due (your device time)"
            name="dueAt"
            type="datetime-local"
            defaultValue={localDateTime(task.dueAt)}
            required
          />
        </CommandForm>
      </details>
    </li>
  );
}
export function TaskPanel({
  prospectId,
  prospectVersion,
  tasks,
  now,
  taskStatus,
  links,
  moreHref,
}: {
  prospectId: string;
  prospectVersion: number;
  tasks: CrmWorkspace["tasks"];
  now: string;
  taskStatus: string;
  links: { open: string; completed: string; all: string };
  moreHref?: string;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  return (
    <section className={styles.panel} id="record-tasks">
      <h2>Follow-up tasks</h2>
      <p className={styles.muted}>
        Keep track of follow-ups. Choose “Make next step” to update the lead’s
        primary action.
      </p>
      <CommandForm
        label="Create follow-up task"
        submitLabel="Add task"
        buildCommand={(data) => ({
          kind: "create_task",
          prospectId,
          requestId,
          title: fieldText(data, "title"),
          dueAt: localInstant(fieldText(data, "dueAt")),
        })}
        onSuccess={(_result, form) => {
          form.reset();
          setRequestId(crypto.randomUUID());
        }}
      >
        <FieldGroup>
          <FormField label="Task title" name="title" required maxLength={300} />
          <FormField
            label="Due (your device time)"
            name="dueAt"
            type="datetime-local"
            required
          />
        </FieldGroup>
      </CommandForm>
      <nav className={styles.nav} aria-label="Task status">
        {(["open", "completed", "all"] as const).map((status) => (
          <Link
            key={status}
            href={links[status]}
            aria-current={taskStatus === status ? "page" : undefined}
          >
            {status === "open"
              ? "Open"
              : status === "completed"
                ? "Completed"
                : "All tasks"}
          </Link>
        ))}
      </nav>
      {tasks.rows.length === 0 ? (
        <p className={styles.empty}>
          No {taskStatus === "all" ? "" : taskStatus} tasks.
        </p>
      ) : (
        <ul className={styles.items}>
          {tasks.rows.map((task) => (
            <TaskItem
              key={`${task.id}:${task.version}`}
              task={task}
              prospectId={prospectId}
              prospectVersion={prospectVersion}
              now={now}
            />
          ))}
        </ul>
      )}
      {tasks.nextCursor && moreHref && (
        <Link className={styles.linkButton} href={moreHref}>
          Next tasks
        </Link>
      )}
    </section>
  );
}
