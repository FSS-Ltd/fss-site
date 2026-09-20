import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { withVerifiedPortalIdentity } from "../db/portal-client";
import type { VerifiedPortalIdentity } from "./types";

const ownerInviteRoles = ["contributor", "billing_contact", "viewer"] as const;

export const ownerInvitationSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  role: z.enum(ownerInviteRoles),
});

export type OwnerInvitation = z.infer<typeof ownerInvitationSchema>;

export async function issueOwnerInvitation(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  input: unknown,
  invitationId: string,
  correlationId: string,
): Promise<void> {
  const invitation = ownerInvitationSchema.parse(input);
  const ids = z.strictObject({ organisationId: z.uuid(), invitationId: z.uuid(), correlationId: z.uuid() }).parse({ organisationId, invitationId, correlationId });
  await withVerifiedPortalIdentity(db, identity, ids.correlationId, async (tx) => {
    await tx`select operations.issue_owner_portal_invitation(
      ${ids.invitationId}, ${invitation.name}, ${invitation.email}, ${invitation.role},
      ${ids.organisationId}, ${ids.correlationId}
    )`;
  });
}

export async function failOwnerInvitation(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  invitationId: string,
  correlationId: string,
): Promise<void> {
  await withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    await tx`select operations.fail_owner_portal_invitation(${invitationId}, ${correlationId})`;
  });
}
