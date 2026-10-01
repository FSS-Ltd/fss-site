-- Allow reviewed Studio work to exist for clients without a Growth prospect.
-- Prospect-backed engagements keep their existing IDs and agreement links.
alter table growth.delivery_engagements
  drop constraint delivery_engagement_won_requires_value_and_timestamp;
alter table growth.delivery_engagements
  alter column prospect_id drop not null;
alter table growth.delivery_engagements
  add column studio_organisation_id uuid
    references operations.organisations(id) on delete restrict;
alter table growth.delivery_engagements
  add constraint delivery_engagement_source_check
    check ((prospect_id is null) = (studio_organisation_id is not null));
alter table growth.delivery_engagements
  add constraint delivery_engagement_won_requires_value_and_timestamp check (
    stage <> 'won' or (
      won_at is not null
      and coalesce(one_off_value_pence, 0) + coalesce(monthly_value_pence, 0) > 0
    )
  );
drop index if exists growth.unique_engagement_prospect;
create unique index unique_engagement_prospect
  on growth.delivery_engagements (prospect_id) where prospect_id is not null;
create index studio_engagements_by_organisation
  on growth.delivery_engagements (studio_organisation_id, updated_at desc)
  where studio_organisation_id is not null;

-- The RETURNS TABLE column `id` shadows the draft table column in the earlier
-- function body. Qualify the lookup so staff can create their first draft.
create or replace function operations.save_agreement_builder_draft(
  draft_id uuid,
  target_organisation uuid,
  target_step text,
  target_content jsonb,
  expected_version integer
)
returns table(
  id uuid,
  organisation_id uuid,
  engagement_id uuid,
  step text,
  content jsonb,
  version integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  selected_engagement uuid;
  stored operations.agreement_builder_drafts;
begin
  perform operations.assert_active_staff_membership();
  if actor is null or actor !~ '^[a-f0-9]{64}$' then
    raise exception 'Staff authorization is required.' using errcode = '42501';
  end if;
  if draft_id is null or target_organisation is null or expected_version is null
    or expected_version < 0 or target_step is null
    or target_step not in ('link', 'scope', 'fees', 'people', 'document', 'review')
    or target_content is null or jsonb_typeof(target_content) <> 'object' then
    raise exception 'Agreement draft is invalid.' using errcode = '22023';
  end if;
  if target_content ? 'engagementId' and (
    jsonb_typeof(target_content -> 'engagementId') <> 'string'
    or target_content ->> 'engagementId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'Agreement draft is invalid.' using errcode = '22023';
  end if;
  selected_engagement := nullif(target_content ->> 'engagementId', '')::uuid;
  if selected_engagement is not null and not exists (
    select 1 from operations.engagement_links as link
    where link.organisation_id = target_organisation
      and link.engagement_id = selected_engagement
  ) then
    raise exception 'Reviewed engagement is unavailable.' using errcode = '23503';
  end if;
  select * into stored
  from operations.agreement_builder_drafts as draft
  where draft.id = draft_id
  for update;
  if not found then
    if expected_version <> 0 then
      raise exception 'Agreement draft changed.' using errcode = '40001';
    end if;
    insert into operations.agreement_builder_drafts (
      id, organisation_id, engagement_id, step, content, version, created_by
    ) values (
      draft_id, target_organisation, selected_engagement, target_step,
      target_content, 1, actor
    ) returning * into stored;
  else
    if stored.organisation_id <> target_organisation
      or stored.version <> expected_version
      or stored.finalised_at is not null then
      raise exception 'Agreement draft changed.' using errcode = '40001';
    end if;
    update operations.agreement_builder_drafts as draft
    set engagement_id = selected_engagement,
        step = target_step,
        content = target_content,
        version = draft.version + 1,
        updated_at = clock_timestamp()
    where draft.id = draft_id
    returning * into stored;
  end if;
  insert into operations.audit_events (
    organisation_id, actor_id, action, entity_id, review_reference,
    correlation_id, entity_version
  ) values (
    stored.organisation_id, actor, 'agreement.draft_saved', stored.id,
    'fss-studio-agreement-builder',
    nullif(current_setting('operations.correlation_id', true), '')::uuid,
    stored.version
  );
  id := stored.id;
  organisation_id := stored.organisation_id;
  engagement_id := stored.engagement_id;
  step := stored.step;
  content := stored.content;
  version := stored.version;
  created_at := stored.created_at;
  updated_at := stored.updated_at;
  return next;
end;
$$;

create or replace function operations.load_agreement_builder_draft(
  draft_id uuid,
  target_organisation uuid,
  expected_version integer default null
)
returns table(
  id uuid,
  organisation_id uuid,
  engagement_id uuid,
  step text,
  content jsonb,
  version integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored operations.agreement_builder_drafts;
begin
  perform operations.assert_active_staff_membership();
  if draft_id is null or target_organisation is null
    or (expected_version is not null and expected_version < 1) then
    raise exception 'Agreement draft is invalid.' using errcode = '22023';
  end if;
  if expected_version is null then
    select * into stored
    from operations.agreement_builder_drafts as draft
    where draft.id = draft_id and draft.organisation_id = target_organisation;
  else
    select * into stored
    from operations.agreement_builder_drafts as draft
    where draft.id = draft_id and draft.organisation_id = target_organisation
    for update;
  end if;
  if not found or stored.finalised_at is not null then
    raise exception 'Agreement draft is unavailable.' using errcode = 'P0002';
  end if;
  if expected_version is not null and stored.version <> expected_version then
    raise exception 'Agreement draft changed.' using errcode = '40001';
  end if;
  id := stored.id;
  organisation_id := stored.organisation_id;
  engagement_id := stored.engagement_id;
  step := stored.step;
  content := stored.content;
  version := stored.version;
  created_at := stored.created_at;
  updated_at := stored.updated_at;
  return next;
end;
$$;

create table operations.studio_engagement_reviews (
  organisation_id uuid not null,
  engagement_id uuid not null,
  primary_goal text not null check (length(trim(primary_goal)) between 1 and 4000),
  proposed_scope text not null check (length(trim(proposed_scope)) between 1 and 4000),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  reviewed_by text not null check (reviewed_by ~ '^[a-f0-9]{64}$'),
  reviewed_at timestamptz not null default clock_timestamp(),
  primary key (organisation_id, engagement_id),
  foreign key (organisation_id, engagement_id)
    references operations.engagement_links(organisation_id, engagement_id)
    on delete restrict
);
alter table operations.studio_engagement_reviews enable row level security;
alter table operations.studio_engagement_reviews force row level security;
revoke all on operations.studio_engagement_reviews
  from public, anon, authenticated, service_role, growth_app, operations_founder,
    operations_portal, operations_billing_worker, operations_signing_worker,
    operations_onboarding_worker;

create table operations.staff_engagement_commands (
  command_id uuid primary key,
  organisation_id uuid not null references operations.organisations(id) on delete restrict,
  actor_id text not null check (actor_id ~ '^[a-f0-9]{64}$'),
  command jsonb not null check (jsonb_typeof(command) = 'object'),
  engagement_id uuid not null references growth.delivery_engagements(id) on delete restrict,
  draft_id uuid not null references operations.agreement_builder_drafts(id) on delete restrict,
  draft_version integer not null check (draft_version > 0),
  created_at timestamptz not null default clock_timestamp()
);
alter table operations.staff_engagement_commands enable row level security;
alter table operations.staff_engagement_commands force row level security;
revoke all on operations.staff_engagement_commands
  from public, anon, authenticated, service_role, growth_app, operations_founder,
    operations_portal, operations_billing_worker, operations_signing_worker,
    operations_onboarding_worker;

create function operations.complete_staff_engagement_command(
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
    agreement_content := coalesce(saved_draft.content -> 'agreement', '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
        'title', coalesce(saved_draft.content #> '{agreement,title}', to_jsonb(engagement_name)),
        'goals', coalesce(saved_draft.content #> '{agreement,goals}', to_jsonb(reviewed_goal)),
        'scope', coalesce(saved_draft.content #> '{agreement,scope}', to_jsonb(reviewed_scope))
      ));
    update operations.agreement_builder_drafts d
    set engagement_id = selected_engagement,
      content = jsonb_set(
        jsonb_set(d.content, '{engagementId}', to_jsonb(selected_engagement::text), true),
        '{agreement}', agreement_content, true
      ),
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

revoke all on function operations.complete_staff_engagement_command(uuid, jsonb, uuid)
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.complete_staff_engagement_command(uuid, jsonb, uuid)
  to operations_founder;
