set lock_timeout = '5s';
set statement_timeout = '30s';

alter table growth.email_messages add column outreach_claim_previous_status text check (outreach_claim_previous_status in ('queued','retry','sending'));

alter table growth.outreach_provider_usage add constraint outreach_usage_account_connection_unique unique (account_id, connection_id);
alter table growth.campaigns add constraint campaign_policy_account_unique unique (id, version, account_connection_id);

alter table growth.outreach_reservations
  drop constraint outreach_reservations_status_check,
  add constraint outreach_reservations_status_check check (status in ('reserved','submitting','accepted','sent','uncertain','rejected','cancelled')),
  add column connection_id uuid references growth.integration_connections(id) on delete restrict,
  add constraint outreach_reservation_usage_connection_fk foreign key (account_id, connection_id) references growth.outreach_provider_usage(account_id, connection_id) on delete restrict,
  add constraint outreach_reservation_campaign_account_fk foreign key (campaign_id, policy_version, connection_id) references growth.campaigns(id, version, account_connection_id) on delete restrict,
  add column grant_epoch integer check (grant_epoch > 0),
  add column rfc_message_id text,
  add column recipient_count integer check (recipient_count > 0),
  add column authority_fingerprint text check (authority_fingerprint ~ '^[a-f0-9]{64}$'),
  add column lease_token uuid,
  add column fence integer not null default 1 check (fence > 0),
  add column lease_until timestamptz,
  add column submitted_at timestamptz,
  add column provider_message_id text,
  add column provider_thread_id text,
  add column actual_sent_at timestamptz,
  add constraint outreach_reservation_authority_fields check (
    connection_id is null or (
      grant_epoch is not null and rfc_message_id is not null and length(trim(rfc_message_id)) > 0
      and recipient_count is not null and authority_fingerprint is not null
      and lease_token is not null and lease_until is not null
      and (status not in ('submitting','accepted','rejected','uncertain') or submitted_at is not null)
      and (status <> 'accepted' or (provider_message_id is not null and provider_thread_id is not null))
      and (status not in ('reserved','cancelled') or submitted_at is null)
      and (status <> 'sent')
      and (actual_sent_at is null or status = 'accepted')
    )
  );
create index outreach_reservation_connection_day on growth.outreach_reservations(connection_id,london_day,status);
create index outreach_reservation_campaign_day on growth.outreach_reservations(campaign_id,london_day,status) where campaign_id is not null;
create index outreach_reservation_pending_account on growth.outreach_reservations(connection_id,status,reserved_at) where status in ('reserved','submitting','uncertain','accepted');
create index outreach_reservation_unbound on growth.outreach_reservations(status) where connection_id is null and status <> 'cancelled';
create unique index outreach_reservation_provider_id on growth.outreach_reservations(connection_id,provider_message_id) where provider_message_id is not null;

create function growth.protect_outreach_reservation_authority() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.connection_id is null and new.connection_id is not null then
    raise exception 'historical reservation identity cannot be inferred';
  end if;
  if old.connection_id is not null then
    if (new.id, new.idempotency_key, new.campaign_id, new.policy_version, new.membership_id,
        new.email_message_id, new.sequence_id, new.account_id, new.connection_id, new.london_day,
        new.reserved_at, new.grant_epoch, new.rfc_message_id, new.recipient_count,
        new.authority_fingerprint, new.lease_token, new.lease_until, new.fence)
       is distinct from
       (old.id, old.idempotency_key, old.campaign_id, old.policy_version, old.membership_id,
        old.email_message_id, old.sequence_id, old.account_id, old.connection_id, old.london_day,
        old.reserved_at, old.grant_epoch, old.rfc_message_id, old.recipient_count,
        old.authority_fingerprint, old.lease_token, old.lease_until, old.fence) then
      raise exception 'reservation authority is immutable';
    end if;
    if (old.submitted_at is not null and new.submitted_at is distinct from old.submitted_at) or
       (old.provider_message_id is not null and new.provider_message_id is distinct from old.provider_message_id) or
       (old.provider_thread_id is not null and new.provider_thread_id is distinct from old.provider_thread_id) or
       (old.actual_sent_at is not null and new.actual_sent_at is distinct from old.actual_sent_at) then
      raise exception 'reservation evidence is immutable';
    end if;
    if not (new.status = old.status or
      (old.status = 'reserved' and new.status in ('submitting','cancelled')) or
      (old.status = 'submitting' and new.status in ('accepted','uncertain','rejected')) or
      (old.status = 'uncertain' and new.status = 'accepted')) then
      raise exception 'invalid reservation transition';
    end if;
  end if;
  return new;
end $$;
create trigger protect_outreach_reservation_authority before update on growth.outreach_reservations
for each row execute function growth.protect_outreach_reservation_authority();
