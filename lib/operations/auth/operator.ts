import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
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

export const portalOperationSchema = z.discriminatedUnion("action", [
  contactSchema.extend({ action: z.literal("create_contact") }),
  inviteSchema.extend({ action: z.literal("issue_invite") }),
  revokeSchema.extend({ action: z.literal("revoke_membership") }),
]);
export type PortalOperation = z.infer<typeof portalOperationSchema>;
export type PortalOperationResult =
  | { action: "create_contact"; contactId: string }
  | { action: "issue_invite"; activationUrl: string; expiresAt: string }
  | { action: "revoke_membership" };

export async function applyPortalOperation(
  db: OperationsDb,
  founder: OperationsFounder,
  operation: PortalOperation,
  origin: string,
): Promise<PortalOperationResult> {
  const { action, ...input } = portalOperationSchema.parse(operation);
  if (action === "create_contact")
    return { action, ...(await createPortalContact(db, founder, input)) };
  if (action === "revoke_membership") {
    await revokePortalMembership(db, founder, input);
    return { action };
  }
  const invite = inviteSchema.parse(input);
  const contact = await getPortalContact(db, founder, {
    organisationId: invite.organisationId,
    contactId: invite.contactId,
  });
  if (!contact) throw new Error("The approved portal contact was not found.");
  await provisionPortalAccount(contact.email);
  const issued = await issuePortalInvite(db, founder, invite);
  const url = new URL("/portal/activate", origin);
  url.hash = new URLSearchParams({ invite: issued.token }).toString();
  return {
    action,
    activationUrl: url.href,
    expiresAt: issued.expiresAt.toISOString(),
  };
}
