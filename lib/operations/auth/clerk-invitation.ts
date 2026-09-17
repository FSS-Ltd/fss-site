import { z } from "zod";
import { portalRoles, type VerifiedPortalIdentity } from "./types";
import { readVerifiedPortalUser } from "./verified-user";

const legacyPortalInvitationMetadataSchema = z.strictObject({
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

const pendingPortalInvitationMetadataSchema = z.strictObject({
  version: z.literal(2),
  invitationId: z.uuid(),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
});

const staffInvitationMetadataSchema =
  pendingPortalInvitationMetadataSchema.extend({
    version: z.literal(3),
    realm: z.literal("staff"),
    role: z.literal("admin"),
  });

const portalInvitationMetadataSchema = z.discriminatedUnion("version", [
  legacyPortalInvitationMetadataSchema,
  pendingPortalInvitationMetadataSchema,
  staffInvitationMetadataSchema,
]);

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

type LegacyPortalInvitationInput = Omit<
  z.input<typeof legacyPortalInvitationMetadataSchema>,
  "version"
>;
type PendingPortalInvitationInput = Omit<
  z.input<typeof pendingPortalInvitationMetadataSchema>,
  "version"
>;

export function createStaffInvitationMetadata(
  input: PendingPortalInvitationInput,
): z.infer<typeof staffInvitationMetadataSchema> {
  return staffInvitationMetadataSchema.parse({
    ...input,
    version: 3,
    realm: "staff",
    role: "admin",
  });
}

export function isStaffInvitationForEmail(
  metadata: unknown,
  email: string,
): boolean {
  const invitation = staffInvitationMetadataSchema.safeParse(
    metadata &&
      typeof metadata === "object" &&
      "fssPortalInvitation" in metadata
      ? metadata.fssPortalInvitation
      : null,
  );
  return invitation.success && invitation.data.email === email.toLowerCase();
}

export function createPortalInvitationMetadata(
  input: LegacyPortalInvitationInput | PendingPortalInvitationInput,
): PortalInvitationMetadata {
  return portalInvitationMetadataSchema.parse({
    ...input,
    version: "invitationId" in input ? 2 : 1,
  });
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
