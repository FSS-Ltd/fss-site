-- Founder console may read staff access without direct staff table privileges.
create function operations.founder_staff_access_register()
returns table (
  id uuid, name text, email text, user_id uuid, membership_id uuid,
  state text, invited_at timestamptz, joined_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare actor text := nullif(current_setting('operations.actor_id', true), '');
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  return query
    select i.id, i.name, i.email, m.user_id, m.id,
      case
        when i.state = 'revoked' or m.revoked_at is not null then 'revoked'
        when i.state = 'completed' and m.id is not null then 'active'
        when i.state = 'pending' and i.expires_at <= now() then 'expired'
        else i.state
      end,
      i.created_at, m.granted_at
    from operations.pending_staff_invitations i
    left join operations.staff_memberships m on m.invitation_id = i.id;
end;
$$;

-- Resolve the membership internally; callers cannot select an invitation to revoke.
create function operations.revoke_staff_membership(target_membership uuid, review text, correlation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  invitation uuid;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  if target_membership is null or correlation is null then raise exception 'Membership identity is required.'; end if;
  if review is null or length(trim(review)) not between 1 and 200 then raise exception 'Revocation review is invalid.'; end if;
  select invitation_id into invitation from operations.staff_memberships where id = target_membership;
  if not found then raise exception 'Staff membership was not found.'; end if;
  perform operations.revoke_staff_invitation(invitation, review, correlation);
end;
$$;

revoke all on function operations.founder_staff_access_register(), operations.revoke_staff_membership(uuid, text, uuid)
  from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.founder_staff_access_register(), operations.revoke_staff_membership(uuid, text, uuid)
  to operations_founder;
