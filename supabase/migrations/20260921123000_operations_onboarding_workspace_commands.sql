-- Draft deletion is an explicit optimistic-concurrency command. A draft that
-- has reached a durable journey remains evidence and cannot be discarded.
create function operations.discard_onboarding_journey_draft(
  target_organisation uuid,
  target_draft uuid,
  expected_version integer,
  target_review_reference text
)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  actor text := operations.assert_onboarding_founder();
  draft operations.onboarding_journey_drafts;
begin
  if expected_version < 1
    or length(trim(coalesce(target_review_reference, ''))) not between 1 and 200 then
    raise exception 'Journey draft discard is invalid.' using errcode = '22023';
  end if;

  select * into strict draft
  from operations.onboarding_journey_drafts as stored
  where stored.id = target_draft and stored.organisation_id = target_organisation
  for update;
  if draft.version <> expected_version then
    raise exception 'Journey draft has changed.' using errcode = '40001';
  end if;
  if exists (
    select 1
    from operations.onboarding_journeys journey
    where journey.organisation_id = target_organisation
      and journey.onboarding_workspace_draft_id = target_draft
  ) then
    raise exception 'A started journey retains its source draft.' using errcode = '55000';
  end if;

  delete from operations.onboarding_journey_drafts
  where id = target_draft and organisation_id = target_organisation;
  insert into operations.audit_events(
    organisation_id, actor_id, action, entity_id, review_reference, correlation_id
  ) values (
    target_organisation, actor, 'onboarding.journey_draft_discarded', target_draft,
    target_review_reference, nullif(current_setting('operations.correlation_id', true), '')::uuid
  );
end;
$$;

revoke all on function operations.discard_onboarding_journey_draft(uuid, uuid, integer, text)
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_founder, operations_billing_worker, operations_signing_worker,
    operations_onboarding_worker;
grant execute on function operations.discard_onboarding_journey_draft(uuid, uuid, integer, text)
  to operations_founder;

alter table operations.audit_events drop constraint audit_events_action_check;
alter table operations.audit_events add constraint audit_events_action_check check (action in (
  'organisation.created', 'engagement.linked', 'agreement.revised', 'agreement.signed', 'service.activated',
  'contact.created', 'invite.issued', 'invite.revoked', 'invite.claimed', 'membership.revoked',
  'project.created', 'project.updated', 'milestone.created', 'milestone.updated', 'document.created', 'document.updated',
  'billing.billing_customers.created', 'billing.billing_schedules.created', 'billing.billing_commands.created',
  'billing.invoices.created', 'billing.billing_amendment_previews.created', 'onboarding.retry_requested',
  'onboarding.template_published', 'onboarding.journey_draft_saved', 'onboarding.booking_confirmed',
  'onboarding.client_profile_completed', 'onboarding.journey_draft_discarded'
));
