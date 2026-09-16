-- Read-only client register for verified FSS Admin sessions.
-- The function is deliberately narrow: it exposes no invitation or access controls.
create function operations.staff_client_register()
returns table(
  id uuid,
  legal_name text,
  display_name text,
  trading_status text,
  timezone text,
  lifecycle text,
  engagement_count integer
)
language plpgsql
stable
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

  return query
    select o.id, o.legal_name, o.display_name, o.trading_status,
      o.timezone, o.lifecycle,
      (select count(*)::integer from operations.engagement_links e
       where e.organisation_id = o.id) as engagement_count
    from operations.organisations o
    order by o.id;
end;
$$;

revoke all on function operations.staff_client_register()
  from public, anon, authenticated, service_role, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.staff_client_register() to operations_founder;
