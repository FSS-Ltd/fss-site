import type { PortalTeamMember } from "@/lib/operations/workspaces/types";
import { getPortalRolePresentation } from "@/lib/operations/auth/permissions";
import styles from "./workspace.module.css";

function joinedLabel(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function TeamList({
  members,
}: {
  members: readonly PortalTeamMember[];
}): React.JSX.Element {
  if (members.length === 0)
    return (
      <p className={styles.empty}>There are no active workspace members.</p>
    );

  return (
    <ul className={styles.collection} aria-label="Active workspace members">
      {members.map((member) => (
        <li className={styles.row} key={`${member.name}-${member.joinedAt}`}>
          <div className={styles.rowContent}>
            <h2>{member.name}</h2>
            <p>
              {getPortalRolePresentation(member.role).label} · Joined{" "}
              <time dateTime={member.joinedAt}>
                {joinedLabel(member.joinedAt)}
              </time>
            </p>
          </div>
          <span className={styles.status}>
            {getPortalRolePresentation(member.role).detail}
          </span>
        </li>
      ))}
    </ul>
  );
}
