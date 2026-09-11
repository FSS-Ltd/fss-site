-- Clerk is the external identity provider. The operations schema continues to
-- receive only the app-derived UUID principal and verified email address.
create function operations.claim_portal_invite_for_verified_email() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  invitation operations.portal_invites;
  contact operations.contacts;
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := nullif(current_setting('operations.verified_email', true), '');
  correlation uuid := nullif(current_setting('operations.correlation_id', true), '')::uuid;
begin
  if verified_user is null or verified_email is null or correlation is null then return null; end if;
  select i, c into invitation, contact
    from operations.portal_invites i
    join operations.contacts c on c.id = i.contact_id and c.organisation_id = i.organisation_id
    join operations.organisations o on o.id = i.organisation_id
    where c.email = verified_email
      and i.claimed_at is null
      and i.revoked_at is null
      and i.expires_at > clock_timestamp()
      and o.lifecycle = 'active'
    order by i.created_at desc, i.id desc
    limit 1
    for update of i, c;
  if not found then return null; end if;
  if exists (
    select 1 from operations.memberships
    where contact_id = contact.id and user_id <> verified_user
  ) or exists (
    select 1 from operations.memberships
    where organisation_id = contact.organisation_id
      and user_id = verified_user
      and contact_id <> contact.id
  ) then return null; end if;
  insert into operations.memberships (organisation_id, contact_id, user_id, role)
    values (invitation.organisation_id, contact.id, verified_user, invitation.role)
    on conflict (contact_id) do update set role = excluded.role, revoked_at = null;
  update operations.portal_invites set claimed_at = now() where id = invitation.id;
  insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference, correlation_id)
    values (
      invitation.organisation_id,
      encode(sha256(convert_to(verified_user::text, 'UTF8')), 'hex'),
      'invite.claimed',
      invitation.id,
      invitation.review_reference,
      correlation
    );
  return invitation.organisation_id;
end;
$$;

revoke all on function operations.claim_portal_invite_for_verified_email()
  from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.claim_portal_invite_for_verified_email() to operations_portal;
