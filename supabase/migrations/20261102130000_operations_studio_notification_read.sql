-- The FSS Studio notifications page lists request email deliveries as staff,
-- but the table was created with every role revoked and no staff policy, so
-- the page always failed with a permission error. Staff may read; only the
-- dispatch and worker functions write.
grant select on operations.request_email_deliveries to operations_founder;
create policy staff_read on operations.request_email_deliveries
  for select to operations_founder
  using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
