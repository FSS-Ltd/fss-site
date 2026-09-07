import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { requirePortalMember } from "@/lib/operations/auth/require-member";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { listPortalProjects } from "@/lib/operations/projects/repository";
import { RequestForm } from "@/components/portal/requests/request-form";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/projects.module.css";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
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
    <div className={styles.page}>
      <Link
        className={styles.breadcrumb}
        href={`/portal/requests?organisationId=${context.organisationId}`}
      >
        All requests
      </Link>
      <p className={styles.eyebrow}>Tell us what you need</p>
      <h1 className={styles.title}>New request</h1>
      <RequestForm
        organisationId={context.organisationId}
        projects={projects.map(({ id, title }) => ({ id, title }))}
      />
    </div>
  );
}
