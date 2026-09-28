import { z } from "zod";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";
import {
  executeProjectCommandInTransaction,
  projectCommandSchema,
  type DeliveryCommandResult,
} from "./service";
import { ProjectConflict, type ProjectStatus } from "./types";

export type StaffProjectMilestone = Readonly<{
  evidence: string | null;
  id: string;
  ownerDisplay: string;
  position: number;
  status: ProjectStatus;
  summary: string;
  targetDate: string | null;
  title: string;
}>;

export type StaffProjectDetail = Readonly<{
  agreementId: string;
  deliverables: string[];
  id: string;
  internalEstimateMinutes: number | null;
  internalNotes: string;
  milestones: StaffProjectMilestone[];
  organisationId: string;
  outcome: string;
  ownerDisplay: string;
  scheduleDependencies: string[];
  scheduleEvidence: string | null;
  status: ProjectStatus;
  summary: string;
  targetDate: string | null;
  title: string;
  version: number;
  visibility: "internal" | "client";
}>;

type StoredStaffProject = Omit<StaffProjectDetail, "milestones">;

export async function loadStaffProjectForEdit(
  db: OperationsDb,
  admin: FssAdminContext,
  projectId: string,
): Promise<StaffProjectDetail | null> {
  const id = z.uuid().parse(projectId);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const [project] = await tx<StoredStaffProject[]>`
      select
        p.id,
        p.organisation_id as "organisationId",
        p.agreement_id as "agreementId",
        p.title,
        p.summary,
        p.outcome,
        p.deliverables,
        p.status,
        p.owner_display as "ownerDisplay",
        p.target_date::text as "targetDate",
        p.schedule_dependencies as "scheduleDependencies",
        p.schedule_evidence as "scheduleEvidence",
        p.internal_notes as "internalNotes",
        p.internal_estimate_minutes as "internalEstimateMinutes",
        p.visibility,
        p.version
      from operations.projects p
      where p.id = ${id}
    `;
    if (!project) return null;
    const milestones = await tx<StaffProjectMilestone[]>`
      select
        id,
        title,
        summary,
        status,
        owner_display as "ownerDisplay",
        target_date::text as "targetDate",
        evidence,
        position
      from operations.milestones
      where organisation_id = ${project.organisationId} and project_id = ${project.id}
      order by position asc, id asc
      limit 100
    `;
    return { ...project, milestones };
  });
}

export async function executeStaffProjectCommand(
  db: OperationsDb,
  admin: FssAdminContext,
  projectId: string,
  raw: unknown,
  correlationId: string,
): Promise<DeliveryCommandResult> {
  const id = z.uuid().parse(projectId);
  z.uuid().parse(correlationId);
  const command = projectCommandSchema.parse(raw);
  if (command.action === "create" || command.projectId !== id)
    throw new ProjectConflict();

  return withFssAdminTransaction(db, admin, async (tx) => {
    const [project] = await tx<{ organisationId: string }[]>`
      select organisation_id as "organisationId"
      from operations.projects
      where id = ${id}
    `;
    if (!project) throw new ProjectConflict();
    return executeProjectCommandInTransaction(
      tx,
      project.organisationId,
      command,
      correlationId,
    );
  });
}

export async function executeStaffProjectCreateCommand(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<DeliveryCommandResult> {
  const id = z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = projectCommandSchema.parse(raw);
  if (command.action !== "create") throw new ProjectConflict();

  return withFssAdminTransaction(db, admin, async (tx) => {
    const [agreement] = await tx<Array<{ id: string }>>`
      select id
      from operations.agreements
      where organisation_id = ${id} and id = ${command.metadata.agreementId}
    `;
    if (!agreement)
      throw new ProjectConflict("Select an agreement for this client.");
    return executeProjectCommandInTransaction(tx, id, command, correlationId);
  });
}
