-- Manual records have no fabricated verification date; research remains authoritative.
alter table growth.businesses alter column verified_at drop not null;

create table growth.crm_capture_requests (
  id uuid primary key,
  prospect_id uuid not null references growth.prospects(id) on delete restrict,
  inbound_lead_id uuid unique references growth.inbound_leads(id) on delete restrict,
  actor_id text not null check (actor_id ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index crm_capture_prospect_idx on growth.crm_capture_requests(prospect_id);

create table growth.crm_tasks (
  id uuid primary key,
  prospect_id uuid not null references growth.prospects(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 300),
  due_at timestamptz not null,
  completed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_tasks_prospect_due_idx on growth.crm_tasks(prospect_id,due_at,id);
create index crm_inbound_submitted_idx on growth.inbound_leads(submitted_at desc,id desc);
create index crm_tasks_due_idx on growth.crm_tasks(prospect_id, due_at, id) where completed_at is null;
create index crm_tasks_completed_idx on growth.crm_tasks(prospect_id, completed_at desc, id) where completed_at is not null;

create table growth.crm_activities (
  id uuid primary key,
  prospect_id uuid not null references growth.prospects(id) on delete restrict,
  activity_type text not null check (activity_type in ('note','call','meeting','task_created','task_updated','task_completed','task_reopened','next_step')),
  body text not null check (length(trim(body)) between 1 and 10000),
  task_id uuid references growth.crm_tasks(id) on delete restrict,
  actor_id text not null check (actor_id ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index crm_activity_prospect_idx on growth.crm_activities(prospect_id, created_at desc, id desc);

create table growth.crm_saved_views (
  id uuid primary key,
  actor_id text not null check (actor_id ~ '^[a-f0-9]{64}$'),
  name text not null check (length(trim(name)) between 1 and 80),
  filters jsonb not null check (jsonb_typeof(filters) = 'object'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(actor_id, name)
);
create index crm_saved_view_actor_idx on growth.crm_saved_views(actor_id, created_at, id);

alter table growth.crm_capture_requests enable row level security;
alter table growth.crm_tasks enable row level security;
alter table growth.crm_activities enable row level security;
alter table growth.crm_saved_views enable row level security;
create policy growth_app_access on growth.crm_capture_requests for all to growth_app using (true) with check (true);
create policy growth_app_access on growth.crm_tasks for all to growth_app using (true) with check (true);
create policy growth_app_access on growth.crm_activities for all to growth_app using (true) with check (true);
create policy growth_app_access on growth.crm_saved_views for all to growth_app using (true) with check (true);
revoke all on growth.crm_capture_requests, growth.crm_tasks, growth.crm_activities, growth.crm_saved_views from public, anon, authenticated, service_role;
grant select, insert on growth.crm_capture_requests, growth.crm_activities to growth_app;
grant select, insert, update on growth.crm_tasks to growth_app;
grant select, insert, update, delete on growth.crm_saved_views to growth_app;
