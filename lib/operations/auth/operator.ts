import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { portalRoles } from "./types";
import {
  createPortalInvitationMetadata,
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
  issuePendingPortalInvitation,
  pendingPortalInvitationSchema,
} from "./pending-invitations";

export const grantAccessSchema = contactSchema.extend({
  action: z.literal("grant_access"),
  role: z.enum(portalRoles),
});

export const inviteClientSchema = pendingPortalInvitationSchema.extend({
  action: z.literal("invite_client"),
});

export const portalOperationSchema = z.discriminatedUnion("action", [
  contactSchema.extend({ action: z.literal("create_contact") }),
  grantAccessSchema,
  inviteClientSchema,
  inviteSchema.extend({ action: z.literal("issue_invite") }),
  revokeSchema.extend({ action: z.literal("revoke_membership") }),
]);
export type PortalOperation = z.infer<typeof portalOperationSchema>;
export type PortalOperationResult =
  | { action: "create_contact"; contactId: string }
  | { action: "grant_access" }
  | { action: "invite_client" }
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
};

const defaultDependencies: PortalOperationDependencies = {
  createId: randomUUID,
  issuePending: issuePendingPortalInvitation,
  failPending: failPendingPortalInvitation,
};

export async function applyPortalOperation(
  db: OperationsDb,
  founder: OperationsFounder,
  operation: PortalOperation,
  origin: string,
  provision: PortalAccountProvisioner = provisionPortalAccount,
  dependencies: PortalOperationDependencies = defaultDependencies,
): Promise<PortalOperationResult> {
  const { action, ...input } = portalOperationSchema.parse(operation);
  if (action === "create_contact")
    return { action, ...(await createPortalContact(db, founder, input)) };
  if (action === "revoke_membership") {
    await revokePortalMembership(db, founder, input);
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
        role: invitation.role,
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
  if (action === "grant_access") {
    const grant = grantAccessSchema.parse(operation);
    const url = createInvitationActivationUrl(origin, grant.name, grant.email);
    await provision(
      grant.email,
      url.href,
      createPortalInvitationMetadata({
        organisationId: grant.organisationId,
        name: grant.name,
        email: grant.email,
        role: grant.role,
        reviewReference: grant.reviewReference,
        approvedBy: founder.actorId,
      }),
    );
    return { action };
  }
  const invite = inviteSchema.parse(input);
  const contact = await getPortalContact(db, founder, {
    organisationId: invite.organisationId,
    contactId: invite.contactId,
  });
  if (!contact) throw new Error("The approved portal contact was not found.");
  const issued = await issuePortalInvite(db, founder, invite);
  const url = new URL("/portal/activate", origin);
  await provision(contact.email, url.href, undefined);
  return {
    action,
    activationUrl: url.href,
    expiresAt: issued.expiresAt.toISOString(),
  };
}

function createInvitationActivationUrl(
  origin: string,
  name: string,
  email: string,
): URL {
  const url = new URL("/portal/activate", origin);
  url.searchParams.set("name", name);
  url.searchParams.set("email", email);
  return url;
}
