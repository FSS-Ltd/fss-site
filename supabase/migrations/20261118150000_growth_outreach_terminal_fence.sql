-- Serialize final client/suppression reads with phantom-capable writers.
-- Locks last only until the surrounding transaction ends, never across provider I/O.
create function growth.try_outreach_terminal_fence() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  lock table operations.organisations, operations.contacts, operations.engagement_links,
    growth.delivery_engagements, growth.contacts, growth.suppressions
    in share mode nowait;
  return true;
exception when lock_not_available then
  return false;
end;
$$;
revoke all on function growth.try_outreach_terminal_fence() from public, anon, authenticated, service_role;
grant execute on function growth.try_outreach_terminal_fence() to growth_app;
