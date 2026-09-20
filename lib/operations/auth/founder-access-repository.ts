import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { requireOperationsFounder } from "../organisations/link-engagement";
import type { OperationsFounder } from "../organisations/types";
import {
  accessRoleOptions,
  type FounderAccessFilters,
  type FounderAccessEntry,
  type FounderAccessOverview,
} from "./founder-access";
import {
  parseWorkspacePage,
  workspacePageOffset,
  workspacePageSize,
} from "../workspaces/pagination";

type AccessRow = Omit<FounderAccessEntry, "invitedAt" | "joinedAt"> & {
  invitedAt: Date | null;
  joinedAt: Date | null;
};

type AccessMetricRow = {
  uniqueActiveUsers: number;
  clientUsers: number;
  admins: number;
  pendingInvitations: number;
};

type AccessRoleMetricRow = {
  role: FounderAccessEntry["role"];
  count: number;
};

export type FounderAccessListInput = {
  page?: unknown;
  query?: unknown;
  accessType?: unknown;
  state?: unknown;
};

function singleSearchParameter(value: unknown): string | undefined {
  if (Array.isArray(value))
    throw new Error("Only one filter value is allowed.");
  return z.string().optional().parse(value);
}

function parseFounderAccessFilters(
  input: FounderAccessListInput,
): FounderAccessFilters {
  const query = z
    .string()
    .trim()
    .max(100)
    .parse(singleSearchParameter(input.query) ?? "");
  const rawAccessType = singleSearchParameter(input.accessType);
  const rawState = singleSearchParameter(input.state);
  const accessType = z
    .enum(["client", "admin"])
    .optional()
    .parse(rawAccessType === "all" ? undefined : rawAccessType);
  const state = z
    .enum([
      "active",
      "pending",
      "revoked",
      "expired",
      "provider_failed",
      "inactive",
    ])
    .optional()
    .parse(rawState === "all" ? undefined : rawState);
  return { query, accessType, state };
}

export async function listFounderAccessOverview(
  db: OperationsDb,
  context: OperationsFounder | null,
  input: FounderAccessListInput = {},
): Promise<FounderAccessOverview> {
  const founder = requireOperationsFounder(context);
  const page = parseWorkspacePage(input.page);
  const filters = parseFounderAccessFilters(input);
  const offset = workspacePageOffset(page);
  const accessType = filters.accessType ?? null;
  const state = filters.state ?? null;
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    const [counts, metricRows, roleMetrics, rows] = await Promise.all([
      tx<
        { count: number }[]
      >`select count(*)::integer as count from operations.organisations where lifecycle = 'active'`,
      tx<AccessMetricRow[]>`
        with active_access as (
          select m.user_id, 'client'::text as access_type, m.role::text as role,
            lower(c.email) as email
          from operations.memberships m
          join operations.contacts c on c.id = m.contact_id
          join operations.organisations o on o.id = m.organisation_id
          where m.revoked_at is null and o.lifecycle = 'active'
            and m.user_id is not null
          union all
          select s.user_id, 'admin'::text, 'admin'::text, lower(s.email)
          from operations.founder_staff_access_register() s
          where s.state = 'active' and s.user_id is not null
        ),
        pending_access as (
          select lower(p.email) as email
          from operations.pending_portal_invitations p
          where p.state = 'pending' and p.expires_at > now()
          union all
          select lower(c.email)
          from operations.portal_invites i
          join operations.contacts c on c.id = i.contact_id
          join operations.organisations o on o.id = i.organisation_id
          where i.claimed_at is null and i.revoked_at is null
            and i.expires_at > now() and o.lifecycle = 'active'
          union all
          select lower(s.email)
          from operations.founder_staff_access_register() s
          where s.state = 'pending'
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
            )) as "pendingInvitations"
      `,
      tx<AccessRoleMetricRow[]>`
        with active_access as (
          select m.user_id, m.role::text as role
          from operations.memberships m
          join operations.organisations o on o.id = m.organisation_id
          where m.revoked_at is null and o.lifecycle = 'active'
            and m.user_id is not null
          union all
          select s.user_id, 'admin'::text
          from operations.founder_staff_access_register() s
          where s.state = 'active' and s.user_id is not null
        )
        select role, count(distinct user_id)::integer as count
        from active_access
        group by role
      `,
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
        ) access
        where (${accessType}::text is null or access."accessType" = ${accessType}::text)
          and (${state}::text is null or access.state = ${state}::text)
          and (
            ${filters.query}::text = ''
            or lower(concat_ws(' ', access.name, access.email, access."organisationName"))
              like '%' || lower(${filters.query}) || '%'
          )
        order by name, email, id
        limit ${workspacePageSize + 1} offset ${offset}
      `,
    ]);
    const entries = rows.map(
      (row): FounderAccessEntry => ({
        ...row,
        invitedAt: row.invitedAt?.toISOString() ?? null,
        joinedAt: row.joinedAt?.toISOString() ?? null,
      }),
    );
    const metrics = metricRows[0] ?? {
      uniqueActiveUsers: 0,
      clientUsers: 0,
      admins: 0,
      pendingInvitations: 0,
    };
    return {
      value: {
        entries: entries.slice(0, workspacePageSize),
        metrics: {
          ...metrics,
          organisations: counts[0]?.count ?? 0,
          roleCounts: accessRoleOptions.map((role) => ({
            ...role,
            count:
              roleMetrics.find((metric) => metric.role === role.value)?.count ??
              0,
          })),
        },
        filters,
        page,
        hasNext: rows.length > workspacePageSize,
      },
    };
  });
  return result.value;
}
