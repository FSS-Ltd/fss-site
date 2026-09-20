import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { portalRoles } from "./types";
import {
  createPortalInvitationMetadata,
  createStaffInvitationMetadata,
  type PortalInvitationMetadata,
} from "./clerk-invitation";
import { provisionPortalAccount } from "./provision";
import {
  contactSchema,
  inviteSchema,
  revokeSchema,
  createPortalContact,
  getPortalContact,
  issuePortalInvite,
  revokePortalMembership,
} from "./repository";
import {
  failPendingPortalInvitation,
  existingPortalInvitationSchema,
  issuePendingPortalInvitation,
  pendingPortalInvitationSchema,
} from "./pending-invitations";
import { sendConfiguredFounderInvitation } from "./founder-invitation";
import {
  issueStaffInvitation,
  failStaffInvitation,
  revokeStaffMembership,
  staffInvitationSchema,
  revokeStaffMembershipSchema,
} from "./staff-invitations";
import { createInvitationActivationUrl, portalUrl } from "./portal-url";
import { requireOperationsFounder } from "../organisations/link-engagement";

export const grantAccessSchema = contactSchema.extend({
  action: z.literal("grant_access"),
  role: z.enum(portalRoles),
});

export const inviteClientSchema = pendingPortalInvitationSchema.extend({
  action: z.literal("invite_client"),
});
export const inviteExistingClientSchema = existingPortalInvitationSchema.extend(
  {
    action: z.literal("invite_existing_client"),
  },
);
export const inviteAdminSchema = staffInvitationSchema.extend({
  action: z.literal("invite_admin"),
});
export const inviteFounderSchema = z.strictObject({
  action: z.literal("invite_founder"),
  reviewReference: z.string().trim().min(1).max(200),
});

export const portalOperationSchema = z.discriminatedUnion("action", [
  contactSchema.extend({ action: z.literal("create_contact") }),
  grantAccessSchema,
  inviteClientSchema,
  inviteExistingClientSchema,
  inviteAdminSchema,
  revokeStaffMembershipSchema.extend({ action: z.literal("revoke_admin") }),
  inviteFounderSchema,
  inviteSchema.extend({ action: z.literal("issue_invite") }),
  revokeSchema.extend({ action: z.literal("revoke_membership") }),
]);
export type PortalOperation = z.infer<typeof portalOperationSchema>;
export type PortalAccessOperation = Extract<
  PortalOperation,
  {
    action:
      | "invite_client"
      | "invite_existing_client"
      | "invite_admin"
      | "revoke_membership"
      | "revoke_admin";
  }
>;
export type PortalOperationResult =
  | { action: "create_contact"; contactId: string }
  | { action: "grant_access" }
  | { action: "invite_client" }
  | { action: "invite_existing_client" }
  | { action: "invite_admin" }
  | { action: "revoke_admin" }
  | { action: "invite_founder" }
  | { action: "issue_invite"; activationUrl: string; expiresAt: string }
  | { action: "revoke_membership" };

export type PortalAccountProvisioner = (
  email: string,
  redirectUrl: string,
  metadata: PortalInvitationMetadata | undefined,
) => Promise<void>;

export class PortalAccessConflict extends Error {}

type PortalOperationDependencies = {
  createId: () => string;
  issuePending: typeof issuePendingPortalInvitation;
  failPending: typeof failPendingPortalInvitation;
  sendFounder: typeof sendConfiguredFounderInvitation;
  issueStaff: typeof issueStaffInvitation;
  failStaff: typeof failStaffInvitation;
  revokeStaff: typeof revokeStaffMembership;
};

const defaultDependencies: PortalOperationDependencies = {
  createId: randomUUID,
  issuePending: issuePendingPortalInvitation,
  failPending: failPendingPortalInvitation,
  sendFounder: sendConfiguredFounderInvitation,
  issueStaff: issueStaffInvitation,
  failStaff: failStaffInvitation,
  revokeStaff: revokeStaffMembership,
};

export async function applyPortalOperation(
  db: OperationsDb,
  founder: OperationsFounder,
  operation: PortalOperation,
  origin: string,
  provision: PortalAccountProvisioner = provisionPortalAccount,
  dependencyOverrides: Partial<PortalOperationDependencies> = {},
): Promise<PortalOperationResult> {
  requireOperationsFounder(founder);
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const { action, ...input } = portalOperationSchema.parse(operation);
  if (action === "create_contact")
    return { action, ...(await createPortalContact(db, founder, input)) };
  if (action === "revoke_membership") {
    await revokePortalMembership(db, founder, input);
    return { action };
  }
  if (action === "revoke_admin") {
    await dependencies.revokeStaff(db, founder, input, dependencies.createId());
    return { action };
  }
  if (action === "invite_admin") {
    const invitation = inviteAdminSchema.parse(operation);
    const invitationId = dependencies.createId();
    const correlationId = dependencies.createId();
    await dependencies.issueStaff(
      db,
      founder,
      {
        name: invitation.name,
        email: invitation.email,
        reviewReference: invitation.reviewReference,
      },
      invitationId,
      correlationId,
    );
    try {
      await provision(
        invitation.email,
        createInvitationActivationUrl(origin, invitation.name, invitation.email)
          .href,
        createStaffInvitationMetadata({
          invitationId,
          email: invitation.email,
        }),
      );
    } catch (error) {
      await dependencies.failStaff(db, founder, invitationId, correlationId);
      throw error;
    }
    return { action };
  }
  if (action === "invite_client") {
    const invitation = inviteClientSchema.parse(operation);
    const invitationId = dependencies.createId();
    const correlationId = dependencies.createId();
    await dependencies.issuePending(
      db,
      founder,
      {
        name: invitation.name,
        email: invitation.email,
        role: "owner",
        reviewReference: invitation.reviewReference,
      },
      invitationId,
      correlationId,
    );
    const url = createInvitationActivationUrl(
      origin,
      invitation.name,
      invitation.email,
    );
    try {
      await provision(
        invitation.email,
        url.href,
        createPortalInvitationMetadata({
          invitationId,
          email: invitation.email,
        }),
      );
    } catch (error) {
      await dependencies.failPending(db, founder, invitationId, correlationId);
      throw error;
    }
    return { action };
  }
  if (action === "invite_existing_client" || action === "grant_access") {
    const invitation =
      action === "grant_access"
        ? grantAccessSchema.parse(operation)
        : inviteExistingClientSchema.parse(operation);
    const invitationId = dependencies.createId();
    const correlationId = dependencies.createId();
    await dependencies.issuePending(
      db,
      founder,
      {
        name: invitation.name,
        email: invitation.email,
        role: invitation.role,
        reviewReference: invitation.reviewReference,
        organisationId: invitation.organisationId,
      },
      invitationId,
      correlationId,
    );
    try {
      await provision(
        invitation.email,
        createInvitationActivationUrl(origin, invitation.name, invitation.email)
          .href,
        createPortalInvitationMetadata({
          invitationId,
          email: invitation.email,
        }),
      );
    } catch (error) {
      await dependencies.failPending(db, founder, invitationId, correlationId);
      throw error;
    }
    return { action };
  }
  if (action === "invite_founder") {
    const invitation = inviteFounderSchema.parse(operation);
    await dependencies.sendFounder(invitation.reviewReference);
    return { action };
  }
  const invite = inviteSchema.parse(input);
  const contact = await getPortalContact(db, founder, {
    organisationId: invite.organisationId,
    contactId: invite.contactId,
  });
  if (!contact) throw new Error("The approved portal contact was not found.");
  const issued = await issuePortalInvite(db, founder, invite);
  const url = portalUrl("/activate", origin);
  await provision(contact.email, url.href, undefined);
  return {
    action,
    activationUrl: url.href,
    expiresAt: issued.expiresAt.toISOString(),
  };
}
