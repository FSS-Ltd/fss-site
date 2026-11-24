set lock_timeout = '5s';
set statement_timeout = '30s';

-- A NULL connection preserves legacy, unbound snapshots without inventing identity.
create unique index outreach_provider_usage_connection_unique
  on growth.outreach_provider_usage(connection_id)
  where connection_id is not null;
