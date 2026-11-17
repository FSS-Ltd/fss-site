set lock_timeout = '5s';

-- The client exclusion function must see FORCE RLS protected Operations rows.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = current_user and (rolsuper or rolbypassrls)) then
    raise exception 'campaign client exclusion requires a BYPASSRLS function owner';
  end if;
end $$;

alter table growth.prospects
  add column source_type text not null default 'research' check (source_type in ('research','facebook_page','facebook_group','manual','web','google_maps','referral','inbound')),
  add column source_url text,
  add column source_observed_at timestamptz,
  add column source_details jsonb not null default '{}'::jsonb check (jsonb_typeof(source_details) = 'object');

create table growth.campaigns (
  id uuid not null default gen_random_uuid(),
  version integer not null check (version > 0),
  request_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 200),
  policy jsonb not null check (jsonb_typeof(policy) = 'object'),
  status text not null default 'paused' check (status in ('paused','approved','revoked')),
  approved_by text check (approved_by ~ '^[a-f0-9]{64}$'),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (id, version),
  unique (request_id),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);
create function growth.prevent_campaign_policy_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.policy is distinct from old.policy or new.id is distinct from old.id or new.version is distinct from old.version then
    raise exception 'campaign policy revisions are immutable';
  end if;
  if old.approved_by is not null and (new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at) then
    raise exception 'campaign approval attribution is immutable';
  end if;
  return new;
end $$;
create trigger campaign_policy_immutable before update on growth.campaigns for each row execute function growth.prevent_campaign_policy_update();

alter table growth.sequence_enrollments add constraint sequence_id_prospect_unique unique (id,prospect_id);

create table growth.campaign_memberships (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null, policy_version integer not null,
  business_id uuid not null references growth.businesses(id) on delete restrict,
  prospect_id uuid not null references growth.prospects(id) on delete restrict,
  request_id uuid not null unique,
  status text not null default 'review' check (status in ('review','active','paused','stopped','replied','completed')),
  variant_id text, first_sent_at timestamptz,
  sequence_id uuid references growth.sequence_enrollments(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (campaign_id, policy_version) references growth.campaigns(id,version) on delete restrict,
  foreign key (sequence_id,prospect_id) references growth.sequence_enrollments(id,prospect_id) on delete restrict,
  unique (id,campaign_id,policy_version),
  unique (id,campaign_id,policy_version,sequence_id)
);
create unique index outreach_one_active_business on growth.campaign_memberships (business_id) where status in ('review','active','paused');
create index campaign_memberships_campaign_idx on growth.campaign_memberships(campaign_id,policy_version);
create index campaign_memberships_prospect_idx on growth.campaign_memberships(prospect_id);
create index campaign_memberships_sequence_idx on growth.campaign_memberships(sequence_id);

create table growth.outreach_permissions (
  id uuid primary key,
  membership_id uuid not null references growth.campaign_memberships(id) on delete restrict,
  basis text not null check (basis in ('consent','requested_service')),
  provider text not null check (provider in ('gmail','resend')),
  jurisdiction text not null check (length(trim(jurisdiction)) > 0),
  expires_at timestamptz not null,
  actor_id text not null check (actor_id ~ '^[a-f0-9]{64}$'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  contact_version integer not null check (contact_version >= 0),
  prospect_version integer not null check (prospect_version > 0),
  created_at timestamptz not null default now(),
  unique (id,membership_id)
);
create index outreach_permissions_membership_idx on growth.outreach_permissions(membership_id);
alter table growth.campaign_memberships add column current_permission_id uuid;
alter table growth.campaign_memberships add constraint membership_current_permission_fk foreign key (current_permission_id,id) references growth.outreach_permissions(id,membership_id) on delete restrict;
create index campaign_memberships_permission_idx on growth.campaign_memberships(current_permission_id);

create table growth.outreach_events (
 id uuid primary key, campaign_id uuid not null, policy_version integer not null,
 membership_id uuid references growth.campaign_memberships(id) on delete restrict,
 event_type text not null, occurred_at timestamptz not null default now(),
 foreign key (campaign_id,policy_version) references growth.campaigns(id,version) on delete restrict,
 foreign key (membership_id,campaign_id,policy_version) references growth.campaign_memberships(id,campaign_id,policy_version) on delete restrict
);
create index outreach_events_campaign_idx on growth.outreach_events(campaign_id,policy_version,occurred_at);
create index outreach_events_membership_idx on growth.outreach_events(membership_id);
create table growth.outreach_outbox (
 id uuid primary key, event_id uuid not null unique references growth.outreach_events(id) on delete restrict,
 created_at timestamptz not null default now(), delivered_at timestamptz
);
create table growth.outreach_jobs (
 id uuid primary key default gen_random_uuid(), campaign_id uuid, policy_version integer,
 membership_id uuid references growth.campaign_memberships(id) on delete restrict,
 outbox_id uuid references growth.outreach_outbox(id) on delete restrict,
 job_type text not null, due_at timestamptz not null, idempotency_key text not null unique,
 status text not null default 'pending' check (status in ('pending','leased','completed','cancelled')),
 lease_owner text, lease_until timestamptz, created_at timestamptz not null default now(),
 foreign key (campaign_id,policy_version) references growth.campaigns(id,version) on delete restrict,
 foreign key (membership_id,campaign_id,policy_version) references growth.campaign_memberships(id,campaign_id,policy_version) on delete restrict,
 check ((campaign_id is null) = (policy_version is null)),
 check (membership_id is null or campaign_id is not null),
 check (status <> 'leased' or (lease_owner is not null and lease_until is not null))
);
create index outreach_jobs_due_idx on growth.outreach_jobs(due_at,id) where status in ('pending','leased');
create index outreach_jobs_membership_idx on growth.outreach_jobs(membership_id);
create index outreach_jobs_campaign_idx on growth.outreach_jobs(campaign_id,policy_version);
create index outreach_jobs_outbox_idx on growth.outreach_jobs(outbox_id);
create table growth.outreach_provider_usage (
 account_id text primary key, observed_at timestamptz not null, rolling_messages integer not null check (rolling_messages >= 0),
 rolling_recipients integer not null check (rolling_recipients >= 0), message_limit integer not null check (message_limit > 0),
 recipient_limit integer not null check (recipient_limit > 0), complete boolean not null, health text not null check (health in ('healthy','unknown','halted')), cursor text
);
create table growth.outreach_reservations (
 id uuid primary key default gen_random_uuid(), idempotency_key text not null unique,
 campaign_id uuid, policy_version integer,
 membership_id uuid references growth.campaign_memberships(id) on delete restrict,
 email_message_id uuid not null, sequence_id uuid not null,
 account_id text not null references growth.outreach_provider_usage(account_id) on delete restrict,
 london_day date not null, reserved_at timestamptz not null default now(),
 status text not null default 'reserved' check (status in ('reserved','sent','uncertain','cancelled')),
 completed_at timestamptz,
 foreign key (campaign_id,policy_version) references growth.campaigns(id,version) on delete restrict,
 foreign key (email_message_id,sequence_id) references growth.email_messages(id,sequence_enrollment_id) on delete restrict,
 foreign key (membership_id,campaign_id,policy_version,sequence_id) references growth.campaign_memberships(id,campaign_id,policy_version,sequence_id) on delete restrict,
 check ((campaign_id is null and policy_version is null and membership_id is null) or (campaign_id is not null and policy_version is not null and membership_id is not null))
);
create index outreach_reservations_message_idx on growth.outreach_reservations(email_message_id,sequence_id);
create index outreach_reservations_day_idx on growth.outreach_reservations(london_day) where status <> 'cancelled';
create index outreach_reservations_account_idx on growth.outreach_reservations(account_id,reserved_at) where status <> 'cancelled';
create index outreach_reservations_campaign_idx on growth.outreach_reservations(campaign_id,policy_version,london_day);
create index outreach_reservations_member_idx on growth.outreach_reservations(membership_id);
create table growth.experiment_reviews (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, policy_version integer not null,
 reviewed_by text not null check (reviewed_by ~ '^[a-f0-9]{64}$'), reviewed_at timestamptz not null default now(),
 evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
 foreign key (campaign_id,policy_version) references growth.campaigns(id,version) on delete restrict
);
create index experiment_reviews_campaign_idx on growth.experiment_reviews(campaign_id,policy_version);
create table growth.facebook_destinations (
 id uuid primary key default gen_random_uuid(), url text not null unique, name text not null,
 kind text not null check (kind in ('page','group')), posting_permission text not null default 'unknown' check (posting_permission in ('allowed','unknown','prohibited')),
 website_url text, rules_url text, locality text, rules text, evidence_at timestamptz, created_at timestamptz not null default now()
);
create table growth.facebook_activities (
 id uuid primary key default gen_random_uuid(), destination_id uuid not null references growth.facebook_destinations(id) on delete restrict,
 activity text not null check (activity in ('followed','joined','posted')), occurred_at timestamptz not null default now(), actor_id text not null check (actor_id ~ '^[a-f0-9]{64}$')
);
create index facebook_activities_destination_idx on growth.facebook_activities(destination_id,occurred_at);

do $$
declare t text;
begin
 foreach t in array array['campaigns','campaign_memberships','outreach_events','outreach_reservations','outreach_outbox','outreach_jobs','experiment_reviews','facebook_destinations','facebook_activities','outreach_provider_usage','outreach_permissions'] loop
   execute format('alter table growth.%I enable row level security', t);
   execute format('create policy growth_app_access on growth.%I for all to growth_app using (true) with check (true)', t);
   execute format('revoke all on growth.%I from public, anon, authenticated, service_role', t);
   execute format('grant select, insert on growth.%I to growth_app', t);
 end loop;
end $$;
grant update on growth.campaigns, growth.campaign_memberships, growth.outreach_reservations, growth.outreach_outbox, growth.outreach_jobs, growth.facebook_destinations, growth.outreach_provider_usage to growth_app;

create function growth.outreach_email_domain(value text) returns text
language sql immutable strict set search_path = '' as $$
  select case when lower(trim(value)) ~ '^[^@[:space:]]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
    then split_part(lower(trim(value)), '@', 2) end;
$$;
create function growth.outreach_website_domain(value text) returns text
language sql immutable strict set search_path = '' as $$
  select case when host ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then host end
  from (select regexp_replace(substring(lower(trim(value)) from '^https?://([^/?#:@]+)(:[0-9]+)?([/?#]|$)'), '^www\.', '') as host) parsed;
$$;
revoke all on function growth.outreach_email_domain(text), growth.outreach_website_domain(text) from public, anon, authenticated, service_role;
create function growth.is_outreach_client(target_prospect uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
   select 1 from growth.prospects p join growth.businesses b on b.id = p.business_id
   where p.id = target_prospect and (
     exists (select 1 from growth.delivery_engagements de join operations.engagement_links el on el.engagement_id = de.id where de.prospect_id = p.id)
     or exists (select 1 from operations.organisations o where lower(trim(o.legal_name)) = lower(trim(b.legal_name)) or lower(trim(o.display_name)) = lower(trim(b.legal_name)))
     or exists (select 1 from operations.contacts oc where growth.outreach_email_domain(oc.email) is not null and growth.outreach_email_domain(p.source_details->>'email') is not null and lower(trim(oc.email)) = lower(trim(p.source_details->>'email')))
     or exists (select 1 from operations.contacts oc where growth.outreach_email_domain(oc.email) not in ('gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','live.com','googlemail.com') and growth.outreach_email_domain(oc.email) = growth.outreach_email_domain(p.source_details->>'email'))
     or exists (select 1 from operations.contacts oc where growth.outreach_email_domain(oc.email) not in ('gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','live.com','googlemail.com') and growth.outreach_email_domain(oc.email) = growth.outreach_website_domain(b.website_url))
     or exists (select 1 from growth.contacts gc join operations.contacts oc on growth.outreach_email_domain(gc.email) is not null and growth.outreach_email_domain(oc.email) is not null and lower(trim(oc.email)) = gc.normalised_email where gc.business_id = b.id)
     or exists (select 1 from growth.contacts gc join operations.contacts oc on growth.outreach_email_domain(oc.email) = growth.outreach_email_domain(gc.email) where gc.business_id = b.id and growth.outreach_email_domain(gc.email) not in ('gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','live.com','googlemail.com'))
   )
 );
$$;
revoke all on function growth.is_outreach_client(uuid) from public, anon, authenticated, service_role;
grant execute on function growth.is_outreach_client(uuid) to growth_app;
create function growth.claim_outreach_jobs(worker text, claim_limit integer, lease interval)
returns setof growth.outreach_jobs language plpgsql set search_path = '' as $$
begin
  if worker is null or length(trim(worker)) = 0 or claim_limit is null or lease is null or claim_limit < 1 or claim_limit > 25 or lease <= interval '0' or lease > interval '1 hour' then
    raise exception 'invalid outreach job claim';
  end if;
  return query with selected as (
    select j.id from growth.outreach_jobs j
    where j.due_at <= now() and (j.status = 'pending' or (j.status = 'leased' and j.lease_until <= now()))
    order by j.due_at,j.id for update skip locked limit claim_limit
  ) update growth.outreach_jobs j set status='leased',lease_owner=worker,lease_until=now()+lease
    from selected s where j.id=s.id returning j.*;
end $$;
revoke all on function growth.claim_outreach_jobs(text,integer,interval) from public, anon, authenticated, service_role;
grant execute on function growth.claim_outreach_jobs(text,integer,interval) to growth_app;
alter table growth.prospects add constraint prospects_id_business_id_unique unique (id,business_id);
alter table growth.campaign_memberships add constraint campaign_memberships_prospect_business_fk foreign key (prospect_id,business_id) references growth.prospects(id,business_id) on delete restrict;

reset lock_timeout;
