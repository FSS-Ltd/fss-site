import { z } from "zod";
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

export const grantAccessSchema = contactSchema.extend({
  action: z.literal("grant_access"),
  role: z.enum(portalRoles),
});

export const portalOperationSchema = z.discriminatedUnion("action", [
  contactSchema.extend({ action: z.literal("create_contact") }),
  grantAccessSchema,
  inviteSchema.extend({ action: z.literal("issue_invite") }),
  revokeSchema.extend({ action: z.literal("revoke_membership") }),
]);
export type PortalOperation = z.infer<typeof portalOperationSchema>;
export type PortalOperationResult =
  | { action: "create_contact"; contactId: string }
  | { action: "grant_access" }
  | { action: "issue_invite"; activationUrl: string; expiresAt: string }
  | { action: "revoke_membership" };

export type PortalAccountProvisioner = (
  email: string,
  redirectUrl: string,
  metadata: PortalInvitationMetadata | undefined,
) => Promise<void>;

export class PortalAccessConflict extends Error {}

export async function applyPortalOperation(
  db: OperationsDb,
  founder: OperationsFounder,
  operation: PortalOperation,
  origin: string,
  provision: PortalAccountProvisioner = provisionPortalAccount,
): Promise<PortalOperationResult> {
  const { action, ...input } = portalOperationSchema.parse(operation);
  if (action === "create_contact")
    return { action, ...(await createPortalContact(db, founder, input)) };
  if (action === "revoke_membership") {
    await revokePortalMembership(db, founder, input);
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
