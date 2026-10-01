import { readAccessOverviewMetrics } from "../auth/access-overview-metrics";
import type { FssAdminContext } from "../auth/staff-types";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { OperationsDb } from "../db/client";
import {
  toWorkspaceCollectionPage,
  workspacePageOffset,
  workspacePageSize,
} from "../workspaces/pagination";
import { hasStudioFounderCapability } from "./access-capability";
import {
  studioAccessListInputSchema,
  type StudioPortalAccessEntry,
  type StudioPortalAccessOverview,
  type StudioPortalContact,
} from "./portal-access";

function maskContactEmail(email: string): string {
  const [local, domain] = email.split("@");
  return local && domain
    ? `${local.slice(0, 1)}***@${domain}`
    : "Contact unavailable";
}

type AccessRow = StudioPortalAccessEntry;

export async function listStudioPortalAccess(
  db: OperationsDb,
  admin: FssAdminContext,
  input: unknown,
  identity?: VerifiedPortalIdentity | null,
): Promise<StudioPortalAccessOverview> {
  const parsed = studioAccessListInputSchema.parse(input);
  const canManageStaff = hasStudioFounderCapability(admin, identity);
  if (parsed.view === "staff" && !canManageStaff)
    throw new PortalAccessDenied();
  const query = parsed.query ?? "";
  const state = parsed.state ?? null;
  const offset = workspacePageOffset(parsed.page);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const [contacts, rows, metrics] = await Promise.all([
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
            'membership:' || m.id as id, 'client'::text as "accessType", m.created_at::text as "joinedAt",
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
          join operations.contacts c on c.id = m.contact_id and c.organisation_id = m.organisation_id
          join operations.organisations o on o.id = m.organisation_id
          union all
          select
            'client-invitation:' || p.id, 'client', null::text, o.id, o.display_name,
            c.id, p.name, p.email, null::uuid, p.role,
            case
              when p.state = 'pending' and p.expires_at <= now() then 'expired'
              else p.state
            end,
            p.created_at::text, p.expires_at::text, null::text
          from operations.pending_portal_invitations p
          left join operations.organisations o on o.id = coalesce(p.target_organisation_id, p.organisation_id)
          left join operations.contacts c
            on c.organisation_id = coalesce(p.target_organisation_id, p.organisation_id) and lower(c.email) = lower(p.email)
          where (${canManageStaff} or coalesce(p.target_organisation_id, p.organisation_id) is not null) and p.state <> 'completed'
          union all
          select
            'legacy-invitation:' || i.id, 'client', null::text, o.id, o.display_name,
            c.id, c.name, c.email, null::uuid, i.role,
            case
              when i.revoked_at is not null then 'revoked'
              when i.expires_at <= now() then 'expired'
              when o.lifecycle <> 'active' then 'inactive'
              else 'pending'
            end,
            i.created_at::text, i.expires_at::text, null::text
          from operations.portal_invites i
          join operations.contacts c on c.id = i.contact_id and c.organisation_id = i.organisation_id
          join operations.organisations o on o.id = i.organisation_id
          where i.claimed_at is null
          union all
          select 'staff:' || s.id, 'admin', s.joined_at::text,
            null::uuid, 'FSS'::text, null::uuid, s.name, s.email, s.membership_id,
            'admin', s.state, s.invited_at::text, null::text, s.joined_at::text
          from operations.founder_staff_access_register() s
          where ${canManageStaff}
        ) access
        where (
          (${parsed.view} = 'clients' and access."accessType" = 'client' and access."membershipId" is not null)
          or (${parsed.view} = 'staff' and access."accessType" = 'admin' and access."membershipId" is not null)
          or (${parsed.view} = 'invitations' and access."membershipId" is null)
        )
        and (${state}::text is null or access.state = ${state}::text)
          and (
            ${query}::text = ''
            or lower(concat_ws(' ', access.name, access.email, access."organisationName"))
              like '%' || lower(${query}) || '%'
          )
        order by name, email, id
        limit ${workspacePageSize + 1} offset ${offset}
      `,
      readAccessOverviewMetrics(tx, canManageStaff),
    ]);
    return {
      ...toWorkspaceCollectionPage(rows, parsed.page),
      contacts: contacts.map((contact) => ({
        ...contact,
        email: maskContactEmail(contact.email),
      })),
      query,
      state,
      view: parsed.view,
      canManageStaff,
      metrics: {
        activeClientUsers: metrics.clientUsers,
        activeStaff: metrics.admins,
        pendingInvitations: metrics.pendingInvitations,
        attentionInvitations: metrics.attentionInvitations,
      },
    };
  });
}
