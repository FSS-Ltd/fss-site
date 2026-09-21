"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type {
  OnboardingDueRule,
  OnboardingTaskDefinition,
  OnboardingTaskKind,
} from "@/lib/operations/onboarding/workspace-types";
import {
  PortalButton,
  PortalCheckbox,
  PortalField,
  PortalSelect,
  PortalTextarea,
} from "@/components/portal/ui";
import {
  onboardingEvidenceLabels,
  onboardingEvidenceRuleByKind,
  onboardingTaskKindLabels,
} from "./onboarding-presentation";

type JourneyChecklistEditorProps = Readonly<{
  onChange: (tasks: OnboardingTaskDefinition[]) => void;
  tasks: readonly OnboardingTaskDefinition[];
}>;

const dueRuleLabels: Readonly<Record<OnboardingDueRule, string>> = {
  activation: "After activation",
  previous_task: "After the previous task",
  signature: "After signing",
};

const taskKinds = Object.entries(onboardingTaskKindLabels) as Array<
  [OnboardingTaskKind, string]
>;

function newTask(): OnboardingTaskDefinition {
  return {
    bookingUrl: null,
    dependsOnTaskId: null,
    dueRule: "activation",
    evidenceRule: "profile_saved",
    id: crypto.randomUUID(),
    instructions:
      "Describe the information or evidence the client needs to provide.",
    kind: "profile",
    ownerRole: "owner",
    required: true,
    title: "Confirm your details",
  };
}

export function JourneyChecklistEditor({
  onChange,
  tasks,
}: JourneyChecklistEditorProps): React.JSX.Element {
  function updateTask(
    taskId: string,
    patch: Partial<OnboardingTaskDefinition>,
  ): void {
    onChange(
      tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    );
  }

  function moveTask(taskId: string, direction: -1 | 1): void {
    const index = tasks.findIndex((task) => task.id === taskId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= tasks.length) return;
    const nextTasks = [...tasks];
    [nextTasks[index], nextTasks[nextIndex]] = [
      nextTasks[nextIndex],
      nextTasks[index],
    ];
    onChange(nextTasks);
  }

  return (
    <section aria-label="Client checklist">
      <h2>Client checklist</h2>
      <p>
        Publishing creates a new immutable version. Active journeys keep the
        checklist version that was approved for them.
      </p>
      <ol>
        {tasks.map((task, index) => (
          <li key={task.id}>
            <h3>{task.title || `Checklist task ${index + 1}`}</h3>
            <PortalField label="Task title" required>
              <input
                maxLength={160}
                onChange={(event) =>
                  updateTask(task.id, { title: event.target.value })
                }
                value={task.title}
              />
            </PortalField>
            <PortalTextarea
              label="Instructions"
              maxLength={4_000}
              onChange={(event) =>
                updateTask(task.id, { instructions: event.target.value })
              }
              required
              value={task.instructions}
            />
            <PortalSelect
              label="Task type"
              onChange={(event) => {
                const kind = event.target.value as OnboardingTaskKind;
                updateTask(task.id, {
                  bookingUrl: kind === "booking" ? "https://" : null,
                  evidenceRule: onboardingEvidenceRuleByKind[kind],
                  kind,
                });
              }}
              value={task.kind}
            >
              {taskKinds.map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </PortalSelect>
            <PortalSelect
              label="Responsible role"
              onChange={(event) =>
                updateTask(task.id, {
                  ownerRole: event.target
                    .value as OnboardingTaskDefinition["ownerRole"],
                })
              }
              value={task.ownerRole}
            >
              <option value="owner">Owner</option>
              <option value="contributor">Contributor</option>
              <option value="billing_contact">Billing contact</option>
              <option value="viewer">Viewer</option>
            </PortalSelect>
            <PortalSelect
              label="Depends on"
              onChange={(event) =>
                updateTask(task.id, {
                  dependsOnTaskId: event.target.value || null,
                })
              }
              value={task.dependsOnTaskId ?? ""}
            >
              <option value="">No prerequisite</option>
              {tasks
                .filter((candidate) => candidate.id !== task.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
            </PortalSelect>
            <PortalSelect
              label="Due rule"
              onChange={(event) =>
                updateTask(task.id, {
                  dueRule: event.target.value as OnboardingDueRule,
                })
              }
              value={task.dueRule}
            >
              {Object.entries(dueRuleLabels).map(([rule, label]) => (
                <option key={rule} value={rule}>
                  {label}
                </option>
              ))}
            </PortalSelect>
            <PortalSelect
              label="Completion evidence"
              value={task.evidenceRule}
              disabled
            >
              <option value={task.evidenceRule}>
                {onboardingEvidenceLabels[task.evidenceRule]}
              </option>
            </PortalSelect>
            {task.kind === "booking" ? (
              <PortalField label="Trusted booking destination" required>
                <input
                  maxLength={2_000}
                  onChange={(event) =>
                    updateTask(task.id, { bookingUrl: event.target.value })
                  }
                  required
                  type="url"
                  value={task.bookingUrl ?? ""}
                />
              </PortalField>
            ) : null}
            <PortalCheckbox
              checked={task.required}
              label="Required to finish setup"
              onChange={(event) =>
                updateTask(task.id, { required: event.target.checked })
              }
            />
            <PortalButton
              disabled={index === 0}
              onClick={() => moveTask(task.id, -1)}
              type="button"
              variant="secondary"
            >
              <ArrowUp aria-hidden="true" size={16} /> Move up
            </PortalButton>
            <PortalButton
              disabled={index === tasks.length - 1}
              onClick={() => moveTask(task.id, 1)}
              type="button"
              variant="secondary"
            >
              <ArrowDown aria-hidden="true" size={16} /> Move down
            </PortalButton>
            <PortalButton
              disabled={tasks.length === 1}
              onClick={() =>
                onChange(tasks.filter((item) => item.id !== task.id))
              }
              type="button"
              variant="destructive"
            >
              <Trash2 aria-hidden="true" size={16} /> Remove task
            </PortalButton>
          </li>
        ))}
      </ol>
      <PortalButton
        onClick={() => onChange([...tasks, newTask()])}
        type="button"
        variant="secondary"
      >
        <Plus aria-hidden="true" size={16} /> Add task
      </PortalButton>
    </section>
  );
}
