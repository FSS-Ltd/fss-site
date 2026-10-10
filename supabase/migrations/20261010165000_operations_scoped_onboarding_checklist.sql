-- Progress follows the latest client journey and its current agreement revision.
-- Manual evidence remains valid for that exact revision.
create or replace function operations.portal_onboarding_checklist(target_organisation uuid)
returns table(agreement_signed boolean,billing_ready boolean,files_ready boolean,service_ready boolean)
language plpgsql stable security definer set search_path='' as $$
declare current_journey operations.onboarding_journeys; current_agreement uuid;
begin
 if current_setting('role',true)<>'operations_portal' or
  not operations.portal_has_membership(target_organisation,array['owner','contributor','viewer']) then
  raise exception 'Portal onboarding access is unavailable.' using errcode='42501';
 end if;
 select * into current_journey from operations.onboarding_journeys
  where organisation_id=target_organisation order by created_at desc,id desc limit 1;
 current_agreement:=current_journey.agreement_id;
 if current_agreement is null then
  select p.agreement_id into current_agreement from operations.signing_approvals p
   join operations.agreements a on a.id=p.agreement_id and a.organisation_id=p.organisation_id
   where p.organisation_id=target_organisation and p.status in ('approved','completed')
    and p.revision=a.current_revision and a.status<>'withdrawn'
   order by p.created_at desc,p.id desc limit 1;
 end if;
 return query select
  exists(select 1 from operations.signature_evidence e
    join operations.agreements a on a.id=e.agreement_id and a.organisation_id=e.organisation_id
    where e.organisation_id=target_organisation and e.agreement_id=current_agreement
      and e.revision=a.current_revision),
  exists(select 1 from operations.onboarding_jobs j
    where j.organisation_id=target_organisation and j.journey_id=current_journey.id
      and j.step='invoice' and j.state='succeeded'),
  exists(select 1 from operations.documents d
    where d.organisation_id=target_organisation and d.kind='file' and d.visibility='client'
      and d.scan_status='cleared' and d.revoked_at is null
      and (d.expires_at is null or d.expires_at>clock_timestamp())),
  exists(select 1 from operations.service_instances s
    where s.organisation_id=target_organisation and s.agreement_id=current_agreement
      and s.status='active');
end $$;

create function operations.portal_current_signing_progress(target_organisation uuid)
returns table(status text,required_count integer,recorded_count integer,completion_attempts integer,failure_code text)
language plpgsql stable security definer set search_path='' as $$
begin
 if current_setting('role',true)<>'operations_portal' or
  not operations.portal_has_membership(target_organisation,array['owner','contributor','viewer']) then
  raise exception 'Portal onboarding access is unavailable.' using errcode='42501';
 end if;
 return query select p.status,jsonb_array_length(p.snapshot->'signatories'),
  (select count(*)::integer from operations.signing_signatures s where s.approval_id=p.id),
  p.completion_attempts,p.completion_failure_code
  from operations.signing_approvals p
  join operations.agreements a on a.id=p.agreement_id and a.organisation_id=p.organisation_id
  where p.organisation_id=target_organisation and p.status in ('approved','completed')
    and p.revision=a.current_revision and a.status<>'withdrawn'
    and (p.agreement_id=(select j.agreement_id from operations.onboarding_journeys j
      where j.organisation_id=target_organisation order by j.created_at desc,j.id desc limit 1)
      or not exists(select 1 from operations.onboarding_journeys j
        where j.organisation_id=target_organisation))
  order by p.created_at desc limit 1;
end $$;
create function operations.portal_current_onboarding_journey(target_organisation uuid)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare journey_id uuid;
begin
 if current_setting('role',true)<>'operations_portal' or
  not operations.portal_has_membership(target_organisation,array['owner','contributor','viewer']) then
  raise exception 'Portal onboarding access is unavailable.' using errcode='42501';
 end if;
 select id into journey_id from operations.onboarding_journeys
  where organisation_id=target_organisation order by created_at desc,id desc limit 1;
 return journey_id;
end $$;
revoke all on function operations.portal_current_signing_progress(uuid),
 operations.portal_current_onboarding_journey(uuid)
 from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,
 operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
grant execute on function operations.portal_current_signing_progress(uuid),
 operations.portal_current_onboarding_journey(uuid) to operations_portal;
