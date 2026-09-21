import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { StudioProjectForm } from "@/components/portal/studio/project-form";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { loadStaffProjectForEdit } from "@/lib/operations/projects/staff-service";

export const dynamic = "force-dynamic";

export default async function AdminProjectEditPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const projectId = z.uuid().safeParse((await params).projectId);
  if (!projectId.success) notFound();
  let project: Awaited<ReturnType<typeof loadStaffProjectForEdit>>;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    project = await loadStaffProjectForEdit(db, admin, projectId.data);
  } catch {
    return <PortalUnavailable />;
  }
  if (!project) notFound();
  return <StudioProjectForm project={project} />;
}
