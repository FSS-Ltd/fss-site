-- Approved welcome material is projected through portal membership checks.
-- No portal table grant exposes recipients, billing identifiers or approval emails.
create function operations.read_client_welcome_packet(target_organisation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = '' as $$
begin
  if current_setting('role', true) is distinct from 'operations_portal'
    or not operations.portal_has_membership(target_organisation, array['owner', 'contributor', 'viewer']) then
    raise exception 'Welcome packet is unavailable.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'approvalId', a.id,
      'approvedAt', a.approved_at,
      'content', a.snapshot -> 'content'
    )
    from operations.onboarding_journeys j
    join operations.onboarding_approvals a
      on a.organisation_id = j.organisation_id and a.id = j.approval_id
    where j.organisation_id = target_organisation and j.state <> 'cancelled'
    order by a.approved_at desc, a.id desc
    limit 1
  );
end;
$$;

create function operations.read_client_welcome_packet_pdf(target_organisation uuid, target_approval uuid)
returns table(pdf bytea, pdf_hash text)
language plpgsql
stable
security definer
set search_path = '' as $$
begin
  if current_setting('role', true) is distinct from 'operations_portal'
    or not operations.portal_has_membership(target_organisation, array['owner', 'contributor', 'viewer']) then
    raise exception 'Welcome packet is unavailable.' using errcode = '42501';
  end if;
  return query
    select a.pdf, a.pdf_hash
    from operations.onboarding_journeys j
    join operations.onboarding_approvals a
      on a.organisation_id = j.organisation_id and a.id = j.approval_id
    where j.organisation_id = target_organisation
      and a.id = target_approval and j.state <> 'cancelled';
end;
$$;

revoke all on function operations.read_client_welcome_packet(uuid),
  operations.read_client_welcome_packet_pdf(uuid, uuid)
  from public, anon, authenticated, service_role, growth_app, operations_founder, operations_onboarding_worker;
grant execute on function operations.read_client_welcome_packet(uuid),
  operations.read_client_welcome_packet_pdf(uuid, uuid)
  to operations_portal;
