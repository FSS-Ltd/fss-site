-- Read reviewed engagement details only in staff-scoped agreement workflows.
create function operations.staff_reviewed_engagements(target_organisation uuid)
returns table(id uuid, name text, primary_goal text, proposed_scope text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform operations.assert_active_staff_membership();
  return query
    select e.id, e.name, r.primary_goal, r.proposed_scope
    from operations.engagement_links l
    join growth.delivery_engagements e on e.id = l.engagement_id
    left join operations.studio_engagement_reviews r
      on r.organisation_id = l.organisation_id and r.engagement_id = l.engagement_id
    where l.organisation_id = target_organisation
    order by e.name, e.id
    limit 101;
end;
$$;

revoke all on function operations.staff_reviewed_engagements(uuid)
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.staff_reviewed_engagements(uuid)
  to operations_founder;

-- Counts remain separate from created agreement records.
create index agreement_builder_drafts_unfinished_by_organisation
  on operations.agreement_builder_drafts (organisation_id)
  where finalised_at is null;

create function operations.staff_agreement_builder_draft_counts()
returns table(organisation_id uuid, builder_draft_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform operations.assert_active_staff_membership();
  return query
    select d.organisation_id, count(*)
    from operations.agreement_builder_drafts d
    where d.finalised_at is null
    group by d.organisation_id;
end;
$$;
revoke all on function operations.staff_agreement_builder_draft_counts()
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.staff_agreement_builder_draft_counts()
  to operations_founder;

-- Selecting existing reviewed work now copies its goal and scope into a new draft.
create or replace function operations.complete_staff_engagement_command(
  target_organisation uuid,
  command jsonb,
  command_correlation uuid
)
returns table(engagement_id uuid, draft_id uuid, draft_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  command_key uuid := nullif(command ->> 'commandId', '')::uuid;
  operation text := command ->> 'action';
  selected_engagement uuid;
  saved_draft operations.agreement_builder_drafts;
  prior operations.staff_engagement_commands;
  new_engagement uuid;
  new_draft uuid;
  next_version integer;
  review_reference text;
  engagement_name text;
  reviewed_goal text;
  reviewed_scope text;
  agreement_content jsonb;
begin
  perform operations.assert_active_staff_membership();
  if actor is null or actor !~ '^[a-f0-9]{64}$' or command_key is null
    or command_correlation is null then
    raise exception 'Staff authorization is required.' using errcode = '42501';
  end if;
  if operation not in ('create', 'select') or target_organisation is null then
    raise exception 'Engagement command is invalid.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(command_key::text, 0));
  if not exists (
    select 1 from operations.organisations o
    where o.id = target_organisation and o.lifecycle = 'active'
  ) then
    raise exception 'Client organisation is unavailable.' using errcode = 'P0002';
  end if;

  select * into prior from operations.staff_engagement_commands c
  where c.command_id = command_key for update;
  if found then
    if prior.organisation_id <> target_organisation or prior.actor_id <> actor
      or prior.command <> command then
      raise exception 'Engagement command identity was reused.' using errcode = 'P0001';
    end if;
    return query select prior.engagement_id, prior.draft_id, prior.draft_version;
    return;
  end if;

  selected_engagement := nullif(command ->> 'engagementId', '')::uuid;
  if operation = 'select' then
    if selected_engagement is null or not exists (
      select 1 from operations.engagement_links l
      where l.organisation_id = target_organisation
        and l.engagement_id = selected_engagement
    ) then
      raise exception 'Reviewed engagement is unavailable.' using errcode = '23503';
    end if;
    review_reference := 'studio-engagement-selected';
    select e.name, r.primary_goal, r.proposed_scope
      into engagement_name, reviewed_goal, reviewed_scope
    from operations.engagement_links l
    join growth.delivery_engagements e on e.id = l.engagement_id
    left join operations.studio_engagement_reviews r
      on r.organisation_id = l.organisation_id and r.engagement_id = l.engagement_id
    where l.organisation_id = target_organisation
      and l.engagement_id = selected_engagement;
  else
    if command ->> 'reviewed' is distinct from 'true'
      or length(trim(coalesce(command ->> 'name', ''))) not between 1 and 200
      or length(trim(coalesce(command ->> 'primaryGoal', ''))) not between 1 and 4000
      or length(trim(coalesce(command ->> 'proposedScope', ''))) not between 1 and 4000
      or length(trim(coalesce(command ->> 'reviewReference', ''))) not between 1 and 200 then
      raise exception 'Engagement review details are invalid.' using errcode = '22023';
    end if;
    review_reference := trim(command ->> 'reviewReference');
    engagement_name := trim(command ->> 'name');
    reviewed_goal := trim(command ->> 'primaryGoal');
    reviewed_scope := trim(command ->> 'proposedScope');
    insert into growth.delivery_engagements (
      prospect_id, studio_organisation_id, stage, name, delivery_status
    ) values (
      null, target_organisation, 'negotiation', engagement_name, 'not_started'
    ) returning id into selected_engagement;
    insert into operations.engagement_links (
      engagement_id, organisation_id, created_by, review_reference
    ) values (selected_engagement, target_organisation, actor, review_reference);
    insert into operations.studio_engagement_reviews (
      organisation_id, engagement_id, primary_goal, proposed_scope,
      review_reference, reviewed_by
    ) values (
      target_organisation, selected_engagement, trim(command ->> 'primaryGoal'),
      trim(command ->> 'proposedScope'), review_reference, actor
    );
    insert into growth.commercial_stage_events (
      engagement_id, dimension, from_state, to_state, reason_code,
      actor_type, actor_id, correlation_id
    ) values (
      selected_engagement, 'commercial', 'new', 'negotiation',
      'studio_engagement_reviewed', 'system', actor, command_correlation::text
    );
  end if;

  if command ? 'draftId' then
    select * into saved_draft from operations.agreement_builder_drafts d
    where d.id = (command ->> 'draftId')::uuid for update;
    if not found or saved_draft.organisation_id <> target_organisation
      or saved_draft.version <> (command ->> 'expectedVersion')::integer
      or saved_draft.finalised_at is not null then
      raise exception 'Agreement draft changed.' using errcode = '40001';
    end if;
    new_draft := saved_draft.id;
    next_version := saved_draft.version + 1;
    if saved_draft.engagement_id is not null
      and saved_draft.engagement_id is distinct from selected_engagement then
      agreement_content := jsonb_strip_nulls(jsonb_build_object(
        'currency', saved_draft.content #> '{agreement,currency}',
        'title', engagement_name, 'goals', reviewed_goal, 'scope', reviewed_scope
      ));
    else
      agreement_content := coalesce(saved_draft.content -> 'agreement', '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object(
          'title', coalesce(saved_draft.content #> '{agreement,title}', to_jsonb(engagement_name)),
          'goals', coalesce(saved_draft.content #> '{agreement,goals}', to_jsonb(reviewed_goal)),
          'scope', coalesce(saved_draft.content #> '{agreement,scope}', to_jsonb(reviewed_scope))
        ));
    end if;
    update operations.agreement_builder_drafts d
    set engagement_id = selected_engagement,
      content = case
        when saved_draft.engagement_id is not null
          and saved_draft.engagement_id is distinct from selected_engagement then
          jsonb_build_object('engagementId', selected_engagement::text, 'agreement', agreement_content)
        else jsonb_set(
          jsonb_set(d.content, '{engagementId}', to_jsonb(selected_engagement::text), true),
          '{agreement}', agreement_content, true
        )
      end,
      step = 'scope', version = next_version, updated_at = clock_timestamp()
    where d.id = new_draft;
  else
    new_draft := gen_random_uuid();
    next_version := 1;
    agreement_content := jsonb_strip_nulls(jsonb_build_object(
      'title', engagement_name, 'goals', reviewed_goal, 'scope', reviewed_scope
    ));
    insert into operations.agreement_builder_drafts (
      id, organisation_id, engagement_id, step, content, version, created_by
    ) values (
      new_draft, target_organisation, selected_engagement, 'scope',
      jsonb_build_object(
        'engagementId', selected_engagement::text,
        'agreement', agreement_content
      ), 1, actor
    );
  end if;

  insert into operations.audit_events (
    organisation_id, actor_id, action, entity_id, review_reference,
    correlation_id, entity_version
  ) values (
    target_organisation, actor, 'agreement.draft_saved', new_draft,
    review_reference, command_correlation, next_version
  );
  insert into operations.staff_engagement_commands (
    command_id, organisation_id, actor_id, command, engagement_id,
    draft_id, draft_version
  ) values (
    command_key, target_organisation, actor, command, selected_engagement,
    new_draft, next_version
  );
  return query select selected_engagement, new_draft, next_version;
end;
$$;
