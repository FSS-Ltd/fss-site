-- Keep staff activation independent of first-client organisation onboarding.
create or replace function operations.has_staff_access_or_invitation() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from operations.active_staff_membership()) or exists (
    select 1 from operations.pending_staff_invitations
    where email = lower(trim(nullif(current_setting('operations.verified_email', true), '')))
      and state = 'pending' and expires_at > clock_timestamp()
  );
$$;
revoke all on function operations.has_staff_access_or_invitation() from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.has_staff_access_or_invitation() to operations_portal;

create or replace function operations.claim_pending_portal_invitation(target_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := lower(trim(nullif(current_setting('operations.verified_email', true), '')));
  correlation uuid := nullif(current_setting('operations.correlation_id', true), '')::uuid;
  invitation operations.pending_portal_invitations;
  claimed_contact_id uuid;
begin
  if verified_user is null or verified_email is null or correlation is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.portal:' || verified_email, 0));
  select * into invitation from operations.pending_portal_invitations where id=target_id and email=verified_email for update;
  if not found then return null; end if;
  if invitation.target_organisation_id is not null and not exists (
    select 1 from operations.organisations where id=invitation.target_organisation_id and lifecycle='active'
  ) then return null; end if;
  if invitation.state='completed' and invitation.claimed_user_id=verified_user then
    if exists (select 1 from operations.memberships m join operations.contacts c on c.id=m.contact_id
      where m.organisation_id=invitation.organisation_id and m.user_id=verified_user and m.revoked_at is null and c.email=verified_email)
    then return 'portal'; end if;
    return null;
  end if;
  if invitation.state not in ('pending','accepted') then return null; end if;
  if invitation.state='pending' and invitation.expires_at <= clock_timestamp() then return null; end if;
  if invitation.state='accepted' and invitation.claimed_user_id <> verified_user then return null; end if;
  if invitation.target_organisation_id is null then
    if operations.has_staff_access_or_invitation() then return null; end if;
    perform operations.upsert_user_profile(invitation.name, false);
    update operations.pending_portal_invitations set state='accepted', claimed_user_id=verified_user, accepted_at=coalesce(accepted_at,clock_timestamp()) where id=invitation.id;
    return 'onboarding';
  end if;
  -- A new verified email must never take over a contact already bound to another principal.
  if exists (select 1 from operations.memberships m join operations.contacts c on c.id=m.contact_id
    where m.organisation_id=invitation.target_organisation_id and
      ((c.email=verified_email and m.user_id<>verified_user) or (m.user_id=verified_user and c.email<>verified_email)))
  then return null; end if;
  insert into operations.contacts(organisation_id,name,email,created_by,review_reference)
    values(invitation.target_organisation_id, coalesce((select display_name from operations.user_profiles where user_id=verified_user), invitation.name), verified_email, invitation.created_by, invitation.review_reference)
    on conflict(organisation_id,email) do nothing returning id into claimed_contact_id;
  if claimed_contact_id is null then
    select c.id into claimed_contact_id from operations.contacts c
      where c.organisation_id=invitation.target_organisation_id and c.email=verified_email for update;
  end if;
  -- Legacy claims lock the contact but do not take the new email advisory lock.
  -- Recheck after that lock is held and never overwrite a membership principal.
  if exists(select 1 from operations.memberships where contact_id=claimed_contact_id and user_id<>verified_user)
    then return null; end if;
  perform operations.upsert_user_profile(invitation.name, false);
  update operations.contacts set name=coalesce((select display_name from operations.user_profiles where user_id=verified_user),invitation.name)
    where id=claimed_contact_id;
  insert into operations.memberships(organisation_id,contact_id,user_id,role)
    values(invitation.target_organisation_id,claimed_contact_id,verified_user,invitation.role)
    on conflict(contact_id) do update set role=excluded.role, revoked_at=null
      where operations.memberships.user_id=excluded.user_id;
  if not found then return null; end if;
  update operations.pending_portal_invitations set state='completed', claimed_user_id=verified_user, organisation_id=target_organisation_id, completed_at=clock_timestamp(), accepted_at=coalesce(accepted_at,clock_timestamp()) where id=invitation.id;
  insert into operations.portal_invitation_audit(invitation_id,actor_id,action,correlation_id)
    values(invitation.id,encode(sha256(convert_to(verified_user::text,'UTF8')),'hex'),'completed',correlation);
  return 'portal';
end;
$$;
revoke all on function operations.claim_pending_portal_invitation(uuid)
  from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.claim_pending_portal_invitation(uuid) to operations_portal;

-- Existing Clerk accounts do not receive invitation metadata again. Claim only
-- the database-approved invitation for the server-verified primary email.
create or replace function operations.claim_pending_portal_invitation_for_verified_email() returns text
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := lower(trim(nullif(current_setting('operations.verified_email', true), '')));
  target_id uuid;
begin
  if verified_user is null or verified_email is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.portal:' || verified_email, 0));
  select id into target_id from operations.pending_portal_invitations
    where email=verified_email and (
      (state='pending' and expires_at>clock_timestamp()) or
      (state='accepted' and claimed_user_id=verified_user)
    ) order by created_at desc, id desc limit 1;
  if target_id is null then return null; end if;
  return operations.claim_pending_portal_invitation(target_id);
end;
$$;
revoke all on function operations.claim_pending_portal_invitation_for_verified_email() from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.claim_pending_portal_invitation_for_verified_email() to operations_portal;

create or replace function operations.pending_portal_onboarding() returns boolean
language sql stable security definer set search_path = '' as $$
  select not operations.has_staff_access_or_invitation() and exists(
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
  if operations.has_staff_access_or_invitation() then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.portal:' || verified_email, 0));
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
  if invitation.state='completed' then
    if exists(select 1 from operations.memberships where organisation_id=invitation.organisation_id and user_id=verified_user and revoked_at is null)
    then return invitation.organisation_id; end if;
    return null;
  end if;

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


-- Owner-issued access must stay within the owner's organisation.
create or replace function operations.issue_owner_portal_invitation(
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
  if not exists(select 1 from operations.organisations o where o.id=target_organisation and o.lifecycle='active')
    then raise exception 'Organisation is unavailable.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.portal:' || normalized_email, 0));
  if exists(select 1 from operations.pending_portal_invitations
    where email=normalized_email and state in ('pending','accepted') and target_organisation_id is distinct from target_organisation)
    then raise exception 'This contact already has a pending invitation. Ask FSS to review it.' using errcode='42501'; end if;
  actor := encode(sha256(convert_to(verified_user::text,'UTF8')),'hex');
  update operations.pending_portal_invitations set state='revoked'
    where email=normalized_email and state in ('pending','accepted') and target_organisation_id=target_organisation;
  insert into operations.pending_portal_invitations(id,name,email,role,target_organisation_id,created_by,review_reference,correlation_id)
    values(target_id,trim(target_name),normalized_email,invited_role,target_organisation,actor,'Invited by organisation owner',correlation)
    returning * into invitation;
  insert into operations.portal_invitation_audit(invitation_id,actor_id,action,correlation_id)
    values(invitation.id,actor,'issued',correlation);
  return query select invitation.id, invitation.expires_at;
end;
$$;

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
  if target_organisation is not null and not exists(select 1 from operations.organisations o where o.id=target_organisation and o.lifecycle='active') then raise exception 'Organisation is unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.portal:' || normalized_email, 0));
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


-- An asynchronous Clerk webhook must not undo a name confirmed in the app.
create or replace function operations.upsert_user_profile(target_name text, overwrite_name boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := lower(trim(nullif(current_setting('operations.verified_email', true), '')));
begin
  if verified_user is null or verified_email is null then raise exception 'Verified identity is required.' using errcode='42501'; end if;
  if target_name is null or length(trim(target_name)) not between 1 and 200 then raise exception 'Profile name is invalid.' using errcode='22023'; end if;
  insert into operations.user_profiles(user_id, email, display_name)
    values (verified_user, verified_email, trim(target_name))
    on conflict (user_id) do update set email=excluded.email, display_name=case when overwrite_name then excluded.display_name else operations.user_profiles.display_name end, updated_at=clock_timestamp();
end;
$$;
revoke all on function operations.upsert_user_profile(text,boolean) from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.upsert_user_profile(text,boolean) to operations_portal;

-- Old provider metadata is not a fresh authorization to restore revoked access.
-- Clerk holds invitation state until its recipient completes sign-up. This
-- procedure is deliberately callable only by the scoped portal runtime after
-- its server adapter has supplied a verified Clerk identity.
create or replace function operations.claim_clerk_portal_invitation(
  target_organisation uuid,
  target_name text,
  target_email text,
  invited_role text,
  review text,
  approved_by text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  contact operations.contacts;
  membership operations.memberships;
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := nullif(current_setting('operations.verified_email', true), '');
  correlation uuid := nullif(current_setting('operations.correlation_id', true), '')::uuid;
begin
  if verified_user is null or verified_email is null or correlation is null then return null; end if;
  if target_name is null or length(trim(target_name)) not between 1 and 200 then return null; end if;
  if target_email is null or target_email <> lower(trim(target_email))
    or length(target_email) not between 3 and 254 or target_email <> verified_email then return null; end if;
  if invited_role not in ('owner', 'contributor', 'billing_contact', 'viewer') then return null; end if;
  if review is null or length(trim(review)) not between 1 and 200 then return null; end if;
  if approved_by is null or approved_by !~ '^[a-f0-9]{64}$' then return null; end if;
  if not exists (
    select 1 from operations.organisations
    where id = target_organisation and lifecycle = 'active'
  ) then return null; end if;

  insert into operations.contacts (
    organisation_id,
    name,
    email,
    created_by,
    review_reference
  ) values (
    target_organisation,
    trim(target_name),
    target_email,
    approved_by,
    trim(review)
  )
  on conflict (organisation_id, email) do nothing
  returning * into contact;

  if contact.id is null then
    select * into contact
    from operations.contacts
    where organisation_id = target_organisation and email = target_email
    for update;
  end if;
  if not found then return null; end if;

  select * into membership
  from operations.memberships
  where contact_id = contact.id
  for update;
  if found and (membership.user_id <> verified_user or membership.revoked_at is not null) then return null; end if;
  if found and membership.revoked_at is null then return target_organisation; end if;
  if exists (
    select 1 from operations.memberships
    where organisation_id = target_organisation
      and user_id = verified_user
      and contact_id <> contact.id
  ) then return null; end if;

  insert into operations.memberships (organisation_id, contact_id, user_id, role)
    values (target_organisation, contact.id, verified_user, invited_role)
    on conflict (contact_id) do update set
      role = excluded.role,
      revoked_at = null;
  insert into operations.audit_events (
    organisation_id,
    actor_id,
    action,
    entity_id,
    review_reference,
    correlation_id
  ) values (
    target_organisation,
    encode(sha256(convert_to(verified_user::text, 'UTF8')), 'hex'),
    'invite.claimed',
    contact.id,
    trim(review),
    correlation
  );
  return target_organisation;
end;
$$;

revoke all on function operations.claim_clerk_portal_invitation(uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.claim_clerk_portal_invitation(uuid, text, text, text, text, text)
  to operations_portal;

-- Every successful staff claim persists the same app identity as client claims.
create or replace function operations.claim_staff_invitation(target_id uuid) returns uuid
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
    if membership_id is not null then perform operations.upsert_user_profile(invitation.name, false); end if;
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
  perform operations.upsert_user_profile(invitation.name, false);
  return membership_id;
end;
$$;

create or replace function operations.claim_staff_invitation_for_verified_email()
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := lower(trim(nullif(current_setting('operations.verified_email', true), '')));
  correlation uuid := nullif(current_setting('operations.correlation_id', true), '')::uuid;
  invitation operations.pending_staff_invitations;
begin
  if verified_user is null or verified_email is null or correlation is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.staff:' || verified_email, 0));
  select * into invitation from operations.pending_staff_invitations
    where email = verified_email and state = 'pending' and expires_at > clock_timestamp()
    order by created_at desc, id desc limit 1 for update;
  if not found then return null; end if;

  return operations.claim_staff_invitation(invitation.id);
end;
$$;

revoke all on function operations.claim_staff_invitation_for_verified_email()
  from public, anon, authenticated, service_role, operations_founder,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.claim_staff_invitation_for_verified_email() to operations_portal;

-- Revocation supersedes every invitation that was already issued for this contact.
create or replace function operations.revoke_portal_membership(target_organisation uuid, target_membership uuid, review text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor text := current_setting('operations.actor_id', true);
  member operations.memberships;
  invitation operations.portal_invites;
  pending operations.pending_portal_invitations;
  target_email text;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  select c.email into target_email from operations.contacts c join operations.memberships m on m.contact_id=c.id
    where m.id=target_membership and m.organisation_id=target_organisation;
  if not found then raise exception 'Membership unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.portal:' || target_email, 0));
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
  for pending in update operations.pending_portal_invitations set state='revoked'
    where email=target_email and target_organisation_id=target_organisation and state in ('pending','accepted') returning * loop
    insert into operations.portal_invitation_audit(invitation_id,actor_id,action,correlation_id)
      values(pending.id,actor,'revoked',gen_random_uuid());
  end loop;
  if member.revoked_at is null then
    insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference)
      values (target_organisation, actor, 'membership.revoked', member.id, review);
  end if;
end;
$$;

-- Provider cleanup can touch only invitations this identity consumed, or
-- invitations already revoked by the application. Unclaimed grants stay open.
create or replace function operations.claimed_invitation_ids(target_realm text)
returns table(invitation_id uuid)
language sql stable security definer set search_path = '' as $$
  select id from operations.pending_staff_invitations
    where target_realm='staff'
      and email=lower(trim(nullif(current_setting('operations.verified_email',true),'')))
      and (state='revoked' or (state='completed' and claimed_user_id=nullif(current_setting('operations.user_id',true),'')::uuid))
  union all
  select id from operations.pending_portal_invitations
    where target_realm='portal'
      and email=lower(trim(nullif(current_setting('operations.verified_email',true),'')))
      and (state='revoked' or (state in ('accepted','completed') and claimed_user_id=nullif(current_setting('operations.user_id',true),'')::uuid));
$$;
revoke all on function operations.claimed_invitation_ids(text) from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.claimed_invitation_ids(text) to operations_portal;
