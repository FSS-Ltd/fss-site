-- Operations owns user profiles and access grants. Clerk remains the credential
-- and session provider; its verified identity is mapped to operations.user_profiles.
create table operations.user_profiles (
  user_id uuid primary key,
  email text not null check (email = lower(trim(email)) and length(email) between 3 and 254),
  display_name text not null check (length(trim(display_name)) between 1 and 200),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index operations_user_profiles_email on operations.user_profiles(email);
alter table operations.user_profiles enable row level security;
alter table operations.user_profiles force row level security;

create function operations.upsert_user_profile(target_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := lower(trim(nullif(current_setting('operations.verified_email', true), '')));
begin
  if verified_user is null or verified_email is null then raise exception 'Verified identity is required.' using errcode='42501'; end if;
  if target_name is null or length(trim(target_name)) not between 1 and 200 then raise exception 'Profile name is invalid.' using errcode='22023'; end if;
  insert into operations.user_profiles(user_id, email, display_name)
    values (verified_user, verified_email, trim(target_name))
    on conflict (user_id) do update set email=excluded.email, display_name=excluded.display_name, updated_at=clock_timestamp();
end;
$$;
revoke all on operations.user_profiles from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal, operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
revoke all on function operations.upsert_user_profile(text) from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.upsert_user_profile(text) to operations_portal;

-- A scoped invitation joins an existing organisation. An unscoped invitation
-- remains the first-owner onboarding path.
alter table operations.pending_portal_invitations add column target_organisation_id uuid references operations.organisations(id) on delete restrict;
alter table operations.pending_portal_invitations add column accepted_at timestamptz;
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'operations.pending_portal_invitations'::regclass
      and pg_get_constraintdef(oid) like '%state = ''completed''%'
  loop
    execute format(
      'alter table operations.pending_portal_invitations drop constraint %I',
      constraint_name
    );
  end loop;
end;
$$;
alter table operations.pending_portal_invitations drop constraint if exists pending_portal_invitations_state_check;
alter table operations.pending_portal_invitations add constraint pending_portal_invitations_state_check check (state in ('pending', 'accepted', 'provider_failed', 'completed', 'revoked'));
alter table operations.pending_portal_invitations add constraint pending_portal_invitations_acceptance_check check (
  state <> 'accepted' or (accepted_at is not null and claimed_user_id is not null)
);
drop index if exists operations_one_pending_portal_invitation_per_email;
create unique index operations_one_open_portal_invitation_per_email
  on operations.pending_portal_invitations(email) where state in ('pending', 'accepted');

create or replace function operations.issue_pending_portal_invitation(
  target_id uuid, target_name text, target_email text, invited_role text,
  review text, correlation uuid, target_organisation uuid
) returns table(id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  normalized_email text := lower(trim(target_email));
  invitation operations.pending_portal_invitations;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  if target_id is null or correlation is null or target_name is null or length(trim(target_name)) not between 1 and 200 then raise exception 'Invitation identity is invalid.'; end if;
  if normalized_email is null or length(normalized_email) not between 3 and 254 or review is null or length(trim(review)) not between 1 and 200 then raise exception 'Invitation details are invalid.'; end if;
  if target_organisation is null and invited_role <> 'owner' then raise exception 'The first client user must be an owner.'; end if;
  if invited_role not in ('owner','contributor','billing_contact','viewer') then raise exception 'Invitation role is invalid.'; end if;
  if target_organisation is not null and not exists(select 1 from operations.organisations where id=target_organisation and lifecycle='active') then raise exception 'Organisation is unavailable.'; end if;
  update operations.pending_portal_invitations set state='revoked'
    where email=normalized_email and state in ('pending','accepted');
  insert into operations.pending_portal_invitations(id,name,email,role,target_organisation_id,created_by,review_reference,correlation_id)
    values(target_id,trim(target_name),normalized_email,invited_role,target_organisation,actor,trim(review),correlation)
    returning * into invitation;
  insert into operations.portal_invitation_audit(invitation_id,actor_id,action,correlation_id)
    values(invitation.id,actor,'issued',correlation);
  return query select invitation.id, invitation.expires_at;
end;
$$;
revoke all on function operations.issue_pending_portal_invitation(uuid,text,text,text,text,uuid,uuid)
  from public, anon, authenticated, service_role, growth_app, operations_portal;
grant execute on function operations.issue_pending_portal_invitation(uuid,text,text,text,text,uuid,uuid) to operations_founder;

create or replace function operations.claim_pending_portal_invitation(target_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := lower(trim(nullif(current_setting('operations.verified_email', true), '')));
  correlation uuid := nullif(current_setting('operations.correlation_id', true), '')::uuid;
  invitation operations.pending_portal_invitations;
  contact_id uuid;
begin
  if verified_user is null or verified_email is null or correlation is null then return null; end if;
  select * into invitation from operations.pending_portal_invitations where id=target_id and email=verified_email for update;
  if not found or invitation.state not in ('pending','accepted') then return null; end if;
  if invitation.state='pending' and invitation.expires_at <= clock_timestamp() then return null; end if;
  if invitation.state='accepted' and invitation.claimed_user_id <> verified_user then return null; end if;
  if invitation.target_organisation_id is null then
    update operations.pending_portal_invitations set state='accepted', claimed_user_id=verified_user, accepted_at=coalesce(accepted_at,clock_timestamp()) where id=invitation.id;
    return 'onboarding';
  end if;
  insert into operations.contacts(organisation_id,name,email,created_by,review_reference)
    values(invitation.target_organisation_id, coalesce((select display_name from operations.user_profiles where user_id=verified_user), invitation.name), verified_email, invitation.created_by, invitation.review_reference)
    on conflict(organisation_id,email) do update set name=excluded.name returning id into contact_id;
  insert into operations.memberships(organisation_id,contact_id,user_id,role)
    values(invitation.target_organisation_id,contact_id,verified_user,invitation.role)
    on conflict(contact_id) do update set user_id=excluded.user_id, role=excluded.role, revoked_at=null;
  update operations.pending_portal_invitations set state='completed', claimed_user_id=verified_user, organisation_id=target_organisation_id, completed_at=clock_timestamp(), accepted_at=coalesce(accepted_at,clock_timestamp()) where id=invitation.id;
  insert into operations.portal_invitation_audit(invitation_id,actor_id,action,correlation_id)
    values(invitation.id,encode(sha256(convert_to(verified_user::text,'UTF8')),'hex'),'completed',correlation);
  return 'portal';
end;
$$;
revoke all on function operations.claim_pending_portal_invitation(uuid)
  from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.claim_pending_portal_invitation(uuid) to operations_portal;

create or replace function operations.pending_portal_onboarding() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from operations.pending_portal_invitations
    where email=lower(trim(nullif(current_setting('operations.verified_email',true),'')))
      and target_organisation_id is null
      and (
        (state='accepted' and claimed_user_id=nullif(current_setting('operations.user_id',true),'')::uuid)
        or (state='pending' and expires_at > clock_timestamp())
      )
  );
$$;

create or replace function operations.complete_portal_onboarding(
  target_legal_name text,
  target_display_name text,
  target_timezone text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := lower(trim(nullif(current_setting('operations.verified_email', true), '')));
  correlation uuid := nullif(current_setting('operations.correlation_id', true), '')::uuid;
  invitation operations.pending_portal_invitations;
  created_organisation_id uuid;
  contact_id uuid;
  portal_actor text;
begin
  if verified_user is null or verified_email is null or correlation is null then return null; end if;
  if target_legal_name is null or length(trim(target_legal_name)) not between 1 and 200 then return null; end if;
  if target_display_name is null or length(trim(target_display_name)) not between 1 and 200 then return null; end if;
  if target_timezone is null or length(trim(target_timezone)) not between 1 and 100 then return null; end if;

  select * into invitation from operations.pending_portal_invitations
    where email=verified_email and target_organisation_id is null
      and (
        (state in ('accepted','completed') and claimed_user_id=verified_user)
        or (state='pending' and expires_at > clock_timestamp())
      )
    order by coalesce(completed_at, accepted_at, created_at) desc, id desc limit 1 for update;
  if not found then return null; end if;
  if invitation.state='completed' then return invitation.organisation_id; end if;

  created_organisation_id := gen_random_uuid();
  contact_id := gen_random_uuid();
  portal_actor := encode(sha256(convert_to(verified_user::text, 'UTF8')), 'hex');
  insert into operations.organisations(id,legal_name,display_name,trading_status,timezone,created_by,review_reference)
    values(created_organisation_id,trim(target_legal_name),trim(target_display_name),'unknown',trim(target_timezone),invitation.created_by,invitation.review_reference);
  insert into operations.contacts(id,organisation_id,name,email,created_by,review_reference)
    values(contact_id,created_organisation_id,coalesce((select display_name from operations.user_profiles where user_id=verified_user), invitation.name),verified_email,invitation.created_by,invitation.review_reference);
  insert into operations.memberships(organisation_id,contact_id,user_id,role)
    values(created_organisation_id,contact_id,verified_user,'owner');
  update operations.pending_portal_invitations set
    state='completed', claimed_user_id=verified_user, organisation_id=created_organisation_id, completed_at=clock_timestamp()
    where id=invitation.id;
  insert into operations.portal_invitation_audit(invitation_id,actor_id,action,correlation_id)
    values(invitation.id,portal_actor,'completed',correlation);
  return created_organisation_id;
end;
$$;

create function operations.issue_owner_portal_invitation(
  target_id uuid, target_name text, target_email text, invited_role text,
  target_organisation uuid, correlation uuid
) returns table(id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  normalized_email text := lower(trim(target_email));
  actor text;
  invitation operations.pending_portal_invitations;
begin
  if verified_user is null or target_organisation is null or correlation is null or target_id is null then raise exception 'Verified owner identity is required.' using errcode='42501'; end if;
  if not exists(select 1 from operations.memberships where organisation_id=target_organisation and user_id=verified_user and role='owner' and revoked_at is null) then raise exception 'Owner access is required.' using errcode='42501'; end if;
  if target_name is null or length(trim(target_name)) not between 1 and 200 or normalized_email is null or length(normalized_email) not between 3 and 254 then raise exception 'Invitation details are invalid.' using errcode='22023'; end if;
  if invited_role not in ('contributor','billing_contact','viewer') then raise exception 'Owners can only invite contributor, billing contact, or viewer users.' using errcode='22023'; end if;
  actor := encode(sha256(convert_to(verified_user::text,'UTF8')),'hex');
  update operations.pending_portal_invitations set state='revoked'
    where email=normalized_email and state in ('pending','accepted');
  insert into operations.pending_portal_invitations(id,name,email,role,target_organisation_id,created_by,review_reference,correlation_id)
    values(target_id,trim(target_name),normalized_email,invited_role,target_organisation,actor,'Invited by organisation owner',correlation)
    returning * into invitation;
  insert into operations.portal_invitation_audit(invitation_id,actor_id,action,correlation_id)
    values(invitation.id,actor,'issued',correlation);
  return query select invitation.id, invitation.expires_at;
end;
$$;

create function operations.fail_owner_portal_invitation(target_id uuid, correlation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  changed operations.pending_portal_invitations;
  actor text;
begin
  if verified_user is null then raise exception 'Verified owner identity is required.' using errcode='42501'; end if;
  select * into changed from operations.pending_portal_invitations where id=target_id for update;
  if not found or not exists(select 1 from operations.memberships where organisation_id=changed.target_organisation_id and user_id=verified_user and role='owner' and revoked_at is null) then raise exception 'Owner access is required.' using errcode='42501'; end if;
  update operations.pending_portal_invitations set state='provider_failed' where id=target_id and state='pending' returning * into changed;
  if found then
    actor := encode(sha256(convert_to(verified_user::text,'UTF8')),'hex');
    insert into operations.portal_invitation_audit(invitation_id,actor_id,action,correlation_id)
      values(changed.id,actor,'provider_failed',correlation);
  end if;
end;
$$;
revoke all on function operations.issue_owner_portal_invitation(uuid,text,text,text,uuid,uuid), operations.fail_owner_portal_invitation(uuid,uuid)
  from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.issue_owner_portal_invitation(uuid,text,text,text,uuid,uuid), operations.fail_owner_portal_invitation(uuid,uuid) to operations_portal;

-- Preserve historical memberships as provisional profiles until the recipient next confirms their name.
insert into operations.user_profiles(user_id,email,display_name)
select user_id,email,name from (
  select user_id,email,name,row_number() over(partition by user_id order by created_at desc) as position
  from (
    select m.user_id,c.email,c.name,m.created_at
    from operations.memberships m join operations.contacts c on c.id=m.contact_id where m.revoked_at is null
    union all
    select m.user_id,i.email,i.name,m.granted_at
    from operations.staff_memberships m join operations.pending_staff_invitations i on i.id=m.invitation_id where m.revoked_at is null
  ) candidates
) ranked where position=1 on conflict(user_id) do nothing;
