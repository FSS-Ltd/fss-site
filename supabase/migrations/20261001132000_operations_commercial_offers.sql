-- Immutable commercial terms and retained fixed-choice PDFs; portal writes only
-- through scoped selection functions, never through staff/general write grants.
create table operations.commercial_offers (
 id uuid primary key, organisation_id uuid not null references operations.organisations(id), engagement_id uuid not null,
 draft jsonb not null, spec jsonb not null, expires_at timestamptz not null,
 status text not null default 'published' check(status in ('published','proposed','rejected','selected','withdrawn')),
 version integer not null default 1 check(version>0), selection jsonb, rejection_reason text,
 agreement_id uuid, approval_id uuid, created_by text not null check(created_by ~ '^[a-f0-9]{64}$'),
 correlation_id uuid not null, created_at timestamptz not null default now(),
 source_draft_id uuid unique, source_draft_version integer,
 foreign key(organisation_id,engagement_id) references operations.engagement_links(organisation_id,engagement_id)
);
create index commercial_offers_org on operations.commercial_offers(organisation_id,created_at desc);
create table operations.commercial_offer_branches (
 offer_id uuid not null references operations.commercial_offers(id), option text not null,
 approval_id uuid not null unique, organisation_legal_name text not null,
 snapshot jsonb not null, source_pdf bytea not null, approved_by text not null check(approved_by ~ '^[a-f0-9]{64}$'),
 source_hash text not null check(source_hash=encode(sha256(source_pdf),'hex')),
 check(octet_length(source_pdf) between 5 and 1048576),
 check(substring(source_pdf from 1 for 5)=convert_to('%PDF-','UTF8')),
 primary key(offer_id,option)
);
create function operations.portal_can_commercial_offer(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from operations.commercial_offers f join operations.memberships m on m.organisation_id=f.organisation_id join operations.contacts c on c.id=m.contact_id
 where f.id=target and operations.portal_has_membership(f.organisation_id)
 and m.user_id=nullif(current_setting('operations.user_id',true),'')::uuid and m.revoked_at is null
 and c.email=lower(current_setting('operations.verified_email',true)) and (f.draft->'signatories') ? c.email);
$$;
alter table operations.commercial_offers enable row level security;
alter table operations.commercial_offers force row level security;
alter table operations.commercial_offer_branches enable row level security;
alter table operations.commercial_offer_branches force row level security;
revoke all on operations.commercial_offers,operations.commercial_offer_branches from public,anon,authenticated,service_role,operations_portal,operations_founder;
grant select,insert on operations.commercial_offers,operations.commercial_offer_branches to operations_founder;
grant select on operations.commercial_offers to operations_portal;
create policy staff_read on operations.commercial_offers for select to operations_founder using(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy staff_insert on operations.commercial_offers for insert to operations_founder with check(created_by=current_setting('operations.actor_id',true));
create policy staff_branch_read on operations.commercial_offer_branches for select to operations_founder using(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy staff_branch_insert on operations.commercial_offer_branches for insert to operations_founder with check(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy portal_read on operations.commercial_offers for select to operations_portal using(operations.portal_can_commercial_offer(id));
create function operations.guard_commercial_offer() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform operations.assert_active_staff_membership();
  if new.status<>'published' or new.version<>1 or new.selection is not null or new.agreement_id is not null or new.approval_id is not null or new.rejection_reason is not null
   or new.expires_at<=clock_timestamp() or new.expires_at>clock_timestamp()+interval '90 days' then raise exception 'Invalid offer publication'; end if;
 else
  if (to_jsonb(new)-array['status','version','selection','rejection_reason','agreement_id','approval_id']) is distinct from (to_jsonb(old)-array['status','version','selection','rejection_reason','agreement_id','approval_id']) or new.version<>old.version+1 then raise exception 'Commercial offer terms are immutable'; end if;
 end if;
 return new;
end $$;
create trigger guard_commercial_offer before insert or update on operations.commercial_offers for each row execute function operations.guard_commercial_offer();
-- Internal helper has no caller grant. All values come from retained staff PDFs.
create function operations.materialize_commercial_offer(target uuid,branch_option text,correlation uuid) returns void language plpgsql security definer set search_path='' as $$
declare f operations.commercial_offers; b operations.commercial_offer_branches; aid uuid:=gen_random_uuid(); l jsonb; n integer:=0; binding text;
begin
 select * into strict f from operations.commercial_offers where id=target for update;
 select * into strict b from operations.commercial_offer_branches where offer_id=target and option=branch_option;
 insert into operations.agreements(id,organisation_id,engagement_id,current_revision,created_by) values(aid,f.organisation_id,f.engagement_id,1,b.approved_by);
 insert into operations.agreement_revisions(organisation_id,agreement_id,revision,snapshot,created_by,correlation_id) values(f.organisation_id,aid,1,b.snapshot,b.approved_by,correlation);
 for l in select value from jsonb_array_elements(b.snapshot->'lines') loop
  n:=n+1;
  insert into operations.agreement_lines(organisation_id,agreement_id,revision,line_number,service_code,description,quantity,unit_pence,discount_pence,tax_pence,recurrence_months,start_date,end_date)
  values(f.organisation_id,aid,1,n,l->>'serviceCode',l->>'description',(l->>'quantity')::integer,(l->>'unitPence')::bigint,(l->>'discountPence')::bigint,(l->>'taxPence')::bigint,(l->>'recurrenceMonths')::integer,(l->>'startDate')::date,(l->>'endDate')::date);
 end loop;
 insert into operations.signing_approvals(id,organisation_id,organisation_legal_name,agreement_id,revision,agreement_version,snapshot,source_pdf,source_hash,approval_hash,created_by,correlation_id)
 values(b.approval_id,f.organisation_id,b.organisation_legal_name,aid,1,1,b.snapshot,b.source_pdf,b.source_hash,repeat('0',64),b.approved_by,correlation);
 update operations.signing_approvals set status='approved',approved_at=clock_timestamp(),expires_at=f.expires_at where id=b.approval_id;
 insert into operations.signing_audit_events(organisation_id,approval_id,actor_id,action,correlation_id) values(f.organisation_id,b.approval_id,b.approved_by,'approved',correlation);
 update operations.commercial_offers set status='selected',selection=case when branch_option in ('cash','revenue_share') then jsonb_build_object('option',branch_option) else selection end,agreement_id=aid,approval_id=b.approval_id,version=version+1 where id=target;
end $$;
create function operations.select_commercial_offer(target_org uuid,target uuid,expected integer,choice text,amount text,percentage integer,correlation uuid) returns void language plpgsql security definer set search_path='' as $$
declare f operations.commercial_offers; mode text; proposed jsonb;
begin
 if not coalesce(operations.portal_can_commercial_offer(target),false) then raise exception 'Offer unavailable'; end if;
 select * into strict f from operations.commercial_offers where id=target and organisation_id=target_org for update;
 perform 1 from operations.memberships m join operations.organisations o on o.id=m.organisation_id where m.organisation_id=target_org and m.user_id=nullif(current_setting('operations.user_id',true),'')::uuid and m.revoked_at is null and o.lifecycle='active' for share of m,o;
 if not found or not coalesce(operations.portal_can_commercial_offer(target),false) then raise exception 'Offer unavailable'; end if;
 if f.version is distinct from expected or f.status not in ('published','rejected') or f.expires_at<=clock_timestamp() then raise exception 'Offer changed or expired'; end if;
 if choice not in ('cash','revenue_share') then raise exception 'Invalid choice'; end if;
 mode:=f.spec->(case choice when 'cash' then 'cash' else 'revenueShare' end)->>'mode';
 if mode is null then raise exception 'Choice unavailable'; end if;
 perform set_config('operations.correlation_id',correlation::text,true);
 if mode='fixed' then
  if amount is not null or percentage is not null then raise exception 'Fixed terms cannot be changed'; end if;
  perform operations.materialize_commercial_offer(target,choice,correlation);
 else
  if choice='cash' then
   if coalesce(amount,'') !~ '^(0|[1-9][0-9]{0,17})$' or amount::numeric<2000 or percentage is not null then raise exception 'Recurring proposal must be at least 2000 minor units'; end if;
   proposed:=jsonb_build_object('option',choice,'recurringAmountMinor',amount);
  else
   if percentage is null or percentage not between 1000 and 10000 or amount is not null then raise exception 'Revenue proposal must be between 10 and 100 percent'; end if;
   proposed:=jsonb_build_object('option',choice,'percentageBps',percentage);
  end if;
  update operations.commercial_offers set selection=proposed,status='proposed',rejection_reason=null,version=version+1 where id=target;
 end if;
end $$;
create function operations.review_commercial_offer(target_org uuid,target uuid,expected integer,decision text,reason text,correlation uuid) returns void language plpgsql security definer set search_path='' as $$
declare f operations.commercial_offers;
begin
 perform operations.assert_active_staff_membership();
 select * into strict f from operations.commercial_offers where id=target and organisation_id=target_org for update;
 if f.version is distinct from expected or f.status not in ('published','proposed','rejected') or f.expires_at<=clock_timestamp() then raise exception 'Offer changed or expired'; end if;
 perform set_config('operations.correlation_id',correlation::text,true);
 if decision='withdraw' then
  update operations.commercial_offers set status='withdrawn',version=version+1 where id=target;
 elsif decision='reject' and f.status='proposed' and length(trim(reason)) between 1 and 4000 then
  update operations.commercial_offers set status='rejected',rejection_reason=reason,version=version+1 where id=target;
 elsif decision='approve' and f.status='proposed' then
  perform operations.materialize_commercial_offer(target,'proposal_'||f.version::text,correlation);
 else raise exception 'Invalid offer review'; end if;
end $$;
revoke all on function operations.portal_can_commercial_offer(uuid),operations.guard_commercial_offer(),operations.materialize_commercial_offer(uuid,text,uuid),operations.select_commercial_offer(uuid,uuid,integer,text,text,integer,uuid),operations.review_commercial_offer(uuid,uuid,integer,text,text,uuid) from public,anon,authenticated,service_role,operations_portal,operations_founder;
grant execute on function operations.portal_can_commercial_offer(uuid),operations.select_commercial_offer(uuid,uuid,integer,text,text,integer,uuid) to operations_portal;
grant execute on function operations.review_commercial_offer(uuid,uuid,integer,text,text,uuid) to operations_founder;

-- Staff may allocate monetary fields on custom cash branches, but cannot alter
-- the published scope, dates, service identities, one-off fees or installments.
create function operations.guard_commercial_branch() returns trigger language plpgsql security definer set search_path='' as $$
declare f operations.commercial_offers; expected jsonb; actual_lines jsonb; base_lines jsonb; proposed_total numeric;
begin
 perform operations.assert_active_staff_membership();
 select * into strict f from operations.commercial_offers where id=new.offer_id for update;
 if new.approved_by is distinct from current_setting('operations.actor_id',true) then raise exception 'Branch reviewer must match the active staff actor'; end if;
 if f.status not in ('published','proposed') or f.expires_at<=clock_timestamp() then raise exception 'Offer unavailable'; end if;
 if new.organisation_legal_name is distinct from (select legal_name from operations.organisations where id=f.organisation_id)
 or new.snapshot->>'documentHash' is distinct from new.source_hash
 or new.snapshot->>'documentReference' is distinct from 'private:signing/'||new.approval_id::text||'/source.pdf'
 then raise exception 'Branch document binding mismatch'; end if;
 expected:=f.draft-array['documentHash','documentReference','revenueShare','lines'];
 if new.snapshot-array['documentHash','documentReference','revenueShare','lines'] is distinct from expected then raise exception 'Published terms cannot be changed'; end if;
 if new.option='cash' or (new.option='proposal_'||f.version::text and f.selection->>'option'='cash') then
  if new.snapshot ? 'revenueShare' then raise exception 'Cash terms cannot include revenue share'; end if;
  if new.option='cash' then
   if (f.spec->'cash'->>'mode') is distinct from 'fixed' or new.snapshot->'lines' is distinct from f.draft->'lines' then raise exception 'Fixed cash terms cannot be changed'; end if;
  else
   select jsonb_agg(case when (l->>'recurrenceMonths')::integer>0 then l-array['unitPence','discountPence','taxPence'] else l end order by n) into base_lines from jsonb_array_elements(f.draft->'lines') with ordinality x(l,n);
   select jsonb_agg(case when (l->>'recurrenceMonths')::integer>0 then l-array['unitPence','discountPence','taxPence'] else l end order by n),sum(case when (l->>'recurrenceMonths')::integer>0 then (l->>'unitPence')::numeric*(l->>'quantity')::numeric-(l->>'discountPence')::numeric+(l->>'taxPence')::numeric else 0 end) into actual_lines,proposed_total from jsonb_array_elements(new.snapshot->'lines') with ordinality x(l,n);
   if actual_lines is distinct from base_lines or proposed_total is distinct from (f.selection->>'recurringAmountMinor')::numeric then raise exception 'Allocate the exact proposed recurring total without changing published terms'; end if;
  end if;
 elsif new.option='revenue_share' or (new.option='proposal_'||f.version::text and f.selection->>'option'='revenue_share') then
  expected:=((f.spec->'revenueShare')-array['mode','percentageBps'])||jsonb_build_object('percentageBps',case when new.option='revenue_share' then (f.spec->'revenueShare'->>'percentageBps')::integer else (f.selection->>'percentageBps')::integer end);
  if new.option='revenue_share' and (f.spec->'revenueShare'->>'mode') is distinct from 'fixed' then raise exception 'Fixed revenue terms required'; end if;
  if new.snapshot->'revenueShare' is distinct from expected then raise exception 'Revenue share must match the selected terms'; end if;
  select jsonb_agg(case when (l->>'recurrenceMonths')::integer>0 then l||jsonb_build_object('unitPence','0','discountPence','0','taxPence','0') else l end order by n) into base_lines from jsonb_array_elements(f.draft->'lines') with ordinality x(l,n);
  if new.snapshot->'lines' is distinct from base_lines then raise exception 'Revenue share replaces recurring fees only'; end if;
 else raise exception 'Invalid retained branch'; end if;
 return new;
end $$;
create trigger guard_commercial_branch before insert on operations.commercial_offer_branches for each row execute function operations.guard_commercial_branch();
revoke all on function operations.guard_commercial_branch() from public,anon,authenticated,service_role,operations_portal,operations_founder;

create function operations.lock_commercial_offer(target_org uuid,target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform operations.assert_active_staff_membership();
 perform 1 from operations.commercial_offers where id=target and organisation_id=target_org for update;
 if not found then raise exception 'Offer unavailable'; end if;
end $$;
revoke all on function operations.lock_commercial_offer(uuid,uuid) from public,anon,authenticated,service_role,operations_portal,operations_founder;
grant execute on function operations.lock_commercial_offer(uuid,uuid) to operations_founder;

create function operations.read_commercial_offer_document(target_org uuid,target uuid,choice text)
returns table(bytes bytea,hash text) language sql stable security definer set search_path='' as $$
 select b.source_pdf,b.source_hash from operations.commercial_offer_branches b join operations.commercial_offers f on f.id=b.offer_id
 where f.organisation_id=target_org and f.id=target and b.option=choice and choice in ('cash','revenue_share')
 and f.status in ('published','proposed','rejected') and f.expires_at>clock_timestamp()
 and operations.portal_can_commercial_offer(target);
$$;
revoke all on function operations.read_commercial_offer_document(uuid,uuid,text) from public,anon,authenticated,service_role,operations_portal,operations_founder;
grant execute on function operations.read_commercial_offer_document(uuid,uuid,text) to operations_portal;

-- Append-only history retains every proposal and staff decision. Application
-- roles can read scoped history; only the offer trigger can append events.
create table operations.commercial_offer_events (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references operations.organisations(id),
 offer_id uuid not null references operations.commercial_offers(id),
 offer_version integer not null check(offer_version>0),
 action text not null check(action in ('published','proposed','resubmitted','rejected','withdrawn','selected','approved')),
 status text not null check(status in ('published','proposed','rejected','withdrawn','selected')),
 selection jsonb, rejection_reason text, agreement_id uuid, approval_id uuid,
 actor_kind text not null check(actor_kind in ('staff','portal')),
 actor_id text not null, user_id uuid not null,
 correlation_id uuid not null, occurred_at timestamptz not null default clock_timestamp(),
 unique(offer_id,offer_version),
 check((actor_kind='staff' and actor_id ~ '^[a-f0-9]{64}$') or (actor_kind='portal' and actor_id=user_id::text))
);
create index commercial_offer_events_org on operations.commercial_offer_events(organisation_id,offer_id,offer_version);
alter table operations.commercial_offer_events enable row level security;
alter table operations.commercial_offer_events force row level security;
revoke all on operations.commercial_offer_events from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
grant select on operations.commercial_offer_events to operations_founder,operations_portal;
create policy staff_read on operations.commercial_offer_events for select to operations_founder using(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
create policy portal_read on operations.commercial_offer_events for select to operations_portal using(operations.portal_can_commercial_offer(offer_id));
create function operations.audit_commercial_offer() returns trigger language plpgsql security definer set search_path='' as $$
declare actor text:=nullif(current_setting('operations.actor_id',true),'');
 who uuid:=nullif(current_setting('operations.user_id',true),'')::uuid;
 kind text; event_action text; correlation uuid;
begin
 if current_setting('role',true)='operations_founder' then
  perform operations.assert_active_staff_membership();
  if actor is distinct from encode(sha256(convert_to('fss-admin:'||who::text,'UTF8')),'hex') then raise exception 'Offer audit staff actor mismatch'; end if;
  kind:='staff';
 elsif current_setting('role',true)='operations_portal' and coalesce(operations.portal_can_commercial_offer(new.id),false) then
  actor:=who::text; kind:='portal';
 else raise exception 'Offer audit requires an authorized actor';
 end if;
 if tg_op='INSERT' then
  event_action:='published'; correlation:=new.correlation_id;
 else
  correlation:=nullif(current_setting('operations.correlation_id',true),'')::uuid;
  event_action:=case
   when new.status='proposed' and old.status='rejected' then 'resubmitted'
   when new.status='selected' and old.status='proposed' then 'approved'
   else new.status end;
 end if;
 insert into operations.commercial_offer_events(organisation_id,offer_id,offer_version,action,status,selection,rejection_reason,agreement_id,approval_id,actor_kind,actor_id,user_id,correlation_id)
 values(new.organisation_id,new.id,new.version,event_action,new.status,new.selection,new.rejection_reason,new.agreement_id,new.approval_id,kind,actor,who,correlation);
 return new;
end $$;
create trigger audit_commercial_offer after insert or update on operations.commercial_offers for each row execute function operations.audit_commercial_offer();
revoke all on function operations.audit_commercial_offer() from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
