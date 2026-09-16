import { portalRoleOptions } from "@/lib/operations/auth/access-dashboard-metrics";
import type { InvitationType } from "./portal-access-form";
import styles from "./portal-access-dashboard.module.css";

export function PortalInvitationFields({
  type,
  pending,
}: {
  type: InvitationType;
  pending: boolean;
}): React.JSX.Element {
  return (
    <div className={styles.clientFields}>
      <label>
        Name
        <input
          autoComplete="name"
          maxLength={200}
          name="name"
          required
          disabled={pending}
        />
      </label>
      <label>
        Email address
        <input
          autoComplete="email"
          maxLength={254}
          name="email"
          type="email"
          required
          disabled={pending}
        />
      </label>
      {type === "client" ? (
        <label>
          Portal role
          <select defaultValue="owner" name="role" disabled={pending}>
            {portalRoleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          FSS role
          <input
            value="Admin"
            readOnly
            aria-describedby="staff-access-description"
          />
        </label>
      )}
      {type === "admin" && (
        <p id="staff-access-description">
          FSS Studio access covers operations across clients. Only the founder
          can manage invitations and access.
        </p>
      )}
    </div>
  );
}
