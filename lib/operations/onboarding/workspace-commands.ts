import { z } from "zod";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { JourneyCommandOptions } from "./commands";
import { JourneyConflict } from "./command-types";
import { parseOnboardingWorkspace } from "./queries";
import {
  onboardingTaskDefinitionSchema,
  parseOnboardingTemplateDraft,
} from "./workspace-schema";
import { portalRoles } from "../auth/types";
import { welcomeInputSchema } from "./approval-schema";
import { journeyComposerSchema } from "./journey-composer-contract";

const clientCopy = z
  .string()
  .trim()
  .min(1)
  .max(10_000)
  .refine(
    (value) => !value.includes("\u2014"),
    "Use plain punctuation without em dashes.",
  );

const reviewReference = z.string().trim().min(1).max(200);

const journeyDraftContentSchema = z
  .strictObject({
    welcomeSubject: clientCopy.max(160),
    welcomeBody: clientCopy,
    reviewedWelcome: welcomeInputSchema.optional(),
    composer: journeyComposerSchema.optional(),
    guide: z
      .strictObject({
        clientPriorities: clientCopy,
        proposedWork: clientCopy,
        deliveryProcess: clientCopy,
        workingTogether: clientCopy,
        nextSteps: clientCopy,
      })
      .optional(),
  })
  .refine(
    (content) =>
      Boolean(content.welcomeSubject || content.welcomeBody || content.guide),
    "Add reviewed welcome or guide content.",
  );

export const onboardingWorkspaceCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("save_template_draft"),
    templateId: z.uuid(),
    name: clientCopy.max(160),
    expectedVersion: z.number().int().nonnegative(),
    reviewReference,
    tasks: z.array(onboardingTaskDefinitionSchema).min(1).max(30),
  }),
  z.strictObject({
    action: z.literal("publish_template"),
    templateId: z.uuid(),
    expectedDraftVersion: z.number().int().positive(),
    reviewReference,
  }),
  z.strictObject({
    action: z.literal("save_journey_draft"),
    draftId: z.uuid(),
    agreementId: z.uuid(),
    contactId: z.uuid(),
    templateVersionId: z.uuid(),
    expectedAgreementVersion: z.number().int().positive().optional(),
    expectedVersion: z.number().int().nonnegative(),
    recipientRole: z.enum(portalRoles).default("owner"),
    stage: z.enum(["setup", "content", "access", "schedule", "activate"]),
    content: journeyDraftContentSchema,
    reviewReference,
  }),
  z.strictObject({
    action: z.literal("discard_journey_draft"),
    draftId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    reviewReference,
  }),
  z.strictObject({
    action: z.literal("confirm_booking"),
    journeyId: z.uuid(),
    taskId: z.uuid(),
    bookingAt: z.iso.datetime({ offset: true }),
    reviewReference,
  }),
]);

export type OnboardingWorkspaceCommand = z.infer<
  typeof onboardingWorkspaceCommandSchema
>;

export type OnboardingWorkspaceCommandResult =
  | Readonly<{
      kind: "template_draft";
      templateId: string;
      draftVersion: number;
    }>
  | Readonly<{
      kind: "template_version";
      templateVersionId: string;
      version: number;
    }>
  | Readonly<{
      kind: "journey_draft";
      draftId: string;
      version: number;
      stage: "setup" | "content" | "access" | "schedule" | "activate";
    }>
  | Readonly<{ kind: "journey_draft_discarded"; draftId: string }>
  | Readonly<{ kind: "booking_confirmed"; taskId: string }>;

function workspaceConflict(error: unknown): never {
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    const message = "message" in error ? String(error.message) : "";
    if (code === "40001")
      throw new JourneyConflict(
        "stale_journey",
        "This onboarding draft changed. Refresh it before saving again.",
      );
    if (
      code === "42501" ||
      (code === "23503" &&
        /journey agreement|journey template|template organisation/i.test(
          message,
        ))
    )
      throw new JourneyConflict(
        "unavailable",
        "The selected onboarding record is no longer available.",
      );
  }
  throw error;
}

async function runWorkspaceCommand(
  tx: OperationsTransaction,
  organisationId: string,
  command: OnboardingWorkspaceCommand,
): Promise<OnboardingWorkspaceCommandResult> {
  if (command.action === "save_template_draft") {
    const draft = parseOnboardingTemplateDraft({
      name: command.name,
      tasks: command.tasks,
    });
    const [saved] = await tx<Array<{ id: string; draftVersion: number }>>`
      select id, draft_version as "draftVersion"
      from operations.save_onboarding_template_draft(
        ${command.templateId},
        ${organisationId},
        ${draft.name},
        ${tx.json({ tasks: draft.tasks })},
        ${command.expectedVersion},
        ${command.reviewReference}
      )
    `;
    if (!saved) throw new Error("Onboarding template draft was not saved.");
    return {
      kind: "template_draft",
      templateId: saved.id,
      draftVersion: saved.draftVersion,
    };
  }

  if (command.action === "publish_template") {
    const [published] = await tx<Array<{ id: string; version: number }>>`
      select id, version
      from operations.publish_onboarding_template_version(
        ${command.templateId},
        ${command.expectedDraftVersion},
        ${command.reviewReference}
      )
    `;
    if (!published) throw new Error("Onboarding template was not published.");
    return {
      kind: "template_version",
      templateVersionId: published.id,
      version: published.version,
    };
  }

  if (command.action === "save_journey_draft") {
    const [agreement] = await tx<Array<{ version: number }>>`
      select version
      from operations.agreements
      where organisation_id = ${organisationId} and id = ${command.agreementId}
      for update
    `;
    if (!agreement)
      throw new JourneyConflict(
        "unavailable",
        "The selected agreement is no longer available.",
      );
    if (
      command.expectedAgreementVersion !== undefined &&
      agreement.version !== command.expectedAgreementVersion
    )
      throw new JourneyConflict(
        "stale_journey",
        "The selected agreement changed. Review it before saving this journey draft.",
      );
    const [saved] = await tx<
      Array<{
        id: string;
        version: number;
        stage: "setup" | "content" | "access" | "schedule" | "activate";
      }>
    >`
      select id, version, stage
      from operations.save_onboarding_journey_draft(
        ${command.draftId},
        ${organisationId},
        ${command.agreementId},
        ${command.contactId},
        ${command.templateVersionId},
        ${command.stage},
        ${tx.json({
          ...command.content,
          expectedAgreementVersion: agreement.version,
          recipientRole: command.recipientRole,
        })},
        ${command.expectedVersion},
        ${command.reviewReference}
      )
    `;
    if (!saved) throw new Error("Onboarding journey draft was not saved.");
    return {
      kind: "journey_draft",
      draftId: saved.id,
      version: saved.version,
      stage: saved.stage,
    };
  }

  if (command.action === "discard_journey_draft") {
    await tx`select operations.discard_onboarding_journey_draft(
      ${organisationId},
      ${command.draftId},
      ${command.expectedVersion},
      ${command.reviewReference}
    )`;
    return { kind: "journey_draft_discarded", draftId: command.draftId };
  }

  const [workspaceRow] = await tx<Array<{ workspace: unknown }>>`
    select operations.read_onboarding_workspace(${organisationId}) as workspace
  `;
  const task = workspaceRow
    ? parseOnboardingWorkspace(workspaceRow.workspace).tasks.find(
        (candidate) =>
          candidate.journeyId === command.journeyId &&
          candidate.id === command.taskId,
      )
    : undefined;
  if (!task || task.kind !== "booking")
    throw new JourneyConflict(
      "unavailable",
      "The selected booking task is no longer available.",
    );
  await tx`select operations.complete_onboarding_task(
    ${organisationId},
    ${task.id},
    ${null},
    ${[] as string[]}::uuid[],
    ${command.bookingAt}::timestamptz,
    ${command.reviewReference}
  )`;
  return { kind: "booking_confirmed", taskId: task.id };
}

export async function executeStaffOnboardingWorkspaceCommand(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  options: JourneyCommandOptions,
): Promise<OnboardingWorkspaceCommandResult> {
  z.uuid().parse(organisationId);
  const command = onboardingWorkspaceCommandSchema.parse(raw);
  void options;
  try {
    return await withFssAdminTransaction(db, admin, (tx) =>
      runWorkspaceCommand(tx, organisationId, command),
    );
  } catch (error) {
    return workspaceConflict(error);
  }
}
