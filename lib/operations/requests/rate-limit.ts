import type { VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";
export async function consumeRequestRateLimit(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<boolean> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx) => {
      const [row] = await tx<
        { allowed: boolean }[]
      >`select operations.consume_request_limit(${organisationId}) as allowed`;
      return row.allowed;
    },
  );
}
