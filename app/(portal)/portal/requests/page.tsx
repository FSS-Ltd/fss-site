import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { requirePortalMember } from "@/lib/operations/auth/require-member";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { listPortalRequests } from "@/lib/operations/requests/repository";
import { RequestBoard } from "@/components/portal/requests/board";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/projects.module.css";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  let requests, membership;
  try {
    const db = getPortalDb();
    const correlationId = randomUUID();
    membership = await requirePortalMember(
      db,
      context.identity,
      context.organisationId,
      correlationId,
    );
    requests = await listPortalRequests(
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
      <Link className={styles.breadcrumb} href="/portal">
        Your workspace
      </Link>
      <p className={styles.eyebrow}>Work, together</p>
      <h1 className={styles.title}>Requests</h1>
      <p className={styles.copy}>
        A clear place for new ideas, feedback and the next step.
      </p>
      {hasPortalCapability(membership.role, "requests.create") && (
        <Link
          className={styles.breadcrumb}
          href={`/portal/requests/new?organisationId=${context.organisationId}`}
        >
          New request
        </Link>
      )}
      <RequestBoard
        requests={requests}
        organisationId={context.organisationId}
      />
    </div>
  );
}
