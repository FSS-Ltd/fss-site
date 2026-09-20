import { portalRoleOptions } from "@/lib/operations/auth/access-dashboard-metrics";
import type { InvitationType } from "./portal-access-form";
import styles from "./portal-access-dashboard.module.css";

export function PortalInvitationFields({
  type,
  organisations,
  pending,
}: {
  type: InvitationType;
  organisations: readonly { id: string; displayName: string }[];
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
      {type === "new_client" ? (
        <p>
          The first user for a new client is always the organisation owner and
          will complete onboarding after accepting the invitation.
        </p>
      ) : type === "existing_client" ? (
        <>
          <label>
            Client organisation
            <select defaultValue="" name="organisationId" required disabled={pending}>
              <option disabled value="">
                Select a client
              </option>
              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Portal role
            <select defaultValue="contributor" name="role" disabled={pending}>
              {portalRoleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
        </>
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
