-- Notifications are committed with the offer or signing transition. Provider
-- acceptance and delivery are separate facts; neither is inferred from a link.
create table operations.agreement_notifications (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references operations.organisations(id),
 offer_id uuid references operations.commercial_offers(id),
 approval_id uuid references operations.signing_approvals(id),
 kind text not null check(kind in ('budget_request','offer_request','signing_request')),
 recipient text not null check(recipient=lower(recipient)),
 status text not null default 'queued' check(status in ('queued','sending','sent','delivered','failed','unknown','suppressed')),
 attempts integer not null default 0 check(attempts>=0),
 send_version integer not null default 1 check(send_version>0),
 last_resend_request uuid,
 provider_id text unique,
 accepted_at timestamptz, delivered_at timestamptz,
 last_delivery_event_at timestamptz,
 failure_code text,
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((kind in ('budget_request','offer_request') and offer_id is not null and approval_id is null)
    or (kind='signing_request' and approval_id is not null and offer_id is null)),
 unique(offer_id,kind,recipient), unique(approval_id,kind,recipient)
);
create index agreement_notifications_due on operations.agreement_notifications(next_attempt_at,id)
 where status='queued';
create index agreement_notifications_approval on operations.agreement_notifications(approval_id,recipient);
create index agreement_notifications_offer on operations.agreement_notifications(offer_id,recipient);
create table operations.agreement_notification_attempts (
 notification_id uuid not null references operations.agreement_notifications(id),
 send_version integer not null,
 provider_id text,
 accepted_at timestamptz,
 outcome text not null check(outcome in ('sent','failed','unknown','delivered')),
 failure_code text,
 primary key(notification_id,send_version)
);
alter table operations.agreement_notification_attempts enable row level security;
alter table operations.agreement_notification_attempts force row level security;
revoke all on operations.agreement_notification_attempts from public,anon,authenticated,service_role,growth_app,
 operations_founder,operations_portal,operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
alter table operations.agreement_notifications enable row level security;
alter table operations.agreement_notifications force row level security;
revoke all on operations.agreement_notifications from public,anon,authenticated,service_role,growth_app,
 operations_founder,operations_portal,operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
grant select on operations.agreement_notifications to operations_founder;
create policy staff_read on operations.agreement_notifications for select to operations_founder
 using(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');

create function operations.enqueue_agreement_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient text;
begin
 if tg_table_name='commercial_offers' then
  if tg_op='INSERT' then
   for recipient in select value from jsonb_array_elements_text(new.draft->'signatories') loop
    insert into operations.agreement_notifications(organisation_id,offer_id,kind,recipient)
      values(new.organisation_id,new.id,
        case when new.spec->'cash'->>'mode'='client_proposed' or
          new.spec->'revenueShare'->>'mode'='client_proposed' then 'budget_request' else 'offer_request' end,
        lower(recipient)) on conflict do nothing;
   end loop;
  end if;
 elsif tg_op='UPDATE' and old.status='prepared' and new.status='approved' then
  for recipient in select value from jsonb_array_elements_text(new.snapshot->'signatories') loop
   insert into operations.agreement_notifications(organisation_id,approval_id,kind,recipient)
     values(new.organisation_id,new.id,'signing_request',lower(recipient)) on conflict do nothing;
  end loop;
 end if;
 return new;
end $$;
create trigger enqueue_budget_request after insert on operations.commercial_offers
 for each row execute function operations.enqueue_agreement_notification();
create trigger enqueue_signing_request after update of status on operations.signing_approvals
 for each row execute function operations.enqueue_agreement_notification();

-- Existing issued requests have no provider receipt in this outbox. Keep that
-- uncertainty visible and require an explicit staff resend before sending again.
insert into operations.agreement_notifications(organisation_id,offer_id,kind,recipient,status,failure_code)
select f.organisation_id,f.id,
 case when f.spec->'cash'->>'mode'='client_proposed' or
   f.spec->'revenueShare'->>'mode'='client_proposed' then 'budget_request' else 'offer_request' end,
 lower(recipient.email),'unknown','legacy_delivery_unverified'
from operations.commercial_offers f
cross join lateral jsonb_array_elements_text(f.draft->'signatories') as recipient(email)
where f.status in ('published','rejected') and f.expires_at>clock_timestamp()
on conflict do nothing;
insert into operations.agreement_notifications(organisation_id,approval_id,kind,recipient,status,failure_code)
select p.organisation_id,p.id,'signing_request',lower(recipient.email),'unknown','legacy_delivery_unverified'
from operations.signing_approvals p
cross join lateral jsonb_array_elements_text(p.snapshot->'signatories') as recipient(email)
where p.status='approved' and p.expires_at>clock_timestamp()
on conflict do nothing;

create function operations.agreement_notification_current(target operations.agreement_notifications)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if target.kind in ('budget_request','offer_request') then
  return exists(select 1 from operations.commercial_offers f where f.id=target.offer_id
    and f.organisation_id=target.organisation_id and f.status in ('published','rejected')
    and f.expires_at>clock_timestamp());
 end if;
 return exists(
   select 1 from operations.signing_approvals p
   join operations.agreements a on a.id=p.agreement_id and a.organisation_id=p.organisation_id
   where p.id=target.approval_id and p.organisation_id=target.organisation_id
    and p.status='approved' and p.expires_at>clock_timestamp()
    and a.status='draft' and a.current_revision=p.revision
    and not exists(select 1 from operations.signing_signatures s
      where s.approval_id=p.id and s.email=target.recipient));
end $$;
create function operations.agreement_notification_sendable(target uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare n operations.agreement_notifications;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' then raise exception 'Notification dispatch unavailable' using errcode='42501'; end if;
 select * into n from operations.agreement_notifications where id=target for update;
 if not found or n.status<>'sending' then return false; end if;
 if not operations.agreement_notification_current(n) then
  update operations.agreement_notifications set status='suppressed',lease_until=null,updated_at=clock_timestamp() where id=target;
  return false;
 end if;
 return true;
end $$;
create function operations.claim_agreement_notifications(batch integer)
returns table(id uuid,organisation_id uuid,offer_id uuid,approval_id uuid,kind text,recipient text,
 attempts integer,send_version integer,title text,organisation_name text)
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)<>'operations_onboarding_worker' or batch not between 1 and 50 then
  raise exception 'Notification dispatch unavailable' using errcode='42501';
 end if;
 update operations.agreement_notifications n set status='suppressed',updated_at=clock_timestamp()
  where n.status='queued' and not operations.agreement_notification_current(n);
 update operations.agreement_notifications n set status='unknown',failure_code='lease_expired',lease_until=null,updated_at=clock_timestamp()
  where n.status='sending' and n.lease_until<clock_timestamp();
 return query with due as (
  select n.id from operations.agreement_notifications n
  where n.status='queued' and n.next_attempt_at<=clock_timestamp()
  order by n.next_attempt_at,n.id limit batch for update skip locked
 ), claimed as (
  update operations.agreement_notifications n
   set status='sending',attempts=n.attempts+1,lease_until=clock_timestamp()+interval '2 minutes',updated_at=clock_timestamp()
   from due where n.id=due.id returning n.*
 ) select n.id,n.organisation_id,n.offer_id,n.approval_id,n.kind,n.recipient,n.attempts,n.send_version,
  coalesce(f.draft->>'title',p.snapshot->>'title','Agreement'),o.display_name
  from claimed n join operations.organisations o on o.id=n.organisation_id
   left join operations.commercial_offers f on f.id=n.offer_id
   left join operations.signing_approvals p on p.id=n.approval_id;
end $$;
create table operations.agreement_delivery_events (
 event_id text primary key,notification_id uuid not null references operations.agreement_notifications(id),
 provider_id text not null,recipient text not null,
 kind text not null check(kind in ('delivered','bounced','complained')),
 occurred_at timestamptz not null default clock_timestamp()
);
alter table operations.agreement_delivery_events enable row level security;
alter table operations.agreement_delivery_events force row level security;
revoke all on operations.agreement_delivery_events from public,anon,authenticated,service_role,growth_app,
 operations_founder,operations_portal,operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
create function operations.finish_agreement_notification(target uuid,provider text,accepted timestamptz,
 failure text,retry_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare n operations.agreement_notifications; delivery_kind text; delivery_time timestamptz;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' then raise exception 'Notification dispatch unavailable' using errcode='42501'; end if;
 select * into strict n from operations.agreement_notifications where id=target for update;
 if n.status<>'sending' then return; end if;
 if provider is not null and accepted is not null and length(provider) between 1 and 200 then
  update operations.agreement_notifications set status='sent',provider_id=provider,accepted_at=accepted,
   lease_until=null,updated_at=clock_timestamp() where id=target;
  insert into operations.agreement_notification_attempts(notification_id,send_version,provider_id,accepted_at,outcome)
   values(target,n.send_version,provider,accepted,'sent')
   on conflict(notification_id,send_version) do update set provider_id=excluded.provider_id,
    accepted_at=excluded.accepted_at,outcome='sent',failure_code=null;
  select e.kind,e.occurred_at into delivery_kind,delivery_time
   from operations.agreement_delivery_events e
   where e.notification_id=target and e.provider_id=provider and e.recipient=n.recipient
   order by e.occurred_at desc,e.event_id desc limit 1;
  if found then
   update operations.agreement_notifications set
    status=case when delivery_kind='delivered' then 'delivered' else 'failed' end,
    delivered_at=case when delivery_kind='delivered' then delivery_time else null end,
    failure_code=case when delivery_kind='delivered' then null else delivery_kind end,
    last_delivery_event_at=delivery_time,updated_at=clock_timestamp() where id=target;
   update operations.agreement_notification_attempts set
    outcome=case when delivery_kind='delivered' then 'delivered' else 'failed' end,
    failure_code=case when delivery_kind='delivered' then null else delivery_kind end
    where notification_id=target and send_version=n.send_version;
  end if;
 elsif failure is not null and length(failure) between 1 and 100 then
  update operations.agreement_notifications set status=case when retry_at is not null then 'queued'
    when failure='unknown_outcome' then 'unknown' else 'failed' end,
   failure_code=failure,next_attempt_at=coalesce(retry_at,next_attempt_at),lease_until=null,
   updated_at=clock_timestamp() where id=target;
  if retry_at is null then
   insert into operations.agreement_notification_attempts(notification_id,send_version,outcome,failure_code)
    values(target,n.send_version,case when failure='unknown_outcome' then 'unknown' else 'failed' end,failure)
    on conflict(notification_id,send_version) do update set outcome=excluded.outcome,failure_code=excluded.failure_code;
  end if;
 else raise exception 'Invalid notification result'; end if;
end $$;
create function operations.record_agreement_delivery(target uuid,event text,kind text,provider text,recipient text,event_occurred timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare n operations.agreement_notifications;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' or kind not in ('delivered','bounced','complained') then
  raise exception 'Delivery event unavailable' using errcode='42501'; end if;
 select * into n from operations.agreement_notifications where id=target for update;
 if not found or n.recipient is distinct from lower(recipient) or
  (n.provider_id is not null and n.provider_id is distinct from provider) or
  n.status not in ('sending','sent','delivered','failed') then return; end if;
 insert into operations.agreement_delivery_events(event_id,notification_id,provider_id,recipient,kind,occurred_at)
  values(event,target,provider,lower(recipient),kind,coalesce(event_occurred,clock_timestamp())) on conflict do nothing;
 if not found then return; end if;
 if n.provider_id is null then return; end if;
 if n.last_delivery_event_at is not null and event_occurred is not null and
  event_occurred<n.last_delivery_event_at then return; end if;
 update operations.agreement_notifications set status=case when kind='delivered' then 'delivered' else 'failed' end,
  delivered_at=case when kind='delivered' then clock_timestamp() else delivered_at end,
  failure_code=case when kind='delivered' then null else kind end,
  last_delivery_event_at=coalesce(event_occurred,clock_timestamp()),updated_at=clock_timestamp()
  where id=target;
 update operations.agreement_notification_attempts set outcome=case when kind='delivered' then 'delivered' else 'failed' end,
  failure_code=case when kind='delivered' then null else kind end
  where notification_id=target and send_version=n.send_version;
end $$;
create function operations.resend_agreement_notification(target_org uuid,target_source uuid,target uuid,expected_version integer,
 request uuid,correlation uuid) returns void language plpgsql security definer set search_path='' as $$
declare n operations.agreement_notifications; actor text:=nullif(current_setting('operations.actor_id',true),'');
begin
 perform operations.assert_active_staff_membership();
 if actor is null or actor !~ '^[a-f0-9]{64}$' or request is null or correlation is null then
  raise exception 'Notification resend unavailable' using errcode='42501'; end if;
 select * into n from operations.agreement_notifications where id=target and organisation_id=target_org for update;
 if not found then raise exception 'Notification changed' using errcode='P0001'; end if;
 if n.last_resend_request=request then return; end if;
 if (n.kind='signing_request' and n.approval_id is distinct from target_source) or
  (n.kind in ('budget_request','offer_request') and n.offer_id is distinct from target_source) or
  n.send_version<>expected_version or n.status not in ('sent','failed','unknown') or
  not operations.agreement_notification_current(n) then
  raise exception 'Notification changed' using errcode='P0001'; end if;
 update operations.agreement_notifications set status='queued',send_version=send_version+1,
  last_resend_request=request,provider_id=null,accepted_at=null,delivered_at=null,
  last_delivery_event_at=null,failure_code=null,
  next_attempt_at=clock_timestamp(),lease_until=null,updated_at=clock_timestamp() where id=target;
 insert into operations.audit_events(organisation_id,actor_id,action,entity_id,review_reference,correlation_id,entity_version)
  values(target_org,actor,'agreement.notification_resent',target,'signing-delivery',correlation,expected_version);
end $$;
revoke all on function operations.enqueue_agreement_notification(),operations.agreement_notification_current(operations.agreement_notifications),operations.agreement_notification_sendable(uuid),
 operations.claim_agreement_notifications(integer),operations.finish_agreement_notification(uuid,text,timestamptz,text,timestamptz),
 operations.record_agreement_delivery(uuid,text,text,text,text,timestamptz)
 ,operations.resend_agreement_notification(uuid,uuid,uuid,integer,uuid,uuid)
 from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,
 operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
grant execute on function operations.claim_agreement_notifications(integer),operations.agreement_notification_sendable(uuid),
 operations.finish_agreement_notification(uuid,text,timestamptz,text,timestamptz),
 operations.record_agreement_delivery(uuid,text,text,text,text,timestamptz) to operations_onboarding_worker;
grant execute on function operations.resend_agreement_notification(uuid,uuid,uuid,integer,uuid,uuid) to operations_founder;
