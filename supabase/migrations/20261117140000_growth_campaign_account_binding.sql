set lock_timeout = '5s';

alter table growth.integration_connections add constraint integration_connection_id_provider_unique unique (id, provider);

alter table growth.campaigns
  add column account_connection_id uuid,
  add column account_provider growth.integration_provider generated always as ('gmail'::growth.integration_provider) stored,
  add constraint campaign_gmail_account_fk foreign key (account_connection_id, account_provider)
    references growth.integration_connections(id, provider) on delete restrict,
  add constraint campaign_account_policy_match check (
    account_connection_id::text is not distinct from policy ->> 'accountConnectionId'
  );

create index campaigns_account_connection_idx on growth.campaigns(account_connection_id);

create function growth.prevent_campaign_account_binding_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.account_connection_id is distinct from old.account_connection_id then
    raise exception 'campaign account binding is immutable';
  end if;
  return new;
end $$;
create trigger campaign_account_binding_immutable before update on growth.campaigns
for each row execute function growth.prevent_campaign_account_binding_update();
