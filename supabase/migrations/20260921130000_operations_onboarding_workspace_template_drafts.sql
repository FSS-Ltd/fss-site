-- Staff template editing needs the latest draft version as well as immutable
-- published versions. This remains available only through the scoped workspace
-- reader, never direct table access.
create or replace function operations.read_onboarding_workspace(target_organisation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = '' as $$
declare
  is_founder boolean := coalesce(current_setting('role', true) = 'operations_founder'
    and current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$', false);
  is_portal boolean := coalesce(current_setting('role', true) = 'operations_portal'
    and operations.portal_has_membership(target_organisation, array['owner', 'contributor', 'billing_contact', 'viewer']), false);
begin
  if not is_founder and not is_portal then
    raise exception 'Onboarding workspace access is unavailable.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'templates', case when is_founder then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'templateId', v.template_id, 'version', v.version,
        'name', v.title, 'tasks', v.content -> 'tasks',
        'publishedAt', v.published_at
      ) order by v.published_at desc, v.id)
      from operations.onboarding_template_versions v
      where v.organisation_id = target_organisation
    ), '[]'::jsonb) else '[]'::jsonb end,
    'templateDrafts', case when is_founder then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', template.id, 'name', template.title,
        'draftVersion', template.draft_version,
        'publishedVersion', template.published_version,
        'tasks', template.draft_content -> 'tasks'
      ) order by template.updated_at desc, template.id)
      from operations.onboarding_templates template
      where template.organisation_id = target_organisation
    ), '[]'::jsonb) else '[]'::jsonb end,
    'journeyDrafts', case when is_founder then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'agreementId', d.agreement_id, 'contactId', d.contact_id,
        'templateVersionId', d.template_version_id, 'stage', d.stage,
        'expectedAgreementVersion', (d.content ->> 'expectedAgreementVersion')::integer,
        'recipientRole', d.content ->> 'recipientRole',
        'version', d.version, 'updatedAt', d.updated_at
      ) order by d.updated_at desc, d.id)
      from operations.onboarding_journey_drafts d
      where d.organisation_id = target_organisation
    ), '[]'::jsonb) else '[]'::jsonb end,
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', task.id, 'journeyId', task.journey_id,
        'templateVersionId', task.template_version_id,
        'title', task.definition ->> 'title',
        'instructions', task.definition ->> 'instructions',
        'kind', task.definition ->> 'kind',
        'required', (task.definition ->> 'required')::boolean,
        'ownerRole', task.definition ->> 'ownerRole',
        'dueRule', task.definition ->> 'dueRule',
        'bookingUrl', case when task.definition ->> 'kind' = 'booking' then task.definition ->> 'bookingUrl' else null end,
        'state', case
          when task.state = 'completed'
            or (task.definition ->> 'evidenceRule' = 'agreement_signed' and exists (
              select 1 from operations.signature_evidence e where e.organisation_id = task.organisation_id
            ))
            or (task.definition ->> 'evidenceRule' = 'billing_ready' and exists (
              select 1 from operations.onboarding_jobs j where j.organisation_id = task.organisation_id and j.step = 'invoice' and j.state = 'succeeded'
            )) then 'complete'
          when task.definition ->> 'dependsOnTaskId' is not null and exists (
            select 1 from operations.onboarding_journey_tasks prerequisite
            where prerequisite.journey_id = task.journey_id
              and prerequisite.template_task_id = (task.definition ->> 'dependsOnTaskId')::uuid
              and prerequisite.state <> 'completed'
          ) then 'blocked'
          else 'available'
        end,
        'completionDetail', case
          when task.state = 'completed' then 'Completion recorded.'
          when task.definition ->> 'evidenceRule' = 'agreement_signed' and exists (
            select 1 from operations.signature_evidence e where e.organisation_id = task.organisation_id
          ) then 'Signed agreement recorded.'
          when task.definition ->> 'evidenceRule' = 'billing_ready' and exists (
            select 1 from operations.onboarding_jobs j where j.organisation_id = task.organisation_id and j.step = 'invoice' and j.state = 'succeeded'
          ) then 'Billing readiness recorded.'
          else null
        end
      ) order by task.created_at, task.id)
      from operations.onboarding_journey_tasks task
      where task.organisation_id = target_organisation
    ), '[]'::jsonb)
  );
end;
$$;
