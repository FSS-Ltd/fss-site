set lock_timeout = '5s';
set statement_timeout = '30s';

alter table growth.outreach_jobs
  drop constraint outreach_jobs_status_check,
  add constraint outreach_jobs_status_check check (status in ('pending','leased','completed','cancelled','held')),
  add column lease_revision bigint not null default 0 check (lease_revision >= 0);

create or replace function growth.claim_outreach_jobs(worker text, claim_limit integer, lease interval)
returns setof growth.outreach_jobs language plpgsql set search_path = '' as $$
begin
  if worker is null or length(trim(worker)) = 0 or claim_limit is null or lease is null or claim_limit < 1 or claim_limit > 25 or lease <= interval '0' or lease > interval '1 hour' then
    raise exception 'invalid outreach job claim';
  end if;
  return query with selected as (
    select j.id from growth.outreach_jobs j
    where j.due_at <= now() and (j.status = 'pending' or (j.status = 'leased' and j.lease_until <= now()))
    order by j.due_at,j.id for update skip locked limit claim_limit
  ) update growth.outreach_jobs j set status='leased',lease_owner=worker,lease_until=now()+lease,lease_revision=j.lease_revision+1
    from selected s where j.id=s.id returning j.*;
end $$;


alter table growth.email_messages
  add column controlled_preparation jsonb check (controlled_preparation is null or jsonb_typeof(controlled_preparation) = 'object');

create function growth.protect_controlled_preparation() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.controlled_preparation is not null and new.controlled_preparation is distinct from old.controlled_preparation then
    raise exception 'controlled preparation is immutable';
  end if;
  return new;
end $$;
create trigger protect_controlled_preparation before update on growth.email_messages
for each row execute function growth.protect_controlled_preparation();

alter table growth.outreach_reservations
  add column issued_snapshot jsonb,
  add column issued_snapshot_hash text,
  add column confirmation_receipt jsonb,
  add column confirmation_observed_at timestamptz,
  add constraint reservation_issued_snapshot_pair check (
    (issued_snapshot is null and issued_snapshot_hash is null) or
    (issued_snapshot is not null and issued_snapshot_hash is not null and jsonb_typeof(issued_snapshot) = 'object' and issued_snapshot_hash ~ '^[a-f0-9]{64}$'
      and (issued_snapshot->>'version' = '1' and issued_snapshot->>'kind' = 'direct_raw'
        and length(issued_snapshot->>'raw') between 1 and 4000000 and issued_snapshot->>'raw' ~ '^[A-Za-z0-9_-]+$'
        and issued_snapshot->>'rawSha256' = issued_snapshot_hash
        and length(trim(issued_snapshot->>'from')) > 0 and issued_snapshot->>'from' = lower(trim(issued_snapshot->>'from'))
        and issued_snapshot->>'connectionId' = connection_id::text and issued_snapshot->>'grantEpoch' = grant_epoch::text
        and length(trim(issued_snapshot->>'googleSubject')) > 0 and issued_snapshot->>'rfcMessageId' = rfc_message_id
        and issued_snapshot->>'messageId' = email_message_id::text and issued_snapshot->>'sequenceId' = sequence_id::text
        and coalesce(issued_snapshot->>'membershipId','') = coalesce(membership_id::text,'')
        and jsonb_typeof(issued_snapshot->'envelope'->'to') = 'array' and jsonb_array_length(issued_snapshot->'envelope'->'to') = 1
        and issued_snapshot->'envelope'->'cc' = '[]'::jsonb and issued_snapshot->'envelope'->'bcc' = '[]'::jsonb) is true)
  ),
  add constraint reservation_confirmation_pair check (
    (confirmation_receipt is null and confirmation_observed_at is null) or
    (confirmation_receipt is not null and jsonb_typeof(confirmation_receipt) = 'object' and confirmation_observed_at is not null and issued_snapshot is not null
      and (confirmation_receipt->>'basis' = 'gmail_fss_sent_observed'
        and confirmation_receipt->>'googleSubject' = issued_snapshot->>'googleSubject'
        and confirmation_receipt->>'providerMessageId' = provider_message_id
        and confirmation_receipt->>'providerThreadId' = provider_thread_id
        and confirmation_receipt->>'rfcMessageId' = rfc_message_id
        and confirmation_receipt->>'rawSha256' = issued_snapshot_hash
        and (confirmation_receipt->>'observationGrantEpoch') ~ '^[1-9][0-9]*$'
        and (confirmation_receipt->>'observedFrom')::timestamptz <= confirmation_observed_at
        and (confirmation_receipt->>'providerCreatedAt')::timestamptz <= confirmation_observed_at
        and (confirmation_receipt->>'observedUntil')::timestamptz = confirmation_observed_at) is true)
  ),
  add constraint reservation_id_membership_unique unique (id,membership_id),
  add constraint reservation_id_campaign_policy_unique unique (id,campaign_id,policy_version);

create function growth.protect_outreach_confirmation() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.issued_snapshot is not null or new.confirmation_receipt is not null then
      raise exception 'confirmation evidence requires an existing reservation';
    end if;
    return new;
  end if;
  if old.issued_snapshot is not null and (new.issued_snapshot,new.issued_snapshot_hash) is distinct from (old.issued_snapshot,old.issued_snapshot_hash) then
    raise exception 'issued snapshot is immutable';
  end if;
  if old.issued_snapshot is null and new.issued_snapshot is not null and not (old.status='reserved' and new.status='submitting') then
    raise exception 'issued snapshot requires submitting transition';
  end if;
  if old.confirmation_receipt is not null and (new.confirmation_receipt,new.confirmation_observed_at) is distinct from (old.confirmation_receipt,old.confirmation_observed_at) then
    raise exception 'confirmation receipt is immutable';
  end if;
  return new;
end $$;
create trigger protect_outreach_confirmation before insert or update on growth.outreach_reservations
for each row execute function growth.protect_outreach_confirmation();

alter table growth.campaign_memberships
  add column first_confirmation_reservation_id uuid,
  add column confirmed_snapshot jsonb,
  add constraint membership_confirmation_pair check (
    (first_confirmation_reservation_id is null and confirmed_snapshot is null) or
    (first_confirmation_reservation_id is not null and confirmed_snapshot is not null and jsonb_typeof(confirmed_snapshot) = 'object')
  ),
  add constraint membership_confirmation_reservation_fk foreign key (first_confirmation_reservation_id,id)
    references growth.outreach_reservations(id,membership_id) on delete restrict;

create function growth.protect_campaign_confirmation() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.first_confirmation_reservation_id is not null and (new.first_confirmation_reservation_id,new.confirmed_snapshot) is distinct from (old.first_confirmation_reservation_id,old.confirmed_snapshot) then
    raise exception 'membership confirmation is immutable';
  end if;
  return new;
end $$;
create trigger protect_campaign_confirmation before update on growth.campaign_memberships
for each row execute function growth.protect_campaign_confirmation();

alter table growth.outreach_jobs
  add column anchor_reservation_id uuid,
  add column anchor_revision integer not null default 0 check (anchor_revision >= 0),
  add constraint outreach_job_anchor_fk foreign key (anchor_reservation_id,campaign_id,policy_version)
    references growth.outreach_reservations(id,campaign_id,policy_version) on delete restrict,
  add constraint outreach_job_anchor_pair check (
    (anchor_reservation_id is null and anchor_revision = 0) or
    (anchor_reservation_id is not null and anchor_revision > 0 and job_type='monthly_report' and membership_id is null)
  );
create unique index outreach_one_campaign_monthly_report on growth.outreach_jobs(campaign_id)
  where job_type='monthly_report' and membership_id is null and campaign_id is not null;
create index outreach_reservation_thread_idx on growth.outreach_reservations(provider_thread_id) where provider_thread_id is not null;
create index sequence_enrollment_gmail_thread_idx on growth.sequence_enrollments(gmail_thread_id) where gmail_thread_id is not null;

reset statement_timeout;
reset lock_timeout;
