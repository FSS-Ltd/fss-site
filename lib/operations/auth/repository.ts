import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { requireOperationsFounder } from "../organisations/link-engagement";
import type { OperationsFounder } from "../organisations/types";
import { createPortalInviteToken } from "./invites";
import { portalRoles } from "./types";

const reviewReference = z.string().trim().min(1).max(200);
export const contactSchema = z.strictObject({
  organisationId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  reviewReference,
});

export const inviteSchema = z.strictObject({
  organisationId: z.uuid(),
  contactId: z.uuid(),
  role: z.enum(portalRoles),
  reviewReference,
});
export const revokeSchema = z.strictObject({
  organisationId: z.uuid(),
  membershipId: z.uuid(),
  reviewReference,
});

export async function createPortalContact(
  db: OperationsDb,
  context: OperationsFounder | null,
  input: unknown,
): Promise<{ contactId: string }> {
  const founder = requireOperationsFounder(context);
  const contact = contactSchema.parse(input);
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    const [row] = await tx<{ contactId: string }[]>`
      insert into operations.contacts (organisation_id, name, email, created_by, review_reference)
      values (${contact.organisationId}, ${contact.name}, ${contact.email}, ${founder.actorId}, ${contact.reviewReference})
      returning id as "contactId"
    `;
    return { value: row };
  });
  return result.value;
}

export async function issuePortalInvite(
  db: OperationsDb,
  context: OperationsFounder | null,
  input: unknown,
): Promise<{ token: string; expiresAt: Date }> {
  const founder = requireOperationsFounder(context);
  const invite = inviteSchema.parse(input);
  const { token, tokenHash } = createPortalInviteToken();
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    const [row] = await tx<{ expiresAt: Date }[]>`
      select operations.issue_portal_invite(${invite.organisationId}, ${invite.contactId}, ${invite.role}, ${tokenHash}, ${invite.reviewReference}) as "expiresAt"
    `;
    return { value: { token, expiresAt: row.expiresAt } };
  });
  return result.value;
}

export async function revokePortalMembership(
  db: OperationsDb,
  context: OperationsFounder | null,
  input: unknown,
): Promise<void> {
  const founder = requireOperationsFounder(context);
  const revoke = revokeSchema.parse(input);
  await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    await tx`select operations.revoke_portal_membership(${revoke.organisationId}, ${revoke.membershipId}, ${revoke.reviewReference})`;
  });
}

export type PortalContact = {
  contactId: string;
  organisationId: string;
  name: string;
  email: string;
};
export async function getPortalContact(
  db: OperationsDb,
  context: OperationsFounder | null,
  input: unknown,
): Promise<PortalContact | null> {
  const founder = requireOperationsFounder(context);
  const lookup = z
    .strictObject({ organisationId: z.uuid(), contactId: z.uuid() })
    .parse(input);
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    const [row] = await tx<PortalContact[]>`
      select id as "contactId", organisation_id as "organisationId", name, email from operations.contacts
      where organisation_id = ${lookup.organisationId} and id = ${lookup.contactId}
    `;
    return { value: row ?? null };
  });
  return result.value;
}
