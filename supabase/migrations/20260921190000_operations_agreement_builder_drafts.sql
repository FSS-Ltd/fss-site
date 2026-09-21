-- Staff-only working state for the FSS Studio agreement builder. Immutable
-- agreement revisions remain the commercial and signing source of truth.
create table operations.agreement_builder_drafts (
  id uuid primary key,
  organisation_id uuid not null references operations.organisations(id) on delete restrict,
  engagement_id uuid references growth.delivery_engagements(id) on delete restrict,
  step text not null check (step in ('link', 'scope', 'fees', 'people', 'document', 'review')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  version integer not null check (version > 0),
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  finalised_at timestamptz,
  finalised_agreement_id uuid references operations.agreements(id) on delete restrict,
  unique (organisation_id, id),
  check ((finalised_at is null) = (finalised_agreement_id is null))
);

create index agreement_builder_drafts_scope
  on operations.agreement_builder_drafts (organisation_id, updated_at desc, id);

alter table operations.agreement_builder_drafts enable row level security;
alter table operations.agreement_builder_drafts force row level security;
revoke all on operations.agreement_builder_drafts
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker,
    operations_founder;

create function operations.save_agreement_builder_draft(
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
  from operations.agreement_builder_drafts
  where id = draft_id
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

create function operations.load_agreement_builder_draft(
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
    from operations.agreement_builder_drafts
    where id = draft_id and organisation_id = target_organisation;
  else
    select * into stored
    from operations.agreement_builder_drafts
    where id = draft_id and organisation_id = target_organisation
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

create function operations.finalise_agreement_builder_draft(
  draft_id uuid,
  target_organisation uuid,
  expected_version integer,
  final_agreement_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
begin
  perform operations.assert_active_staff_membership();
  if actor is null or actor !~ '^[a-f0-9]{64}$' then
    raise exception 'Staff authorization is required.' using errcode = '42501';
  end if;
  update operations.agreement_builder_drafts as draft
  set finalised_at = clock_timestamp(), finalised_agreement_id = final_agreement_id,
      updated_at = clock_timestamp()
  where draft.id = draft_id
    and draft.organisation_id = target_organisation
    and draft.version = expected_version
    and draft.finalised_at is null
    and exists (
      select 1 from operations.agreements as agreement
      where agreement.id = final_agreement_id
        and agreement.organisation_id = target_organisation
    );
  if not found then
    raise exception 'Agreement draft changed.' using errcode = '40001';
  end if;
  insert into operations.audit_events (
    organisation_id, actor_id, action, entity_id, review_reference,
    correlation_id, entity_version
  ) values (
    target_organisation, actor, 'agreement.draft_finalised', draft_id,
    'fss-studio-agreement-builder',
    nullif(current_setting('operations.correlation_id', true), '')::uuid,
    expected_version
  );
end;
$$;

revoke all on function operations.save_agreement_builder_draft(uuid, uuid, text, jsonb, integer),
  operations.load_agreement_builder_draft(uuid, uuid, integer),
  operations.finalise_agreement_builder_draft(uuid, uuid, integer, uuid)
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.save_agreement_builder_draft(uuid, uuid, text, jsonb, integer),
  operations.load_agreement_builder_draft(uuid, uuid, integer),
  operations.finalise_agreement_builder_draft(uuid, uuid, integer, uuid)
  to operations_founder;

alter table operations.audit_events drop constraint audit_events_action_check;
alter table operations.audit_events add constraint audit_events_action_check check (action in (
  'organisation.created', 'engagement.linked', 'agreement.revised',
  'agreement.signed', 'service.activated', 'contact.created', 'invite.issued',
  'invite.revoked', 'invite.claimed', 'membership.revoked', 'project.created',
  'project.updated', 'milestone.created', 'milestone.updated', 'document.created',
  'document.updated', 'billing.billing_customers.created',
  'billing.billing_schedules.created', 'billing.billing_commands.created',
  'billing.invoices.created', 'billing.billing_amendment_previews.created',
  'onboarding.retry_requested', 'onboarding.template_published',
  'onboarding.journey_draft_saved', 'onboarding.booking_confirmed',
  'onboarding.client_profile_completed', 'onboarding.journey_draft_discarded',
  'agreement.draft_saved', 'agreement.draft_finalised'
));
