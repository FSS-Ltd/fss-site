-- Recorded in the remote history during the Operations production activation.
-- Runtime logins are provisioned separately because their passwords must never
-- be committed. Local CI does not have those logins, so it intentionally skips them.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'operations_founder_runtime') then
    execute 'alter role operations_founder_runtime in database postgres set role operations_founder';
  end if;
  if exists (select 1 from pg_roles where rolname = 'operations_billing_runtime') then
    execute 'alter role operations_billing_runtime in database postgres set role operations_billing_worker';
  end if;
  if exists (select 1 from pg_roles where rolname = 'operations_signing_runtime') then
    execute 'alter role operations_signing_runtime in database postgres set role operations_signing_worker';
  end if;
  if exists (select 1 from pg_roles where rolname = 'operations_onboarding_runtime') then
    execute 'alter role operations_onboarding_runtime in database postgres set role operations_onboarding_worker';
  end if;
end
$$;
