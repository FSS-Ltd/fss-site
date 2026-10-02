import { z } from "zod";
import type { Currency } from "../money";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";
import {
  parseWorkspacePage,
  toWorkspaceCollectionPage,
  workspacePageOffset,
  workspacePageSize,
  type WorkspaceCollectionPage,
} from "../workspaces/pagination";

const clientSearchSchema = z.string().trim().max(100);

export type StudioClient = Readonly<{
  activeWorkCount: number;
  displayName: string;
  id: string;
  legalName: string;
  lifecycle: "active" | "archived";
  nextAction: string;
  nextActionHref: string;
  primaryContactName: string;
}>;

export type StudioClientDetail = Readonly<{
  billingCurrency: Currency;
  currencyVersion: number;
  activeJourneyCount: number;
  activeProjectCount: number;
  agreementCount: number;
  billingExceptionCount: number;
  displayName: string;
  id: string;
  legalName: string;
  lifecycle: "active" | "archived";
  nextAction: string;
  nextActionHref: string;
  openRequestCount: number;
  primaryContactName: string;
  timezone: string;
}>;

function parseSearch(value: unknown): string {
  if (Array.isArray(value))
    throw new Error("Only one client search is allowed.");
  return clientSearchSchema.parse(value ?? "");
}

export async function listStudioClients(
  db: OperationsDb,
  admin: FssAdminContext,
  input: { page?: unknown; query?: unknown } = {},
): Promise<WorkspaceCollectionPage<StudioClient>> {
  const page = parseWorkspacePage(input.page);
  const query = parseSearch(input.query);
  const offset = workspacePageOffset(page);

  return withFssAdminTransaction(db, admin, async (tx) => {
    const rows = await tx<StudioClient[]>`
      select
        o.id,
        o.display_name as "displayName",
        o.legal_name as "legalName",
        o.lifecycle,
        coalesce(primary_contact.name, 'No primary contact') as "primaryContactName",
        (
          (select count(*)::integer
           from operations.projects p
           where p.organisation_id = o.id
             and p.status not in ('completed', 'paused'))
          +
          (select count(*)::integer
           from operations.requests r
           where r.organisation_id = o.id
             and r.status not in ('done', 'cancelled'))
        ) as "activeWorkCount",
        case
          when exists (
            select 1 from operations.requests r
            where r.organisation_id = o.id and r.status = 'ready_for_review'
          ) then 'Review client work'
          when exists (
            select 1 from operations.agreements a
            where a.organisation_id = o.id and a.status = 'draft'
          ) then 'Finish agreement'
          when not exists (
            select 1 from operations.agreements a where a.organisation_id = o.id
          ) then 'Set up an agreement'
          when not exists (
            select 1 from operations.projects p where p.organisation_id = o.id
          ) then 'Plan first project'
          else 'Open client workspace'
        end as "nextAction",
        case
          when exists (
            select 1 from operations.requests r
            where r.organisation_id = o.id and r.status = 'ready_for_review'
          ) then '/portal/admin/clients/' || o.id::text || '/requests'
          when exists (
            select 1 from operations.agreements a
            where a.organisation_id = o.id and a.status = 'draft'
          ) then '/portal/admin/clients/' || o.id::text || '/agreements'
          when not exists (
            select 1 from operations.agreements a where a.organisation_id = o.id
          ) then '/portal/admin/clients/' || o.id::text || '/agreements/new'
          when not exists (
            select 1 from operations.projects p where p.organisation_id = o.id
          ) then '/portal/admin/projects/new?organisationId=' || o.id::text
          else '/portal/admin/clients/' || o.id::text
        end as "nextActionHref"
      from operations.organisations o
      left join lateral (
        select c.name
        from operations.contacts c
        where c.organisation_id = o.id
        order by c.created_at asc, c.id asc
        limit 1
      ) primary_contact on true
      where (
        ${query}::text = ''
        or lower(o.display_name) like '%' || lower(${query}) || '%'
        or lower(o.legal_name) like '%' || lower(${query}) || '%'
      )
      order by o.display_name asc, o.id asc
      limit ${workspacePageSize + 1} offset ${offset}
    `;
    return toWorkspaceCollectionPage(rows, page);
  });
}

export async function loadStudioClient(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
): Promise<StudioClientDetail | null> {
  const id = z.uuid().parse(organisationId);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const [client] = await tx<StudioClientDetail[]>`
      select
        o.id,
        o.display_name as "displayName",
        o.legal_name as "legalName",
        o.timezone,
        o.billing_currency as "billingCurrency",
        o.currency_version as "currencyVersion",
        o.lifecycle,
        coalesce(primary_contact.name, 'No primary contact') as "primaryContactName",
        (select count(*)::integer from operations.projects p
          where p.organisation_id = o.id and p.status not in ('completed', 'paused')
        ) as "activeProjectCount",
        (select count(*)::integer from operations.requests r
          where r.organisation_id = o.id and r.status not in ('done', 'cancelled')
        ) as "openRequestCount",
        (select count(*)::integer from operations.agreements a
          where a.organisation_id = o.id
        ) as "agreementCount",
        (select count(*)::integer from operations.onboarding_journeys j
          where j.organisation_id = o.id and j.state in ('active', 'paused')
        ) as "activeJourneyCount",
        (select count(*)::integer from operations.billing_exceptions e
          where e.organisation_id = o.id and e.resolved_at is null
        ) as "billingExceptionCount",
        case
          when exists (
            select 1 from operations.requests r
            where r.organisation_id = o.id and r.status = 'ready_for_review'
          ) then 'Review client work'
          when exists (
            select 1 from operations.agreements a
            where a.organisation_id = o.id and a.status = 'draft'
          ) then 'Finish agreement'
          when not exists (
            select 1 from operations.agreements a where a.organisation_id = o.id
          ) then 'Set up an agreement'
          when not exists (
            select 1 from operations.projects p where p.organisation_id = o.id
          ) then 'Plan first project'
          else 'Open client workspace'
        end as "nextAction",
        case
          when exists (
            select 1 from operations.requests r
            where r.organisation_id = o.id and r.status = 'ready_for_review'
          ) then '/portal/admin/clients/' || o.id::text || '/requests'
          when exists (
            select 1 from operations.agreements a
            where a.organisation_id = o.id and a.status = 'draft'
          ) then '/portal/admin/clients/' || o.id::text || '/agreements'
          when not exists (
            select 1 from operations.agreements a where a.organisation_id = o.id
          ) then '/portal/admin/clients/' || o.id::text || '/agreements/new'
          when not exists (
            select 1 from operations.projects p where p.organisation_id = o.id
          ) then '/portal/admin/projects/new?organisationId=' || o.id::text
          else '/portal/admin/clients/' || o.id::text
        end as "nextActionHref"
      from operations.organisations o
      left join lateral (
        select c.name
        from operations.contacts c
        where c.organisation_id = o.id
        order by c.created_at asc, c.id asc
        limit 1
      ) primary_contact on true
      where o.id = ${id}
    `;
    return client ?? null;
  });
}
