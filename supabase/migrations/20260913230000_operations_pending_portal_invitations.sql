-- Organisation-free invitations are claimed only after a verified portal user
-- supplies the organisation details required to establish a tenant boundary.
create table operations.pending_portal_invitations (
  id uuid primary key,
  name text not null check (length(trim(name)) between 1 and 200),
  email text not null check (email = lower(trim(email)) and length(email) between 3 and 254),
  role text not null check (role in ('owner', 'contributor', 'billing_contact', 'viewer')),
  state text not null default 'pending' check (state in ('pending', 'provider_failed', 'completed', 'revoked')),
  expires_at timestamptz not null default (now() + interval '72 hours'),
  claimed_user_id uuid,
  organisation_id uuid references operations.organisations(id) on delete restrict,
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((state = 'completed') = (completed_at is not null)),
  check ((state = 'completed') = (claimed_user_id is not null)),
  check ((state = 'completed') = (organisation_id is not null))
);
create unique index operations_one_pending_portal_invitation_per_email
  on operations.pending_portal_invitations (email) where state = 'pending';
create index operations_pending_portal_invitation_expiry
  on operations.pending_portal_invitations (expires_at) where state = 'pending';

create table operations.portal_invitation_audit (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references operations.pending_portal_invitations(id) on delete restrict,
  actor_id text not null check (length(trim(actor_id)) between 1 and 200),
  action text not null check (action in ('issued', 'revoked', 'provider_failed', 'completed')),
  correlation_id uuid not null,
  occurred_at timestamptz not null default now()
);
create index operations_portal_invitation_audit_history
  on operations.portal_invitation_audit (invitation_id, occurred_at, id);

alter table operations.pending_portal_invitations enable row level security;
alter table operations.pending_portal_invitations force row level security;
alter table operations.portal_invitation_audit enable row level security;
alter table operations.portal_invitation_audit force row level security;

create policy founder_read on operations.pending_portal_invitations
  for select to operations_founder
  using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy founder_read on operations.portal_invitation_audit
  for select to operations_founder
  using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');

create function operations.issue_pending_portal_invitation(
  target_id uuid,
  target_name text,
  target_email text,
  invited_role text,
  review text,
  correlation uuid
) returns table(id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  actor text := current_setting('operations.actor_id', true);
  normalized_email text := lower(trim(target_email));
  invitation operations.pending_portal_invitations;
  prior operations.pending_portal_invitations;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  if target_id is null or correlation is null then raise exception 'Invitation identity is required.'; end if;
  if target_name is null or length(trim(target_name)) not between 1 and 200 then raise exception 'Invitation name is invalid.'; end if;
  if target_email is null or length(normalized_email) not between 3 and 254 then raise exception 'Invitation email is invalid.'; end if;
  if invited_role not in ('owner', 'contributor', 'billing_contact', 'viewer') then raise exception 'Invitation role is invalid.'; end if;
  if review is null or length(trim(review)) not between 1 and 200 then raise exception 'Invitation review is invalid.'; end if;

  for prior in
    update operations.pending_portal_invitations
      set state = 'revoked'
      where email = normalized_email and state = 'pending'
      returning *
  loop
    insert into operations.portal_invitation_audit (invitation_id, actor_id, action, correlation_id)
      values (prior.id, actor, 'revoked', correlation);
  end loop;

  insert into operations.pending_portal_invitations (
    id, name, email, role, created_by, review_reference, correlation_id
  ) values (
    target_id, trim(target_name), normalized_email, invited_role, actor, trim(review), correlation
  ) returning * into invitation;
  insert into operations.portal_invitation_audit (invitation_id, actor_id, action, correlation_id)
    values (invitation.id, actor, 'issued', correlation);
  return query select invitation.id, invitation.expires_at;
end;
$$;

create function operations.fail_pending_portal_invitation(
  target_id uuid,
  correlation uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor text := current_setting('operations.actor_id', true);
  changed operations.pending_portal_invitations;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  update operations.pending_portal_invitations
    set state = 'provider_failed'
    where id = target_id and state = 'pending'
    returning * into changed;
  if changed.id is not null then
    insert into operations.portal_invitation_audit (invitation_id, actor_id, action, correlation_id)
      values (changed.id, actor, 'provider_failed', correlation);
  end if;
end;
$$;

create function operations.pending_portal_onboarding() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from operations.pending_portal_invitations invitation
    where invitation.email = nullif(current_setting('operations.verified_email', true), '')
      and nullif(current_setting('operations.user_id', true), '')::uuid is not null
      and invitation.state = 'pending'
      and invitation.expires_at > clock_timestamp()
  );
$$;

create function operations.complete_portal_onboarding(
  target_legal_name text,
  target_display_name text,
  target_timezone text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := nullif(current_setting('operations.verified_email', true), '');
  correlation uuid := nullif(current_setting('operations.correlation_id', true), '')::uuid;
  invitation operations.pending_portal_invitations;
  organisation_id uuid;
  contact_id uuid;
  portal_actor text;
begin
  if verified_user is null or verified_email is null or correlation is null then return null; end if;
  if target_legal_name is null or length(trim(target_legal_name)) not between 1 and 200 then return null; end if;
  if target_display_name is null or length(trim(target_display_name)) not between 1 and 200 then return null; end if;
  if target_timezone is null or length(trim(target_timezone)) not between 1 and 100 then return null; end if;

  select * into invitation
    from operations.pending_portal_invitations
    where email = verified_email and claimed_user_id = verified_user and state = 'completed'
    order by completed_at desc, id desc limit 1;
  if found then return invitation.organisation_id; end if;

  select * into invitation
    from operations.pending_portal_invitations
    where email = verified_email and state = 'pending' and expires_at > clock_timestamp()
    order by created_at desc, id desc limit 1 for update;
  if not found then return null; end if;

  organisation_id := gen_random_uuid();
  contact_id := gen_random_uuid();
  portal_actor := encode(sha256(convert_to(verified_user::text, 'UTF8')), 'hex');
  insert into operations.organisations (
    id, legal_name, display_name, trading_status, timezone, created_by, review_reference
  ) values (
    organisation_id, trim(target_legal_name), trim(target_display_name), 'unknown', trim(target_timezone), invitation.created_by, invitation.review_reference
  );
  insert into operations.contacts (
    id, organisation_id, name, email, created_by, review_reference
  ) values (
    contact_id, organisation_id, invitation.name, invitation.email, invitation.created_by, invitation.review_reference
  );
  insert into operations.memberships (organisation_id, contact_id, user_id, role)
    values (organisation_id, contact_id, verified_user, invitation.role);
  update operations.pending_portal_invitations set
    state = 'completed',
    claimed_user_id = verified_user,
    organisation_id = complete_portal_onboarding.organisation_id,
    completed_at = clock_timestamp()
    where id = invitation.id;
  insert into operations.portal_invitation_audit (invitation_id, actor_id, action, correlation_id)
    values (invitation.id, portal_actor, 'completed', correlation);
  return organisation_id;
end;
$$;

revoke all on operations.pending_portal_invitations, operations.portal_invitation_audit
  from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal;
grant select on operations.pending_portal_invitations, operations.portal_invitation_audit
  to operations_founder;
revoke all on function operations.issue_pending_portal_invitation(uuid, text, text, text, text, uuid),
  operations.fail_pending_portal_invitation(uuid, uuid), operations.pending_portal_onboarding(),
  operations.complete_portal_onboarding(text, text, text)
  from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal;
grant execute on function operations.issue_pending_portal_invitation(uuid, text, text, text, text, uuid),
  operations.fail_pending_portal_invitation(uuid, uuid) to operations_founder;
grant execute on function operations.pending_portal_onboarding(),
  operations.complete_portal_onboarding(text, text, text) to operations_portal;
