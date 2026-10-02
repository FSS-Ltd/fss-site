-- Existing clients retain GBP. Historical agreements and invoices are untouched.
alter table operations.organisations
  add column billing_currency text not null default 'GBP'
    check (billing_currency in ('GBP', 'USD', 'EUR')),
  add column currency_version integer not null default 1 check (currency_version > 0);

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
  'agreement.draft_saved', 'agreement.draft_finalised',
  'organisation.currency_changed'
));

create function operations.update_client_currency(
  target_organisation uuid,
  target_currency text,
  expected_version integer,
  review text,
  correlation uuid
)
returns table(organisation_id uuid, billing_currency text, currency_version integer)
language plpgsql security definer set search_path = '' as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  stored operations.organisations;
begin
  perform operations.assert_active_staff_membership();
  if actor is null or actor !~ '^[a-f0-9]{64}$' then
    raise exception 'Staff authorization is required.' using errcode = '42501';
  end if;
  if target_organisation is null or target_currency is null
    or target_currency not in ('GBP', 'USD', 'EUR') or expected_version is null
    or expected_version < 1 or expected_version > 2147483646
    or review is null or length(trim(review)) not between 1 and 200
    or correlation is null then
    raise exception 'Currency change is invalid.' using errcode = '22023';
  end if;
  select * into stored from operations.organisations o
    where o.id = target_organisation and o.lifecycle = 'active' for update;
  if not found or stored.currency_version <> expected_version then
    raise exception 'Client currency changed.' using errcode = '40001';
  end if;
  if stored.billing_currency <> target_currency then
    update operations.organisations o
      set billing_currency = target_currency, currency_version = o.currency_version + 1
      where o.id = target_organisation returning * into stored;
    insert into operations.audit_events (
      organisation_id, actor_id, action, entity_id, review_reference, correlation_id, entity_version
    ) values (
      stored.id, actor, 'organisation.currency_changed', stored.id, trim(review), correlation, stored.currency_version
    );
  end if;
  organisation_id := stored.id;
  billing_currency := stored.billing_currency;
  currency_version := stored.currency_version;
  return next;
end;
$$;
revoke all on function operations.update_client_currency(uuid, text, integer, text, uuid)
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.update_client_currency(uuid, text, integer, text, uuid)
  to operations_founder;
