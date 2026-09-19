-- Names only the reviewed engagements already linked to an organisation.
-- The function is intentionally staff-scoped so the FSS Studio agreement
-- workspace can present meaningful choices without widening Growth access.
create function operations.staff_linked_engagements(target_organisation uuid)
returns table(id uuid, name text)
language plpgsql
stable
security definer
set search_path = '' as $$
begin
  perform operations.assert_active_staff_membership();

  return query
    select e.id, e.name
    from operations.engagement_links l
    join growth.delivery_engagements e on e.id = l.engagement_id
    where l.organisation_id = target_organisation
    order by e.name, e.id
    limit 101;
end;
$$;

revoke all on function operations.staff_linked_engagements(uuid)
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.staff_linked_engagements(uuid)
  to operations_founder;
