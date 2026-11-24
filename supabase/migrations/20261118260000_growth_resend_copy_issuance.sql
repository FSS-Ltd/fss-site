begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
          and (issued_snapshot->'campaign') - array['campaignId','policyVersion','membershipId','businessId','market','offer','commercialTerms','cadenceFamily','variantId','variantVersion','copySha256','copyFamilyVersion','copyFamilySha256','assignment','permissionId','sourceProof','reviewedRecipient','effectiveRecipient']='{}'::jsonb
          and issued_snapshot->'campaign'->>'campaignId'=campaign_id::text
          and issued_snapshot->'campaign'->>'policyVersion'=policy_version::text
          and issued_snapshot->'campaign'->>'membershipId'=membership_id::text
          and (not (issued_snapshot->'campaign' ? 'copyFamilyVersion') or (
            issued_snapshot->'campaign'->>'copyFamilyVersion'='1'
            and issued_snapshot->'campaign'->>'copyFamilySha256' ~ '^[a-f0-9]{64}$'))
          and ((issued_snapshot->'campaign' ? 'copyFamilyVersion') = (issued_snapshot->'campaign' ? 'copyFamilySha256')))
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

commit;
