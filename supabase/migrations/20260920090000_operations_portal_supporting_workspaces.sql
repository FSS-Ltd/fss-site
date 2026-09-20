-- Supporting client workspace contracts. Direct table access remains unavailable
-- to portal users; the functions below expose only the fields each view needs.
create table operations.notification_preferences (
  organisation_id uuid not null references operations.organisations(id) on delete restrict,
  user_id uuid not null,
  request_email_enabled boolean not null default true,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (organisation_id, user_id)
);

alter table operations.notification_preferences enable row level security;
alter table operations.notification_preferences force row level security;

create function operations.portal_team_members(target_organisation uuid)
returns table(name text, role text, joined_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role', true) <> 'operations_portal'
    or not operations.portal_has_membership(target_organisation, array['owner', 'contributor', 'viewer']) then
    raise exception 'Portal access is unavailable.' using errcode = '42501';
  end if;

  return query
    select c.name, m.role, m.created_at
    from operations.memberships m
    join operations.contacts c
      on c.organisation_id = m.organisation_id and c.id = m.contact_id
    where m.organisation_id = target_organisation
      and m.revoked_at is null
    order by c.name, c.id
    limit 100;
end;
$$;

create function operations.portal_notification_preferences(target_organisation uuid)
returns table(request_email_enabled boolean)
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
begin
  if current_setting('role', true) <> 'operations_portal'
    or current_user_id is null
    or not operations.portal_has_membership(target_organisation, array['owner']) then
    raise exception 'Portal access is unavailable.' using errcode = '42501';
  end if;

  return query
    select coalesce(p.request_email_enabled, true)
    from (select 1) as fallback
    left join operations.notification_preferences p
      on p.organisation_id = target_organisation and p.user_id = current_user_id;
end;
$$;

create function operations.set_portal_notification_preferences(
  target_organisation uuid,
  target_request_email_enabled boolean
)
returns table(request_email_enabled boolean)
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
begin
  if current_setting('role', true) <> 'operations_portal'
    or current_user_id is null
    or target_request_email_enabled is null
    or not operations.portal_has_membership(target_organisation, array['owner']) then
    raise exception 'Portal access is unavailable.' using errcode = '42501';
  end if;

  insert into operations.notification_preferences(
    organisation_id,
    user_id,
    request_email_enabled
  ) values (
    target_organisation,
    current_user_id,
    target_request_email_enabled
  )
  on conflict (organisation_id, user_id) do update
    set request_email_enabled = excluded.request_email_enabled,
      updated_at = clock_timestamp();

  return query select target_request_email_enabled;
end;
$$;

create or replace function operations.dispatch_request_notifications(batch integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  dispatched integer := 0;
  event record;
begin
  if batch is null or batch not between 1 and 100 then
    raise exception 'Invalid notification batch';
  end if;

  for event in
    select o.id, o.organisation_id, o.request_id, o.kind, r.title,
      r.public_summary, r.version,
      (select o2.display_name from operations.organisations o2
        where o2.id = o.organisation_id) as organisation_name,
      (select c.email from operations.memberships m2
        join operations.contacts c on c.id = m2.contact_id
        where m2.organisation_id = o.organisation_id
          and m2.revoked_at is null
          and m2.role = 'owner'
          and coalesce((
            select p.request_email_enabled
            from operations.notification_preferences p
            where p.organisation_id = m2.organisation_id and p.user_id = m2.user_id
          ), true)
        order by m2.id
        limit 1) as owner_email
    from operations.request_notification_outbox o
    join operations.requests r
      on r.organisation_id = o.organisation_id and r.id = o.request_id
    where o.consumed_at is null
    order by o.created_at, o.id
    limit batch
    for update of o skip locked
  loop
    insert into operations.request_notifications(
      organisation_id,
      request_id,
      user_id,
      kind,
      title,
      body,
      request_version,
      source_outbox_id
    )
    select event.organisation_id, event.request_id, m.user_id, event.kind,
      event.title, event.public_summary, event.version, event.id
    from operations.memberships m
    where m.organisation_id = event.organisation_id
      and m.revoked_at is null
      and m.role in ('owner', 'contributor', 'viewer')
    on conflict (source_outbox_id, user_id) do nothing;

    if event.kind in ('review_requested', 'accepted')
      and event.owner_email is not null then
      insert into operations.request_email_deliveries(
        organisation_id,
        request_id,
        outbox_id,
        kind,
        recipient
      ) values (
        event.organisation_id,
        event.request_id,
        event.id,
        event.kind,
        event.owner_email
      ) on conflict (outbox_id) do nothing;
    end if;

    update operations.request_notification_outbox
      set consumed_at = clock_timestamp()
      where id = event.id;
    dispatched := dispatched + 1;
  end loop;

  return dispatched;
end;
$$;

revoke all on operations.notification_preferences
  from public, anon, authenticated, service_role, growth_app, operations_founder,
    operations_portal, operations_billing_worker, operations_signing_worker,
    operations_onboarding_worker;
revoke all on function operations.portal_team_members(uuid),
  operations.portal_notification_preferences(uuid),
  operations.set_portal_notification_preferences(uuid, boolean)
  from public, anon, authenticated, service_role, growth_app, operations_founder,
    operations_portal, operations_billing_worker, operations_signing_worker,
    operations_onboarding_worker;
grant execute on function operations.portal_team_members(uuid),
  operations.portal_notification_preferences(uuid),
  operations.set_portal_notification_preferences(uuid, boolean)
  to operations_portal;
