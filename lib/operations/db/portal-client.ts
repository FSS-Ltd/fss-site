import postgres from "postgres";
import { z } from "zod";
import {
  operationsEnabled,
  type OperationsDb,
  type OperationsTransaction,
} from "./client";
import {
  PortalAccessDenied,
  portalRoles,
  type PortalContext,
  type VerifiedPortalIdentity,
} from "../auth/types";

let sharedDb: OperationsDb | undefined;
export function getPortalDb(): OperationsDb {
  if (!operationsEnabled()) throw new Error("Operations is disabled.");
  const url = process.env.OPERATIONS_PORTAL_DATABASE_URL;
  if (!url) throw new Error("Portal database is not configured.");
  sharedDb ??= postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { options: "-c role=operations_portal" },
  });
  return sharedDb;
}

const identitySchema = z.strictObject({
  userId: z.uuid(),
  email: z.email().max(254),
  emailVerified: z.literal(true),
});

// Identity must come from the verified server adapter, never request JSON.
export async function withVerifiedPortalIdentity<T>(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  correlationId: string,
  run: (tx: OperationsTransaction) => Promise<T>,
): Promise<T> {
  const parsed = identitySchema.safeParse(identity);
  if (!parsed.success || !z.uuid().safeParse(correlationId).success)
    throw new PortalAccessDenied();
  const result = await db.begin(async (tx) => {
    const [role] = await tx<{ name: string }[]>`select current_user as name`;
    if (role.name !== "operations_portal") throw new PortalAccessDenied();
    await tx`select set_config('operations.user_id', ${parsed.data.userId}, true),
      set_config('operations.verified_email', ${parsed.data.email.trim().toLowerCase()}, true),
      set_config('operations.correlation_id', ${correlationId}, true),
      set_config('operations.organisation_id', '', true)`;
    return { value: await run(tx) };
  });
  return result.value;
}

export async function withPortalTransaction<T>(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
  run: (tx: OperationsTransaction, context: PortalContext) => Promise<T>,
): Promise<T> {
  if (!z.uuid().safeParse(organisationId).success)
    throw new PortalAccessDenied();
  return withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    await tx`select set_config('operations.organisation_id', ${organisationId}, true)`;
    const [membership] = await tx<{ userId: string; role: string }[]>`
      select user_id as "userId", role from operations.memberships
      where organisation_id = ${organisationId} and revoked_at is null
    `;
    const role = portalRoles.find(
      (candidate) => candidate === membership?.role,
    );
    if (!membership || !role) throw new PortalAccessDenied();
    return run(tx, {
      userId: membership.userId,
      organisationId,
      role,
      correlationId,
    });
  });
}
