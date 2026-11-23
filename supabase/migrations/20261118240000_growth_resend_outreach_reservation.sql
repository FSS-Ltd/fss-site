begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Existing NULL provider values remain untouched. Bound historical rows are
-- subject to their original Gmail constraints; unbound rows remain unknown.
alter table growth.outreach_reservations
  add column outreach_provider growth.integration_provider,
  add column resend_send_generation uuid,
  add constraint reservation_explicit_provider_check
    check (outreach_provider is null or outreach_provider in ('gmail','resend')),
  add constraint reservation_explicit_provider_fk foreign key (connection_id,outreach_provider)
    references growth.integration_connections(id,provider) on delete restrict;

alter table growth.outreach_reservations
  drop constraint outreach_reservation_authority_fields,
  add constraint outreach_reservation_authority_fields check ((
    (outreach_provider is null and connection_id is null and resend_send_generation is null)
    or
    (coalesce(outreach_provider,'gmail'::growth.integration_provider)='gmail'
      and connection_id is not null and resend_send_generation is null
      and grant_epoch is not null and rfc_message_id is not null and length(trim(rfc_message_id)) > 0
      and recipient_count is not null and authority_fingerprint is not null
      and lease_token is not null and lease_until is not null
      and (status not in ('submitting','accepted','rejected','uncertain') or submitted_at is not null)
      and (status <> 'accepted' or (provider_message_id is not null and provider_thread_id is not null))
      and (status not in ('reserved','cancelled') or submitted_at is null)
      and status <> 'sent'
      and (actual_sent_at is null or status = 'accepted'))
    or
    (outreach_provider='resend' and connection_id is not null and account_id=connection_id::text
      and campaign_id is not null and policy_version is not null and membership_id is not null
      and resend_send_generation is not null and grant_epoch is null and rfc_message_id is null
      and provider_thread_id is null and actual_sent_at is null and recipient_count=1
      and authority_fingerprint is not null and lease_token is not null and lease_until is not null
      and (status not in ('submitting','accepted','rejected','uncertain') or (submitted_at is not null and issued_snapshot is not null))
      and (status <> 'accepted' or (provider_message_id is not null and direct_submission_evidence is not null))
      and (status <> 'rejected' or direct_noninvocation_evidence is not null)
      and (status not in ('reserved','cancelled') or submitted_at is null)
      and status <> 'sent')
  ) is true);

alter table growth.outreach_reservations
  drop constraint reservation_issued_snapshot_pair,
  add constraint reservation_issued_snapshot_pair check ((
    (issued_snapshot is null and issued_snapshot_hash is null)
    or
    (issued_snapshot is not null and issued_snapshot_hash is not null and jsonb_typeof(issued_snapshot)='object'
      and issued_snapshot_hash ~ '^[a-f0-9]{64}$'
      and (case when outreach_provider='resend' then
        (outreach_provider='resend'
          and issued_snapshot->>'version'='1' and issued_snapshot->>'kind'='resend_json'
          and issued_snapshot - array['version','kind','rawBody','bodySha256','accountId','connectionId','sendGeneration','idempotencyKey','messageId','sequenceId','membershipId','from','replyTo','recipient','campaign']='{}'::jsonb
          and octet_length(issued_snapshot->>'rawBody') between 1 and 1048576
          and encode(sha256(convert_to(issued_snapshot->>'rawBody','UTF8')),'hex')=issued_snapshot_hash
          and issued_snapshot->>'bodySha256'=issued_snapshot_hash
          and issued_snapshot->>'accountId'=account_id and issued_snapshot->>'connectionId'=connection_id::text
          and issued_snapshot->>'sendGeneration'=resend_send_generation::text and issued_snapshot->>'idempotencyKey'=idempotency_key
          and idempotency_key ~ '^[A-Za-z0-9_/-]+$' and length(idempotency_key) between 1 and 256
          and issued_snapshot->>'messageId'=email_message_id::text and issued_snapshot->>'sequenceId'=sequence_id::text
          and issued_snapshot->>'membershipId'=membership_id::text
          and length(trim(issued_snapshot->>'from'))>0 and issued_snapshot->>'from'=lower(trim(issued_snapshot->>'from'))
          and length(trim(issued_snapshot->>'replyTo'))>0 and issued_snapshot->>'replyTo'=lower(trim(issued_snapshot->>'replyTo'))
          and length(trim(issued_snapshot->>'recipient'))>0 and issued_snapshot->>'recipient'=lower(trim(issued_snapshot->>'recipient'))
          and (issued_snapshot->>'rawBody')::jsonb ->> 'from'=issued_snapshot->>'from'
          and (issued_snapshot->>'rawBody')::jsonb -> 'to'=jsonb_build_array(issued_snapshot->>'recipient')
          and (issued_snapshot->>'rawBody')::jsonb ->> 'reply_to'=issued_snapshot->>'replyTo'
          and jsonb_typeof((issued_snapshot->>'rawBody')::jsonb -> 'subject')='string'
          and length(trim((issued_snapshot->>'rawBody')::jsonb ->> 'subject')) between 1 and 320
          and (issued_snapshot->>'rawBody')::jsonb ->> 'subject' !~ '[[:cntrl:]]'
          and jsonb_typeof((issued_snapshot->>'rawBody')::jsonb -> 'html')='string'
          and length((issued_snapshot->>'rawBody')::jsonb ->> 'html')>0
          and jsonb_typeof((issued_snapshot->>'rawBody')::jsonb -> 'text')='string'
          and length((issued_snapshot->>'rawBody')::jsonb ->> 'text')>0
          and (issued_snapshot->>'rawBody')::jsonb - array['from','to','reply_to','subject','html','text','headers']='{}'::jsonb
          and jsonb_typeof(issued_snapshot->'campaign')='object'
          and (issued_snapshot->'campaign') - array['campaignId','policyVersion','membershipId','businessId','market','offer','commercialTerms','cadenceFamily','variantId','variantVersion','copySha256','assignment','permissionId','sourceProof','reviewedRecipient','effectiveRecipient']='{}'::jsonb
          and issued_snapshot->'campaign'->>'campaignId'=campaign_id::text
          and issued_snapshot->'campaign'->>'policyVersion'=policy_version::text
          and issued_snapshot->'campaign'->>'membershipId'=membership_id::text)
      else
        (coalesce(outreach_provider,'gmail'::growth.integration_provider)='gmail'
          and issued_snapshot->>'version'='1' and issued_snapshot->>'kind'='direct_raw'
          and length(issued_snapshot->>'raw') between 1 and 4000000 and issued_snapshot->>'raw' ~ '^[A-Za-z0-9_-]+$'
          and issued_snapshot->>'rawSha256'=issued_snapshot_hash
          and length(trim(issued_snapshot->>'from'))>0 and issued_snapshot->>'from'=lower(trim(issued_snapshot->>'from'))
          and issued_snapshot->>'connectionId'=connection_id::text and issued_snapshot->>'grantEpoch'=grant_epoch::text
          and length(trim(issued_snapshot->>'googleSubject'))>0 and issued_snapshot->>'rfcMessageId'=rfc_message_id
          and issued_snapshot->>'messageId'=email_message_id::text and issued_snapshot->>'sequenceId'=sequence_id::text
          and coalesce(issued_snapshot->>'membershipId','')=coalesce(membership_id::text,'')
          and jsonb_typeof(issued_snapshot->'envelope'->'to')='array' and jsonb_array_length(issued_snapshot->'envelope'->'to')=1
          and issued_snapshot->'envelope'->'cc'='[]'::jsonb and issued_snapshot->'envelope'->'bcc'='[]'::jsonb)
      end)
      )
  ) is true);

alter table growth.outreach_reservations
  drop constraint direct_submission_evidence_identity,
  add constraint direct_submission_evidence_identity check ((
    direct_submission_evidence is null or (
      issued_snapshot is not null and status='accepted' and provider_message_id is not null
      and length(provider_message_id) between 1 and 256 and provider_message_id !~ '[[:cntrl:]]'
      and provider_message_id=trim(provider_message_id)
      and (
        (coalesce(outreach_provider,'gmail'::growth.integration_provider)='gmail'
          and provider_thread_id is not null and length(provider_thread_id) between 1 and 256
          and provider_thread_id !~ '[[:cntrl:]]' and provider_thread_id=trim(provider_thread_id)
          and direct_submission_evidence=jsonb_build_object(
            'version',1,'kind','gmail_api_send_message_v1','reservationId',id::text,'accountId',account_id,
            'connectionId',connection_id::text,'googleSubject',issued_snapshot->>'googleSubject','grantEpoch',grant_epoch,
            'rfcMessageId',rfc_message_id,'rawSha256',issued_snapshot_hash,
            'providerMessageId',provider_message_id,'providerThreadId',provider_thread_id))
        or
        (outreach_provider='resend' and provider_thread_id is null and provider_message_id ~ '^[A-Za-z0-9_-]+$'
          and direct_submission_evidence=jsonb_build_object(
            'version',1,'kind','resend_api_send_email_v1','reservationId',id::text,'accountId',account_id,
            'connectionId',connection_id::text,'sendGeneration',resend_send_generation::text,
            'idempotencyKey',idempotency_key,'bodySha256',issued_snapshot_hash,'providerMessageId',provider_message_id))
      )
    )
  ) is true);

alter table growth.outreach_reservations
  drop constraint direct_noninvocation_identity,
  add constraint direct_noninvocation_identity check ((
    direct_noninvocation_evidence is null or (
      status='rejected' and issued_snapshot is not null and direct_submission_evidence is null and (
        (coalesce(outreach_provider,'gmail'::growth.integration_provider)='gmail'
          and direct_noninvocation_evidence->>'reason' in ('invalid_input','guard_rejected','credential_preparation_failed')
          and direct_noninvocation_evidence=jsonb_build_object('version',1,'kind','gmail_send_not_invoked_v1','reservationId',id::text,'reason',direct_noninvocation_evidence->>'reason'))
        or
        (outreach_provider='resend' and direct_noninvocation_evidence=jsonb_build_object(
          'version',1,'kind','resend_send_not_invoked_v1','reservationId',id::text,'reason','guard_or_input_rejected'))
      )
    )
  ) is true);

create function growth.protect_reservation_provider_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' and (new.outreach_provider,new.resend_send_generation) is distinct from (old.outreach_provider,old.resend_send_generation) then
    raise exception 'reservation provider identity is immutable';
  end if;
  if tg_op='INSERT' and new.connection_id is not null and not exists (
    select 1 from growth.integration_connections c join growth.email_messages m on m.id=new.email_message_id
    where c.id=new.connection_id and c.provider=coalesce(new.outreach_provider,'gmail'::growth.integration_provider)
      and m.channel=c.provider::text and m.direction='outbound'
  ) then raise exception 'reservation provider connection or channel mismatch'; end if;
  if tg_op='UPDATE' and new.outreach_provider='resend' and old.issued_snapshot is null
    and new.issued_snapshot is not null and not exists (
      select 1 from growth.integration_connections c
      join growth.outreach_account_controls a on a.connection_id=c.id and a.provider='resend'
      join growth.outreach_account_reviews r on r.id=a.resend_binding_review_id and r.connection_id=c.id
        and r.kind='resend_configure' and r.evidence->'binding'=a.resend_binding
        and r.actor_id=encode(sha256(convert_to('j.ntagengwa@faithfulsoftware.dev','UTF8')),'hex')
      where c.id=new.connection_id and c.provider='resend' and a.state='active'
        and c.subject_email=new.issued_snapshot->>'from'
        and a.resend_binding->>'sender'=new.issued_snapshot->>'from'
        and a.resend_binding->>'replyTo'=new.issued_snapshot->>'replyTo'
        and a.resend_binding->>'sendGeneration'=new.resend_send_generation::text
    ) then raise exception 'resend issued account binding is not current'; end if;
  return new;
end $$;
create trigger protect_reservation_provider_identity before insert or update on growth.outreach_reservations
for each row execute function growth.protect_reservation_provider_identity();
commit;
