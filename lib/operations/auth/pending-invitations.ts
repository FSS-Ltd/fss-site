import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { withVerifiedPortalIdentity } from "../db/portal-client";
import { requireOperationsFounder } from "../organisations/link-engagement";
import type { OperationsFounder } from "../organisations/types";
import {
  portalRoles,
  PortalAccessDenied,
  type VerifiedPortalIdentity,
} from "./types";

const boundedText = z.string().trim().min(1).max(200);

export const pendingPortalInvitationSchema = z.strictObject({
  name: boundedText,
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  role: z.enum(portalRoles),
  reviewReference: boundedText,
});

export const existingPortalInvitationSchema =
  pendingPortalInvitationSchema.extend({
    organisationId: z.uuid(),
  });

export const organisationOnboardingSchema = z.strictObject({
  legalName: boundedText,
  displayName: boundedText,
  timezone: z.string().trim().min(1).max(100),
});

export type PendingPortalInvitation = z.infer<
  typeof pendingPortalInvitationSchema
>;
export type OrganisationOnboarding = z.infer<
  typeof organisationOnboardingSchema
>;

export async function issuePendingPortalInvitation(
  db: OperationsDb,
  context: OperationsFounder | null,
  input: unknown,
  invitationId: string,
  correlationId: string,
): Promise<{ invitationId: string; expiresAt: Date }> {
  const founder = requireOperationsFounder(context);
  const invitation = z
    .union([pendingPortalInvitationSchema, existingPortalInvitationSchema])
    .parse(input);
  const ids = z
    .strictObject({ invitationId: z.uuid(), correlationId: z.uuid() })
    .parse({ invitationId, correlationId });
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    const [row] = await tx<{ id: string; expiresAt: Date }[]>`
      select id, expires_at as "expiresAt"
      from operations.issue_pending_portal_invitation(
        ${ids.invitationId}, ${invitation.name}, ${invitation.email},
        ${invitation.role}, ${invitation.reviewReference}, ${ids.correlationId},
        ${"organisationId" in invitation ? invitation.organisationId : null}
      )
    `;
    if (!row) throw new Error("Portal invitation could not be recorded.");
    return { value: row };
  });
  return { invitationId: result.value.id, expiresAt: result.value.expiresAt };
}

export async function failPendingPortalInvitation(
  db: OperationsDb,
  context: OperationsFounder | null,
  invitationId: string,
  correlationId: string,
): Promise<void> {
  const founder = requireOperationsFounder(context);
  const ids = z
    .strictObject({ invitationId: z.uuid(), correlationId: z.uuid() })
    .parse({ invitationId, correlationId });
  await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    await tx`select operations.fail_pending_portal_invitation(${ids.invitationId}, ${ids.correlationId})`;
  });
}

export async function needsPortalOnboarding(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  correlationId: string,
): Promise<boolean> {
  return withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    const [row] = await tx<{ needed: boolean }[]>`
      select operations.pending_portal_onboarding() as needed
    `;
    return row?.needed === true;
  });
}

export async function claimPendingPortalInvitationForVerifiedEmail(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  correlationId: string,
): Promise<"portal" | "onboarding" | null> {
  return withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    const [row] = await tx<{ destination: string | null }[]>`
      select operations.claim_pending_portal_invitation_for_verified_email() as destination
    `;
    return row?.destination === "portal" || row?.destination === "onboarding"
      ? row.destination
      : null;
  });
}

export async function completePortalOnboarding(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  input: unknown,
  correlationId: string,
): Promise<{ organisationId: string }> {
  const organisation = organisationOnboardingSchema.parse(input);
  return withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    const [row] = await tx<{ organisationId: string | null }[]>`
      select operations.complete_portal_onboarding(
        ${organisation.legalName}, ${organisation.displayName}, ${organisation.timezone}
      ) as "organisationId"
    `;
    if (!row?.organisationId) throw new PortalAccessDenied();
    return { organisationId: row.organisationId };
  });
}

export async function getClaimedInvitationIds(
  db: OperationsDb,
  identity: VerifiedPortalIdentity,
  realm: "staff" | "portal",
  correlationId: string,
): Promise<string[]> {
  return withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    const rows = await tx<{ invitationId: string }[]>`
      select invitation_id as "invitationId" from operations.claimed_invitation_ids(${realm})
    `;
    return rows.map((row) => row.invitationId);
  });
}
