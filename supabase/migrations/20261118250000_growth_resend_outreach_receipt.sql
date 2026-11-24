begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table growth.resend_delivery_events
  add column outreach_reservation_id uuid references growth.outreach_reservations(id) on delete restrict,
  add column outreach_connection_id uuid references growth.integration_connections(id) on delete restrict,
  add column outreach_webhook_generation uuid,
  add column outreach_body_sha256 text,
  add column outreach_rfc_message_id text,
  add constraint resend_outreach_event_shape check ((
    (outreach_reservation_id is null and outreach_connection_id is null and outreach_webhook_generation is null and outreach_body_sha256 is null and outreach_rfc_message_id is null)
    or (outreach_reservation_id is not null and outreach_connection_id is not null and outreach_webhook_generation is not null
      and outreach_body_sha256 ~ '^[a-f0-9]{64}$' and length(outreach_rfc_message_id) between 3 and 998 and event_type='email.delivered' and email_message_id is not null and newsletter_send_id is null)
  ) is true);
create unique index resend_outreach_event_reservation_idx on growth.resend_delivery_events(outreach_reservation_id) where outreach_reservation_id is not null;
create unique index resend_outreach_event_rfc_idx on growth.resend_delivery_events(outreach_connection_id,outreach_rfc_message_id) where outreach_reservation_id is not null;

alter table growth.outreach_reservations drop constraint reservation_confirmation_pair;
alter table growth.outreach_reservations add constraint reservation_confirmation_pair check ((
  (confirmation_receipt is null and confirmation_observed_at is null)
  or (confirmation_receipt is not null and jsonb_typeof(confirmation_receipt)='object' and confirmation_observed_at is not null and issued_snapshot is not null
    and case when outreach_provider='resend' then
      (status='accepted' and direct_submission_evidence is not null and actual_sent_at is null and grant_epoch is null and rfc_message_id is null and provider_thread_id is null
      and confirmation_receipt - array['basis','providerMessageId','providerEventId','bodySha256','rfcMessageId','connectionId','webhookGeneration','sendGeneration','providerEventCreatedAt','providerMessageCreatedAt','observedAt','possibleInvocationFrom']='{}'::jsonb
      and confirmation_receipt->>'basis'='resend_fss_delivery_observed'
      and confirmation_receipt->>'providerMessageId'=provider_message_id
      and confirmation_receipt->>'connectionId'=connection_id::text
      and confirmation_receipt->>'sendGeneration'=resend_send_generation::text
      and confirmation_receipt->>'providerEventId' ~ '^[A-Za-z0-9_-]+$' and length(confirmation_receipt->>'providerEventId') between 1 and 256
      and confirmation_receipt->>'bodySha256' ~ '^[a-f0-9]{64}$'
      and length(confirmation_receipt->>'rfcMessageId') between 3 and 998
      and confirmation_receipt->>'webhookGeneration' ~ '^[0-9a-f-]{36}$'
      and (confirmation_receipt->>'observedAt')::timestamptz=confirmation_observed_at
      and (confirmation_receipt->>'possibleInvocationFrom')::timestamptz=date_trunc('milliseconds',submitted_at)
      and (confirmation_receipt->>'providerEventCreatedAt')::timestamptz between submitted_at and confirmation_observed_at
      and (confirmation_receipt->>'providerMessageCreatedAt' is null or (confirmation_receipt->>'providerMessageCreatedAt')::timestamptz between submitted_at and (confirmation_receipt->>'providerEventCreatedAt')::timestamptz))
    else
      (confirmation_receipt->>'basis'='gmail_fss_sent_observed'
        and confirmation_receipt->>'googleSubject'=issued_snapshot->>'googleSubject'
        and confirmation_receipt->>'providerMessageId'=provider_message_id
        and confirmation_receipt->>'providerThreadId'=provider_thread_id
        and confirmation_receipt->>'rfcMessageId'=rfc_message_id
        and confirmation_receipt->>'rawSha256'=issued_snapshot_hash
        and (confirmation_receipt->>'observationGrantEpoch') ~ '^[1-9][0-9]*$'
        and (confirmation_receipt->>'observedFrom')::timestamptz <= confirmation_observed_at
        and (confirmation_receipt->>'providerCreatedAt')::timestamptz <= confirmation_observed_at
        and (confirmation_receipt->>'observedUntil')::timestamptz=confirmation_observed_at)
    end)
) is true);

create function growth.protect_resend_outreach_event() returns trigger language plpgsql set search_path='' as $$
begin
  if old.outreach_reservation_id is not null then raise exception 'outreach delivery evidence is immutable'; end if;
  if new.outreach_reservation_id is not null then raise exception 'historical delivery event attribution is immutable'; end if;
  return new;
end $$;
create trigger protect_resend_outreach_event before update on growth.resend_delivery_events
  for each row execute function growth.protect_resend_outreach_event();
commit;
