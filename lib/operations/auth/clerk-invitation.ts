import { z } from "zod";
import { portalRoles, type VerifiedPortalIdentity } from "./types";
import { readVerifiedPortalUser } from "./verified-user";

const portalInvitationMetadataSchema = z.strictObject({
  version: z.literal(1),
  organisationId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  role: z.enum(portalRoles),
  reviewReference: z.string().trim().min(1).max(200),
  approvedBy: z.string().regex(/^[a-f0-9]{64}$/),
});

const clerkUserEnvelope = z
  .object({
    id: z.string().regex(/^user_[A-Za-z0-9]+$/),
    public_metadata: z.unknown().optional(),
    publicMetadata: z.unknown().optional(),
  })
  .passthrough();

export type PortalInvitationMetadata = z.infer<
  typeof portalInvitationMetadataSchema
>;

export type PortalInvitationClaim = {
  readonly clerkUserId: string;
  readonly identity: VerifiedPortalIdentity;
  readonly invitation: PortalInvitationMetadata;
};

export function createPortalInvitationMetadata(input: {
  organisationId: string;
  name: string;
  email: string;
  role: (typeof portalRoles)[number];
  reviewReference: string;
  approvedBy: string;
}): PortalInvitationMetadata {
  return portalInvitationMetadataSchema.parse({ version: 1, ...input });
}

export function readPortalInvitationClaim(
  user: unknown,
): PortalInvitationClaim | null {
  const envelope = clerkUserEnvelope.safeParse(user);
  const identity = readVerifiedPortalUser(user);
  if (!envelope.success || !identity) return null;
  const metadata =
    envelope.data.publicMetadata ?? envelope.data.public_metadata ?? null;
  const invitation = portalInvitationMetadataSchema.safeParse(
    metadata &&
      typeof metadata === "object" &&
      "fssPortalInvitation" in metadata
      ? metadata.fssPortalInvitation
      : null,
  );
  if (!invitation.success || invitation.data.email !== identity.email)
    return null;
  return {
    clerkUserId: envelope.data.id,
    identity,
    invitation: invitation.data,
  };
}
