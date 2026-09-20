import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalProject } from "@/lib/operations/projects/repository";
import { listProjectDocuments } from "@/lib/operations/documents/repository";
import type { ClientProjectDetail } from "@/lib/operations/projects/types";
import type { ClientDocument } from "@/lib/operations/documents/types";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ProjectSummary } from "@/components/portal/project-summary";
import { MilestoneList } from "@/components/portal/milestone-list";
import { DocumentList } from "@/components/portal/document-list";
import styles from "@/components/portal/projects.module.css";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { portalPath } from "@/lib/operations/auth/portal-url";

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
  let project: ClientProjectDetail | null;
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
    <div className={styles.page}>
      <Link
        className={styles.breadcrumb}
        href={`${portalPath("/portal/projects")}?organisationId=${context.organisationId}`}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All projects
      </Link>
      <p className={styles.eyebrow}>Your project</p>
      <h1 className={styles.title}>{project.title}</h1>
      <ProjectSummary project={project} />
      <MilestoneList milestones={project.milestones} />
      <DocumentList
        documents={documents}
        organisationId={context.organisationId}
      />
    </div>
  );
}
