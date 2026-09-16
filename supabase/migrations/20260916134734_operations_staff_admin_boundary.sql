-- Staff Admin grants are independent of client organisations and PortalRole.
-- All access goes through the narrow server-only procedures below.
create table operations.pending_staff_invitations (
  id uuid primary key,
  name text not null check (length(trim(name)) between 1 and 200),
  email text not null check (email = lower(trim(email)) and length(email) between 3 and 254),
  role text not null default 'admin' check (role = 'admin'),
  state text not null default 'pending' check (state in ('pending', 'provider_failed', 'completed', 'revoked')),
  expires_at timestamptz not null default (now() + interval '72 hours'),
  claimed_user_id uuid,
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  provider_failed_at timestamptz,
  revoked_at timestamptz,
  check ((completed_at is null) = (claimed_user_id is null)),
  check (state <> 'completed' or completed_at is not null),
  check (state not in ('pending', 'provider_failed') or completed_at is null),
  check (state <> 'provider_failed' or provider_failed_at is not null),
  check ((state = 'revoked') = (revoked_at is not null))
);
create unique index operations_one_pending_staff_invitation_per_email
  on operations.pending_staff_invitations (email) where state = 'pending';

create table operations.staff_memberships (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references operations.pending_staff_invitations(id) on delete restrict,
  user_id uuid not null,
  role text not null default 'admin' check (role = 'admin'),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index operations_one_active_staff_membership_per_user
  on operations.staff_memberships (user_id) where revoked_at is null;

create table operations.staff_invitation_audit (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references operations.pending_staff_invitations(id) on delete restrict,
  actor_id text not null check (actor_id ~ '^[a-f0-9]{64}$'),
  action text not null check (action in ('issued', 'provider_failed', 'completed', 'revoked')),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  correlation_id uuid not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create index operations_staff_invitation_audit_history
  on operations.staff_invitation_audit (invitation_id, occurred_at, id);

alter table operations.pending_staff_invitations enable row level security;
alter table operations.pending_staff_invitations force row level security;
alter table operations.staff_memberships enable row level security;
alter table operations.staff_memberships force row level security;
alter table operations.staff_invitation_audit enable row level security;
alter table operations.staff_invitation_audit force row level security;

create function operations.issue_staff_invitation(
  target_id uuid, target_name text, target_email text, review text, correlation uuid
) returns table(id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  normalized_email text := lower(trim(target_email));
  invitation operations.pending_staff_invitations;
  prior operations.pending_staff_invitations;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  if target_id is null or correlation is null then raise exception 'Invitation identity is required.'; end if;
  if target_name is null or length(trim(target_name)) not between 1 and 200 then raise exception 'Invitation name is invalid.'; end if;
  if normalized_email is null or length(normalized_email) not between 3 and 254 then raise exception 'Invitation email is invalid.'; end if;
  if review is null or length(trim(review)) not between 1 and 200 then raise exception 'Invitation review is invalid.'; end if;

  -- Serialize issue/claim/revoke for the same email, including the first issue.
  perform pg_advisory_xact_lock(hashtextextended('operations.staff:' || normalized_email, 0));
  if exists (
    select 1 from operations.staff_memberships m
    join operations.pending_staff_invitations i on i.id = m.invitation_id
    where i.email = normalized_email and m.revoked_at is null
  ) then raise exception 'Active staff access must be revoked before inviting again.'; end if;

  for prior in
    update operations.pending_staff_invitations
    set state = 'revoked', revoked_at = clock_timestamp()
    where email = normalized_email and state = 'pending' returning *
  loop
    insert into operations.staff_invitation_audit (invitation_id, actor_id, action, review_reference, correlation_id)
    values (prior.id, actor, 'revoked', trim(review), correlation);
  end loop;

  insert into operations.pending_staff_invitations (id, name, email, created_by, review_reference, correlation_id)
  values (target_id, trim(target_name), normalized_email, actor, trim(review), correlation)
  returning * into invitation;
  insert into operations.staff_invitation_audit (invitation_id, actor_id, action, review_reference, correlation_id)
  values (invitation.id, actor, 'issued', invitation.review_reference, correlation);
  return query select invitation.id, invitation.expires_at;
end;
$$;

create function operations.fail_staff_invitation(target_id uuid, correlation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  invitation operations.pending_staff_invitations;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  if target_id is null or correlation is null then raise exception 'Invitation identity is required.'; end if;
  update operations.pending_staff_invitations
  set state = 'provider_failed', provider_failed_at = clock_timestamp()
  where id = target_id and state = 'pending' returning * into invitation;
  if found then
    insert into operations.staff_invitation_audit (invitation_id, actor_id, action, review_reference, correlation_id)
    values (invitation.id, actor, 'provider_failed', invitation.review_reference, correlation);
  end if;
end;
$$;

create function operations.claim_staff_invitation(target_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := nullif(current_setting('operations.verified_email', true), '');
  correlation uuid := nullif(current_setting('operations.correlation_id', true), '')::uuid;
  invitation operations.pending_staff_invitations;
  membership_id uuid;
begin
  if verified_user is null or verified_email is null or correlation is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.staff:' || verified_email, 0));
  select * into invitation from operations.pending_staff_invitations
  where id = target_id and email = verified_email for update;
  if not found then return null; end if;

  -- Completed invitations are idempotent only for their original active grant.
  if invitation.state = 'completed' and invitation.claimed_user_id = verified_user then
    select id into membership_id from operations.staff_memberships
    where invitation_id = target_id and user_id = verified_user and revoked_at is null;
    return membership_id;
  end if;
  if invitation.state <> 'pending' or invitation.expires_at <= clock_timestamp() then return null; end if;

  insert into operations.staff_memberships (invitation_id, user_id)
  values (target_id, verified_user)
  on conflict (user_id) where revoked_at is null do nothing
  returning id into membership_id;
  if membership_id is null then return null; end if;

  update operations.pending_staff_invitations
  set state = 'completed', claimed_user_id = verified_user, completed_at = clock_timestamp()
  where id = target_id;
  insert into operations.staff_invitation_audit (invitation_id, actor_id, action, review_reference, correlation_id)
  values (target_id, encode(sha256(convert_to(verified_user::text, 'UTF8')), 'hex'), 'completed', invitation.review_reference, correlation);
  return membership_id;
end;
$$;

create function operations.active_staff_membership()
returns table(membership_id uuid, user_id uuid, role text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.user_id, m.role from operations.staff_memberships m
  join operations.pending_staff_invitations i on i.id = m.invitation_id
  where m.user_id = nullif(current_setting('operations.user_id', true), '')::uuid
    and nullif(current_setting('operations.verified_email', true), '') is not null
    and m.revoked_at is null and i.state = 'completed';
$$;

create function operations.revoke_staff_invitation(target_id uuid, review text, correlation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  invitation operations.pending_staff_invitations;
  target_email text;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  if target_id is null or correlation is null then raise exception 'Invitation identity is required.'; end if;
  if review is null or length(trim(review)) not between 1 and 200 then raise exception 'Revocation review is invalid.'; end if;
  select email into target_email from operations.pending_staff_invitations where id = target_id;
  if not found then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.staff:' || target_email, 0));
  update operations.pending_staff_invitations
  set state = 'revoked', revoked_at = clock_timestamp()
  where id = target_id and state <> 'revoked' returning * into invitation;
  if not found then return; end if;
  update operations.staff_memberships set revoked_at = clock_timestamp()
  where invitation_id = target_id and revoked_at is null;
  insert into operations.staff_invitation_audit (invitation_id, actor_id, action, review_reference, correlation_id)
  values (target_id, actor, 'revoked', trim(review), correlation);
end;
$$;

revoke all on operations.pending_staff_invitations, operations.staff_memberships, operations.staff_invitation_audit
  from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
revoke all on function operations.issue_staff_invitation(uuid, text, text, text, uuid),
  operations.fail_staff_invitation(uuid, uuid), operations.claim_staff_invitation(uuid),
  operations.active_staff_membership(), operations.revoke_staff_invitation(uuid, text, uuid)
  from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.issue_staff_invitation(uuid, text, text, text, uuid),
  operations.fail_staff_invitation(uuid, uuid), operations.revoke_staff_invitation(uuid, text, uuid)
  to operations_founder;
grant execute on function operations.claim_staff_invitation(uuid), operations.active_staff_membership()
  to operations_portal;
