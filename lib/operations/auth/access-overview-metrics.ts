import type { OperationsTransaction } from "../db/client";

export type AccessOverviewMetricRow = Readonly<{
  uniqueActiveUsers: number;
  clientUsers: number;
  admins: number;
  pendingInvitations: number;
  attentionInvitations: number;
}>;

// The caller supplies includeStaff only after checking the verified founder capability.
// Counts cover the authorised dataset and never consume register filters or page offsets.
export async function readAccessOverviewMetrics(
  tx: OperationsTransaction,
  includeStaff: boolean,
): Promise<AccessOverviewMetricRow> {
  const rows = await tx<AccessOverviewMetricRow[]>`
        with active_access as (
          select m.user_id, 'client'::text as access_type, m.role::text as role,
            lower(trim(c.email)) as email
          from operations.memberships m
          join operations.contacts c on c.id = m.contact_id and c.organisation_id = m.organisation_id
          join operations.organisations o on o.id = m.organisation_id
          where m.revoked_at is null and o.lifecycle = 'active'
            and m.user_id is not null
          union all
          select s.user_id, 'admin'::text, 'admin'::text, lower(trim(s.email))
          from operations.founder_staff_access_register() s
          where ${includeStaff} and s.state = 'active' and s.user_id is not null
        ),
        pending_access as (
          select lower(trim(p.email)) as email
          from operations.pending_portal_invitations p
          where p.state = 'pending' and p.expires_at > now()
            and (${includeStaff} or coalesce(p.target_organisation_id, p.organisation_id) is not null)
          union all
          select lower(trim(c.email))
          from operations.portal_invites i
          join operations.contacts c on c.id = i.contact_id and c.organisation_id = i.organisation_id
          join operations.organisations o on o.id = i.organisation_id
          where i.claimed_at is null and i.revoked_at is null
            and i.expires_at > now() and o.lifecycle = 'active'
          union all
          select lower(trim(s.email))
          from operations.founder_staff_access_register() s
          where ${includeStaff} and s.state = 'pending'
        )
        , attention_access as (
          select lower(trim(p.email)) as email
          from operations.pending_portal_invitations p
          where (p.state = 'provider_failed' or (p.state = 'pending' and p.expires_at <= now()))
            and (${includeStaff} or coalesce(p.target_organisation_id, p.organisation_id) is not null)
          union all
          select lower(trim(c.email))
          from operations.portal_invites i
          join operations.contacts c on c.id = i.contact_id and c.organisation_id = i.organisation_id
          where i.claimed_at is null and i.revoked_at is null and i.expires_at <= now()
          union all
          select lower(trim(s.email)) from operations.founder_staff_access_register() s
          where ${includeStaff} and s.state in ('expired', 'provider_failed')
        )
        select
          (select count(distinct user_id)::integer from active_access) as "uniqueActiveUsers",
          (select count(distinct user_id)::integer from active_access
            where access_type = 'client') as "clientUsers",
          (select count(distinct user_id)::integer from active_access
            where access_type = 'admin') as admins,
          (select count(distinct p.email)::integer from pending_access p
            where not exists (
              select 1 from active_access a where a.email = p.email
            )) as "pendingInvitations",
          (select count(distinct email)::integer from attention_access) as "attentionInvitations"
      `;
  return (
    rows[0] ?? {
      uniqueActiveUsers: 0,
      clientUsers: 0,
      admins: 0,
      pendingInvitations: 0,
      attentionInvitations: 0,
    }
  );
}
