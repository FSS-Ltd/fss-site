-- Growth OS is a server-only data domain. Browser-facing Supabase roles must
-- never acquire access through the Data API, even if a table grant is added by
-- mistake. The application database role retains only the object privileges
-- granted by the prior migrations.

revoke all on schema growth from public, anon, authenticated, service_role;
revoke all on all tables in schema growth from public, anon, authenticated, service_role;
revoke all on all sequences in schema growth from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema growth
  revoke all on tables from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema growth
  revoke all on sequences from public, anon, authenticated, service_role;

alter table growth.businesses enable row level security;
alter table growth.contacts enable row level security;
alter table growth.prospects enable row level security;
alter table growth.integration_connections enable row level security;
alter table growth.audit_log enable row level security;
alter table growth.research_runs enable row level security;
alter table growth.agent_tasks enable row level security;
alter table growth.source_evidence enable row level security;
alter table growth.website_assessments enable row level security;
alter table growth.email_assets enable row level security;
alter table growth.email_templates enable row level security;
alter table growth.sequence_enrollments enable row level security;
alter table growth.email_messages enable row level security;
alter table growth.email_events enable row level security;
alter table growth.suppressions enable row level security;
alter table growth.inbound_leads enable row level security;
alter table growth.newsletter_subscribers enable row level security;
alter table growth.newsletter_issues enable row level security;
alter table growth.newsletter_sends enable row level security;
alter table growth.resend_delivery_events enable row level security;
alter table growth.delivery_engagements enable row level security;
alter table growth.commercial_stage_events enable row level security;
alter table growth.client_messages enable row level security;
alter table growth.prospect_previews enable row level security;
alter table growth.prospect_preview_change_requests enable row level security;
alter table growth.prospect_preview_evidence enable row level security;
alter table growth.prospect_preview_assets enable row level security;
alter table growth.seo_audit_drafts enable row level security;

do $$
declare
  growth_table record;
begin
  for growth_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'growth'
      and c.relkind in ('r', 'p')
  loop
    execute format(
      'drop policy if exists growth_app_access on growth.%I',
      growth_table.relname
    );
    execute format(
      'create policy growth_app_access on growth.%I for all to growth_app using (true) with check (true)',
      growth_table.relname
    );
  end loop;
end
$$;
