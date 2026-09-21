import { z } from "zod";
import { hasPortalCapability, getPortalRolePresentation } from "../auth/permissions";
import { PortalAccessDenied, type PortalRole, type VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";
import { loadClientSetupChecklist, type ClientSetupChecklist } from "./client-checklist";
import { parseOnboardingWorkspace } from "./queries";
import type { OnboardingWorkspaceTask } from "./workspace-types";

const profileSchema = z.strictObject({
  preferredName: z.string().trim().min(1).max(160),
  jobTitle: z.string().trim().min(1).max(160).nullable().optional(),
  phone: z.string().trim().min(3).max(50).nullable().optional(),
});

const clientProfileTaskCommandSchema = z.strictObject({
  action: z.literal("complete_profile"),
  taskId: z.uuid(),
  expectedTemplateVersionId: z.uuid(),
  profile: profileSchema,
});

const clientDocumentTaskCommandSchema = z.strictObject({
  action: z.literal("attach_cleared_documents"),
  taskId: z.uuid(),
  expectedTemplateVersionId: z.uuid(),
  documentIds: z.array(z.uuid()).min(1).max(20),
});

const clientProfileInputSchema = clientProfileTaskCommandSchema.omit({
  action: true,
});
const clientDocumentInputSchema = clientDocumentTaskCommandSchema.omit({
  action: true,
});

export const clientOnboardingTaskCommandSchema = z.discriminatedUnion(
  "action",
  [clientProfileTaskCommandSchema, clientDocumentTaskCommandSchema],
);

export type ClientOnboardingTaskCommand = z.infer<
  typeof clientOnboardingTaskCommandSchema
>;
export type ClientProfileInput = z.infer<typeof clientProfileInputSchema>;
export type ClientDocumentAttachmentInput = z.infer<
  typeof clientDocumentInputSchema
>;

export type ClientTaskAction =
  | Readonly<{ type: "complete_profile" }>
  | Readonly<{ type: "attach_cleared_documents" }>
  | Readonly<{ type: "open_booking"; href: string }>
  | Readonly<{ type: "view_agreement" }>
  | Readonly<{ type: "view_billing" }>
  | Readonly<{ type: "wait_for_fss" }>
  | Readonly<{ type: "none" }>;

export type ClientOnboardingTask = Readonly<{
  id: string;
  templateVersionId: string;
  title: string;
  instructions: string;
  kind: OnboardingWorkspaceTask["kind"];
  required: boolean;
  ownerLabel: string;
  dueAt: string | null;
  state: "blocked" | "available" | "complete";
  completionDetail: string | null;
  action: ClientTaskAction;
}>;

export type ClientOnboardingWorkspace = Readonly<{
  checklist: ClientSetupChecklist;
  tasks: readonly ClientOnboardingTask[];
  requiredTasksComplete: boolean;
}>;

export type ClientOnboardingTaskResult = Readonly<{
  taskId: string;
  state: "complete";
}>;

export class ClientOnboardingConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientOnboardingConflict";
  }
}

function ownerLabel(ownerRole: PortalRole): string {
  return `Assigned to ${getPortalRolePresentation(ownerRole).label.toLowerCase()}.`;
}

function actionForTask(task: OnboardingWorkspaceTask): ClientTaskAction {
  if (task.state !== "available") return { type: "none" };
  if (task.kind === "profile") return { type: "complete_profile" };
  if (task.kind === "upload") return { type: "attach_cleared_documents" };
  if (task.kind === "booking" && task.bookingUrl)
    return { type: "open_booking", href: task.bookingUrl };
  if (task.kind === "agreement") return { type: "view_agreement" };
  if (task.kind === "billing") return { type: "view_billing" };
  return { type: "wait_for_fss" };
}

function projectClientTask(task: OnboardingWorkspaceTask): ClientOnboardingTask {
  return {
    id: task.id,
    templateVersionId: task.templateVersionId,
    title: task.title,
    instructions: task.instructions,
    kind: task.kind,
    required: task.required,
    ownerLabel: ownerLabel(task.ownerRole),
    // The stored template has relative timing rules. It does not contain a
    // verified calendar deadline, so the client view deliberately exposes none.
    dueAt: null,
    state: task.state,
    completionDetail: task.completionDetail,
    action: actionForTask(task),
  };
}

async function loadClientWorkspaceInTransaction(
  tx: OperationsTransaction,
  organisationId: string,
): Promise<ClientOnboardingWorkspace> {
  const [workspaceRow] = await tx<Array<{ workspace: unknown }>>`
    select operations.read_onboarding_workspace(${organisationId}) as workspace
  `;
  if (!workspaceRow) throw new PortalAccessDenied();
  const workspace = parseOnboardingWorkspace(workspaceRow.workspace);
  const tasks = workspace.tasks.map(projectClientTask);
  return {
    checklist: await loadClientSetupChecklist(tx, organisationId),
    tasks,
    requiredTasksComplete:
      tasks.length > 0 &&
      tasks
        .filter((task) => task.required)
        .every((task) => task.state === "complete"),
  };
}

function mapPortalScopeError(error: unknown): never {
  if (error instanceof PortalAccessDenied) throw error;
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    ["42501", "23503", "23514", "P0002"].includes(String(error.code))
  )
    throw new PortalAccessDenied();
  throw error;
}

function getMutableTask(
  workspace: ClientOnboardingWorkspace,
  taskId: string,
  expectedTemplateVersionId: string,
  kind: "profile" | "upload",
): ClientOnboardingTask {
  const task = workspace.tasks.find((candidate) => candidate.id === taskId);
  if (!task || task.kind !== kind) throw new PortalAccessDenied();
  if (task.templateVersionId !== expectedTemplateVersionId)
    throw new ClientOnboardingConflict(
      "This checklist task changed. Refresh it before saving your progress.",
    );
  if (task.state === "blocked")
    throw new ClientOnboardingConflict(
      "Complete the previous required step first.",
    );
  return task;
}

async function completeTask(
  tx: OperationsTransaction,
  organisationId: string,
  taskId: string,
  profile: z.infer<typeof profileSchema> | null,
  documentIds: readonly string[],
): Promise<void> {
  await tx`select operations.complete_onboarding_task(
    ${organisationId},
    ${taskId},
    ${profile === null ? null : tx.json(profile)},
    ${[...documentIds]}::uuid[],
    ${null}::timestamptz,
    ${null}
  )`;
}

export async function loadClientOnboardingWorkspace(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<ClientOnboardingWorkspace> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "onboarding.read"))
        throw new PortalAccessDenied();
      try {
        return await loadClientWorkspaceInTransaction(tx, organisationId);
      } catch (error) {
        return mapPortalScopeError(error);
      }
    },
  );
}

export async function completeClientProfile(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  input: ClientProfileInput,
  correlationId: string,
): Promise<ClientOnboardingTaskResult> {
  const command = clientProfileInputSchema.parse(input);
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "onboarding.read"))
        throw new PortalAccessDenied();
      try {
        const task = getMutableTask(
          await loadClientWorkspaceInTransaction(tx, organisationId),
          command.taskId,
          command.expectedTemplateVersionId,
          "profile",
        );
        if (task.state !== "complete")
          await completeTask(
            tx,
            organisationId,
            task.id,
            command.profile,
            [],
          );
        return { taskId: task.id, state: "complete" };
      } catch (error) {
        return mapPortalScopeError(error);
      }
    },
  );
}

export async function attachClearedDocumentToTask(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  input: ClientDocumentAttachmentInput,
  correlationId: string,
): Promise<ClientOnboardingTaskResult> {
  const command = clientDocumentInputSchema.parse(input);
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "onboarding.read"))
        throw new PortalAccessDenied();
      try {
        const task = getMutableTask(
          await loadClientWorkspaceInTransaction(tx, organisationId),
          command.taskId,
          command.expectedTemplateVersionId,
          "upload",
        );
        if (task.state !== "complete")
          await completeTask(
            tx,
            organisationId,
            task.id,
            null,
            command.documentIds,
          );
        return { taskId: task.id, state: "complete" };
      } catch (error) {
        return mapPortalScopeError(error);
      }
    },
  );
}

export async function executeClientOnboardingTaskCommand(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<ClientOnboardingTaskResult> {
  const command = clientOnboardingTaskCommandSchema.parse(raw);
  if (command.action === "complete_profile")
    return completeClientProfile(
      db,
      identity,
      organisationId,
      {
        taskId: command.taskId,
        expectedTemplateVersionId: command.expectedTemplateVersionId,
        profile: command.profile,
      },
      correlationId,
    );
  return attachClearedDocumentToTask(
    db,
    identity,
    organisationId,
    {
      taskId: command.taskId,
      expectedTemplateVersionId: command.expectedTemplateVersionId,
      documentIds: command.documentIds,
    },
    correlationId,
  );
}
