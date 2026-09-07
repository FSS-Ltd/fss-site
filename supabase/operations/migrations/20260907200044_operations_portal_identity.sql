-- Staged release hold: promote only through Task 14. No production application.
create role operations_portal nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant usage on schema operations to operations_portal;
revoke all on schema growth from operations_portal;
alter default privileges in schema operations revoke all on tables from operations_portal;

create table operations.contacts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references operations.organisations(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 200),
  email text not null check (email = lower(trim(email)) and length(email) between 3 and 254),
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (organisation_id, email), unique (organisation_id, id)
);
create table operations.memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references operations.organisations(id) on delete restrict,
  contact_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('owner', 'contributor', 'billing_contact', 'viewer')),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organisation_id, contact_id) references operations.contacts(organisation_id, id) on delete restrict,
  unique (organisation_id, user_id), unique (contact_id)
);
create index operations_active_membership_user on operations.memberships (user_id, organisation_id) where revoked_at is null;
create table operations.portal_invites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references operations.organisations(id) on delete restrict,
  contact_id uuid not null,
  role text not null check (role in ('owner', 'contributor', 'billing_contact', 'viewer')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default (now() + interval '72 hours'),
  claimed_at timestamptz,
  revoked_at timestamptz,
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  created_at timestamptz not null default now(),
  foreign key (organisation_id, contact_id) references operations.contacts(organisation_id, id) on delete restrict
);
create unique index operations_pending_contact_invite on operations.portal_invites (contact_id) where claimed_at is null and revoked_at is null;

alter table operations.contacts enable row level security;
alter table operations.contacts force row level security;
alter table operations.memberships enable row level security;
alter table operations.memberships force row level security;
alter table operations.portal_invites enable row level security;
alter table operations.portal_invites force row level security;

create policy founder_read on operations.contacts for select to operations_founder using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy founder_create on operations.contacts for insert to operations_founder with check (created_by = current_setting('operations.actor_id', true));
create policy founder_read on operations.memberships for select to operations_founder using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy founder_read on operations.portal_invites for select to operations_founder using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy portal_self on operations.memberships for select to operations_portal using (
  user_id = nullif(current_setting('operations.user_id', true), '')::uuid and revoked_at is null
  and (nullif(current_setting('operations.organisation_id', true), '') is null
    or organisation_id = nullif(current_setting('operations.organisation_id', true), '')::uuid)
  and exists (select 1 from operations.organisations o where o.id = organisation_id)
);
-- Lookup requires its own narrowly scoped definer because organisation and membership
-- policies otherwise recurse. No arbitrary identity argument; never use JWT metadata.
create function operations.portal_has_membership(target_organisation uuid, allowed_roles text[] default array['owner','contributor','billing_contact','viewer']) returns boolean
language sql stable security definer set search_path = '' as $$
  select target_organisation = nullif(current_setting('operations.organisation_id', true), '')::uuid
    and exists (select 1 from operations.memberships m join operations.organisations o on o.id = m.organisation_id
      where m.organisation_id = target_organisation
      and m.user_id = nullif(current_setting('operations.user_id', true), '')::uuid
      and m.revoked_at is null and m.role = any(allowed_roles) and o.lifecycle = 'active');
$$;
-- Unselected context can enumerate only the verified user's own organisations.
create function operations.portal_owns_membership(target_organisation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from operations.memberships m where m.organisation_id = target_organisation
    and m.user_id = nullif(current_setting('operations.user_id', true), '')::uuid and m.revoked_at is null)
    and (nullif(current_setting('operations.organisation_id', true), '') is null
      or target_organisation = nullif(current_setting('operations.organisation_id', true), '')::uuid);
$$;
create policy portal_read on operations.organisations for select to operations_portal
  using (lifecycle = 'active' and operations.portal_owns_membership(id));
grant select, insert on operations.contacts to operations_founder;
grant select on operations.memberships, operations.portal_invites to operations_founder;
grant select on operations.memberships to operations_portal;
grant select (id, display_name) on operations.organisations to operations_portal;
create view operations.portal_organisations with (security_invoker = true) as
  select id, display_name from operations.organisations;
grant select on operations.portal_organisations to operations_portal;

alter table operations.audit_events drop constraint audit_events_action_check;
alter table operations.audit_events add constraint audit_events_action_check check (action in (
  'organisation.created', 'engagement.linked', 'agreement.revised', 'agreement.signed', 'service.activated',
  'contact.created', 'invite.issued', 'invite.revoked', 'invite.claimed', 'membership.revoked'
));
create function operations.audit_contact_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference)
    values (new.organisation_id, new.created_by, 'contact.created', new.id, new.review_reference);
  return new;
end;
$$;
create trigger contact_created after insert on operations.contacts for each row execute function operations.audit_contact_insert();

-- Founder-only procedures serialize contact mutations. Raw tokens never enter SQL.
create function operations.issue_portal_invite(target_organisation uuid, target_contact uuid, invited_role text, invite_hash text, review text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  actor text := current_setting('operations.actor_id', true);
  invitation operations.portal_invites;
  expiry timestamptz := now() + interval '72 hours';
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  perform 1 from operations.contacts c join operations.organisations o on o.id = c.organisation_id
    where c.id = target_contact and c.organisation_id = target_organisation and o.lifecycle = 'active' for update of c;
  if not found then raise exception 'Contact unavailable.'; end if;
  for invitation in update operations.portal_invites set revoked_at = now()
    where contact_id = target_contact and claimed_at is null and revoked_at is null returning * loop
    insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference)
      values (target_organisation, actor, 'invite.revoked', invitation.id, review);
  end loop;
  insert into operations.portal_invites (organisation_id, contact_id, role, token_hash, expires_at, created_by, review_reference)
    values (target_organisation, target_contact, invited_role, invite_hash, expiry, actor, review) returning * into invitation;
  insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference)
    values (target_organisation, actor, 'invite.issued', invitation.id, review);
  return expiry;
end;
$$;

create function operations.claim_portal_invite(invite_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  invitation operations.portal_invites;
  contact operations.contacts;
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := nullif(current_setting('operations.verified_email', true), '');
  correlation uuid := nullif(current_setting('operations.correlation_id', true), '')::uuid;
begin
  if verified_user is null or verified_email is null or correlation is null then return null; end if;
  select c.* into contact from operations.contacts c join operations.portal_invites i on i.contact_id = c.id
    where i.token_hash = invite_hash for update of c;
  if not found or contact.email <> verified_email then return null; end if;
  select * into invitation from operations.portal_invites where token_hash = invite_hash for update;
  if invitation.claimed_at is not null or invitation.revoked_at is not null or invitation.expires_at <= clock_timestamp() then return null; end if;
  if not exists (select 1 from operations.organisations where id = invitation.organisation_id and lifecycle = 'active') then return null; end if;
  -- A different login cannot take over a bound contact; founder must review identity changes.
  if exists (select 1 from operations.memberships where contact_id = contact.id and user_id <> verified_user)
    or exists (select 1 from operations.memberships where organisation_id = contact.organisation_id and user_id = verified_user and contact_id <> contact.id) then return null; end if;
  insert into operations.memberships (organisation_id, contact_id, user_id, role)
    values (invitation.organisation_id, contact.id, verified_user, invitation.role)
    on conflict (contact_id) do update set role = excluded.role, revoked_at = null;
  update operations.portal_invites set claimed_at = now() where id = invitation.id;
  insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference, correlation_id)
    values (invitation.organisation_id, encode(sha256(convert_to(verified_user::text, 'UTF8')), 'hex'), 'invite.claimed', invitation.id, invitation.review_reference, correlation);
  return invitation.organisation_id;
end;
$$;

create function operations.revoke_portal_membership(target_organisation uuid, target_membership uuid, review text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor text := current_setting('operations.actor_id', true);
  member operations.memberships;
  invitation operations.portal_invites;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  perform 1 from operations.contacts c join operations.memberships m on m.contact_id = c.id
    where m.id = target_membership and m.organisation_id = target_organisation for update of c;
  if not found then raise exception 'Membership unavailable.'; end if;
  select * into member from operations.memberships where id = target_membership for update;
  update operations.memberships set revoked_at = now() where id = target_membership and revoked_at is null;
  for invitation in update operations.portal_invites set revoked_at = now()
    where contact_id = member.contact_id and revoked_at is null and claimed_at is null returning * loop
    insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference)
      values (target_organisation, actor, 'invite.revoked', invitation.id, review);
  end loop;
  if member.revoked_at is null then
    insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference)
      values (target_organisation, actor, 'membership.revoked', member.id, review);
  end if;
end;
$$;
revoke all on all tables in schema operations from public, anon, authenticated, service_role, growth_app;
revoke all on function operations.portal_has_membership(uuid, text[]), operations.portal_owns_membership(uuid),
  operations.audit_contact_insert(), operations.issue_portal_invite(uuid, uuid, text, text, text),
  operations.claim_portal_invite(text), operations.revoke_portal_membership(uuid, uuid, text)
  from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal;
grant execute on function operations.portal_has_membership(uuid, text[]), operations.portal_owns_membership(uuid), operations.claim_portal_invite(text) to operations_portal;
grant execute on function operations.issue_portal_invite(uuid, uuid, text, text, text), operations.revoke_portal_membership(uuid, uuid, text) to operations_founder;

-- Security throttles are global hashed counters, not client records. No direct grants.
create table operations.portal_auth_limits (
  bucket_hash text not null check (bucket_hash ~ '^[a-f0-9]{64}$'),
  bucket_kind text not null check (bucket_kind in ('ip', 'email')),
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (bucket_hash, bucket_kind, window_start)
);
create index operations_auth_limits_window on operations.portal_auth_limits (window_start);
alter table operations.portal_auth_limits enable row level security;
alter table operations.portal_auth_limits force row level security;
revoke all on operations.portal_auth_limits from public, anon, authenticated, service_role, growth_app, operations_portal, operations_founder;
create function operations.consume_portal_auth_limit(bucket_hash text, bucket_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  current_window timestamptz := date_bin(interval '15 minutes', clock_timestamp(), timestamptz '2000-01-01');
  threshold integer;
  consumed integer;
begin
  if bucket_hash is null or bucket_hash !~ '^[a-f0-9]{64}$' or bucket_kind is null or bucket_kind not in ('ip', 'email') then return false; end if;
  threshold := case bucket_kind when 'ip' then 30 else 5 end;
  delete from operations.portal_auth_limits where ctid in (
    select ctid from operations.portal_auth_limits where window_start < current_window - interval '15 minutes' limit 100
  );
  insert into operations.portal_auth_limits as limits (bucket_hash, bucket_kind, window_start, attempts)
    values (bucket_hash, bucket_kind, current_window, 1)
    on conflict on constraint portal_auth_limits_pkey do update set attempts = limits.attempts + 1
      where limits.attempts < threshold
    returning attempts into consumed;
  return consumed is not null;
end;
$$;
revoke all on function operations.consume_portal_auth_limit(text, text) from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.consume_portal_auth_limit(text, text) to operations_portal;
