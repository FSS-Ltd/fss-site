import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { withVerifiedPortalIdentity } from "../db/portal-client";
import { requireOperationsFounder } from "../organisations/link-engagement";
import type { OperationsFounder } from "../organisations/types";
import type { PortalInvitationClaim } from "./clerk-invitation";
import type { StaffMembership } from "./staff-types";
import type { VerifiedPortalIdentity } from "./types";

const reviewSchema = z.string().trim().min(1).max(200);
const idsSchema = z.strictObject({
  invitationId: z.uuid(),
  correlationId: z.uuid(),
});
export const staffInvitationSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  reviewReference: reviewSchema,
});
const membershipSchema = z.strictObject({
  membershipId: z.uuid(),
  userId: z.uuid(),
  role: z.literal("admin"),
});

export async function issueStaffInvitation(
  db: OperationsDb,
  context: OperationsFounder | null,
  input: unknown,
  invitationId: string,
  correlationId: string,
): Promise<{ invitationId: string; expiresAt: Date }> {
  const founder = requireOperationsFounder(context);
  const invitation = staffInvitationSchema.parse(input);
  const ids = idsSchema.parse({ invitationId, correlationId });
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    const [row] = await tx<{ id: string; expiresAt: Date }[]>`
      select id, expires_at as "expiresAt" from operations.issue_staff_invitation(
        ${ids.invitationId}, ${invitation.name}, ${invitation.email}, ${invitation.reviewReference}, ${ids.correlationId}
      )
    `;
    if (!row) throw new Error("Staff invitation could not be recorded.");
    return { value: { invitationId: row.id, expiresAt: row.expiresAt } };
  });
  return result.value;
}

export async function failStaffInvitation(
  db: OperationsDb,
  context: OperationsFounder | null,
  invitationId: string,
  correlationId: string,
): Promise<void> {
  const founder = requireOperationsFounder(context);
  const ids = idsSchema.parse({ invitationId, correlationId });
  await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    await tx`select operations.fail_staff_invitation(${ids.invitationId}, ${ids.correlationId})`;
  });
}

// Revoke the invitation and its grant together so old Clerk metadata cannot restore access.
export async function revokeStaffInvitation(
  db: OperationsDb,
  context: OperationsFounder | null,
  invitationId: string,
  reviewReference: string,
  correlationId: string,
): Promise<void> {
  const founder = requireOperationsFounder(context);
  const ids = idsSchema.parse({ invitationId, correlationId });
  const review = reviewSchema.parse(reviewReference);
  await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    await tx`select operations.revoke_staff_invitation(${ids.invitationId}, ${review}, ${ids.correlationId})`;
  });
}

// Claim must be produced by the verified Clerk server/webhook adapter, never request JSON.
export async function claimClerkStaffInvitation(
  db: OperationsDb,
  claim: PortalInvitationClaim | null,
  correlationId: string,
): Promise<boolean> {
  if (
    !claim ||
    claim.invitation.version !== 3 ||
    claim.invitation.email !== claim.identity.email
  )
    return false;
  const invitationId = z.uuid().parse(claim.invitation.invitationId);
  return withVerifiedPortalIdentity(
    db,
    claim.identity,
    correlationId,
    async (tx) => {
      const [row] = await tx<{ membershipId: string | null }[]>`
      select operations.claim_staff_invitation(${invitationId}) as "membershipId"
    `;
      return z.uuid().safeParse(row?.membershipId).success;
    },
  );
}

export async function getActiveStaffMembership(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  correlationId: string,
): Promise<StaffMembership | null> {
  return withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    const [row] = await tx<
      { membershipId: string; userId: string; role: string }[]
    >`
      select membership_id as "membershipId", user_id as "userId", role
      from operations.active_staff_membership()
    `;
    const membership = membershipSchema.safeParse(row);
    return membership.success && membership.data.userId === identity?.userId
      ? membership.data
      : null;
  });
}
