import { PortalCard, StatusBadge } from "@/components/portal/ui";
import type { StudioPortalAccessEntry } from "@/lib/operations/studio/portal-access";
import { AccessDialog } from "./access-dialog";
import { DeleteInvitationDialog } from "./delete-invitation-dialog";
import { ResendInvitationDialog } from "./resend-invitation-dialog";
import {
  accessDate,
  accessRole,
  accessStateLabels,
  accessStateTone,
} from "./access-presentation";
import styles from "./portal-access.module.css";

export function AccessIdentityCard({
  entry,
  canManageStaff,
  onComplete,
  timezone,
}: Readonly<{
  entry: StudioPortalAccessEntry;
  canManageStaff: boolean;
  onComplete: (message: string) => void;
  timezone: string;
}>): React.JSX.Element {
  const removable =
    entry.state === "active" &&
    entry.membershipId &&
    (entry.accessType === "client" || canManageStaff);
  const [prefix, invitationId] = entry.id.split(":");
  const resendKind =
    prefix === "client-invitation"
      ? "client"
      : prefix === "staff"
        ? "staff"
        : null;
  const canResend =
    !entry.membershipId &&
    (entry.state === "pending" || entry.state === "expired") &&
    resendKind !== null &&
    Boolean(invitationId) &&
    (resendKind === "client" || canManageStaff);
  return (
    <PortalCard>
      <div className={styles.identity}>
        <span aria-hidden="true" className={styles.avatar}>
          {entry.name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")}
        </span>
        <div className={styles.identitySummary}>
          <h2>{entry.name}</h2>
          <p>{entry.email}</p>
          <p>
            {entry.organisationName ?? "New client"} ·{" "}
            {accessRole(entry.role).label}
          </p>
        </div>
        <StatusBadge status={accessStateTone(entry.state)}>
          {accessStateLabels[entry.state]}
        </StatusBadge>
        <div className={styles.identityAction}>
          {canResend && resendKind && invitationId ? (
            <ResendInvitationDialog
              entry={entry}
              invitationId={invitationId}
              kind={resendKind}
              onComplete={onComplete}
            />
          ) : null}
          {removable ? (
            <AccessDialog entry={entry} kind="remove" onComplete={onComplete} />
          ) : !entry.membershipId &&
            (entry.accessType === "client" || canManageStaff) ? (
            <DeleteInvitationDialog entry={entry} onComplete={onComplete} />
          ) : null}
        </div>
      </div>
      <dl className={styles.dates}>
        <div>
          <dt>{entry.membershipId ? "Joined" : "Invited"}</dt>
          <dd>
            {accessDate(
              entry.membershipId ? entry.joinedAt : entry.invitedAt,
              timezone,
            )}
          </dd>
        </div>
        <div>
          <dt>
            {entry.membershipId
              ? "Scope"
              : entry.state === "accepted"
                ? "Next step"
                : "Expires"}
          </dt>
          <dd>
            {entry.membershipId
              ? entry.accessType === "admin"
                ? "FSS operations"
                : "Client organisation"
              : entry.state === "accepted"
                ? "Create organisation"
                : accessDate(entry.expiresAt, timezone)}
          </dd>
        </div>
      </dl>
    </PortalCard>
  );
}
