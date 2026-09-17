-- Recheck the active FSS Admin grant inside each staff-authorized transaction.
create function operations.assert_active_staff_membership()
returns void
language plpgsql
security definer
set search_path = '' as $$
begin
  if not exists (
    select 1
    from operations.staff_memberships m
    join operations.pending_staff_invitations i on i.id = m.invitation_id
    where m.user_id = nullif(current_setting('operations.user_id', true), '')::uuid
      and m.revoked_at is null
      and i.state = 'completed'
  ) then
    raise exception 'Staff authorization is required.';
  end if;
end;
$$;

revoke all on function operations.assert_active_staff_membership()
  from public, anon, authenticated, service_role, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.assert_active_staff_membership()
  to operations_founder;
