-- Closure notices are distinct from client acceptance throughout the durable
-- outbox, in-app notification and email delivery chain.
alter table operations.request_notification_outbox
  drop constraint if exists request_notification_outbox_kind_check;
alter table operations.request_notification_outbox
  add constraint request_notification_outbox_kind_check
  check (kind in (
    'request_received',
    'status_changed',
    'public_comment',
    'review_requested',
    'accepted',
    'closed'
  ));

alter table operations.request_notifications
  drop constraint if exists request_notifications_kind_check;
alter table operations.request_notifications
  add constraint request_notifications_kind_check
  check (kind in (
    'request_received',
    'status_changed',
    'public_comment',
    'review_requested',
    'accepted',
    'closed'
  ));

alter table operations.request_email_deliveries
  drop constraint if exists request_email_deliveries_kind_check;
alter table operations.request_email_deliveries
  add constraint request_email_deliveries_kind_check
  check (kind in ('review_requested', 'accepted', 'closed'));

grant select(transition_reason) on operations.requests to operations_portal;

create or replace function operations.audit_request_change()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare
  actor text := coalesce(
    nullif(current_setting('operations.actor_id', true), ''),
    nullif(current_setting('operations.user_id', true), '')
  );
  event_kind text;
  req uuid;
  item jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  req := case
    when tg_table_name = 'requests' then (item ->> 'id')::uuid
    else (item ->> 'request_id')::uuid
  end;
  insert into operations.request_history(
    organisation_id,
    request_id,
    actor_id,
    action,
    request_version,
    reason,
    correlation_id
  ) values (
    (item ->> 'organisation_id')::uuid,
    req,
    actor,
    coalesce(
      nullif(current_setting('operations.request_action', true), ''),
      tg_table_name || '.' || lower(tg_op)
    ),
    (select version from operations.requests where id = req),
    case
      when tg_table_name = 'requests'
        and tg_op = 'UPDATE'
        and item ->> 'priority' is distinct from to_jsonb(old) ->> 'priority'
        then (to_jsonb(old) ->> 'priority') || ' -> ' || (item ->> 'priority')
      when tg_table_name = 'requests' then item ->> 'transition_reason'
      when tg_table_name = 'request_reviewers' then item ->> 'user_id'
      else ''
    end,
    nullif(current_setting('operations.correlation_id', true), '')::uuid
  );
  if tg_table_name = 'requests' then
    if tg_op = 'INSERT' then
      event_kind := 'request_received';
    elsif new.status <> old.status then
      event_kind := case new.status
        when 'ready_for_review' then 'review_requested'
        when 'done' then case new.closure_label
          when 'Accepted by client' then 'accepted'
          when 'Closed by FSS' then 'closed'
          else 'status_changed'
        end
        else 'status_changed'
      end;
    end if;
  elsif tg_table_name = 'request_comments'
    and to_jsonb(new) ->> 'visibility' = 'client' then
    event_kind := 'public_comment';
  end if;
  if event_kind is not null then
    insert into operations.request_notification_outbox(
      organisation_id,
      request_id,
      kind
    ) values (new.organisation_id, req, event_kind);
  end if;
  return new;
end;
$$;

create or replace function operations.dispatch_request_notifications(batch integer)
returns integer
language plpgsql
security definer
set search_path = '' as $$
declare
  dispatched integer := 0;
  event record;
begin
  if batch is null or batch not between 1 and 100 then
    raise exception 'Invalid notification batch';
  end if;
  for event in
    select o.id, o.organisation_id, o.request_id, o.kind, r.title,
      case when o.kind = 'closed' then r.transition_reason else r.public_summary end as public_summary,
      r.version,
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

    if event.kind in ('review_requested', 'accepted', 'closed')
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

create or replace function operations.claim_request_emails(batch integer)
returns table(
  id uuid,
  organisation_id uuid,
  request_id uuid,
  kind text,
  recipient text,
  attempts integer,
  request_title text,
  deliverable_version text,
  public_summary text,
  review_instructions text,
  organisation_name text
)
language plpgsql
security definer
set search_path = '' as $$
begin
  if batch is null or batch not between 1 and 100 then
    raise exception 'Invalid email batch';
  end if;
  return query
  with due as (
    select d2.id
    from operations.request_email_deliveries d2
    where d2.status = 'pending'
      and (d2.next_attempt_at is null or d2.next_attempt_at <= clock_timestamp())
    order by d2.created_at, d2.id
    limit batch
    for update skip locked
  )
  update operations.request_email_deliveries d
  set attempts = d.attempts + 1,
    updated_at = clock_timestamp()
  from operations.requests r, operations.organisations o, due
  where d.id = due.id
    and r.organisation_id = d.organisation_id
    and r.id = d.request_id
    and o.id = d.organisation_id
  returning d.id, d.organisation_id, d.request_id, d.kind, d.recipient, d.attempts,
    r.title, coalesce(r.deliverable_version, ''),
    case when d.kind = 'closed' then r.transition_reason else r.public_summary end,
    r.review_instructions, o.display_name;
end;
$$;

revoke all on function operations.audit_request_change(),
  operations.dispatch_request_notifications(integer)
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.dispatch_request_notifications(integer)
  to operations_founder;
