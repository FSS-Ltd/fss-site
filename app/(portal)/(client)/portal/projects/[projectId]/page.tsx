import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalProject } from "@/lib/operations/projects/repository";
import { listProjectDocuments } from "@/lib/operations/documents/repository";
import type { ClientProjectDetail as ClientProjectDetailData } from "@/lib/operations/projects/types";
import type { ClientDocument } from "@/lib/operations/documents/types";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientProjectDetail } from "@/components/portal/projects/client-project-detail";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  const parsed = z.uuid().safeParse((await params).projectId);
  if (!parsed.success) notFound();
  let project: ClientProjectDetailData | null;
  let documents: ClientDocument[];
  try {
    const correlationId = randomUUID();
    project = await getPortalProject(
      getPortalDb(),
      context.identity,
      context.organisationId,
      parsed.data,
      correlationId,
    );
    documents = project
      ? await listProjectDocuments(
          getPortalDb(),
          context.identity,
          context.organisationId,
          parsed.data,
          correlationId,
        )
      : [];
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  if (!project) notFound();
  return (
    <ClientProjectDetail
      documents={documents}
      organisationId={context.organisationId}
      project={project}
    />
  );
}
