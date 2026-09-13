-- Clerk holds invitation state until its recipient completes sign-up. This
-- procedure is deliberately callable only by the scoped portal runtime after
-- its server adapter has supplied a verified Clerk identity.
create function operations.claim_clerk_portal_invitation(
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
  if found and membership.user_id <> verified_user then return null; end if;
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
