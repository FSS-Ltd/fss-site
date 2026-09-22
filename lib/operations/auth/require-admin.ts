import { createHash } from "node:crypto";
import type { OperationsDb } from "../db/client";
import { getActiveStaffMembership } from "./staff-invitations";
import type { FssAdminContext } from "./staff-types";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "./types";

export async function requireFssAdmin(
  portalDb: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  correlationId: string,
): Promise<FssAdminContext> {
  const membership = await getActiveStaffMembership(
    portalDb,
    identity,
    correlationId,
  );
  if (!membership) throw new PortalAccessDenied();
  return {
    ...membership,
    realm: "staff",
    actorId: createHash("sha256")
      .update(`fss-admin:${membership.userId}`)
      .digest("hex"),
    correlationId,
  };
}
