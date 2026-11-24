begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Stop an upgrade rather than preserve unattributed controlled credit as verified fact.
lock table growth.outreach_reservations, growth.campaign_memberships, growth.outreach_jobs, growth.outreach_events, growth.audit_log in share row exclusive mode;
do $$
begin
  if exists (select 1 from growth.outreach_reservations where confirmation_receipt is not null or confirmation_observed_at is not null)
    or exists (select 1 from growth.campaign_memberships where first_confirmation_reservation_id is not null or confirmed_snapshot is not null)
    or exists (select 1 from growth.outreach_jobs where anchor_reservation_id is not null)
    or exists (select 1 from growth.outreach_events where event_type='gmail_sent_observed')
    or exists (select 1 from growth.audit_log where action='outreach_reservation.gmail_sent_observed') then
    raise exception 'unproven Gmail confirmation facts require manual audit before migration';
  end if;
end $$;

alter table growth.outreach_reservations
  add column direct_submission_evidence jsonb,
  add constraint direct_submission_evidence_identity check (
    direct_submission_evidence is null or (
      issued_snapshot is not null and status='accepted' and provider_message_id is not null and provider_thread_id is not null
      and length(provider_message_id) between 1 and 256 and length(provider_thread_id) between 1 and 256
      and provider_message_id !~ '[[:cntrl:]]' and provider_thread_id !~ '[[:cntrl:]]'
      and provider_message_id=trim(provider_message_id) and provider_thread_id=trim(provider_thread_id)
      and direct_submission_evidence = jsonb_build_object(
        'version',1,'kind','gmail_api_send_message_v1','reservationId',id::text,'accountId',account_id,
        'connectionId',connection_id::text,'googleSubject',issued_snapshot->>'googleSubject','grantEpoch',grant_epoch,
        'rfcMessageId',rfc_message_id,'rawSha256',issued_snapshot_hash,
        'providerMessageId',provider_message_id,'providerThreadId',provider_thread_id
      )
    )
  ),
  add constraint confirmed_requires_direct_submission check (confirmation_receipt is null or direct_submission_evidence is not null);

create function growth.protect_direct_submission_evidence() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='INSERT' then
    if new.direct_submission_evidence is not null then raise exception 'direct submission evidence requires an existing reservation'; end if;
    return new;
  end if;
  if old.direct_submission_evidence is not null and new.direct_submission_evidence is distinct from old.direct_submission_evidence then
    raise exception 'direct submission evidence is immutable';
  end if;
  if old.direct_submission_evidence is null and new.direct_submission_evidence is not null and not (
    old.status='submitting' and new.status='accepted' and old.issued_snapshot is not null and old.confirmation_receipt is null
  ) then
    raise exception 'direct submission evidence requires submitting to accepted transition';
  end if;
  return new;
end $$;
create trigger protect_direct_submission_evidence before insert or update on growth.outreach_reservations
for each row execute function growth.protect_direct_submission_evidence();

commit;
