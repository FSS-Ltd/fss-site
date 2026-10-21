-- Staff can extend an expired response window without rewriting retained terms.
alter table operations.commercial_offer_events
  drop constraint commercial_offer_events_action_check,
  add constraint commercial_offer_events_action_check
    check(action in ('published','proposed','resubmitted','rejected','withdrawn','selected','approved','deadline_extended'));
alter table operations.commercial_offer_events
  add column previous_expires_at timestamptz,
  add column expires_at timestamptz;

create or replace function operations.guard_commercial_offer() returns trigger
language plpgsql set search_path='' as $$
declare extension_marker text;
begin
 if tg_op='INSERT' then
  perform operations.assert_active_staff_membership();
  if new.status<>'published' or new.version<>1 or new.selection is not null or new.agreement_id is not null or new.approval_id is not null or new.rejection_reason is not null
   or new.expires_at<=clock_timestamp() or new.expires_at>clock_timestamp()+interval '90 days' then raise exception 'Invalid offer publication'; end if;
 else
  if (to_jsonb(new)-array['status','version','selection','rejection_reason','agreement_id','approval_id','expires_at']) is distinct from (to_jsonb(old)-array['status','version','selection','rejection_reason','agreement_id','approval_id','expires_at']) or new.version<>old.version+1 then raise exception 'Commercial offer terms are immutable'; end if;
  if new.expires_at is distinct from old.expires_at then
   extension_marker:=current_setting('operations.commercial_offer_deadline_extension',true);
   if extension_marker is distinct from old.id::text||':'||old.version::text
    or new.expires_at<=clock_timestamp() or new.expires_at>clock_timestamp()+interval '90 days'
    or old.expires_at>clock_timestamp() or old.status not in ('published','proposed','rejected') then
    raise exception 'Invalid commercial offer deadline extension';
   end if;
  end if;
 end if;
 return new;
end $$;

create or replace function operations.review_commercial_offer(target_org uuid,target uuid,expected integer,decision text,reason text,correlation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare f operations.commercial_offers;
begin
 perform operations.assert_active_staff_membership();
 select * into strict f from operations.commercial_offers where id=target and organisation_id=target_org for update;
 if f.version is distinct from expected or f.status not in ('published','proposed','rejected') then raise exception 'Offer changed or unavailable'; end if;
 if f.expires_at<=clock_timestamp() and decision<>'withdraw' then raise exception 'Offer changed or expired'; end if;
 perform set_config('operations.correlation_id',correlation::text,true);
 if decision='withdraw' then
  update operations.commercial_offers set status='withdrawn',version=version+1 where id=target;
 elsif decision='reject' and f.status='proposed' and length(trim(reason)) between 1 and 4000 then
  update operations.commercial_offers set status='rejected',rejection_reason=reason,version=version+1 where id=target;
 elsif decision='approve' and f.status='proposed' then
  perform operations.materialize_commercial_offer(target,'proposal_'||f.version::text,correlation);
 else raise exception 'Invalid offer review'; end if;
end $$;

create function operations.extend_commercial_offer(target_org uuid,target uuid,expected integer,new_expiry timestamptz,correlation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare f operations.commercial_offers;
begin
 perform operations.assert_active_staff_membership();
 select * into strict f from operations.commercial_offers where id=target and organisation_id=target_org for update;
 if f.version is distinct from expected or f.status not in ('published','proposed','rejected') then raise exception 'Offer changed or unavailable'; end if;
 if f.expires_at>clock_timestamp() then raise exception 'Offer deadline has not expired'; end if;
 if new_expiry is null or new_expiry<=clock_timestamp() or new_expiry>clock_timestamp()+interval '90 days' then raise exception 'Deadline must be in the future and within 90 days'; end if;
 if correlation is null then raise exception 'Correlation ID required'; end if;
 perform set_config('operations.correlation_id',correlation::text,true);
 perform set_config('operations.commercial_offer_deadline_extension',target::text||':'||expected::text,true);
 update operations.commercial_offers set expires_at=new_expiry,version=version+1 where id=target;
 perform set_config('operations.commercial_offer_deadline_extension','',true);
end $$;
revoke all on function operations.extend_commercial_offer(uuid,uuid,integer,timestamptz,uuid) from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
grant execute on function operations.extend_commercial_offer(uuid,uuid,integer,timestamptz,uuid) to operations_founder;

create or replace function operations.audit_commercial_offer() returns trigger
language plpgsql security definer set search_path='' as $$
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
   when new.expires_at is distinct from old.expires_at then 'deadline_extended'
   when new.status='proposed' and old.status='rejected' then 'resubmitted'
   when new.status='selected' and old.status='proposed' then 'approved'
   else new.status end;
 end if;
 insert into operations.commercial_offer_events(organisation_id,offer_id,offer_version,action,status,selection,rejection_reason,agreement_id,approval_id,actor_kind,actor_id,user_id,correlation_id,previous_expires_at,expires_at)
 values(new.organisation_id,new.id,new.version,event_action,new.status,new.selection,new.rejection_reason,new.agreement_id,new.approval_id,kind,actor,who,correlation,case when tg_op='UPDATE' and new.expires_at is distinct from old.expires_at then old.expires_at end,new.expires_at);
 return new;
end $$;
