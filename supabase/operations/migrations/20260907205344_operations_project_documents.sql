-- Staged Task 4 release hold. Apply only to an isolated test database until release approval.
create table operations.projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  agreement_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 160),
  summary text not null check (length(summary) <= 4000),
  outcome text not null check (length(outcome) <= 4000),
  deliverables text[] not null default '{}' check (cardinality(deliverables) <= 50),
  status text not null check (status in ('planned','active','waiting_for_us','waiting_for_you','completed','paused')),
  owner_display text not null check (length(trim(owner_display)) between 1 and 160),
  target_date date,
  schedule_dependencies text[] not null default '{}' check (cardinality(schedule_dependencies) <= 30),
  schedule_evidence text check (length(schedule_evidence) <= 4000),
  internal_notes text not null default '' check (length(internal_notes) <= 10000),
  internal_estimate_minutes integer check (internal_estimate_minutes >= 0),
  visibility text not null default 'internal' check (visibility in ('internal','client')),
  version integer not null default 1 check (version > 0),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (organisation_id,id),
  foreign key (organisation_id,agreement_id) references operations.agreements(organisation_id,id) on delete restrict
);
create index operations_project_scope on operations.projects (organisation_id,created_at desc,id);
create table operations.milestones (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 160),
  summary text not null check (length(summary) <= 4000),
  status text not null check (status in ('planned','active','waiting_for_us','waiting_for_you','completed','paused')),
  owner_display text not null check (length(trim(owner_display)) between 1 and 160),
  target_date date,
  evidence text check (length(evidence) <= 4000),
  position integer not null check (position between 0 and 99),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  unique (organisation_id,project_id,id),
  foreign key (organisation_id,project_id) references operations.projects(organisation_id,id) on delete restrict
);
create index operations_milestone_scope on operations.milestones (organisation_id,project_id,position,id);
create table operations.documents (
  id uuid primary key,
  organisation_id uuid not null,
  project_id uuid not null,
  milestone_id uuid,
  title text not null check (length(trim(title)) between 1 and 160),
  kind text not null check (kind in ('link','file')),
  url text,
  object_key text,
  filename text check (length(filename) between 1 and 200 and filename !~ '[[:cntrl:]/\\]'),
  mime_type text check (mime_type in ('application/pdf','image/png','image/jpeg','text/plain')),
  size_bytes integer check (size_bytes between 1 and 10485760),
  content_hash text check (content_hash ~ '^[a-f0-9]{64}$'),
  scan_status text not null default 'quarantined' check (scan_status in ('quarantined','cleared','rejected')),
  scan_content_hash text check (scan_content_hash ~ '^[a-f0-9]{64}$'),
  scan_evidence text check (length(trim(scan_evidence)) between 1 and 2000),
  visibility text not null default 'internal' check (visibility in ('internal','client')),
  expires_at timestamptz,
  revoked_at timestamptz,
  version integer not null default 1 check (version > 0),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  created_at timestamptz not null default now(),
  foreign key (organisation_id,project_id) references operations.projects(organisation_id,id) on delete restrict,
  foreign key (organisation_id,project_id,milestone_id) references operations.milestones(organisation_id,project_id,id) on delete restrict,
  check ((kind='link' and url is not null and url ~ '^https://[^/@[:space:]]+([/?#]|$)' and length(url)<=2000 and object_key is null and filename is null and mime_type is null and size_bytes is null and content_hash is null)
    or (kind='file' and object_key is not null and url is null and filename is not null and mime_type is not null and size_bytes is not null and content_hash is not null and object_key = 'operations/' || organisation_id::text || '/' || id::text || '/' || content_hash)),
  check (scan_status <> 'cleared' or (scan_evidence is not null and scan_content_hash is not null and scan_content_hash = content_hash) or kind='link')
);
create index operations_document_scope on operations.documents (organisation_id,project_id,created_at desc,id);

alter table operations.projects enable row level security;
alter table operations.projects force row level security;
alter table operations.milestones enable row level security;
alter table operations.milestones force row level security;
alter table operations.documents enable row level security;
alter table operations.documents force row level security;
revoke all on operations.projects, operations.milestones, operations.documents from public,anon,authenticated,service_role,growth_app,operations_portal;
grant select,insert,update on operations.projects, operations.milestones, operations.documents to operations_founder;
create policy founder_read on operations.projects for select to operations_founder using (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy founder_create on operations.projects for insert to operations_founder with check (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy founder_update on operations.projects for update to operations_founder using (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$') with check (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy founder_read on operations.milestones for select to operations_founder using (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy founder_create on operations.milestones for insert to operations_founder with check (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy founder_update on operations.milestones for update to operations_founder using (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$') with check (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy founder_read on operations.documents for select to operations_founder using (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy founder_create on operations.documents for insert to operations_founder with check (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy founder_update on operations.documents for update to operations_founder using (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$') with check (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy portal_read on operations.projects for select to operations_portal using (visibility='client' and operations.portal_has_membership(organisation_id,array['owner','contributor','viewer']));
create policy portal_read on operations.milestones for select to operations_portal using (operations.portal_has_membership(organisation_id,array['owner','contributor','viewer']) and exists(select 1 from operations.projects p where p.organisation_id=milestones.organisation_id and p.id=milestones.project_id));
create policy portal_read on operations.documents for select to operations_portal using (visibility='client' and scan_status='cleared' and revoked_at is null and (expires_at is null or expires_at>clock_timestamp()) and operations.portal_has_membership(organisation_id,array['owner','contributor','viewer']) and exists(select 1 from operations.projects p where p.organisation_id=documents.organisation_id and p.id=documents.project_id));
-- Column grants protect internal fields even if a future query accidentally selects them.
grant select (id,organisation_id,agreement_id,title,summary,outcome,deliverables,status,owner_display,target_date,schedule_dependencies,schedule_evidence,created_at) on operations.projects to operations_portal;
grant select (id,organisation_id,project_id,title,summary,status,owner_display,target_date,evidence,position) on operations.milestones to operations_portal;
grant select (id,organisation_id,project_id,title,kind,url,object_key,filename,mime_type,size_bytes,content_hash,expires_at,created_at) on operations.documents to operations_portal;

alter table operations.audit_events drop constraint audit_events_action_check;
alter table operations.audit_events add constraint audit_events_action_check check (action in ('organisation.created','engagement.linked','agreement.revised','agreement.signed','service.activated','contact.created','invite.issued','invite.revoked','invite.claimed','membership.revoked','project.created','project.updated','milestone.created','milestone.updated','document.created','document.updated'));
create function operations.audit_delivery_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor text := current_setting('operations.actor_id',true); entity text;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  if tg_op='UPDATE' and (new.id<>old.id or new.organisation_id<>old.organisation_id) then raise exception 'Delivery identity is immutable.'; end if;
  entity := case tg_table_name when 'projects' then 'project' when 'milestones' then 'milestone' else 'document' end;
  insert into operations.audit_events(organisation_id,actor_id,action,entity_id,review_reference,correlation_id)
    values(new.organisation_id,actor,entity || case tg_op when 'INSERT' then '.created' else '.updated' end,new.id,new.review_reference,nullif(current_setting('operations.correlation_id',true),'')::uuid);
  return new;
end;
$$;
revoke all on function operations.audit_delivery_change() from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder;
create trigger project_audit after insert or update on operations.projects for each row execute function operations.audit_delivery_change();
create trigger milestone_audit after insert or update on operations.milestones for each row execute function operations.audit_delivery_change();
create trigger document_audit after insert or update on operations.documents for each row execute function operations.audit_delivery_change();
