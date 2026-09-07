import { z } from "zod";
import {
  hasPortalCapability,
  type PortalCapability,
} from "../auth/permissions";
import {
  PortalAccessDenied,
  type PortalContext,
  type VerifiedPortalIdentity,
} from "../auth/types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";
import type {
  ClientProject,
  ClientProjectDetail,
  ClientMilestone,
} from "./types";

export async function withProjectAccess<T>(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
  capability: PortalCapability,
  run: (tx: OperationsTransaction, context: PortalContext) => Promise<T>,
): Promise<T> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, capability))
        throw new PortalAccessDenied();
      return run(tx, context);
    },
  );
}
export async function loadClientProjects(
  tx: OperationsTransaction,
  context: PortalContext,
  projectId: string | null,
): Promise<ClientProject[]> {
  const rows = await tx<
    ClientProject[]
  >`select id, agreement_id as "agreementId", title, summary, outcome, deliverables, status, owner_display as "ownerDisplay", target_date::text as "targetDate", schedule_dependencies as "scheduleDependencies", schedule_evidence as "scheduleEvidence" from operations.projects where organisation_id=${context.organisationId} and (${projectId}::uuid is null or id=${projectId}::uuid) order by created_at desc, id limit 100`;
  return [...rows];
}
export async function listPortalProjects(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<ClientProject[]> {
  return withProjectAccess(
    db,
    identity,
    organisationId,
    correlationId,
    "projects.read",
    (tx, context) => loadClientProjects(tx, context, null),
  );
}
export async function getPortalProject(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  projectId: string,
  correlationId: string,
): Promise<ClientProjectDetail | null> {
  z.uuid().parse(projectId);
  return withProjectAccess(
    db,
    identity,
    organisationId,
    correlationId,
    "projects.read",
    async (tx, context) => {
      const [project] = await loadClientProjects(tx, context, projectId);
      if (!project) return null;
      const milestones = await tx<
        ClientMilestone[]
      >`select id,title,summary,status,owner_display as "ownerDisplay",target_date::text as "targetDate",evidence from operations.milestones where organisation_id=${context.organisationId} and project_id=${projectId} order by position,id limit 100`;
      return { ...project, milestones: [...milestones] };
    },
  );
}
