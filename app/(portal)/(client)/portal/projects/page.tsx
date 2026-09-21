import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { listPortalProjects } from "@/lib/operations/projects/repository";
import type { ClientProject } from "@/lib/operations/projects/types";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientProjectList } from "@/components/portal/projects/client-project-list";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  let projects: ClientProject[];
  try {
    projects = await listPortalProjects(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <ClientProjectList
      organisationId={context.organisationId}
      projects={projects}
    />
  );
}
