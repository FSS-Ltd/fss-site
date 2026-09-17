-- Allows an already-authenticated invited Admin to claim access without
-- starting a second Clerk sign-up session.
create function operations.claim_staff_invitation_for_verified_email()
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  verified_email text := lower(trim(nullif(current_setting('operations.verified_email', true), '')));
  correlation uuid := nullif(current_setting('operations.correlation_id', true), '')::uuid;
  invitation operations.pending_staff_invitations;
  membership_id uuid;
begin
  if verified_user is null or verified_email is null or correlation is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.staff:' || verified_email, 0));
  select * into invitation from operations.pending_staff_invitations
    where email = verified_email and state = 'pending' and expires_at > clock_timestamp()
    order by created_at desc, id desc limit 1 for update;
  if not found then return null; end if;

  insert into operations.staff_memberships (invitation_id, user_id)
    values (invitation.id, verified_user)
    on conflict (user_id) where revoked_at is null do nothing
    returning id into membership_id;
  if membership_id is null then return null; end if;

  update operations.pending_staff_invitations
    set state = 'completed', claimed_user_id = verified_user, completed_at = clock_timestamp()
    where id = invitation.id;
  insert into operations.staff_invitation_audit
    (invitation_id, actor_id, action, review_reference, correlation_id)
    values (invitation.id, encode(sha256(convert_to(verified_user::text, 'UTF8')), 'hex'), 'completed', invitation.review_reference, correlation);
  return membership_id;
end;
$$;

revoke all on function operations.claim_staff_invitation_for_verified_email()
  from public, anon, authenticated, service_role, operations_founder,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.claim_staff_invitation_for_verified_email() to operations_portal;
