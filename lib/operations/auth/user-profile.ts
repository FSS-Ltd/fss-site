import { z } from "zod";
import type { OperationsDb } from "../db/client";
import {
  withPortalTransaction,
  withVerifiedPortalIdentity,
} from "../db/portal-client";
import { hasPortalCapability } from "./permissions";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "./types";

export const userProfileNameSchema = z.string().trim().min(1).max(200);

export type PortalProfile = Readonly<{
  displayName: string;
  email: string;
  organisationName: string;
  requestEmailEnabled: boolean;
  role: "owner" | "contributor" | "billing_contact" | "viewer";
  timezone: string;
}>;

export type SavedPortalProfile = Readonly<{
  displayName: string;
}>;

export async function readPortalProfile(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<PortalProfile> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx) => {
      const [profile] = await tx<PortalProfile[]>`
        select display_name as "displayName", email, organisation_name as "organisationName",
          timezone, role, request_email_enabled as "requestEmailEnabled"
        from operations.portal_current_profile(${organisationId})
      `;
      if (!profile) throw new Error("Portal profile is unavailable.");
      return profile;
    },
  );
}

export async function saveUserProfile(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  displayName: string,
  correlationId: string,
  overwriteName = true,
): Promise<SavedPortalProfile> {
  const name = userProfileNameSchema.parse(displayName);
  await withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    await tx`select operations.upsert_user_profile(${name}, ${overwriteName})`;
  });
  return { displayName: name };
}

export async function savePortalProfile(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  displayName: string,
  correlationId: string,
): Promise<SavedPortalProfile> {
  const name = userProfileNameSchema.parse(displayName);
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "settings.manage"))
        throw new PortalAccessDenied();
      await tx`select operations.upsert_user_profile(${name}, true)`;
      return { displayName: name };
    },
  );
}
