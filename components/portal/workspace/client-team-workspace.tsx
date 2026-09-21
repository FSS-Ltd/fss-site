import { UsersRound } from "lucide-react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { PortalRole } from "@/lib/operations/auth/types";
import type { PortalTeamMember } from "@/lib/operations/workspaces/types";
import { TeamList } from "./team-list";

export function ClientTeamWorkspace({
  invitation,
  members,
  organisationId,
  role,
}: {
  invitation?: React.ReactNode;
  members: readonly PortalTeamMember[];
  organisationId: string;
  role: PortalRole;
}): React.JSX.Element {
  const canInvite = role === "owner";
  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { href: portalPath("/portal"), label: "Your workspace" },
          { href: portalPath("/portal/settings"), label: "Settings" },
          { label: "Team" },
        ]}
        description="People with active access to this organisation’s client workspace."
        eyebrow="Your shared workspace"
        title="Team"
      />
      <PortalCard title="Active members">
        <TeamList members={members} />
      </PortalCard>
      {canInvite && invitation ? (
        <PortalCard title="Invite a team member">{invitation}</PortalCard>
      ) : (
        <Notice tone="info">
          <UsersRound aria-hidden="true" size={18} /> Access changes are managed
          by an organisation owner. Ask FSS for help if an owner is unavailable.
        </Notice>
      )}
      <PortalActionLink
        href={`${portalPath("/portal/help")}?${new URLSearchParams({ organisationId }).toString()}`}
        variant="secondary"
      >
        Get access help
      </PortalActionLink>
    </div>
  );
}
