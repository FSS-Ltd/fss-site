-- Expose only client-safe, evidence-derived onboarding progress. The portal
-- never receives the underlying approvals, billing records, or recovery data.
create function operations.portal_onboarding_checklist(target_organisation uuid)
returns table(
  agreement_signed boolean,
  billing_ready boolean,
  files_ready boolean,
  service_ready boolean
)
language plpgsql
stable
security definer
set search_path = '' as $$
begin
  if current_setting('role', true) <> 'operations_portal'
    or not operations.portal_has_membership(
      target_organisation,
      array['owner', 'contributor', 'viewer']
    ) then
    raise exception 'Portal onboarding access is unavailable.' using errcode = '42501';
  end if;

  return query
    select
      exists(
        select 1
        from operations.signature_evidence e
        where e.organisation_id = target_organisation
      ) as agreement_signed,
      exists(
        select 1
        from operations.onboarding_jobs j
        where j.organisation_id = target_organisation
          and j.step = 'invoice'
          and j.state = 'succeeded'
      ) as billing_ready,
      exists(
        select 1
        from operations.documents d
        where d.organisation_id = target_organisation
          and d.kind = 'file'
          and d.visibility = 'client'
          and d.scan_status = 'cleared'
          and d.revoked_at is null
          and (d.expires_at is null or d.expires_at > clock_timestamp())
      ) as files_ready,
      exists(
        select 1
        from operations.service_instances s
        where s.organisation_id = target_organisation
          and s.status = 'active'
      ) as service_ready;
end;
$$;

revoke all on function operations.portal_onboarding_checklist(uuid)
  from public, anon, authenticated, service_role, growth_app, operations_founder,
    operations_onboarding_worker, operations_signing_worker,
    operations_billing_worker;
grant execute on function operations.portal_onboarding_checklist(uuid)
  to operations_portal;
