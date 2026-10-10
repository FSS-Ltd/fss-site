-- A setup session records the client's choice and consent before Stripe
-- collects details. It has no amount and cannot settle an existing invoice.
grant select (billing_currency) on operations.organisations to operations_portal;
create table operations.billing_setup_sessions (
 id uuid primary key,
 organisation_id uuid not null,
 customer_id uuid not null,
 account_id text not null,
 environment text not null check(environment in ('test','live')),
 currency text not null check(currency in ('GBP','USD','EUR')),
 method text not null check(method in ('card','bacs_debit')),
 automatic_consent boolean not null,
 consented_at timestamptz,
 user_id uuid not null,
 provider_session_id text not null unique check(provider_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$'),
 status text not null default 'pending' check(status in ('pending','complete','cancelled','failed')),
 setup_intent_id text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 correlation_id uuid not null,
 foreign key(organisation_id,customer_id) references operations.billing_customers(organisation_id,id),
 check((automatic_consent and consented_at is not null) or
       (not automatic_consent and consented_at is null)),
 check(method<>'bacs_debit' or currency='GBP')
);
create index billing_setup_sessions_scope on operations.billing_setup_sessions
 (organisation_id,account_id,environment,currency,created_at desc);
create table operations.billing_payment_preferences (
 organisation_id uuid not null,
 customer_id uuid not null,
 account_id text not null,
 environment text not null check(environment in ('test','live')),
 currency text not null check(currency in ('GBP','USD','EUR')),
 method text not null check(method in ('card','bacs_debit')),
 provider_method_id text not null check(provider_method_id ~ '^pm_[A-Za-z0-9]+$'),
 provider_mandate_id text,
 brand text,
 last4 text check(last4 ~ '^[0-9]{4}$'),
 expires_month integer check(expires_month between 1 and 12),
 expires_year integer check(expires_year between 2020 and 2200),
 automatic_consent boolean not null,
 consented_at timestamptz,
 status text not null check(status in ('active','pending_mandate','revoked','expired')),
 source_session_id uuid not null references operations.billing_setup_sessions(id),
 effective_from timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(organisation_id,account_id,environment,currency),
 foreign key(organisation_id,customer_id) references operations.billing_customers(organisation_id,id),
 check((automatic_consent and consented_at is not null) or
       (not automatic_consent and consented_at is null))
);
create table operations.billing_setup_events (
 event_id text primary key,
 setup_id uuid not null references operations.billing_setup_sessions(id),
 event_type text not null,
 occurred_at timestamptz not null
);
do $$ declare name text; begin
 foreach name in array array['billing_setup_sessions','billing_payment_preferences','billing_setup_events'] loop
  execute format('alter table operations.%I enable row level security',name);
  execute format('alter table operations.%I force row level security',name);
  execute format('revoke all on operations.%I from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,operations_signing_worker,operations_billing_worker,operations_onboarding_worker',name);
 end loop;
end $$;
grant select on operations.billing_setup_sessions,operations.billing_payment_preferences to operations_portal;
create policy portal_read on operations.billing_setup_sessions for select to operations_portal
 using(operations.portal_has_membership(organisation_id,array['owner','billing_contact']));
create policy portal_read on operations.billing_payment_preferences for select to operations_portal
 using(operations.portal_has_membership(organisation_id,array['owner','billing_contact']));

create function operations.portal_billing_setup_preflight(target_org uuid,account text,mode text,curr text)
returns table(name text,email text,existing_automatic_schedule boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if current_setting('role',true)<>'operations_portal' or
  not operations.portal_has_membership(target_org,array['owner','billing_contact']) then
  raise exception 'Billing setup unavailable' using errcode='42501'; end if;
 return query select o.legal_name,r.snapshot->>'billingContact',
  exists(select 1 from operations.billing_payment_preferences p
   join operations.billing_schedules s on s.organisation_id=p.organisation_id and s.account_id=p.account_id
    and s.environment=p.environment and s.currency=p.currency
   where p.organisation_id=target_org and p.account_id=account and p.environment=mode and p.currency=curr
    and p.automatic_consent and s.owner='subscription' and s.provider_reference is not null)
 from operations.organisations o
 join operations.signature_evidence e on e.organisation_id=o.id
 join operations.agreement_revisions r using(organisation_id,agreement_id,revision)
 where o.id=target_org and r.snapshot->>'currency'=curr
 order by e.created_at desc limit 1;
end $$;
revoke all on function operations.portal_billing_setup_preflight(uuid,text,text,text)
 from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,
 operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
grant execute on function operations.portal_billing_setup_preflight(uuid,text,text,text) to operations_portal;

create function operations.portal_billing_payment_preference(target_org uuid,account text,mode text,curr text)
returns table(method text,status text,brand text,last4 text,automatic_consent boolean,
 expires_month integer,expires_year integer,mandate_status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if current_setting('role',true)<>'operations_portal' or
  not operations.portal_has_membership(target_org,array['owner','billing_contact']) then
  raise exception 'Billing setup unavailable' using errcode='42501'; end if;
 return query select p.method,p.status,p.brand,p.last4,p.automatic_consent,
  p.expires_month,p.expires_year,m.status
 from operations.billing_payment_preferences p
 left join operations.mandate_projections m on m.provider_mandate_id=p.provider_mandate_id
  and m.account_id=p.account_id and m.environment=p.environment and m.organisation_id=p.organisation_id
 where p.organisation_id=target_org and p.account_id=account and p.environment=mode and p.currency=curr;
end $$;
revoke all on function operations.portal_billing_payment_preference(uuid,text,text,text)
 from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,
 operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
grant execute on function operations.portal_billing_payment_preference(uuid,text,text,text) to operations_portal;

create function operations.register_billing_setup_customer(target_org uuid,account text,mode text,curr text,
 provider_customer text,correlation uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare existing operations.billing_customers; actor text;
begin
 if current_setting('role',true)<>'operations_portal' or
  not operations.portal_has_membership(target_org,array['owner','billing_contact'])
  or account !~ '^acct_[A-Za-z0-9]+$' or mode not in ('test','live')
  or curr not in ('GBP','USD','EUR') or provider_customer !~ '^cus_[A-Za-z0-9]+$'
  or correlation is null then raise exception 'Billing setup unavailable' using errcode='42501'; end if;
 if not exists(select 1 from operations.signature_evidence e
  join operations.agreement_revisions r using(organisation_id,agreement_id,revision)
  where e.organisation_id=target_org and r.snapshot->>'currency'=curr) then
  raise exception 'Signed agreement required' using errcode='P0001'; end if;
 actor:=encode(sha256(convert_to('portal-billing:'||current_setting('operations.user_id',true),'UTF8')),'hex');
 insert into operations.billing_customers(organisation_id,account_id,environment,currency,provider_customer_id,created_by,correlation_id)
  values(target_org,account,mode,curr,provider_customer,actor,correlation)
  on conflict(organisation_id,account_id,environment,currency) do nothing;
 select * into strict existing from operations.billing_customers
  where organisation_id=target_org and account_id=account and environment=mode and currency=curr;
 if existing.provider_customer_id<>provider_customer then raise exception 'Billing customer conflict' using errcode='P0001'; end if;
 return existing.id;
end $$;

create function operations.register_billing_setup(target uuid,target_org uuid,customer uuid,account text,
 mode text,curr text,method text,consent boolean,provider_session text,correlation uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)<>'operations_portal' or
  not operations.portal_has_membership(target_org,array['owner','billing_contact'])
  or not exists(select 1 from operations.billing_customers c where c.id=customer and c.organisation_id=target_org
    and c.account_id=account and c.environment=mode and c.currency=curr)
  or (method='bacs_debit' and curr<>'GBP') or method not in ('card','bacs_debit')
  or provider_session !~ '^cs_(test|live)_[A-Za-z0-9]+$' or consent is null
  then raise exception 'Billing setup unavailable' using errcode='42501'; end if;
 if exists(select 1 from operations.billing_payment_preferences p
   join operations.billing_schedules s on s.organisation_id=p.organisation_id and s.account_id=p.account_id
    and s.environment=p.environment and s.currency=p.currency
   where p.organisation_id=target_org and p.account_id=account and p.environment=mode and p.currency=curr
    and p.automatic_consent and s.owner='subscription' and s.provider_reference is not null) then
  raise exception 'Existing automatic schedules require managed payment-method changes' using errcode='P0001'; end if;
 insert into operations.billing_setup_sessions(id,organisation_id,customer_id,account_id,environment,currency,
  method,automatic_consent,consented_at,user_id,provider_session_id,correlation_id)
 values(target,target_org,customer,account,mode,curr,method,consent,
  case when consent then clock_timestamp() else null end,
  nullif(current_setting('operations.user_id',true),'')::uuid,provider_session,correlation)
 on conflict(id) do nothing;
end $$;

create function operations.record_billing_setup_event(target uuid,event text,kind text,occurred timestamptz,
 provider_customer text,provider_session text,setup_intent text,provider_method text,mandate text,
 method text,metadata_org uuid,metadata_currency text,brand text,last4 text,exp_month integer,exp_year integer)
returns void language plpgsql security definer set search_path='' as $$
declare s operations.billing_setup_sessions; c operations.billing_customers;
begin
 if current_setting('role',true)<>'operations_billing_worker' or kind not in ('setup_intent.succeeded','setup_intent.setup_failed','checkout.session.expired')
  or event is null or occurred is null then raise exception 'Billing setup event unavailable' using errcode='42501'; end if;
 select * into s from operations.billing_setup_sessions where id=target for update;
 if not found then raise exception 'Billing setup registration pending'; end if;
 if (provider_session is not null and s.provider_session_id is distinct from provider_session)
  or (kind='checkout.session.expired' and provider_session is null) then
  raise exception 'Billing setup scope mismatch' using errcode='P0001'; end if;
 select * into strict c from operations.billing_customers where id=s.customer_id;
 if c.provider_customer_id is distinct from provider_customer or c.account_id<>s.account_id or c.environment<>s.environment
  or c.currency<>s.currency or s.organisation_id is distinct from metadata_org
  or s.currency is distinct from metadata_currency
  or (kind='setup_intent.succeeded' and s.method is distinct from method)
  then raise exception 'Billing setup scope mismatch' using errcode='P0001'; end if;
 insert into operations.billing_setup_events(event_id,setup_id,event_type,occurred_at) values(event,target,kind,occurred)
  on conflict do nothing;
 if not found then return; end if;
 if kind='setup_intent.succeeded' then
  if provider_method !~ '^pm_[A-Za-z0-9]+$' or setup_intent !~ '^seti_[A-Za-z0-9]+$' then
   raise exception 'Billing setup evidence incomplete' using errcode='P0001'; end if;
  update operations.billing_setup_sessions set status='complete',setup_intent_id=setup_intent,
   updated_at=clock_timestamp() where id=target and status<>'complete';
  if found then
   insert into operations.billing_payment_preferences(organisation_id,customer_id,account_id,environment,currency,
    method,provider_method_id,provider_mandate_id,brand,last4,expires_month,expires_year,automatic_consent,
    consented_at,status,source_session_id)
   values(s.organisation_id,s.customer_id,s.account_id,s.environment,s.currency,s.method,provider_method,mandate,
    brand,last4,exp_month,exp_year,s.automatic_consent,s.consented_at,
    case when s.method='bacs_debit' then 'pending_mandate' else 'active' end,s.id)
   on conflict(organisation_id,account_id,environment,currency) do update set
    method=excluded.method,provider_method_id=excluded.provider_method_id,
    provider_mandate_id=excluded.provider_mandate_id,brand=excluded.brand,last4=excluded.last4,
    expires_month=excluded.expires_month,expires_year=excluded.expires_year,
    automatic_consent=excluded.automatic_consent,consented_at=excluded.consented_at,
    status=excluded.status,source_session_id=excluded.source_session_id,
    effective_from=clock_timestamp(),updated_at=clock_timestamp();
  end if;
 elsif s.status='pending' then
  update operations.billing_setup_sessions set status=case when kind='checkout.session.expired' then 'cancelled' else 'failed' end,
   updated_at=clock_timestamp() where id=target;
 end if;
end $$;
create function operations.revoke_billing_payment_method(account text,mode text,provider_method text,occurred timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)<>'operations_billing_worker' or account !~ '^acct_[A-Za-z0-9]+$'
  or mode not in ('test','live') or provider_method !~ '^pm_[A-Za-z0-9]+$' or occurred is null then
  raise exception 'Payment method event unavailable' using errcode='42501'; end if;
 update operations.billing_payment_preferences set status='revoked',automatic_consent=false,consented_at=null,
  updated_at=clock_timestamp()
  where account_id=account and environment=mode and provider_method_id=provider_method
    and effective_from<=occurred and status<>'revoked';
end $$;
revoke all on function operations.register_billing_setup_customer(uuid,text,text,text,text,uuid),
 operations.register_billing_setup(uuid,uuid,uuid,text,text,text,text,boolean,text,uuid),
 operations.record_billing_setup_event(uuid,text,text,timestamptz,text,text,text,text,text,text,uuid,text,text,text,integer,integer),
 operations.revoke_billing_payment_method(text,text,text,timestamptz)
 from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,
 operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
grant execute on function operations.register_billing_setup_customer(uuid,text,text,text,text,uuid),
 operations.register_billing_setup(uuid,uuid,uuid,text,text,text,text,boolean,text,uuid) to operations_portal;
grant execute on function operations.record_billing_setup_event(uuid,text,text,timestamptz,text,text,text,text,text,text,uuid,text,text,text,integer,integer)
 to operations_billing_worker;
grant execute on function operations.revoke_billing_payment_method(text,text,text,timestamptz)
 to operations_billing_worker;

-- Only a future recurring obligation may opt into automatic collection.
-- Existing invoices and immediate obligations remain manual.
create function operations.authorised_future_payment_method(target_org uuid,target_schedule uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare s operations.billing_schedules; p operations.billing_payment_preferences;
begin
 if current_setting('role',true) not in ('operations_founder','operations_onboarding_worker') then
  raise exception 'Billing authority unavailable' using errcode='42501'; end if;
 select * into s from operations.billing_schedules where id=target_schedule and organisation_id=target_org;
 if not found or s.owner<>'subscription' or s.due_date<=current_date or s.provider_reference is not null then return null; end if;
 select * into p from operations.billing_payment_preferences
  where organisation_id=target_org and account_id=s.account_id and environment=s.environment
   and currency=s.currency and automatic_consent and consented_at is not null
   and status in ('active','pending_mandate');
 if not found or p.effective_from>clock_timestamp() then return null; end if;
 if p.method='card' then
  if p.status<>'active' or p.expires_year is null or p.expires_month is null
   or make_date(p.expires_year,p.expires_month,1)<date_trunc('month',current_date)::date then return null; end if;
 else
  if p.provider_mandate_id is null or not exists(select 1 from operations.mandate_projections m
    where m.organisation_id=target_org and m.account_id=s.account_id and m.environment=s.environment
      and m.provider_mandate_id=p.provider_mandate_id and m.status='active') then return null; end if;
 end if;
 return p.provider_method_id;
end $$;
revoke all on function operations.authorised_future_payment_method(uuid,uuid)
 from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,
 operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
grant execute on function operations.authorised_future_payment_method(uuid,uuid)
 to operations_founder,operations_onboarding_worker;
