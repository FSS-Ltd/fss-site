begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table growth.email_events
  add column outreach_reply_reservation_id uuid,
  add column outreach_reply_attribution jsonb,
  add constraint email_event_outreach_reply_pair check ((
    (outreach_reply_reservation_id is null and outreach_reply_attribution is null)
    or (outreach_reply_reservation_id is not null and jsonb_typeof(outreach_reply_attribution)='object'
      and provider='gmail' and event_type in ('reply','bounce','auto_response')
      and outreach_reply_attribution - array['basis','outboundProvider','reservationId','rfcMessageId','connectionId','googleSubject','grantEpoch','recipient']='{}'::jsonb
      and outreach_reply_attribution->>'basis'='gmail_exact_reference_v1'
      and outreach_reply_attribution->>'outboundProvider' in ('gmail','resend')
      and outreach_reply_attribution->>'reservationId'=outreach_reply_reservation_id::text
      and jsonb_typeof(outreach_reply_attribution->'rfcMessageId')='string'
      and length(outreach_reply_attribution->>'rfcMessageId') between 3 and 998
      and outreach_reply_attribution->>'connectionId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and jsonb_typeof(outreach_reply_attribution->'googleSubject')='string'
      and length(outreach_reply_attribution->>'googleSubject') between 1 and 512
      and outreach_reply_attribution->>'googleSubject'=trim(outreach_reply_attribution->>'googleSubject')
      and jsonb_typeof(outreach_reply_attribution->'grantEpoch')='number'
      and case when outreach_reply_attribution->>'grantEpoch' ~ '^[1-9][0-9]{0,9}$'
        then (outreach_reply_attribution->>'grantEpoch')::numeric <= 2147483647 else false end
      and jsonb_typeof(outreach_reply_attribution->'recipient')='string'
      and outreach_reply_attribution->>'recipient'=lower(trim(outreach_reply_attribution->>'recipient'))
      and length(outreach_reply_attribution->>'recipient') between 3 and 320)
  ) is true) not valid;
alter table growth.email_events
  add constraint email_event_outreach_reply_reservation_fk foreign key (outreach_reply_reservation_id)
  references growth.outreach_reservations(id) on delete restrict not valid;
alter table growth.email_events validate constraint email_event_outreach_reply_pair;
alter table growth.email_events validate constraint email_event_outreach_reply_reservation_fk;

create function growth.protect_outreach_reply_attribution() returns trigger language plpgsql set search_path='' as $$
begin
  if old.outreach_reply_attribution is not null and new is distinct from old then
    raise exception 'outreach reply attribution is immutable';
  end if;
  if new.outreach_reply_reservation_id is distinct from old.outreach_reply_reservation_id
    or new.outreach_reply_attribution is distinct from old.outreach_reply_attribution then
    raise exception 'outreach reply attribution is immutable';
  end if;
  return new;
end $$;
create trigger protect_outreach_reply_attribution before update on growth.email_events
  for each row execute function growth.protect_outreach_reply_attribution();
commit;
