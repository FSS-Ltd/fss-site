-- Request notifications: durable in-app fan-out plus independent email delivery
-- records consumed by the request notification worker. Fan-out and delivery run
-- only through the narrow security-definer procedures below.
alter table operations.request_notification_outbox add column if not exists consumed_at timestamptz;

create table operations.request_notifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  request_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind in ('request_received','status_changed','public_comment','review_requested','accepted')),
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null default '' check (length(body) <= 4000),
  request_version integer not null check (request_version > 0),
  source_outbox_id uuid not null references operations.request_notification_outbox(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (source_outbox_id, user_id),
  foreign key (organisation_id, request_id) references operations.requests(organisation_id, id)
);
create index request_notifications_user on operations.request_notifications(user_id, created_at desc, id);

create table operations.request_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  request_id uuid not null,
  outbox_id uuid not null unique references operations.request_notification_outbox(id) on delete cascade,
  kind text not null check (kind in ('review_requested','accepted')),
  recipient text not null check (recipient = lower(trim(recipient)) and length(recipient) between 3 and 254),
  status text not null default 'pending' check (status in ('pending','succeeded','held')),
  provider_id text,
  accepted_at timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 1000),
  next_attempt_at timestamptz,
  last_error text not null default '' check (length(last_error) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (organisation_id, request_id) references operations.requests(organisation_id, id),
  check (status <> 'succeeded' or (provider_id is not null and accepted_at is not null)),
  check (provider_id is null or accepted_at is not null)
);

-- Fan out each unconsumed outbox event to the organisation's active members and
-- queue one owner email for review and acceptance events. Idempotent per user
-- and per outbox row, and safe under concurrent workers.
create function operations.dispatch_request_notifications(batch integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  dispatched integer := 0;
  event record;
begin
  if batch is null or batch not between 1 and 100 then raise exception 'Invalid notification batch'; end if;
  for event in
    select o.id, o.organisation_id, o.request_id, o.kind, r.title, r.public_summary, r.version,
      (select o2.display_name from operations.organisations o2 where o2.id = o.organisation_id) as organisation_name,
      (select c.email from operations.memberships m2 join operations.contacts c on c.id = m2.contact_id
        where m2.organisation_id = o.organisation_id and m2.revoked_at is null and m2.role = 'owner'
        order by m2.id limit 1) as owner_email
    from operations.request_notification_outbox o
    join operations.requests r on r.organisation_id = o.organisation_id and r.id = o.request_id
    where o.consumed_at is null
    order by o.created_at, o.id
    limit batch
    for update of o skip locked
  loop
    insert into operations.request_notifications(organisation_id, request_id, user_id, kind, title, body, request_version, source_outbox_id)
    select event.organisation_id, event.request_id, m.user_id, event.kind, event.title, event.public_summary, event.version, event.id
    from operations.memberships m
    where m.organisation_id = event.organisation_id and m.revoked_at is null
      and m.role in ('owner', 'contributor', 'viewer')
    on conflict (source_outbox_id, user_id) do nothing;
    if event.kind in ('review_requested','accepted') and event.owner_email is not null then
      insert into operations.request_email_deliveries(organisation_id, request_id, outbox_id, kind, recipient)
      values (event.organisation_id, event.request_id, event.id, event.kind, event.owner_email)
      on conflict (outbox_id) do nothing;
    end if;
    update operations.request_notification_outbox set consumed_at = clock_timestamp() where id = event.id;
    dispatched := dispatched + 1;
  end loop;
  return dispatched;
end $$;

create function operations.claim_request_emails(batch integer) returns table(
  id uuid, organisation_id uuid, request_id uuid, kind text, recipient text, attempts integer,
  request_title text, deliverable_version text, public_summary text, review_instructions text, organisation_name text
) language plpgsql security definer set search_path = '' as $$
begin
  if batch is null or batch not between 1 and 100 then raise exception 'Invalid email batch'; end if;
  return query
  with due as (
    select d2.id from operations.request_email_deliveries d2
    where d2.status = 'pending' and (d2.next_attempt_at is null or d2.next_attempt_at <= clock_timestamp())
    order by d2.created_at, d2.id
    limit batch
    for update skip locked
  )
  update operations.request_email_deliveries d
  set attempts = d.attempts + 1, updated_at = clock_timestamp()
  from operations.requests r, operations.organisations o, due
  where d.id = due.id
    and r.organisation_id = d.organisation_id and r.id = d.request_id
    and o.id = d.organisation_id
  returning d.id, d.organisation_id, d.request_id, d.kind, d.recipient, d.attempts,
    r.title, coalesce(r.deliverable_version, ''), r.public_summary, r.review_instructions,
    o.display_name;
end $$;

create function operations.complete_request_email(target uuid, provider text, accepted timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if target is null or provider is null or length(trim(provider)) not between 1 and 200 or accepted is null
    or accepted > clock_timestamp() + interval '1 minute' then raise exception 'Invalid email completion'; end if;
  update operations.request_email_deliveries
  set status = 'succeeded', provider_id = trim(provider), accepted_at = accepted, updated_at = clock_timestamp()
  where id = target and status = 'pending';
  if not found then raise exception 'Email delivery is not pending'; end if;
end $$;

create function operations.fail_request_email(target uuid, code text, next_attempt timestamptz, held boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if target is null or code is null or length(trim(code)) not between 1 and 200
    or held is null or (next_attempt is not null and held) then raise exception 'Invalid email failure'; end if;
  update operations.request_email_deliveries
  set status = case when held then 'held' else 'pending' end,
    last_error = trim(code), next_attempt_at = next_attempt, updated_at = clock_timestamp()
  where id = target and status = 'pending';
  if not found then raise exception 'Email delivery is not pending'; end if;
end $$;

alter table operations.request_notifications enable row level security;
alter table operations.request_notifications force row level security;
alter table operations.request_email_deliveries enable row level security;
alter table operations.request_email_deliveries force row level security;
revoke all on operations.request_notifications, operations.request_email_deliveries
  from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
revoke all on function operations.dispatch_request_notifications(integer), operations.claim_request_emails(integer),
  operations.complete_request_email(uuid, text, timestamptz), operations.fail_request_email(uuid, text, timestamptz, boolean)
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.dispatch_request_notifications(integer), operations.claim_request_emails(integer),
  operations.complete_request_email(uuid, text, timestamptz), operations.fail_request_email(uuid, text, timestamptz, boolean)
  to operations_founder;

grant select on operations.request_notifications to operations_portal;
create policy portal_read on operations.request_notifications for select to operations_portal
  using (user_id = nullif(current_setting('operations.user_id', true), '')::uuid
    and operations.portal_has_membership(organisation_id, array['owner','contributor','viewer']));
grant update(read_at) on operations.request_notifications to operations_portal;
create policy portal_mark_read on operations.request_notifications for update to operations_portal
  using (user_id = nullif(current_setting('operations.user_id', true), '')::uuid and read_at is null)
  with check (user_id = nullif(current_setting('operations.user_id', true), '')::uuid and read_at is not null);
