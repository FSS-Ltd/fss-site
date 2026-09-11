-- Promoted through the approved Operations production release gate.
create table operations.requests (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null, project_id uuid not null,
 created_by uuid not null, idempotency_key uuid not null,
 title text not null check(length(trim(title)) between 1 and 160), description text not null check(length(trim(description)) between 1 and 10000),
 type text not null check(type in ('work','change','bug','help')), desired_outcome text not null check(length(trim(desired_outcome)) between 1 and 4000),
 desired_date date, impact text not null default '' check(length(impact)<=4000), reproduction_steps text not null default '' check(length(reproduction_steps)<=4000),expected_behaviour text not null default '' check(length(expected_behaviour)<=4000),actual_behaviour text not null default '' check(length(actual_behaviour)<=4000),
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 status text not null default 'new' check(status in ('new','acknowledged','planned','in_progress','ready_for_review','changes_requested','done','cancelled')),
 scope text not null default 'assessment_pending' check(scope in ('included','assessment_pending','quote_required','declined_with_reason')),scope_reason text not null default '' check(length(scope_reason)<=4000),
 delivery_owner_id uuid check(delivery_owner_id='00000000-0000-4000-8000-000000000001'::uuid), owner_display text not null default '' check(length(owner_display)<=160), next_action text not null default '' check(length(next_action)<=4000),target_date date, agreement_id uuid,
 version integer not null default 1 check(version>0), review_cycle integer not null default 1 check(review_cycle>0),deliverable_version text check(length(trim(deliverable_version)) between 1 and 200),review_instructions text not null default '' check(length(review_instructions)<=4000),public_summary text not null default '' check(length(public_summary)<=4000),
 acknowledgement_target timestamptz not null, review_reminder_target timestamptz, calendar_version text not null,
 blocked_since timestamptz,blocked_reason text,blocked_responsible_party text,blocked_next_check_date date,
 closure_label text check(closure_label in ('Accepted by client','Closed by FSS','Cancelled by FSS')),transition_reason text not null default '' check(length(transition_reason)<=4000),capacity_override_reason text not null default '' check(length(capacity_override_reason)<=4000),
 created_at timestamptz not null default now(), unique(organisation_id,id),unique(organisation_id,created_by,idempotency_key),
 foreign key(organisation_id,project_id) references operations.projects(organisation_id,id), foreign key(organisation_id,agreement_id) references operations.agreements(organisation_id,id),
 check(type<>'bug' or (length(trim(reproduction_steps))>0 and length(trim(expected_behaviour))>0 and length(trim(actual_behaviour))>0)),
 check(scope<>'declined_with_reason' or length(trim(scope_reason))>0),
 check((blocked_since is null and blocked_reason is null and blocked_responsible_party is null and blocked_next_check_date is null) or (status not in ('done','cancelled') and blocked_since is not null and length(trim(blocked_reason)) between 1 and 4000 and length(trim(blocked_responsible_party)) between 1 and 160 and blocked_next_check_date is not null))
);
create index requests_tenant on operations.requests(organisation_id,created_at desc,id);
create index requests_wip on operations.requests(delivery_owner_id) where status='in_progress';
create table operations.request_comments(id uuid primary key default gen_random_uuid(),organisation_id uuid not null,request_id uuid not null,body text not null check(length(trim(body)) between 1 and 10000),visibility text not null check(visibility in ('client','internal')),author_label text not null,created_at timestamptz not null default now(),foreign key(organisation_id,request_id) references operations.requests(organisation_id,id));
create index request_comments_scope on operations.request_comments(organisation_id,request_id,created_at,id);
create table operations.request_reviewers(organisation_id uuid not null,request_id uuid not null,user_id uuid not null,primary key(organisation_id,request_id,user_id),foreign key(organisation_id,request_id) references operations.requests(organisation_id,id));
create table operations.request_reviews(id uuid primary key default gen_random_uuid(),organisation_id uuid not null,request_id uuid not null,review_cycle integer not null check(review_cycle>0),deliverable_version text not null,decision text not null check(decision in ('requested','accepted','changes_requested')),feedback text not null default '',created_at timestamptz not null default now(),foreign key(organisation_id,request_id) references operations.requests(organisation_id,id));
create index request_reviews_scope on operations.request_reviews(organisation_id,request_id,created_at,id);
create table operations.request_documents(organisation_id uuid not null,request_id uuid not null,document_id uuid not null references operations.documents(id),review_cycle integer not null check(review_cycle>0),deliverable_version text not null check(length(trim(deliverable_version)) between 1 and 200),primary key(organisation_id,request_id,review_cycle,deliverable_version,document_id),foreign key(organisation_id,request_id) references operations.requests(organisation_id,id));
create table operations.request_allowance_adjustments(id uuid primary key default gen_random_uuid(),organisation_id uuid not null,request_id uuid not null,unit text not null check(unit in ('hours','tasks','milestones')),amount numeric not null check(amount<>0 and amount between -1000000 and 1000000 and scale(amount)<=2),reason text not null check(length(trim(reason)) between 1 and 4000),approval_reference text not null check(length(trim(approval_reference)) between 1 and 200),created_at timestamptz not null default now(),foreign key(organisation_id,request_id) references operations.requests(organisation_id,id));
-- Only IDs and event categories enter the outbox. A later authorized dispatcher resolves scoped recipients.
create table operations.request_notification_outbox(id uuid primary key default gen_random_uuid(),organisation_id uuid not null,request_id uuid not null,kind text not null check(kind in ('request_received','status_changed','public_comment','review_requested','accepted')),created_at timestamptz not null default now(),foreign key(organisation_id,request_id) references operations.requests(organisation_id,id));
create table operations.request_history(id uuid primary key default gen_random_uuid(),organisation_id uuid not null,request_id uuid not null,actor_id text not null,action text not null,request_version integer not null,reason text not null default '',correlation_id uuid not null,created_at timestamptz not null default now(),foreign key(organisation_id,request_id) references operations.requests(organisation_id,id));

-- Definer helpers are narrowly scoped because portal must never read internal request columns.
create function operations.can_review_request(org uuid,req uuid) returns boolean language sql stable security definer set search_path='' as $$
 select operations.portal_has_membership(org,array['owner']) or (operations.portal_has_membership(org,array['contributor']) and exists(select 1 from operations.request_reviewers r where r.organisation_id=org and r.request_id=req and r.user_id=nullif(current_setting('operations.user_id',true),'')::uuid));
$$;
revoke all on function operations.can_review_request(uuid,uuid) from public,anon,authenticated,service_role,growth_app;
grant execute on function operations.can_review_request(uuid,uuid) to operations_portal,operations_founder;

do $$ declare t text; begin
 foreach t in array array['requests','request_comments','request_reviewers','request_reviews','request_documents','request_allowance_adjustments','request_notification_outbox','request_history'] loop
 execute format('alter table operations.%I enable row level security',t);
 execute format('alter table operations.%I force row level security',t);
 execute format('revoke all on operations.%I from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder',t);
 execute format('grant select,insert on operations.%I to operations_founder',t);
 execute format('create policy founder_read on operations.%I for select to operations_founder using (current_setting(''operations.actor_id'',true) ~ ''^[a-f0-9]{64}$'')',t);
 execute format('create policy founder_insert on operations.%I for insert to operations_founder with check (current_setting(''operations.actor_id'',true) ~ ''^[a-f0-9]{64}$'')',t);
 end loop;
end $$;
grant update on operations.requests to operations_founder;
create policy founder_update on operations.requests for update to operations_founder using(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$') with check(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
grant delete on operations.request_reviewers to operations_founder;
create policy founder_delete on operations.request_reviewers for delete to operations_founder using(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy portal_read on operations.requests for select to operations_portal using(operations.portal_has_membership(organisation_id,array['owner','contributor','viewer']) and exists(select 1 from operations.projects p where p.organisation_id=requests.organisation_id and p.id=requests.project_id));
grant select(id,organisation_id,project_id,title,description,type,desired_outcome,desired_date,impact,reproduction_steps,expected_behaviour,actual_behaviour,status,scope,scope_reason,owner_display,next_action,target_date,version,review_cycle,deliverable_version,review_instructions,public_summary,acknowledgement_target,review_reminder_target,created_at,blocked_since,blocked_reason,blocked_responsible_party,blocked_next_check_date,closure_label) on operations.requests to operations_portal;
create policy portal_read on operations.request_comments for select to operations_portal using(visibility='client' and exists(select 1 from operations.requests r where r.organisation_id=request_comments.organisation_id and r.id=request_comments.request_id));
grant select(id,organisation_id,request_id,body,author_label,created_at) on operations.request_comments to operations_portal;
create policy portal_read on operations.request_reviews for select to operations_portal using(exists(select 1 from operations.requests r where r.organisation_id=request_reviews.organisation_id and r.id=request_reviews.request_id));
grant select on operations.request_reviews to operations_portal;
create policy portal_read on operations.request_documents for select to operations_portal using(exists(select 1 from operations.requests r where r.organisation_id=request_documents.organisation_id and r.id=request_documents.request_id));
grant select on operations.request_documents to operations_portal;

create function operations.guard_request_update() returns trigger language plpgsql security definer set search_path='' as $$
declare founder boolean := current_setting('role',true)='operations_founder'; active_count integer; gate_agreement uuid;
begin
 if tg_op='INSERT' then
  if new.status<>'new' or new.version<>1 or new.review_cycle<>1 then raise exception 'Invalid initial request'; end if;
 else
  if new.id<>old.id or new.organisation_id<>old.organisation_id or new.project_id<>old.project_id or new.created_by<>old.created_by or new.idempotency_key<>old.idempotency_key or new.version<>old.version+1 then raise exception 'Invalid request identity/version'; end if;
  if new.review_cycle<>old.review_cycle and not(old.status='done' and new.status='acknowledged' and new.review_cycle=old.review_cycle+1) then raise exception 'Invalid review cycle'; end if;
  if founder and new.closure_label='Accepted by client' and new.closure_label is distinct from old.closure_label then raise exception 'Founder closure cannot impersonate client acceptance'; end if;
  if new.status<>old.status then
   if not ((old.status='new' and new.status='acknowledged') or (old.status='acknowledged' and new.status='planned') or (old.status='planned' and new.status='in_progress') or (old.status='in_progress' and new.status='ready_for_review') or (old.status='ready_for_review' and new.status in ('done','changes_requested')) or (old.status='changes_requested' and new.status='in_progress') or (old.status='done' and new.status='acknowledged') or (old.status not in ('done','cancelled') and new.status='cancelled') or (founder and old.status not in ('done','cancelled') and new.status='done' and new.closure_label='Closed by FSS')) then raise exception 'Invalid request transition'; end if;
   if new.status in ('cancelled','done') and (new.status='cancelled' or new.closure_label='Closed by FSS') and length(trim(new.transition_reason))=0 then raise exception 'Closure reason required'; end if;
   if new.status='acknowledged' and (new.delivery_owner_id is null or length(trim(new.owner_display))=0) then raise exception 'Owner required'; end if;
   if old.status='done' and (length(trim(new.transition_reason))=0 or new.review_cycle<>old.review_cycle+1 or new.deliverable_version is not null) then raise exception 'Reopen reason and new cycle required'; end if;
   if new.status='done' and founder and new.closure_label is distinct from 'Closed by FSS' then raise exception 'Founder must use labelled administrative closure'; end if;
   if new.status='planned' and new.scope='quote_required' and not exists(select 1 from operations.agreements a join operations.projects p on p.organisation_id=a.organisation_id where a.organisation_id=new.organisation_id and a.id=new.agreement_id and a.status='signed' and p.id=new.project_id and p.agreement_id<>a.id) then raise exception 'Approved change agreement required'; end if;
   if new.status='planned' and (new.scope not in ('included','quote_required') or length(trim(new.next_action))=0 or (new.scope='quote_required' and new.agreement_id is null)) then raise exception 'Approved scope and next action required'; end if;
   if new.status='in_progress' then
    if new.delivery_owner_id is null or new.scope<>'included' and new.scope<>'quote_required' then raise exception 'Owner and approved scope required'; end if;
    if new.scope='quote_required' and (new.agreement_id is null or exists(select 1 from operations.projects p where p.id=new.project_id and p.agreement_id=new.agreement_id)) then raise exception 'New signed change agreement required'; end if;
    select coalesce(new.agreement_id,p.agreement_id) into gate_agreement from operations.projects p where p.id=new.project_id and p.organisation_id=new.organisation_id;
    if not exists(select 1 from operations.service_instances s join operations.agreements a on a.organisation_id=s.organisation_id and a.id=s.agreement_id and a.current_revision=s.revision where a.organisation_id=new.organisation_id and a.id=gate_agreement and a.status='signed' and s.status='active' and s.effective_date<=current_date and (s.end_date is null or s.end_date>=current_date)) then raise exception 'Signed agreement, start and deposit gates required'; end if;
    perform pg_advisory_xact_lock(hashtextextended(new.delivery_owner_id::text,5));
    select count(*) into active_count from operations.requests where delivery_owner_id=new.delivery_owner_id and status='in_progress' and id<>new.id;
    if active_count>=3 and length(trim(new.capacity_override_reason))=0 then raise exception 'Delivery owner capacity is full'; end if;
   end if;
   if new.status='ready_for_review' and exists(select 1 from operations.request_reviews h where h.request_id=new.id and h.review_cycle=new.review_cycle and h.deliverable_version=new.deliverable_version) then raise exception 'Use a new deliverable version'; end if;
   if new.status='ready_for_review' and (new.deliverable_version is null or length(trim(new.review_instructions))=0 or length(trim(new.public_summary))=0 or new.review_reminder_target is null) then raise exception 'Review evidence required'; end if;
  end if;
 end if;
 if new.status='in_progress' and (new.scope not in ('included','quote_required') or new.blocked_since is not null and new.blocked_next_check_date is null) then raise exception 'Active scope must remain approved'; end if;
 return new;
end $$;
revoke all on function operations.guard_request_update() from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder;
create trigger request_guard before insert or update on operations.requests for each row execute function operations.guard_request_update();
create function operations.audit_request_change() returns trigger language plpgsql security definer set search_path='' as $$
declare actor text:=coalesce(nullif(current_setting('operations.actor_id',true),''),nullif(current_setting('operations.user_id',true),'')); event_kind text; req uuid; item jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
 req:=case when tg_table_name='requests' then (item->>'id')::uuid else (item->>'request_id')::uuid end;
 insert into operations.request_history(organisation_id,request_id,actor_id,action,request_version,reason,correlation_id)
 values((item->>'organisation_id')::uuid,req,actor,coalesce(nullif(current_setting('operations.request_action',true),''),tg_table_name||'.'||lower(tg_op)),(select version from operations.requests where id=req),case when tg_table_name='requests' and tg_op='UPDATE' and item->>'priority' is distinct from to_jsonb(old)->>'priority' then (to_jsonb(old)->>'priority') || ' -> ' || (item->>'priority') when tg_table_name='requests' then item->>'transition_reason' when tg_table_name='request_reviewers' then item->>'user_id' else '' end,nullif(current_setting('operations.correlation_id',true),'')::uuid);
 if tg_table_name='requests' then
  if tg_op='INSERT' then event_kind:='request_received';
  elsif new.status<>old.status then event_kind:=case new.status when 'ready_for_review' then 'review_requested' when 'done' then case new.closure_label when 'Accepted by client' then 'accepted' else 'status_changed' end else 'status_changed' end; end if;
 elsif tg_table_name='request_comments' and to_jsonb(new)->>'visibility'='client' then event_kind:='public_comment'; end if;
 if event_kind is not null then insert into operations.request_notification_outbox(organisation_id,request_id,kind) values(new.organisation_id,req,event_kind); end if;
 return new;
end $$;
revoke all on function operations.audit_request_change() from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder;
create trigger request_audit after insert or update on operations.requests for each row execute function operations.audit_request_change();
create trigger request_comment_audit after insert on operations.request_comments for each row execute function operations.audit_request_change();
create trigger request_allowance_audit after insert on operations.request_allowance_adjustments for each row execute function operations.audit_request_change();

create function operations.create_portal_request(org uuid,payload jsonb,ack_target timestamptz,calendar text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; uid uuid:=nullif(current_setting('operations.user_id',true),'')::uuid; project uuid:=(payload->>'projectId')::uuid;
begin
 if current_setting('role',true)<>'operations_portal' or not operations.portal_has_membership(org,array['owner','contributor']) or not exists(select 1 from operations.projects p where p.organisation_id=org and p.id=project and p.visibility='client') then raise exception 'Portal access is unavailable.' using errcode='42501'; end if;
 if ack_target is null or calendar is null or ack_target<=clock_timestamp() or ack_target>clock_timestamp()+interval '30 days' or length(calendar) not between 1 and 200 then raise exception 'Invalid acknowledgement target'; end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||uid::text||(payload->>'idempotencyKey'),7));
 select id into result from operations.requests where organisation_id=org and created_by=uid and idempotency_key=(payload->>'idempotencyKey')::uuid;
 if result is not null then return result; end if;
 insert into operations.requests(organisation_id,project_id,created_by,idempotency_key,title,description,type,desired_outcome,desired_date,impact,reproduction_steps,expected_behaviour,actual_behaviour,acknowledgement_target,calendar_version)
 values(org,project,uid,(payload->>'idempotencyKey')::uuid,payload->>'title',payload->>'description',payload->>'type',payload->>'desiredOutcome',(payload->>'desiredDate')::date,coalesce(payload->>'impact',''),coalesce(payload->>'reproductionSteps',''),coalesce(payload->>'expectedBehaviour',''),coalesce(payload->>'actualBehaviour',''),ack_target,calendar) returning id into result;
 return result;
end $$;
create function operations.portal_request_command(org uuid,payload jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare r operations.requests; act text:=payload->>'action'; uid uuid:=nullif(current_setting('operations.user_id',true),'')::uuid; body text;
begin
 if current_setting('role',true)<>'operations_portal' or not operations.portal_has_membership(org,array['owner','contributor']) then raise exception 'Portal access is unavailable.' using errcode='42501'; end if;
 select * into r from operations.requests where organisation_id=org and id=(payload->>'requestId')::uuid for update;
 if r.id is null or not exists(select 1 from operations.projects p where p.organisation_id=org and p.id=r.project_id and p.visibility='client') then raise exception 'Request unavailable' using errcode='42501'; end if;
 if payload->>'expectedVersion' is null or r.version<>(payload->>'expectedVersion')::integer then raise exception 'Request changed' using errcode='40001'; end if;
 if act='comment' then
  insert into operations.request_comments(organisation_id,request_id,body,visibility,author_label) values(org,r.id,payload->>'body','client','Client');
 elsif act in ('accept','request_changes') then
  if not operations.can_review_request(org,r.id) then raise exception 'Review permission required' using errcode='42501'; end if;
  if r.status<>'ready_for_review' or payload->>'reviewCycle' is null or r.review_cycle<>(payload->>'reviewCycle')::integer or r.deliverable_version is distinct from payload->>'deliverableVersion' then raise exception 'Review changed' using errcode='40001'; end if;
  body:=coalesce(payload->>'feedback','');
  if act='request_changes' and length(trim(body)) not between 1 and 10000 then raise exception 'Feedback required'; end if;
  insert into operations.request_reviews(organisation_id,request_id,review_cycle,deliverable_version,decision,feedback) values(org,r.id,r.review_cycle,r.deliverable_version,case act when 'accept' then 'accepted' else 'changes_requested' end,body);
 else raise exception 'Unsupported client command'; end if;
 update operations.requests set version=version+1,status=case act when 'accept' then 'done' when 'request_changes' then 'changes_requested' else status end,closure_label=case act when 'accept' then 'Accepted by client' else closure_label end,blocked_since=case act when 'accept' then null else blocked_since end,blocked_reason=case act when 'accept' then null else blocked_reason end,blocked_responsible_party=case act when 'accept' then null else blocked_responsible_party end,blocked_next_check_date=case act when 'accept' then null else blocked_next_check_date end where id=r.id;
 return r.version+1;
end $$;
revoke all on function operations.create_portal_request(uuid,jsonb,timestamptz,text),operations.portal_request_command(uuid,jsonb) from public,anon,authenticated,service_role,growth_app,operations_founder;
grant execute on function operations.create_portal_request(uuid,jsonb,timestamptz,text),operations.portal_request_command(uuid,jsonb) to operations_portal;

create function operations.guard_request_reference() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='request_reviewers' and not exists(select 1 from operations.memberships m where m.organisation_id=new.organisation_id and m.user_id=(to_jsonb(new)->>'user_id')::uuid and m.revoked_at is null and m.role in ('owner','contributor')) then raise exception 'Active delivery membership required'; end if;
 if tg_table_name='request_documents' and not exists(select 1 from operations.documents d join operations.requests r on r.organisation_id=d.organisation_id and r.project_id=d.project_id where r.id=new.request_id and r.organisation_id=new.organisation_id and r.review_cycle=(to_jsonb(new)->>'review_cycle')::integer and r.deliverable_version=to_jsonb(new)->>'deliverable_version' and d.id=(to_jsonb(new)->>'document_id')::uuid and d.visibility='client' and d.scan_status='cleared' and d.revoked_at is null and (d.expires_at is null or d.expires_at>clock_timestamp())) then raise exception 'Approved scoped document required'; end if;
 return new;
end $$;
revoke all on function operations.guard_request_reference() from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder;
create trigger reviewer_guard before insert on operations.request_reviewers for each row execute function operations.guard_request_reference();
create trigger request_document_guard before insert on operations.request_documents for each row execute function operations.guard_request_reference();
create table operations.request_rate_limits(bucket text not null,window_start timestamptz not null,attempts integer not null check(attempts>0),primary key(bucket,window_start));
alter table operations.request_rate_limits enable row level security;
alter table operations.request_rate_limits force row level security;
revoke all on operations.request_rate_limits from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal;
create function operations.consume_request_limit(org uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=nullif(current_setting('operations.user_id',true),'')::uuid; bucket_name text; n integer; allowed boolean:=true; window_time timestamptz:=date_trunc('minute',clock_timestamp());
begin
 if current_setting('role',true)<>'operations_portal' or not operations.portal_has_membership(org,array['owner','contributor']) then raise exception 'Portal access is unavailable.' using errcode='42501'; end if;
 delete from operations.request_rate_limits where ctid in(select ctid from operations.request_rate_limits where window_start<window_time-interval '1 hour' limit 1000);
 foreach bucket_name in array array['org:'||org::text,'user:'||uid::text] loop
 insert into operations.request_rate_limits as limits values(bucket_name,window_time,1) on conflict(bucket,window_start) do update set attempts=limits.attempts+1 returning attempts into n;
 allowed:=allowed and n<=case when bucket_name like 'org:%' then 120 else 30 end;
 end loop;
 return allowed;
end $$;
revoke all on function operations.consume_request_limit(uuid) from public,anon,authenticated,service_role,growth_app,operations_founder;
grant execute on function operations.consume_request_limit(uuid) to operations_portal;

create function operations.guard_request_allowance() returns trigger language plpgsql security definer set search_path='' as $$
declare r operations.requests; prior_unit text; total numeric;
begin
 select * into r from operations.requests where organisation_id=new.organisation_id and id=new.request_id for update;
 if not exists(select 1 from operations.projects p join operations.agreements a on a.organisation_id=p.organisation_id and a.id=coalesce(r.agreement_id,p.agreement_id) where p.id=r.project_id and p.organisation_id=r.organisation_id and a.status='signed') then raise exception 'Signed contractual allowance required'; end if;
 select min(unit),coalesce(sum(amount),0) into prior_unit,total from operations.request_allowance_adjustments where organisation_id=new.organisation_id and request_id=new.request_id;
 if (prior_unit is not null and prior_unit<>new.unit) or total+new.amount<0 then raise exception 'Preserve contractual units and nonnegative allowance'; end if;
 return new;
end $$;
revoke all on function operations.guard_request_allowance() from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder;
create trigger request_allowance_guard before insert on operations.request_allowance_adjustments for each row execute function operations.guard_request_allowance();

revoke insert on operations.request_history,operations.request_notification_outbox from operations_founder;

create policy portal_read on operations.request_allowance_adjustments for select to operations_portal using(exists(select 1 from operations.requests r where r.organisation_id=request_allowance_adjustments.organisation_id and r.id=request_allowance_adjustments.request_id));
grant select on operations.request_allowance_adjustments to operations_portal;

create function operations.guard_request_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)='operations_founder' and new.decision<>'requested' then raise exception 'Founder cannot record client acceptance or feedback'; end if;
 if not exists(select 1 from operations.requests r where r.organisation_id=new.organisation_id and r.id=new.request_id and r.status='ready_for_review' and r.review_cycle=new.review_cycle and r.deliverable_version=new.deliverable_version) then raise exception 'Review must match current deliverable'; end if;
 return new;
end $$;
revoke all on function operations.guard_request_review() from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder;
create trigger request_review_guard before insert on operations.request_reviews for each row execute function operations.guard_request_review();
create trigger request_review_audit after insert on operations.request_reviews for each row execute function operations.audit_request_change();
create trigger request_reviewer_audit after insert or delete on operations.request_reviewers for each row execute function operations.audit_request_change();
create trigger request_document_audit after insert on operations.request_documents for each row execute function operations.audit_request_change();
