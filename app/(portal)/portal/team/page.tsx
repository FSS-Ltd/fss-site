import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { OrganisationTeamInvitation } from "@/components/portal/auth/organisation-team-invitation";
import { TeamList } from "@/components/portal/workspace/team-list";
import styles from "@/components/portal/projects.module.css";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { requirePortalMember } from "@/lib/operations/auth/require-member";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { listPortalTeamMembers } from "@/lib/operations/workspaces/portal-repository";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  const members = await listPortalTeamMembers(
    getPortalDb(),
    context.identity,
    context.organisationId,
    randomUUID(),
  ).catch((error) => {
    if (error instanceof PortalAccessDenied) notFound();
    return null;
  });
  if (!members) return <PortalUnavailable />;
  const membership = await requirePortalMember(
    getPortalDb(),
    context.identity,
    context.organisationId,
    randomUUID(),
  ).catch((error) => {
    if (error instanceof PortalAccessDenied) notFound();
    return null;
  });
  if (!membership) return <PortalUnavailable />;
  return (
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href={portalPath("/portal")}>
        Your workspace
      </Link>
      <p className={styles.eyebrow}>Your shared workspace</p>
      <h1 className={styles.title}>Team</h1>
      <p className={styles.copy}>
        People with active access to this organisation’s client workspace.
      </p>
      <section
        className={styles.section}
        aria-labelledby="team-members-heading"
      >
        <div className={styles.sectionHeading}>
          <h2 id="team-members-heading">Active members</h2>
          <span className={styles.note}>
            {membership.role === "owner"
              ? "As an owner, you can invite a team member."
              : "Access changes are managed by an organisation owner."}
          </span>
        </div>
        <TeamList members={members} />
      </section>
      {membership.role === "owner" && (
        <section className={styles.section} aria-labelledby="invite-team-member-heading">
          <div className={styles.sectionHeading}>
            <h2 id="invite-team-member-heading">Invite a team member</h2>
          </div>
          <OrganisationTeamInvitation organisationId={context.organisationId} />
        </section>
      )}
    </div>
  );
}
