import type { OperationsDb } from "../db/client";
import {
  withPortalTransaction,
  withVerifiedPortalIdentity,
} from "../db/portal-client";
import type {
  PortalContext,
  PortalRole,
  VerifiedPortalIdentity,
} from "./types";

export async function requirePortalMember(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<PortalContext> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (_tx, context) => context,
  );
}

export type PortalMembershipSummary = {
  organisationId: string;
  displayName: string;
  role: PortalRole;
};
export async function listPortalMemberships(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  correlationId: string,
): Promise<PortalMembershipSummary[]> {
  return withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    const rows = await tx<PortalMembershipSummary[]>`
      select m.organisation_id as "organisationId", o.display_name as "displayName", m.role
      from operations.memberships m join operations.organisations o on o.id = m.organisation_id
      where m.revoked_at is null order by o.display_name, o.id limit 100
    `;
    return [...rows];
  });
}
