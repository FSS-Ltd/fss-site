-- Read-only cross-client queue for the FSS Studio Delivery workspace.
create function operations.staff_delivery_queue()
returns table(
  id uuid,
  organisation_id uuid,
  organisation_name text,
  title text,
  status text,
  owner_display text,
  next_action text,
  target_date text,
  created_at text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from operations.staff_memberships m
    join operations.pending_staff_invitations i on i.id = m.invitation_id
    where m.user_id = nullif(current_setting('operations.user_id', true), '')::uuid
      and m.revoked_at is null and i.state = 'completed'
  ) then raise exception 'Staff authorization is required.'; end if;

  return query
    select r.id, r.organisation_id, o.display_name, r.title, r.status,
      r.owner_display, r.next_action, r.target_date::text, r.created_at::text
    from operations.requests r
    join operations.organisations o on o.id = r.organisation_id
    where o.lifecycle = 'active'
    order by case when r.status in ('done', 'cancelled') then 1 else 0 end,
      r.created_at desc, r.id desc limit 200;
end;
$$;

revoke all on function operations.staff_delivery_queue()
  from public, anon, authenticated, service_role, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.staff_delivery_queue() to operations_founder;
