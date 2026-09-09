-- Staged Task 12 only; no production promotion.
create table operations.metric_export_jobs (
 id uuid primary key default gen_random_uuid(), actor_id text not null check(actor_id ~ '^[a-f0-9]{64}$'),
 filters jsonb not null check(jsonb_typeof(filters)='object'), provider_scope jsonb not null check(jsonb_typeof(provider_scope)='object'),
 definition_version text not null, created_at timestamptz not null default now(),
 state text not null default 'queued' check(state in ('queued','complete','failed')),
 completed_at timestamptz, csv text check(octet_length(csv)<=10000000), failure text,
 check((state='complete')=(csv is not null)), check((state='queued')=(completed_at is null))
);
create table operations.metric_export_audit (
 id uuid primary key default gen_random_uuid(),job_id uuid not null references operations.metric_export_jobs(id),
 actor_id text not null check(actor_id ~ '^[a-f0-9]{64}$'),action text not null check(action in ('requested','completed','failed','downloaded')),
 created_at timestamptz not null default now()
);
alter table operations.metric_export_jobs enable row level security;
alter table operations.metric_export_jobs force row level security;
alter table operations.metric_export_audit enable row level security;
alter table operations.metric_export_audit force row level security;
revoke all on operations.metric_export_jobs,operations.metric_export_audit from public,anon,authenticated,service_role,growth_app,operations_portal,operations_billing_worker;
grant select,insert on operations.metric_export_jobs,operations.metric_export_audit to operations_founder;
grant update(state,completed_at,csv,failure) on operations.metric_export_jobs to operations_founder;
create policy founder_scope on operations.metric_export_jobs to operations_founder using(actor_id=current_setting('operations.actor_id',true)) with check(actor_id=current_setting('operations.actor_id',true));
create policy founder_scope on operations.metric_export_audit to operations_founder using(actor_id=current_setting('operations.actor_id',true)) with check(actor_id=current_setting('operations.actor_id',true));
create function operations.guard_metric_export_audit() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from operations.metric_export_jobs j where j.id=new.job_id and j.actor_id=new.actor_id) then raise exception 'Export audit scope mismatch'; end if;
 return new;
end $$;
create trigger guard_metric_export_audit before insert on operations.metric_export_audit for each row execute function operations.guard_metric_export_audit();
revoke all on function operations.guard_metric_export_audit() from public,anon,authenticated,service_role,growth_app,operations_portal,operations_billing_worker;
-- EXPLAIN ANALYZE at 100,000 invoices/requests showed per-row actor regex checks.
-- The founder predicate is row-independent; evaluate once. Tenant policies are unchanged.
alter policy founder_read on operations.invoices using ((select current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$'));
alter policy founder_read on operations.requests using ((select current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$'));
