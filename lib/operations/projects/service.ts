import { z } from "zod";
import { withAgreementTransaction } from "../agreements/repository";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import type { OperationsTransaction } from "../db/client";
import { ProjectConflict, projectStatuses } from "./types";

const shortText = z.string().trim().min(1).max(160);
const common = {
  title: shortText,
  summary: z.string().trim().max(4000),
  status: z.enum(projectStatuses),
  ownerDisplay: shortText,
  targetDate: z.iso.date().nullable(),
};
export const projectMetadataSchema = z.strictObject({
  ...common,
  agreementId: z.uuid(),
  outcome: z.string().trim().max(4000),
  deliverables: z.array(shortText).max(50),
  scheduleDependencies: z.array(shortText).max(30),
  scheduleEvidence: z.string().trim().min(1).max(4000).nullable(),
  internalNotes: z.string().max(10000),
  internalEstimateMinutes: z
    .number()
    .int()
    .nonnegative()
    .max(2147483647)
    .nullable(),
  visibility: z.enum(["internal", "client"]),
});
export const milestoneMetadataSchema = z.strictObject({
  ...common,
  evidence: z.string().trim().min(1).max(4000).nullable(),
  position: z.number().int().min(0).max(99),
});
const review = { reviewReference: z.string().trim().min(1).max(200) };
export const projectCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("create"),
    metadata: projectMetadataSchema,
    ...review,
  }),
  z.strictObject({
    action: z.literal("update"),
    projectId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    metadata: projectMetadataSchema,
    ...review,
  }),
  z.strictObject({
    action: z.literal("milestone"),
    projectId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    milestoneId: z.uuid().nullable(),
    metadata: milestoneMetadataSchema,
    ...review,
  }),
]);
export type DeliveryCommandResult = { id: string; version: number };
export type ProjectCommand = z.infer<typeof projectCommandSchema>;

export async function executeProjectCommandInTransaction(
  tx: OperationsTransaction,
  organisationId: string,
  command: ProjectCommand,
  correlationId: string,
): Promise<DeliveryCommandResult> {
  await tx`select set_config('operations.correlation_id',${correlationId},true)`;
  if (command.action === "create") {
    const m = command.metadata;
    const [row] = await tx<
      DeliveryCommandResult[]
    >`insert into operations.projects(organisation_id,agreement_id,title,summary,outcome,deliverables,status,owner_display,target_date,schedule_dependencies,schedule_evidence,internal_notes,internal_estimate_minutes,visibility,review_reference) values (${organisationId},${m.agreementId},${m.title},${m.summary},${m.outcome},${m.deliverables},${m.status},${m.ownerDisplay},${m.targetDate},${m.scheduleDependencies},${m.scheduleEvidence},${m.internalNotes},${m.internalEstimateMinutes},${m.visibility},${command.reviewReference}) returning id,version`;
    if (!row) throw new Error("The project could not be created.");
    return row;
  }
  const [current] = await tx<
    DeliveryCommandResult[]
  >`select id,version from operations.projects where organisation_id=${organisationId} and id=${command.projectId} for update`;
  if (!current || current.version !== command.expectedVersion)
    throw new ProjectConflict();
  if (command.action === "update") {
    const m = command.metadata;
    await tx`update operations.projects set agreement_id=${m.agreementId},title=${m.title},summary=${m.summary},outcome=${m.outcome},deliverables=${m.deliverables},status=${m.status},owner_display=${m.ownerDisplay},target_date=${m.targetDate},schedule_dependencies=${m.scheduleDependencies},schedule_evidence=${m.scheduleEvidence},internal_notes=${m.internalNotes},internal_estimate_minutes=${m.internalEstimateMinutes},visibility=${m.visibility},review_reference=${command.reviewReference},version=version+1 where organisation_id=${organisationId} and id=${current.id}`;
  } else {
    const m = command.metadata;
    if (command.milestoneId) {
      const rows =
        await tx`update operations.milestones set title=${m.title},summary=${m.summary},status=${m.status},owner_display=${m.ownerDisplay},target_date=${m.targetDate},evidence=${m.evidence},position=${m.position},review_reference=${command.reviewReference} where organisation_id=${organisationId} and project_id=${current.id} and id=${command.milestoneId} returning id`;
      if (!rows.length)
        throw new ProjectConflict("Milestone was not found in this project.");
    } else {
      await tx`insert into operations.milestones(organisation_id,project_id,title,summary,status,owner_display,target_date,evidence,position,review_reference) values (${organisationId},${current.id},${m.title},${m.summary},${m.status},${m.ownerDisplay},${m.targetDate},${m.evidence},${m.position},${command.reviewReference})`;
    }
    await tx`update operations.projects set version=version+1,review_reference=${command.reviewReference} where organisation_id=${organisationId} and id=${current.id}`;
  }
  return { id: current.id, version: current.version + 1 };
}

export async function executeProjectCommand(
  db: OperationsDb,
  context: OperationsFounder | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<DeliveryCommandResult> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = projectCommandSchema.parse(raw);
  return withAgreementTransaction(db, context, (tx) =>
    executeProjectCommandInTransaction(tx, organisationId, command, correlationId),
  );
}
