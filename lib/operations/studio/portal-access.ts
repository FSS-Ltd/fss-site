import { z } from "zod";
import { portalRoles } from "../auth/types";
import { applyPortalOperation, type PortalAccountProvisioner } from "../auth/operator";
import { PortalAccessConflict } from "../auth/operator";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";
import {
  toWorkspaceCollectionPage,
  workspacePageOffset,
  workspacePageSize,
  type WorkspaceCollectionPage,
} from "../workspaces/pagination";

const accessStateSchema = z.enum([
  "active",
  "pending",
  "revoked",
  "expired",
  "provider_failed",
  "inactive",
]);

const listInputSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(10_000),
  query: z.string().trim().max(100).optional(),
  state: accessStateSchema.optional(),
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
]);

export type StaffPortalAccessOperation = z.infer<
  typeof staffPortalAccessOperationSchema
>;

export type StudioPortalAccessEntry = Readonly<{
  id: string;
  organisationId: string;
  organisationName: string;
  contactId: string | null;
  name: string;
  email: string;
  membershipId: string | null;
  role: (typeof portalRoles)[number];
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

export type StudioPortalAccessOverview = WorkspaceCollectionPage<StudioPortalAccessEntry> &
  Readonly<{
    contacts: readonly StudioPortalContact[];
    query: string;
    state: z.infer<typeof accessStateSchema> | null;
  }>;

type AccessRow = StudioPortalAccessEntry;

function maskContactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Contact unavailable";
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function listStudioPortalAccess(
  db: OperationsDb,
  admin: FssAdminContext,
  input: unknown,
): Promise<StudioPortalAccessOverview> {
  const parsed = listInputSchema.parse(input);
  const query = parsed.query ?? "";
  const state = parsed.state ?? null;
  const offset = workspacePageOffset(parsed.page);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const [contacts, rows] = await Promise.all([
      tx<StudioPortalContact[]>`
        select c.id, c.organisation_id as "organisationId",
          o.display_name as "organisationName", c.name, c.email
        from operations.contacts c
        join operations.organisations o on o.id = c.organisation_id
        where o.lifecycle = 'active'
        order by o.display_name, c.name, c.email
        limit 200
      `,
      tx<AccessRow[]>`
        select * from (
          select
            'membership:' || m.id as id,
            o.id as "organisationId", o.display_name as "organisationName",
            c.id as "contactId", c.name, c.email, m.id as "membershipId", m.role,
            case
              when m.revoked_at is not null then 'revoked'
              when o.lifecycle <> 'active' then 'inactive'
              else 'active'
            end as state,
            m.created_at::text as "invitedAt", null::text as "expiresAt",
            m.created_at::text as "lastVerifiedAt"
          from operations.memberships m
          join operations.contacts c on c.id = m.contact_id
          join operations.organisations o on o.id = m.organisation_id
          union all
          select
            'client-invitation:' || p.id, o.id, o.display_name,
            c.id, p.name, p.email, null::uuid, p.role,
            case
              when p.state = 'pending' and p.expires_at <= now() then 'expired'
              else p.state
            end,
            p.created_at::text, p.expires_at::text, null::text
          from operations.pending_portal_invitations p
          join operations.organisations o on o.id = p.organisation_id
          left join operations.contacts c
            on c.organisation_id = p.organisation_id and lower(c.email) = lower(p.email)
          where p.organisation_id is not null and p.state <> 'completed'
          union all
          select
            'legacy-invitation:' || i.id, o.id, o.display_name,
            c.id, c.name, c.email, null::uuid, i.role,
            case
              when i.revoked_at is not null then 'revoked'
              when i.expires_at <= now() then 'expired'
              when o.lifecycle <> 'active' then 'inactive'
              else 'pending'
            end,
            i.created_at::text, i.expires_at::text, null::text
          from operations.portal_invites i
          join operations.contacts c on c.id = i.contact_id
          join operations.organisations o on o.id = i.organisation_id
          where i.claimed_at is null
        ) access
        where (${state}::text is null or access.state = ${state}::text)
          and (
            ${query}::text = ''
            or lower(concat_ws(' ', access.name, access.email, access."organisationName"))
              like '%' || lower(${query}) || '%'
          )
        order by name, email, id
        limit ${workspacePageSize + 1} offset ${offset}
      `,
    ]);
    return {
      ...toWorkspaceCollectionPage(rows, parsed.page),
      contacts: contacts.map((contact) => ({
        ...contact,
        email: maskContactEmail(contact.email),
      })),
      query,
      state,
    };
  });
}

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
): Promise<StaffPortalAccessOutcome> {
  const operation = staffPortalAccessOperationSchema.parse(raw);
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
