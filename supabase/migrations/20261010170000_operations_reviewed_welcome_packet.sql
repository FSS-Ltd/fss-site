-- Check packet provenance and reviewed draft content without exposing protected
-- onboarding tables to the founder database role.
create function operations.matches_reviewed_welcome_packet(
  target_organisation uuid,
  target_template_version uuid,
  target_pack_version uuid,
  target_draft uuid,
  target_agreement uuid,
  target_contact uuid,
  target_welcome jsonb
)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform operations.assert_onboarding_founder();
  return exists (
    select 1
    from operations.onboarding_template_versions v
    join operations.onboarding_journey_drafts d
      on d.organisation_id = v.organisation_id
      and d.template_version_id = v.id
    where v.organisation_id = target_organisation
      and v.id = target_template_version
      and v.source_welcome_pack_version_id = target_pack_version
      and d.id = target_draft
      and d.agreement_id = target_agreement
      and d.contact_id = target_contact
      and d.content -> 'reviewedWelcome' = target_welcome
  );
end;
$$;

revoke all on function operations.matches_reviewed_welcome_packet(
  uuid, uuid, uuid, uuid, uuid, uuid, jsonb
) from public, anon, authenticated, service_role, growth_app,
  operations_founder, operations_portal, operations_billing_worker,
  operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.matches_reviewed_welcome_packet(
  uuid, uuid, uuid, uuid, uuid, uuid, jsonb
) to operations_founder;
