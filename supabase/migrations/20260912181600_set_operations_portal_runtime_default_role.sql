-- Recorded in the remote history during the Operations production activation.
-- Runtime logins are provisioned separately because their passwords must never
-- be committed. Local CI does not have that login, so it intentionally skips it.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'operations_portal_runtime') then
    execute 'alter role operations_portal_runtime in database postgres set role operations_portal';
  end if;
end
$$;
