import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { withVerifiedPortalIdentity } from "../db/portal-client";
import type { VerifiedPortalIdentity } from "./types";

export const userProfileNameSchema = z.string().trim().min(1).max(200);

export async function saveUserProfile(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  displayName: string,
  correlationId: string,
  overwriteName = true,
): Promise<void> {
  const name = userProfileNameSchema.parse(displayName);
  await withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    await tx`select operations.upsert_user_profile(${name}, ${overwriteName})`;
  });
}
