import type { OperationsDb } from "../db/client";
import { requireOperationsFounder } from "../organisations/link-engagement";
import type { OperationsFounder } from "../organisations/types";
import {
  getFounderAccessMetrics,
  type FounderAccessEntry,
  type FounderAccessOverview,
} from "./founder-access";

type AccessRow = Omit<FounderAccessEntry, "invitedAt" | "joinedAt"> & {
  invitedAt: Date | null;
  joinedAt: Date | null;
};

/** Full projection avoids the old register's limits silently truncating user totals. */
export async function listFounderAccessOverview(
  db: OperationsDb,
  context: OperationsFounder | null,
): Promise<FounderAccessOverview> {
  const founder = requireOperationsFounder(context);
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    const [counts, rows] = await Promise.all([
      tx<
        { count: number }[]
      >`select count(*)::integer as count from operations.organisations where lifecycle = 'active'`,
      tx<AccessRow[]>`
        select * from (
          select 'membership:' || m.id as id, 'client'::text as "accessType", c.name, c.email,
            m.user_id as "userId", m.id as "membershipId", o.id as "organisationId",
            o.display_name as "organisationName", m.role,
            case when m.revoked_at is not null then 'revoked' when o.lifecycle <> 'active' then 'inactive' else 'active' end as state,
            coalesce(p.created_at, i.created_at) as "invitedAt", m.created_at as "joinedAt"
          from operations.memberships m
          join operations.contacts c on c.id = m.contact_id
          join operations.organisations o on o.id = m.organisation_id
          left join lateral (
            select created_at from operations.pending_portal_invitations
            where organisation_id = m.organisation_id and claimed_user_id = m.user_id and state = 'completed'
            order by completed_at desc, id desc limit 1
          ) p on true
          left join lateral (
            select created_at from operations.portal_invites
            where contact_id = c.id and claimed_at is not null
            order by claimed_at desc, id desc limit 1
          ) i on true
          union all
          select 'client-invitation:' || p.id, 'client', p.name, p.email, null::uuid, null::uuid,
            null::uuid, null::text, p.role,
            case when p.state = 'pending' and p.expires_at <= now() then 'expired' else p.state end,
            p.created_at, null::timestamptz
          from operations.pending_portal_invitations p where p.state <> 'completed'
          union all
          select 'legacy-invitation:' || i.id, 'client', c.name, c.email, null::uuid, null::uuid,
            o.id, o.display_name, i.role,
            case when i.revoked_at is not null then 'revoked' when i.expires_at <= now() then 'expired'
              when o.lifecycle <> 'active' then 'inactive' else 'pending' end,
            i.created_at, null::timestamptz
          from operations.portal_invites i
          join operations.contacts c on c.id = i.contact_id
          join operations.organisations o on o.id = i.organisation_id
          where i.claimed_at is null
          union all
          select 'staff:' || s.id, 'admin', s.name, s.email, s.user_id, s.membership_id,
            null::uuid, null::text, 'admin', s.state, s.invited_at, s.joined_at
          from operations.founder_staff_access_register() s
        ) access order by name, email, id
      `,
    ]);
    const entries = rows.map(
      (row): FounderAccessEntry => ({
        ...row,
        invitedAt: row.invitedAt?.toISOString() ?? null,
        joinedAt: row.joinedAt?.toISOString() ?? null,
      }),
    );
    return {
      value: {
        entries,
        metrics: getFounderAccessMetrics(entries, counts[0]?.count ?? 0),
      },
    };
  });
  return result.value;
}
