begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Unbound rows retain their historical generated Gmail value. Bound Gmail rows
-- remain Gmail; bound Resend rows can only reference a Resend connection.
alter table growth.campaigns
  drop constraint campaign_gmail_account_fk,
  drop constraint campaign_bound_provider_gmail,
  drop column account_provider,
  add column account_provider growth.integration_provider generated always as (
    case when account_connection_id is not null and policy ->> 'provider' = 'resend'
      then 'resend'::growth.integration_provider
      else 'gmail'::growth.integration_provider end
  ) stored,
  add constraint campaign_account_provider_fk foreign key (account_connection_id, account_provider)
    references growth.integration_connections(id, provider) on delete restrict,
  add constraint campaign_bound_provider_supported check (
    account_connection_id is null or (policy ->> 'provider' in ('gmail','resend')) is true
  );
commit;
