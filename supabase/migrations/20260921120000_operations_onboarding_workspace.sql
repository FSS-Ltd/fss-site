-- Versioned welcome templates and task snapshots remain inside Operations.
-- Provider receipts and browser-submitted completion timestamps are never stored
-- as onboarding task evidence.
create table operations.onboarding_templates (
  id uuid primary key,
  organisation_id uuid not null references operations.organisations(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 160),
  draft_content jsonb not null check (jsonb_typeof(draft_content) = 'object'),
  draft_version integer not null check (draft_version > 0),
  published_version integer not null default 0 check (published_version >= 0 and published_version <= draft_version),
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index onboarding_templates_scope on operations.onboarding_templates (organisation_id, updated_at desc, id);

create table operations.onboarding_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references operations.onboarding_templates(id) on delete restrict,
  organisation_id uuid not null references operations.organisations(id) on delete restrict,
  version integer not null check (version > 0),
  title text not null check (length(trim(title)) between 1 and 160),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  published_by text not null check (published_by ~ '^[a-f0-9]{64}$'),
  published_at timestamptz not null default clock_timestamp(),
  unique (template_id, version),
  unique (organisation_id, id)
);
create index onboarding_template_versions_scope on operations.onboarding_template_versions (organisation_id, published_at desc, id);

create table operations.onboarding_journey_drafts (
  id uuid primary key,
  organisation_id uuid not null,
  agreement_id uuid not null,
  contact_id uuid not null references operations.contacts(id) on delete restrict,
  template_version_id uuid not null,
  stage text not null check (stage in ('setup', 'content', 'access', 'schedule', 'activate')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  version integer not null check (version > 0),
  saved_by text not null check (saved_by ~ '^[a-f0-9]{64}$'),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (organisation_id, id),
  foreign key (organisation_id, agreement_id) references operations.agreements(organisation_id, id) on delete restrict,
  foreign key (organisation_id, template_version_id) references operations.onboarding_template_versions(organisation_id, id) on delete restrict
);
create index onboarding_journey_drafts_scope on operations.onboarding_journey_drafts (organisation_id, updated_at desc, id);

create table operations.onboarding_client_profiles (
  organisation_id uuid not null,
  user_id uuid not null,
  contact_id uuid not null references operations.contacts(id) on delete restrict,
  preferred_name text not null check (length(trim(preferred_name)) between 1 and 160),
  job_title text check (job_title is null or length(trim(job_title)) between 1 and 160),
  phone text check (phone is null or length(trim(phone)) between 3 and 50),
  completed_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (organisation_id, user_id),
  unique (organisation_id, contact_id),
  foreign key (organisation_id, contact_id) references operations.contacts(organisation_id, id) on delete restrict
);

alter table operations.onboarding_journeys
  add column onboarding_template_version_id uuid,
  add column onboarding_workspace_draft_id uuid;

create table operations.onboarding_journey_tasks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  journey_id uuid not null,
  template_version_id uuid not null,
  template_task_id uuid not null,
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  state text not null default 'pending' check (state in ('pending', 'completed')),
  evidence jsonb,
  completed_by text,
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (journey_id, template_task_id),
  unique (organisation_id, id),
  foreign key (organisation_id, journey_id) references operations.onboarding_journeys(organisation_id, id) on delete restrict,
  foreign key (organisation_id, template_version_id) references operations.onboarding_template_versions(organisation_id, id) on delete restrict,
  check ((state = 'pending' and evidence is null and completed_by is null and completed_at is null)
    or (state = 'completed' and evidence is not null and completed_by is not null and completed_at is not null))
);
create index onboarding_journey_tasks_scope on operations.onboarding_journey_tasks (organisation_id, journey_id, created_at, id);

alter table operations.onboarding_journeys
  add constraint onboarding_journeys_template_version_scope
  foreign key (organisation_id, onboarding_template_version_id)
  references operations.onboarding_template_versions(organisation_id, id) on delete restrict,
  add constraint onboarding_journeys_workspace_draft_scope
  foreign key (organisation_id, onboarding_workspace_draft_id)
  references operations.onboarding_journey_drafts(organisation_id, id) on delete restrict;

create table operations.onboarding_journey_task_attachments (
  organisation_id uuid not null,
  task_id uuid not null,
  document_id uuid not null references operations.documents(id) on delete restrict,
  attached_at timestamptz not null default clock_timestamp(),
  primary key (task_id, document_id),
  foreign key (organisation_id, task_id) references operations.onboarding_journey_tasks(organisation_id, id) on delete restrict
);

create function operations.assert_onboarding_template_content(target_content jsonb)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  task jsonb;
begin
  if jsonb_typeof(target_content) <> 'object'
    or jsonb_typeof(target_content -> 'tasks') <> 'array'
    or jsonb_array_length(target_content -> 'tasks') not between 1 and 30 then
    raise exception 'A template requires between one and thirty tasks.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(target_content -> 'tasks') as entries(task)
    where jsonb_typeof(entries.task) <> 'object'
      or not (entries.task ?& array['id', 'title', 'instructions', 'kind', 'ownerRole', 'required', 'dependsOnTaskId', 'dueRule', 'evidenceRule', 'bookingUrl'])
      or exists (
        select 1
        from jsonb_object_keys(entries.task) as keys(key)
        where keys.key not in ('id', 'title', 'instructions', 'kind', 'ownerRole', 'required', 'dependsOnTaskId', 'dueRule', 'evidenceRule', 'bookingUrl')
      )
  ) then
    raise exception 'Template tasks contain unsupported fields.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(target_content -> 'tasks') as entries(task)
    where jsonb_typeof(entries.task -> 'id') <> 'string'
      or jsonb_typeof(entries.task -> 'title') <> 'string'
      or jsonb_typeof(entries.task -> 'instructions') <> 'string'
      or jsonb_typeof(entries.task -> 'kind') <> 'string'
      or jsonb_typeof(entries.task -> 'ownerRole') <> 'string'
      or jsonb_typeof(entries.task -> 'dueRule') <> 'string'
      or jsonb_typeof(entries.task -> 'evidenceRule') <> 'string'
      or coalesce(entries.task ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or length(trim(coalesce(entries.task ->> 'title', ''))) not between 1 and 160
      or length(trim(coalesce(entries.task ->> 'instructions', ''))) not between 1 and 4000
      or position(chr(8212) in coalesce(entries.task ->> 'title', '') || coalesce(entries.task ->> 'instructions', '')) > 0
      or coalesce(entries.task ->> 'kind', '') not in ('profile', 'agreement', 'billing', 'upload', 'booking', 'acknowledgement', 'custom')
      or coalesce(entries.task ->> 'ownerRole', '') not in ('owner', 'contributor', 'billing_contact', 'viewer')
      or jsonb_typeof(entries.task -> 'required') <> 'boolean'
      or coalesce(entries.task ->> 'dueRule', '') not in ('activation', 'signature', 'previous_task')
      or coalesce(entries.task ->> 'evidenceRule', '') not in ('profile_saved', 'agreement_signed', 'billing_ready', 'cleared_documents', 'booking_confirmed', 'acknowledged', 'staff_confirmed')
      or (jsonb_typeof(entries.task -> 'dependsOnTaskId') <> 'null'
        and entries.task ->> 'dependsOnTaskId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      or (entries.task ->> 'kind' = 'profile' and entries.task ->> 'evidenceRule' <> 'profile_saved')
      or (entries.task ->> 'kind' = 'agreement' and entries.task ->> 'evidenceRule' <> 'agreement_signed')
      or (entries.task ->> 'kind' = 'billing' and entries.task ->> 'evidenceRule' <> 'billing_ready')
      or (entries.task ->> 'kind' = 'upload' and entries.task ->> 'evidenceRule' <> 'cleared_documents')
      or (entries.task ->> 'kind' = 'booking' and entries.task ->> 'evidenceRule' <> 'booking_confirmed')
      or (entries.task ->> 'kind' = 'acknowledgement' and entries.task ->> 'evidenceRule' <> 'acknowledged')
      or (entries.task ->> 'kind' = 'custom' and entries.task ->> 'evidenceRule' <> 'staff_confirmed')
      or (entries.task ->> 'kind' = 'booking' and (
        jsonb_typeof(entries.task -> 'bookingUrl') <> 'string'
        or entries.task ->> 'bookingUrl' !~ '^https://[^/@[:space:]]+([/?#]|$)'
        or length(entries.task ->> 'bookingUrl') > 2000
      ))
      or (entries.task ->> 'kind' <> 'booking' and jsonb_typeof(entries.task -> 'bookingUrl') <> 'null')
  ) then
    raise exception 'Template task configuration is invalid.' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_array_elements(target_content -> 'tasks') as entries(task))
      <> (select count(distinct entries.task ->> 'id') from jsonb_array_elements(target_content -> 'tasks') as entries(task)) then
    raise exception 'Template task IDs must be unique.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(target_content -> 'tasks') as entries(task)
    where entries.task ->> 'dependsOnTaskId' = entries.task ->> 'id'
      or (entries.task ->> 'dependsOnTaskId' is not null and not exists (
        select 1 from jsonb_array_elements(target_content -> 'tasks') as candidates(task)
        where candidates.task ->> 'id' = entries.task ->> 'dependsOnTaskId'
      ))
  ) then
    raise exception 'Template task dependency is unavailable.' using errcode = '22023';
  end if;

  if exists (
    with recursive task_paths as (
      select entries.task ->> 'id' as start_id,
        entries.task ->> 'dependsOnTaskId' as dependency_id,
        array[entries.task ->> 'id']::text[] as path
      from jsonb_array_elements(target_content -> 'tasks') as entries(task)
      union all
      select task_paths.start_id,
        entries.task ->> 'dependsOnTaskId',
        task_paths.path || (entries.task ->> 'id')
      from task_paths
      join jsonb_array_elements(target_content -> 'tasks') as entries(task)
        on entries.task ->> 'id' = task_paths.dependency_id
      where task_paths.dependency_id is not null
        and not entries.task ->> 'id' = any(task_paths.path)
    )
    select 1 from task_paths where dependency_id = any(path)
  ) then
    raise exception 'Template task dependencies cannot contain a cycle.' using errcode = '22023';
  end if;
end;
$$;

create function operations.assert_onboarding_founder()
returns text
language plpgsql
security definer
set search_path = '' as $$
declare
  actor text := current_setting('operations.actor_id', true);
begin
  if current_setting('role', true) <> 'operations_founder'
    or actor is null
    or actor !~ '^[a-f0-9]{64}$' then
    raise exception 'Founder authorization is required.' using errcode = '42501';
  end if;
  return actor;
end;
$$;

create function operations.save_onboarding_template_draft(
  target_template uuid,
  target_organisation uuid,
  target_title text,
  target_content jsonb,
  expected_version integer,
  target_review_reference text
)
returns table (id uuid, draft_version integer)
language plpgsql
security definer
set search_path = '' as $$
declare
  actor text := operations.assert_onboarding_founder();
  stored_template operations.onboarding_templates;
begin
  if expected_version < 0 or length(trim(coalesce(target_title, ''))) not between 1 and 160
    or position(chr(8212) in coalesce(target_title, '')) > 0
    or length(trim(coalesce(target_review_reference, ''))) not between 1 and 200 then
    raise exception 'Template draft is invalid.' using errcode = '22023';
  end if;
  if target_organisation is null or not exists (
    select 1 from operations.organisations as organisation
    where organisation.id = target_organisation and organisation.lifecycle = 'active'
  ) then
    raise exception 'Template organisation is unavailable.' using errcode = '23503';
  end if;
  perform operations.assert_onboarding_template_content(target_content);

  select * into stored_template from operations.onboarding_templates as stored where stored.id = target_template for update;
  if not found then
    if expected_version <> 0 then
      raise exception 'Template draft has changed.' using errcode = '40001';
    end if;
    insert into operations.onboarding_templates(
      id, organisation_id, title, draft_content, draft_version, created_by
    ) values (
      target_template, target_organisation, trim(target_title), target_content, 1, actor
    ) returning * into stored_template;
  else
    if stored_template.organisation_id is distinct from target_organisation
      or stored_template.draft_version <> expected_version then
      raise exception 'Template draft has changed.' using errcode = '40001';
    end if;
    update operations.onboarding_templates as stored
      set title = trim(target_title), draft_content = target_content,
        draft_version = stored.draft_version + 1, updated_at = clock_timestamp()
      where stored.id = target_template
      returning * into stored_template;
  end if;
  id := stored_template.id;
  draft_version := stored_template.draft_version;
  return next;
end;
$$;

create function operations.publish_onboarding_template_version(
  target_template uuid,
  expected_draft_version integer,
  target_review_reference text
)
returns table (id uuid, version integer)
language plpgsql
security definer
set search_path = '' as $$
declare
  actor text := operations.assert_onboarding_founder();
  stored_template operations.onboarding_templates;
  published operations.onboarding_template_versions;
begin
  if expected_draft_version < 1
    or length(trim(coalesce(target_review_reference, ''))) not between 1 and 200 then
    raise exception 'Template publication is invalid.' using errcode = '22023';
  end if;
  select * into strict stored_template from operations.onboarding_templates as stored where stored.id = target_template for update;
  if stored_template.draft_version <> expected_draft_version then
    raise exception 'Template draft has changed.' using errcode = '40001';
  end if;
  perform operations.assert_onboarding_template_content(stored_template.draft_content);
  insert into operations.onboarding_template_versions(
    template_id, organisation_id, version, title, content, published_by
  ) values (
    stored_template.id, stored_template.organisation_id, stored_template.published_version + 1,
    stored_template.title, stored_template.draft_content, actor
  ) returning * into published;
  update operations.onboarding_templates as stored
    set published_version = published.version, updated_at = clock_timestamp()
    where stored.id = stored_template.id;
  insert into operations.audit_events(
    organisation_id, actor_id, action, entity_id, review_reference, correlation_id
  ) values (
    stored_template.organisation_id,
    actor, 'onboarding.template_published', published.id, target_review_reference,
    nullif(current_setting('operations.correlation_id', true), '')::uuid
  );
  id := published.id;
  version := published.version;
  return next;
end;
$$;

create function operations.save_onboarding_journey_draft(
  target_draft uuid,
  target_organisation uuid,
  target_agreement uuid,
  target_contact uuid,
  target_template_version uuid,
  target_stage text,
  target_content jsonb,
  expected_version integer,
  target_review_reference text
)
returns table (id uuid, version integer, stage text)
language plpgsql
security definer
set search_path = '' as $$
declare
  actor text := operations.assert_onboarding_founder();
  draft operations.onboarding_journey_drafts;
begin
  if expected_version < 0
    or target_stage not in ('setup', 'content', 'access', 'schedule', 'activate')
    or jsonb_typeof(target_content) <> 'object'
    or length(trim(coalesce(target_review_reference, ''))) not between 1 and 200 then
    raise exception 'Journey draft is invalid.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from operations.agreements a
    join operations.contacts c on c.id = target_contact and c.organisation_id = a.organisation_id
    where a.id = target_agreement and a.organisation_id = target_organisation
  ) then
    raise exception 'Journey agreement or contact is unavailable.' using errcode = '23503';
  end if;
  if not exists (
    select 1
    from operations.onboarding_template_versions v
    where v.id = target_template_version
      and v.organisation_id = target_organisation
  ) then
    raise exception 'Journey template is unavailable.' using errcode = '23503';
  end if;

  select * into draft from operations.onboarding_journey_drafts where onboarding_journey_drafts.id = target_draft for update;
  if not found then
    if expected_version <> 0 then
      raise exception 'Journey draft has changed.' using errcode = '40001';
    end if;
    insert into operations.onboarding_journey_drafts(
      id, organisation_id, agreement_id, contact_id, template_version_id, stage,
      content, version, saved_by, review_reference
    ) values (
      target_draft, target_organisation, target_agreement, target_contact,
      target_template_version, target_stage, target_content, 1, actor,
      target_review_reference
    ) returning * into draft;
  else
    if draft.organisation_id <> target_organisation or draft.version <> expected_version then
      raise exception 'Journey draft has changed.' using errcode = '40001';
    end if;
    update operations.onboarding_journey_drafts as existing
      set agreement_id = target_agreement, contact_id = target_contact,
        template_version_id = target_template_version, stage = target_stage,
        content = target_content, version = existing.version + 1, saved_by = actor,
        review_reference = target_review_reference, updated_at = clock_timestamp()
      where existing.id = target_draft
      returning * into draft;
  end if;
  insert into operations.audit_events(
    organisation_id, actor_id, action, entity_id, review_reference, correlation_id
  ) values (
    target_organisation, actor, 'onboarding.journey_draft_saved', draft.id,
    target_review_reference, nullif(current_setting('operations.correlation_id', true), '')::uuid
  );
  id := draft.id;
  version := draft.version;
  stage := draft.stage;
  return next;
end;
$$;

create function operations.instantiate_onboarding_journey_tasks(
  target_journey uuid,
  target_template_version uuid
)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  journey operations.onboarding_journeys;
  version_record operations.onboarding_template_versions;
begin
  perform operations.assert_onboarding_founder();
  select * into strict journey from operations.onboarding_journeys where id = target_journey for update;
  select * into strict version_record from operations.onboarding_template_versions where id = target_template_version;
  if version_record.organisation_id <> journey.organisation_id then
    raise exception 'Journey template is unavailable.' using errcode = '23503';
  end if;
  if journey.onboarding_template_version_id is not null
    and journey.onboarding_template_version_id <> target_template_version then
    raise exception 'Journey template snapshot has changed.' using errcode = '40001';
  end if;
  if exists (select 1 from operations.onboarding_journey_tasks where journey_id = journey.id) then
    return;
  end if;
  insert into operations.onboarding_journey_tasks(
    organisation_id, journey_id, template_version_id, template_task_id, definition
  )
  select journey.organisation_id, journey.id, version_record.id,
    (entries.task ->> 'id')::uuid, entries.task
  from jsonb_array_elements(version_record.content -> 'tasks') as entries(task);
  update operations.onboarding_journeys
    set onboarding_template_version_id = version_record.id
    where id = journey.id;
end;
$$;

create function operations.bind_onboarding_journey_workspace_snapshot(
  target_journey uuid,
  target_template_version uuid,
  target_draft uuid,
  expected_draft_version integer
)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  journey operations.onboarding_journeys;
  draft operations.onboarding_journey_drafts;
begin
  perform operations.assert_onboarding_founder();
  if expected_draft_version < 1 then
    raise exception 'Workspace draft version is invalid.' using errcode = '22023';
  end if;

  select * into strict journey
  from operations.onboarding_journeys
  where id = target_journey
  for update;
  select * into strict draft
  from operations.onboarding_journey_drafts
  where id = target_draft
  for update;

  if draft.organisation_id <> journey.organisation_id
    or draft.agreement_id <> journey.agreement_id
    or draft.template_version_id <> target_template_version
    or draft.version <> expected_draft_version then
    raise exception 'Workspace draft changed.' using errcode = '40001';
  end if;
  if journey.onboarding_workspace_draft_id is not null
    and journey.onboarding_workspace_draft_id <> target_draft then
    raise exception 'Journey workspace snapshot changed.' using errcode = '40001';
  end if;
  if journey.onboarding_template_version_id is not null
    and journey.onboarding_template_version_id <> target_template_version then
    raise exception 'Journey template snapshot changed.' using errcode = '40001';
  end if;

  perform operations.instantiate_onboarding_journey_tasks(
    target_journey,
    target_template_version
  );
  update operations.onboarding_journeys
    set onboarding_workspace_draft_id = target_draft,
        onboarding_template_version_id = target_template_version
    where id = journey.id;
end;
$$;

create function operations.read_onboarding_workspace(target_organisation uuid)
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

create function operations.complete_onboarding_task(
  target_organisation uuid,
  target_task uuid,
  target_profile jsonb default null,
  target_document_ids uuid[] default array[]::uuid[],
  target_booking_at timestamptz default null,
  target_review_reference text default null
)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  role_name text := current_setting('role', true);
  actor text;
  member operations.memberships;
  task operations.onboarding_journey_tasks;
  evidence_rule text;
  profile_name text;
  profile_title text;
  profile_phone text;
begin
  select * into strict task
  from operations.onboarding_journey_tasks
  where id = target_task and organisation_id = target_organisation
  for update;
  evidence_rule := task.definition ->> 'evidenceRule';

  if role_name = 'operations_portal' then
    if not operations.portal_has_membership(target_organisation, array[task.definition ->> 'ownerRole']) then
      raise exception 'Onboarding task access is unavailable.' using errcode = '42501';
    end if;
    select * into strict member from operations.memberships
    where organisation_id = target_organisation
      and user_id = nullif(current_setting('operations.user_id', true), '')::uuid
      and revoked_at is null;
    actor := encode(sha256(convert_to(member.user_id::text, 'UTF8')), 'hex');
  elsif role_name = 'operations_founder' then
    actor := operations.assert_onboarding_founder();
  else
    raise exception 'Onboarding task access is unavailable.' using errcode = '42501';
  end if;

  if task.state = 'completed' then
    return;
  end if;
  if task.definition ->> 'dependsOnTaskId' is not null and exists (
    select 1 from operations.onboarding_journey_tasks prerequisite
    where prerequisite.journey_id = task.journey_id
      and prerequisite.template_task_id = (task.definition ->> 'dependsOnTaskId')::uuid
      and prerequisite.state <> 'completed'
  ) then
    raise exception 'Complete the previous required step first.' using errcode = '23514';
  end if;

  if evidence_rule = 'profile_saved' then
    if role_name <> 'operations_portal' or jsonb_typeof(target_profile) <> 'object'
      or exists (select 1 from jsonb_object_keys(target_profile) as keys(key) where keys.key not in ('preferredName', 'jobTitle', 'phone')) then
      raise exception 'Profile completion is invalid.' using errcode = '22023';
    end if;
    profile_name := trim(coalesce(target_profile ->> 'preferredName', ''));
    profile_title := nullif(trim(coalesce(target_profile ->> 'jobTitle', '')), '');
    profile_phone := nullif(trim(coalesce(target_profile ->> 'phone', '')), '');
    if length(profile_name) not between 1 and 160
      or (profile_title is not null and length(profile_title) > 160)
      or (profile_phone is not null and length(profile_phone) not between 3 and 50) then
      raise exception 'Profile completion is invalid.' using errcode = '22023';
    end if;
    insert into operations.onboarding_client_profiles(
      organisation_id, user_id, contact_id, preferred_name, job_title, phone
    ) values (
      target_organisation, member.user_id, member.contact_id, profile_name, profile_title, profile_phone
    ) on conflict (organisation_id, user_id) do update
      set preferred_name = excluded.preferred_name, job_title = excluded.job_title,
        phone = excluded.phone, updated_at = clock_timestamp(), completed_at = clock_timestamp();
    insert into operations.audit_events(
      organisation_id, actor_id, action, entity_id, review_reference, correlation_id
    ) values (
      target_organisation, actor, 'onboarding.client_profile_completed', task.id,
      'portal-profile', nullif(current_setting('operations.correlation_id', true), '')::uuid
    );
    update operations.onboarding_journey_tasks
      set state = 'completed', evidence = jsonb_build_object('kind', 'profile_saved'),
        completed_by = actor, completed_at = clock_timestamp()
      where id = task.id;
  elsif evidence_rule = 'cleared_documents' then
    if role_name <> 'operations_portal' or cardinality(target_document_ids) not between 1 and 20
      or (select count(*) from operations.documents d
        where d.id = any(target_document_ids)
          and d.organisation_id = target_organisation
          and d.kind = 'file' and d.scan_status = 'cleared'
          and d.revoked_at is null and (d.expires_at is null or d.expires_at > clock_timestamp())) <> cardinality(target_document_ids) then
      raise exception 'Cleared document evidence is required.' using errcode = '23514';
    end if;
    insert into operations.onboarding_journey_task_attachments(organisation_id, task_id, document_id)
      select target_organisation, task.id, unnest(target_document_ids)
      on conflict do nothing;
    update operations.onboarding_journey_tasks
      set state = 'completed', evidence = jsonb_build_object('kind', 'cleared_documents', 'count', cardinality(target_document_ids)),
        completed_by = actor, completed_at = clock_timestamp()
      where id = task.id;
  elsif evidence_rule = 'acknowledged' then
    if role_name <> 'operations_portal' then
      raise exception 'Acknowledgement is unavailable.' using errcode = '42501';
    end if;
    update operations.onboarding_journey_tasks
      set state = 'completed', evidence = jsonb_build_object('kind', 'acknowledged'),
        completed_by = actor, completed_at = clock_timestamp()
      where id = task.id;
  elsif evidence_rule in ('booking_confirmed', 'staff_confirmed') then
    if role_name <> 'operations_founder'
      or length(trim(coalesce(target_review_reference, ''))) not between 1 and 200
      or (evidence_rule = 'booking_confirmed' and (
        target_booking_at is null or target_booking_at < clock_timestamp() - interval '365 days'
        or target_booking_at > clock_timestamp() + interval '365 days'
      )) then
      raise exception 'Staff confirmation is invalid.' using errcode = '22023';
    end if;
    update operations.onboarding_journey_tasks
      set state = 'completed', evidence = jsonb_build_object(
          'kind', evidence_rule,
          'bookingAt', case when target_booking_at is null then null else target_booking_at::text end
        ), completed_by = actor, completed_at = clock_timestamp()
      where id = task.id;
    if evidence_rule = 'booking_confirmed' then
      insert into operations.audit_events(
        organisation_id, actor_id, action, entity_id, review_reference, correlation_id
      ) values (
        target_organisation, actor, 'onboarding.booking_confirmed', task.id,
        target_review_reference, nullif(current_setting('operations.correlation_id', true), '')::uuid
      );
    end if;
  else
    raise exception 'This task is completed from verified service evidence.' using errcode = '42501';
  end if;
end;
$$;

create function operations.onboarding_template_version_immutable()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
begin
  raise exception 'Published onboarding template versions are immutable.' using errcode = '55000';
end;
$$;

create trigger onboarding_template_versions_immutable
before update on operations.onboarding_template_versions
for each row execute function operations.onboarding_template_version_immutable();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'onboarding_templates', 'onboarding_template_versions', 'onboarding_journey_drafts',
    'onboarding_client_profiles', 'onboarding_journey_tasks', 'onboarding_journey_task_attachments'
  ] loop
    execute format('alter table operations.%I enable row level security', table_name);
    execute format('alter table operations.%I force row level security', table_name);
    execute format('revoke all on operations.%I from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal, operations_billing_worker, operations_signing_worker, operations_onboarding_worker', table_name);
  end loop;
end;
$$;

revoke all on function operations.assert_onboarding_template_content(jsonb),
  operations.assert_onboarding_founder(),
  operations.save_onboarding_template_draft(uuid, uuid, text, jsonb, integer, text),
  operations.publish_onboarding_template_version(uuid, integer, text),
  operations.save_onboarding_journey_draft(uuid, uuid, uuid, uuid, uuid, text, jsonb, integer, text),
  operations.instantiate_onboarding_journey_tasks(uuid, uuid),
  operations.bind_onboarding_journey_workspace_snapshot(uuid, uuid, uuid, integer),
  operations.read_onboarding_workspace(uuid),
  operations.complete_onboarding_task(uuid, uuid, jsonb, uuid[], timestamptz, text),
  operations.onboarding_template_version_immutable()
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_founder, operations_billing_worker, operations_signing_worker,
    operations_onboarding_worker;
grant execute on function operations.save_onboarding_template_draft(uuid, uuid, text, jsonb, integer, text),
  operations.publish_onboarding_template_version(uuid, integer, text),
  operations.save_onboarding_journey_draft(uuid, uuid, uuid, uuid, uuid, text, jsonb, integer, text),
  operations.instantiate_onboarding_journey_tasks(uuid, uuid),
  operations.bind_onboarding_journey_workspace_snapshot(uuid, uuid, uuid, integer)
  to operations_founder;
grant execute on function operations.read_onboarding_workspace(uuid)
  to operations_founder, operations_portal;
grant execute on function operations.complete_onboarding_task(uuid, uuid, jsonb, uuid[], timestamptz, text)
  to operations_founder, operations_portal;

alter table operations.audit_events drop constraint audit_events_action_check;
alter table operations.audit_events add constraint audit_events_action_check check (action in (
  'organisation.created', 'engagement.linked', 'agreement.revised', 'agreement.signed', 'service.activated',
  'contact.created', 'invite.issued', 'invite.revoked', 'invite.claimed', 'membership.revoked',
  'project.created', 'project.updated', 'milestone.created', 'milestone.updated', 'document.created', 'document.updated',
  'billing.billing_customers.created', 'billing.billing_schedules.created', 'billing.billing_commands.created',
  'billing.invoices.created', 'billing.billing_amendment_previews.created', 'onboarding.retry_requested',
  'onboarding.template_published', 'onboarding.journey_draft_saved', 'onboarding.booking_confirmed',
  'onboarding.client_profile_completed'
));
