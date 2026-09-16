import type { OperationsDb } from "../db/client";
import { getActiveStaffMembership } from "./staff-invitations";
import type { FssAdminContext } from "./staff-types";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "./types";

export async function requireFssAdmin(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  correlationId: string,
): Promise<FssAdminContext> {
  const membership = await getActiveStaffMembership(
    db,
    identity,
    correlationId,
  );
  if (!membership) throw new PortalAccessDenied();
  return { ...membership, realm: "staff", correlationId };
}
