import { z } from "zod";
import { portalRoles } from "../auth/types";
import type {
  OnboardingEvidenceRule,
  OnboardingTaskDefinition,
  OnboardingTaskKind,
  OnboardingTemplateDraft,
} from "./workspace-types";
import {
  onboardingDueRules,
  onboardingEvidenceRules,
  onboardingTaskKinds,
} from "./workspace-types";

const clientCopy = z
  .string()
  .trim()
  .min(1)
  .max(4_000)
  .refine(
    (value) => !value.includes("\u2014"),
    "Use plain punctuation without em dashes.",
  );

const evidenceRulesByKind: Readonly<
  Record<OnboardingTaskKind, readonly OnboardingEvidenceRule[]>
> = {
  profile: ["profile_saved"],
  agreement: ["agreement_signed"],
  billing: ["billing_ready"],
  upload: ["cleared_documents"],
  booking: ["booking_confirmed"],
  acknowledgement: ["acknowledged"],
  custom: ["staff_confirmed"],
};

const trustedBookingUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Use a trusted HTTPS booking destination.");

export const onboardingTaskDefinitionSchema = z
  .strictObject({
    id: z.uuid(),
    title: clientCopy.max(160),
    instructions: clientCopy,
    kind: z.enum(onboardingTaskKinds),
    ownerRole: z.enum(portalRoles),
    required: z.boolean(),
    dependsOnTaskId: z.uuid().nullable(),
    dueRule: z.enum(onboardingDueRules),
    evidenceRule: z.enum(onboardingEvidenceRules),
    bookingUrl: trustedBookingUrl.nullable(),
  })
  .superRefine((task, context) => {
    if (!evidenceRulesByKind[task.kind].includes(task.evidenceRule)) {
      context.addIssue({
        code: "custom",
        path: ["evidenceRule"],
        message: "Use the evidence rule required by this task type.",
      });
    }
    if (task.kind === "booking" && !task.bookingUrl) {
      context.addIssue({
        code: "custom",
        path: ["bookingUrl"],
        message: "A booking task needs a trusted booking destination.",
      });
    }
    if (task.kind !== "booking" && task.bookingUrl) {
      context.addIssue({
        code: "custom",
        path: ["bookingUrl"],
        message: "Only booking tasks may contain a booking destination.",
      });
    }
  });

export const onboardingTemplateDraftSchema = z
  .strictObject({
    name: clientCopy.max(160),
    tasks: z.array(onboardingTaskDefinitionSchema).min(1).max(30),
  })
  .superRefine((draft, context) => {
    const taskById = new Map(draft.tasks.map((task) => [task.id, task]));
    if (taskById.size !== draft.tasks.length) {
      context.addIssue({
        code: "custom",
        path: ["tasks"],
        message: "Each checklist task needs a unique ID.",
      });
      return;
    }

    for (const task of draft.tasks) {
      if (!task.dependsOnTaskId) continue;
      if (task.dependsOnTaskId === task.id) {
        context.addIssue({
          code: "custom",
          path: ["tasks"],
          message: "A checklist dependency cannot reference the same task.",
        });
      } else if (!taskById.has(task.dependsOnTaskId)) {
        context.addIssue({
          code: "custom",
          path: ["tasks"],
          message:
            "A checklist dependency must reference another task in this template.",
        });
      }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (task: OnboardingTaskDefinition): boolean => {
      if (visiting.has(task.id)) return true;
      if (visited.has(task.id)) return false;
      visiting.add(task.id);
      const dependency = task.dependsOnTaskId
        ? taskById.get(task.dependsOnTaskId)
        : null;
      if (dependency && visit(dependency)) return true;
      visiting.delete(task.id);
      visited.add(task.id);
      return false;
    };

    if (draft.tasks.some((task) => visit(task))) {
      context.addIssue({
        code: "custom",
        path: ["tasks"],
        message: "Checklist task dependencies cannot contain a cycle.",
      });
    }
  });

export function parseOnboardingTemplateDraft(
  input: unknown,
): OnboardingTemplateDraft {
  return onboardingTemplateDraftSchema.parse(input);
}
