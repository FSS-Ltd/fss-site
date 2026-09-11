-- Promoted through the approved Operations production release gate.
create table operations.billing_customers (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null references operations.organisations(id),
 provider text not null default 'stripe' check(provider='stripe'), account_id text not null check(account_id ~ '^acct_[A-Za-z0-9]+$'),
 environment text not null check(environment in ('test','live')), provider_customer_id text not null check(provider_customer_id ~ '^cus_[A-Za-z0-9]+$'),
 created_by text not null, correlation_id uuid not null, created_at timestamptz not null default now(),
 unique(organisation_id,account_id,environment), unique(account_id,environment,provider_customer_id), unique(organisation_id,id)
);
create table operations.billing_schedules (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null, agreement_id uuid not null, revision integer not null,
 account_id text not null check(account_id ~ '^acct_[A-Za-z0-9]+$'),environment text not null check(environment in ('test','live')),
 obligation_key text not null,owner text not null check(owner in ('invoice','subscription')),
 amount_pence numeric(18,0) not null check(amount_pence>=0),currency text not null default 'GBP' check(currency='GBP'),
 due_date date not null,end_date date,recurrence_months integer not null check(recurrence_months in (0,1,3,12)),description text not null,
 signed_snapshot jsonb not null,provider_reference text,
 created_by text not null,correlation_id uuid not null,created_at timestamptz not null default now(),
 check((owner='invoice')=(recurrence_months=0)),check(end_date is null or end_date>=due_date),
 foreign key(organisation_id,agreement_id,revision) references operations.signature_evidence(organisation_id,agreement_id,revision),
 unique(organisation_id,agreement_id,revision,environment,obligation_key),unique(organisation_id,id),
 unique(account_id,environment,provider_reference)
);
create table operations.billing_commands (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null references operations.organisations(id),
 account_id text not null,environment text not null check(environment in ('test','live')),command_key text not null,
 target text not null,state text not null default 'pending' check(state in ('pending','completed')),
 result jsonb,created_by text not null,correlation_id uuid not null,created_at timestamptz not null default now(),
 unique(organisation_id,account_id,environment,command_key),unique(organisation_id,account_id,environment,target),
 check((state='completed')=(result is not null))
);
create table operations.invoices (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null,schedule_id uuid not null,
 account_id text not null,environment text not null check(environment in ('test','live')),provider_invoice_id text not null,
 number text,status text not null check(status in ('draft','open','paid','void','uncollectible')),currency text not null check(currency='GBP'),
 total_pence numeric(18,0) not null check(total_pence>=0),amount_paid_pence numeric(18,0) not null check(amount_paid_pence>=0),
 amount_remaining_pence numeric(18,0) not null check(amount_remaining_pence>=0),due_date date,
 issued_snapshot jsonb not null,projected_at timestamptz not null,
 created_by text not null,correlation_id uuid not null,created_at timestamptz not null default now(),
 foreign key(organisation_id,schedule_id) references operations.billing_schedules(organisation_id,id),
 unique(account_id,environment,provider_invoice_id),unique(organisation_id,id)
);
create table operations.billing_amendment_previews (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null,schedule_id uuid not null,
 proposed_agreement_id uuid not null,proposed_revision integer not null,effective_at timestamptz not null,
 preview jsonb not null,state text not null default 'awaiting_founder_approval' check(state='awaiting_founder_approval'),
 created_by text not null,correlation_id uuid not null,created_at timestamptz not null default now(),
 foreign key(organisation_id,schedule_id) references operations.billing_schedules(organisation_id,id),
 foreign key(organisation_id,proposed_agreement_id,proposed_revision) references operations.signature_evidence(organisation_id,agreement_id,revision)
);
create function operations.guard_billing_schedule() returns trigger language plpgsql set search_path='' as $$
declare snapshot jsonb; obligation jsonb; idx integer; expected_amount numeric; expected_owner text;
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-'provider_reference') is distinct from (to_jsonb(old)-'provider_reference') or old.provider_reference is not null then raise exception 'Billing schedule is immutable'; end if;
  return new;
 end if;
 select r.snapshot into strict snapshot from operations.agreement_revisions r where r.organisation_id=new.organisation_id and r.agreement_id=new.agreement_id and r.revision=new.revision;
 if snapshot is distinct from new.signed_snapshot then raise exception 'Billing snapshot must match signed revision'; end if;
 if new.obligation_key !~ '^(installment|line):[1-9][0-9]*$' then raise exception 'Invalid billing obligation'; end if;
 idx:=split_part(new.obligation_key,':',2)::integer-1;
 if split_part(new.obligation_key,':',1)='installment' then
  obligation:=snapshot->'installments'->idx;expected_amount:=(obligation->>'amountPence')::numeric;expected_owner:='invoice';
  if new.due_date::text is distinct from obligation->>'dueDate' or new.end_date is not null then raise exception 'Invalid installment dates'; end if;
 else
  obligation:=snapshot->'lines'->idx;expected_amount:=(obligation->>'unitPence')::numeric*(obligation->>'quantity')::numeric-(obligation->>'discountPence')::numeric+(obligation->>'taxPence')::numeric;expected_owner:='subscription';
  if new.due_date::text is distinct from obligation->>'startDate' or new.end_date::text is distinct from obligation->>'endDate' or new.recurrence_months is distinct from (obligation->>'recurrenceMonths')::integer or new.recurrence_months=0 then raise exception 'Invalid recurring dates'; end if;
 end if;
 if obligation is null or expected_amount is distinct from new.amount_pence or expected_owner<>new.owner then raise exception 'Billing obligation must match signed allocation'; end if;
 if new.due_date<(select (e.evidence->>'signedDate')::date from operations.signature_evidence e where e.organisation_id=new.organisation_id and e.agreement_id=new.agreement_id and e.revision=new.revision) then raise exception 'Billing date precedes signing'; end if;
 return new;
end $$;
create trigger guard_billing_schedule before insert or update on operations.billing_schedules for each row execute function operations.guard_billing_schedule();
create function operations.guard_billing_invoice() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (to_jsonb(new)-array['status','amount_paid_pence','amount_remaining_pence','projected_at']) is distinct from (to_jsonb(old)-array['status','amount_paid_pence','amount_remaining_pence','projected_at']) then raise exception 'Issued invoice snapshot is immutable'; end if;
 if not exists(select 1 from operations.billing_schedules s where s.organisation_id=new.organisation_id and s.id=new.schedule_id and s.account_id=new.account_id and s.environment=new.environment) then raise exception 'Invoice account must match schedule'; end if;
 return new;
end $$;
create trigger guard_billing_invoice before insert or update on operations.invoices for each row execute function operations.guard_billing_invoice();
do $$ declare t text; begin
 foreach t in array array['billing_customers','billing_schedules','billing_commands','invoices','billing_amendment_previews'] loop
 execute format('alter table operations.%I enable row level security',t);
 execute format('alter table operations.%I force row level security',t);
 execute format('create policy founder_read on operations.%I for select to operations_founder using(current_setting(''operations.actor_id'',true) ~ ''^[a-f0-9]{64}$'')',t);
 execute format('create policy founder_insert on operations.%I for insert to operations_founder with check(created_by=current_setting(''operations.actor_id'',true) and created_by ~ ''^[a-f0-9]{64}$'')',t);
 execute format('grant select,insert on operations.%I to operations_founder',t);
 execute format('revoke all on operations.%I from public,anon,authenticated,service_role,growth_app',t);
 if t in ('billing_schedules','billing_commands','invoices') then
 execute format('create policy founder_update on operations.%I for update to operations_founder using(current_setting(''operations.actor_id'',true) ~ ''^[a-f0-9]{64}$'') with check(current_setting(''operations.actor_id'',true) ~ ''^[a-f0-9]{64}$'')',t);
 end if;
 end loop;
end $$;
grant update(provider_reference) on operations.billing_schedules to operations_founder;
grant update(state,result) on operations.billing_commands to operations_founder;
grant update(status,amount_paid_pence,amount_remaining_pence,projected_at) on operations.invoices to operations_founder;
create policy portal_read on operations.billing_customers for select to operations_portal using(operations.portal_has_membership(organisation_id,array['owner','billing_contact']));
create policy portal_read on operations.invoices for select to operations_portal using(operations.portal_has_membership(organisation_id,array['owner','billing_contact']));
grant select on operations.billing_customers,operations.invoices to operations_portal;
revoke all on function operations.guard_billing_schedule(),operations.guard_billing_invoice() from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal;

create table operations.billing_rate_limits(bucket text not null,window_start timestamptz not null,attempts integer not null check(attempts>0),primary key(bucket,window_start));
alter table operations.billing_rate_limits enable row level security;
alter table operations.billing_rate_limits force row level security;
revoke all on operations.billing_rate_limits from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal;
create function operations.consume_billing_limit(org uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=nullif(current_setting('operations.user_id',true),'')::uuid; bucket_name text; n integer; allowed boolean:=true; window_time timestamptz:=date_trunc('minute',clock_timestamp());
begin
 if current_setting('role',true)<>'operations_portal' or not operations.portal_has_membership(org,array['owner','billing_contact']) then raise exception 'Portal access is unavailable.' using errcode='42501'; end if;
 delete from operations.billing_rate_limits where ctid in(select ctid from operations.billing_rate_limits where window_start<window_time-interval '1 hour' limit 1000);
 foreach bucket_name in array array['org:'||org::text,'user:'||uid::text] loop
 insert into operations.billing_rate_limits as limits values(bucket_name,window_time,1) on conflict(bucket,window_start) do update set attempts=limits.attempts+1 returning attempts into n;
 allowed:=allowed and n<=case when bucket_name like 'org:%' then 120 else 30 end;
 end loop;
 return allowed;
end $$;
revoke all on function operations.consume_billing_limit(uuid) from public,anon,authenticated,service_role,growth_app,operations_founder;
grant execute on function operations.consume_billing_limit(uuid) to operations_portal;
create function operations.guard_billing_command() returns trigger language plpgsql set search_path='' as $$
begin
 if old.state='completed' or new.state<>'completed' or (to_jsonb(new)-array['state','result']) is distinct from (to_jsonb(old)-array['state','result']) or jsonb_typeof(new.result->'providerId') is distinct from 'string' then raise exception 'Completed billing commands are immutable'; end if;
 return new;
end $$;
create trigger guard_billing_command before update on operations.billing_commands for each row execute function operations.guard_billing_command();
create function operations.guard_billing_customer() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from operations.signature_evidence where organisation_id=new.organisation_id) then raise exception 'Signed agreement required for billing customer'; end if;
 return new;
end $$;
create trigger guard_billing_customer before insert on operations.billing_customers for each row execute function operations.guard_billing_customer();
create function operations.audit_billing_insert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into operations.audit_events(organisation_id,actor_id,action,entity_id,review_reference,correlation_id) values(new.organisation_id,new.created_by,'billing.'||tg_table_name||'.created',new.id,'signed-billing-command',new.correlation_id);
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['billing_customers','billing_schedules','billing_commands','invoices','billing_amendment_previews'] loop
 execute format('create trigger audit_billing_insert after insert on operations.%I for each row execute function operations.audit_billing_insert()',t);
 end loop;
end $$;
revoke all on function operations.guard_billing_command(),operations.guard_billing_customer(),operations.audit_billing_insert() from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal;
alter table operations.audit_events drop constraint audit_events_action_check;
alter table operations.audit_events add constraint audit_events_action_check check (action in ('organisation.created','engagement.linked','agreement.revised','agreement.signed','service.activated','contact.created','invite.issued','invite.revoked','invite.claimed','membership.revoked','project.created','project.updated','milestone.created','milestone.updated','document.created','document.updated','billing.billing_customers.created','billing.billing_schedules.created','billing.billing_commands.created','billing.invoices.created','billing.billing_amendment_previews.created'));
-- A shared transaction lock serializes proposed-term schedule/command claims with preview holds.
-- An issued or uncertain pending command is already a collection claim and cannot be labelled held.
create function operations.guard_billing_amendment_hold() returns trigger language plpgsql set search_path='' as $$
declare org uuid; agreement uuid; rev integer; env text; schedule operations.billing_schedules;
begin
 if tg_table_name='billing_schedules' then
  org:=new.organisation_id;agreement:=new.agreement_id;rev:=new.revision;env:=new.environment;
 elsif tg_table_name='billing_commands' then
  if new.target='customer' then return new; end if;
  if new.target !~ '^schedule:[0-9a-f-]{36}$' then raise exception 'Invalid billing command target'; end if;
  select * into strict schedule from operations.billing_schedules where organisation_id=new.organisation_id and id=split_part(new.target,':',2)::uuid and account_id=new.account_id and environment=new.environment;
  org:=schedule.organisation_id;agreement:=schedule.agreement_id;rev:=schedule.revision;env:=schedule.environment;
 else
  select * into strict schedule from operations.billing_schedules where organisation_id=new.organisation_id and id=new.schedule_id;
  org:=new.organisation_id;agreement:=new.proposed_agreement_id;rev:=new.proposed_revision;env:=schedule.environment;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(org::text||':'||agreement::text||':'||rev::text||':'||env,0));
 if tg_table_name='billing_amendment_previews' then
  if exists(select 1 from operations.billing_schedules s where s.organisation_id=org and s.agreement_id=agreement and s.revision=rev and s.environment=env and (s.provider_reference is not null or exists(select 1 from operations.billing_commands c where c.organisation_id=org and c.environment=env and c.target='schedule:'||s.id::text))) then raise exception 'Proposed amendment already has a collection claim; reconcile before preview'; end if;
 else
  if exists(select 1 from operations.billing_amendment_previews p join operations.billing_schedules s on s.organisation_id=p.organisation_id and s.id=p.schedule_id where p.organisation_id=org and p.proposed_agreement_id=agreement and p.proposed_revision=rev and s.environment=env) then raise exception 'Proposed amendment is held for founder approval and cannot be issued independently'; end if;
 end if;
 return new;
end $$;
create trigger guard_billing_amendment_hold before insert on operations.billing_schedules for each row execute function operations.guard_billing_amendment_hold();
create trigger guard_billing_amendment_hold before insert on operations.billing_commands for each row execute function operations.guard_billing_amendment_hold();
create trigger guard_billing_amendment_hold before insert on operations.billing_amendment_previews for each row execute function operations.guard_billing_amendment_hold();
revoke all on function operations.guard_billing_amendment_hold() from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal;
