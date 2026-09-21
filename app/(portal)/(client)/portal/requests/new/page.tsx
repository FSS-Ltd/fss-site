import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { requirePortalMember } from "@/lib/operations/auth/require-member";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { listPortalProjects } from "@/lib/operations/projects/repository";
import { RequestForm } from "@/components/portal/requests/request-form";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PageHeader } from "@/components/portal/ui";
import styles from "@/components/portal/requests/requests.module.css";
import { portalPath } from "@/lib/operations/auth/portal-url";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const context = await getPortalPageContext(params.organisationId);
  if (!context) return <PortalUnavailable />;
  let projects;
  try {
    const db = getPortalDb();
    const correlationId = randomUUID();
    const membership = await requirePortalMember(
      db,
      context.identity,
      context.organisationId,
      correlationId,
    );
    if (!hasPortalCapability(membership.role, "requests.create"))
      throw new PortalAccessDenied();
    projects = await listPortalProjects(
      db,
      context.identity,
      context.organisationId,
      correlationId,
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <div className={styles.requestPage}>
      <PageHeader
        breadcrumbs={[
          {
            label: "Requests",
            href: `${portalPath("/portal/requests")}?organisationId=${context.organisationId}`,
          },
          { label: "New request" },
        ]}
        description={
          params.type === "bug"
            ? "Tell us what happened so we can reproduce it."
            : "A clear request helps us give you a useful next step."
        }
        eyebrow="FSS Studio / Requests"
        title={
          params.type === "bug"
            ? "Report a problem"
            : "What would you like us to do?"
        }
      />
      <RequestForm
        initialProjectId={z.uuid().safeParse(params.projectId).data}
        initialType={params.type === "bug" ? "bug" : "work"}
        organisationId={context.organisationId}
        projects={projects.map(({ id, title }) => ({ id, title }))}
      />
    </div>
  );
}
