import { z } from "zod";
import { hasStudioFounderCapability } from "./access-capability";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import {
  staffInvitationSchema,
  revokeStaffMembershipSchema,
} from "../auth/staff-invitations";
import { portalRoles } from "../auth/types";
import {
  applyPortalOperation,
  type PortalAccountProvisioner,
} from "../auth/operator";
import { PortalAccessConflict } from "../auth/operator";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";
import type { WorkspaceCollectionPage } from "../workspaces/pagination";

const accessStateSchema = z.enum([
  "active",
  "pending",
  "revoked",
  "expired",
  "provider_failed",
  "inactive",
]);

export const studioAccessListInputSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(10_000),
  query: z.string().trim().max(100).optional(),
  state: accessStateSchema.optional(),
  view: z.enum(["clients", "staff", "invitations"]).default("clients"),
});

const inviteOperationSchema = z.strictObject({
  action: z.literal("invite_existing_client"),
  contactId: z.uuid(),
  organisationId: z.uuid(),
  reviewReference: z.string().trim().min(1).max(200),
  role: z.enum(portalRoles),
});

const revokeOperationSchema = z.strictObject({
  action: z.literal("revoke_membership"),
  membershipId: z.uuid(),
  organisationId: z.uuid(),
  reviewReference: z.string().trim().min(1).max(200),
});

export const staffPortalAccessOperationSchema = z.discriminatedUnion("action", [
  inviteOperationSchema,
  revokeOperationSchema,
  staffInvitationSchema.extend({ action: z.literal("invite_admin") }),
  revokeStaffMembershipSchema.extend({ action: z.literal("revoke_admin") }),
]);

export type StaffPortalAccessOperation = z.infer<
  typeof staffPortalAccessOperationSchema
>;

export type StudioPortalAccessEntry = Readonly<{
  id: string;
  organisationId: string | null;
  organisationName: string | null;
  accessType: "client" | "admin";
  joinedAt: string | null;
  contactId: string | null;
  name: string;
  email: string;
  membershipId: string | null;
  role: (typeof portalRoles)[number] | "admin";
  state: z.infer<typeof accessStateSchema>;
  invitedAt: string | null;
  expiresAt: string | null;
  lastVerifiedAt: string | null;
}>;

export type StudioPortalContact = Readonly<{
  id: string;
  organisationId: string;
  organisationName: string;
  name: string;
  email: string;
}>;

export type StudioPortalAccessOverview =
  WorkspaceCollectionPage<StudioPortalAccessEntry> &
    Readonly<{
      contacts: readonly StudioPortalContact[];
      view: "clients" | "staff" | "invitations";
      canManageStaff: boolean;
      metrics: Readonly<{
        activeClientUsers: number;
        activeStaff: number;
        pendingInvitations: number;
        attentionInvitations: number;
      }>;
      query: string;
      state: z.infer<typeof accessStateSchema> | null;
    }>;

export { listStudioPortalAccess } from "./portal-access-read";

type TrustedInviteTarget = Readonly<{
  name: string;
  email: string;
}>;

async function loadInviteTarget(
  db: OperationsDb,
  admin: FssAdminContext,
  operation: z.infer<typeof inviteOperationSchema>,
): Promise<TrustedInviteTarget> {
  return withFssAdminTransaction(db, admin, async (tx) => {
    const [contact] = await tx<TrustedInviteTarget[]>`
      select c.name, c.email
      from operations.contacts c
      join operations.organisations o on o.id = c.organisation_id
      where c.id = ${operation.contactId}
        and c.organisation_id = ${operation.organisationId}
        and o.lifecycle = 'active'
    `;
    if (!contact) {
      throw new PortalAccessConflict(
        "The selected active client contact is no longer available. Refresh and try again.",
      );
    }
    return contact;
  });
}

async function assertRevocableMembership(
  db: OperationsDb,
  admin: FssAdminContext,
  operation: z.infer<typeof revokeOperationSchema>,
): Promise<void> {
  await withFssAdminTransaction(db, admin, async (tx) => {
    const [membership] = await tx<Array<{ id: string }>>`
      select m.id
      from operations.memberships m
      where m.id = ${operation.membershipId}
        and m.organisation_id = ${operation.organisationId}
        and m.revoked_at is null
    `;
    if (!membership) {
      throw new PortalAccessConflict(
        "This membership is no longer active. Refresh the access register.",
      );
    }
  });
}

export type StaffPortalAccessOutcome = Readonly<{
  status: "sent" | "revoked";
}>;

/**
 * The Staff boundary reloads every selected contact or membership before it
 * hands the existing durable invitation/revocation flow a trusted command.
 * Provider delivery remains outside the database transaction by design.
 */
export async function applyStaffPortalAccessOperation(
  db: OperationsDb,
  admin: FssAdminContext,
  raw: unknown,
  origin: string,
  provision?: PortalAccountProvisioner,
  identity?: VerifiedPortalIdentity | null,
): Promise<StaffPortalAccessOutcome> {
  const operation = staffPortalAccessOperationSchema.parse(raw);
  if (
    operation.action === "invite_admin" ||
    operation.action === "revoke_admin"
  ) {
    if (!hasStudioFounderCapability(admin, identity))
      throw new PortalAccessDenied();
    await withFssAdminTransaction(db, admin, async () => undefined);
    await applyPortalOperation(
      db,
      { actorId: admin.actorId },
      operation,
      origin,
      provision,
    );
    return { status: operation.action === "invite_admin" ? "sent" : "revoked" };
  }
  if (operation.action === "invite_existing_client") {
    const contact = await loadInviteTarget(db, admin, operation);
    await applyPortalOperation(
      db,
      { actorId: admin.actorId },
      {
        action: "invite_existing_client",
        email: contact.email,
        name: contact.name,
        organisationId: operation.organisationId,
        reviewReference: operation.reviewReference,
        role: operation.role,
      },
      origin,
      provision,
    );
    return { status: "sent" };
  }
  await assertRevocableMembership(db, admin, operation);
  await applyPortalOperation(
    db,
    { actorId: admin.actorId },
    operation,
    origin,
    provision,
  );
  return { status: "revoked" };
}
