-- Promoted through the approved Operations production release gate. Dedicated service role; no human identity context or Growth access.
create role operations_billing_worker nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant usage on schema operations to operations_billing_worker;
-- Provider amount due includes customer starting balance; the signed invoice total stays immutable.
alter table operations.invoices add column amount_due_pence numeric(18,0) check(amount_due_pence>=0), add column amount_overpaid_pence numeric(18,0) not null default 0 check(amount_overpaid_pence>=0);
create or replace function operations.guard_billing_invoice() returns trigger language plpgsql set search_path='' as $$
begin
 if new.amount_due_pence is null then new.amount_due_pence:=new.total_pence; end if;
 if tg_op='UPDATE' and (to_jsonb(new)-array['status','amount_paid_pence','amount_remaining_pence','amount_due_pence','amount_overpaid_pence','projected_at']) is distinct from (to_jsonb(old)-array['status','amount_paid_pence','amount_remaining_pence','amount_due_pence','amount_overpaid_pence','projected_at']) then raise exception 'Issued invoice snapshot is immutable'; end if;
 if not exists(select 1 from operations.billing_schedules s where s.organisation_id=new.organisation_id and s.id=new.schedule_id and s.account_id=new.account_id and s.environment=new.environment) then raise exception 'Invoice account must match schedule'; end if;
 return new;
end $$;
update operations.invoices set amount_due_pence=total_pence;
alter table operations.invoices alter column amount_due_pence set not null;
create table operations.billing_provider_events (
 id uuid primary key default gen_random_uuid(),account_id text not null check(account_id ~ '^acct_[A-Za-z0-9]+$'),environment text not null check(environment in ('test','live')),
 provider_event_id text not null,event_type text not null,object_id text not null,payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),occurred_at timestamptz not null,
 received_at timestamptz not null default now(),state text not null default 'pending' check(state in ('pending','processing','completed','exception')),
 attempts integer not null default 0,lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz not null default now(),completed_at timestamptz,
 unique(account_id,environment,provider_event_id)
);
create index billing_event_due on operations.billing_provider_events(account_id,environment,next_attempt_at) where state in ('pending','processing');
create table operations.billing_reconciliation_cursors (
 account_id text not null,environment text not null check(environment in ('test','live')),cursor text,pending_invoice_ids text[] not null default '{}',pending_cursor text,pending_page boolean not null default false,
 lease_token uuid,lease_until timestamptz,next_run_at timestamptz not null default now(),completed_at timestamptz,
 primary key(account_id,environment)
);
create table operations.billing_projection_leases (
 account_id text not null,environment text not null,object_id text not null,lease_token uuid not null,lease_until timestamptz not null,
 primary key(account_id,environment,object_id)
);
create table operations.payments (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null references operations.organisations(id),account_id text not null,environment text not null check(environment in ('test','live')),
 provider_payment_id text not null,state text not null check(state in ('pending','processing','succeeded','failed','canceled')),
 method text not null check(method in ('card','bacs_debit','other')),currency text not null default 'GBP' check(currency='GBP'),
 amount_pence numeric(18,0) not null check(amount_pence>=0),received_pence numeric(18,0) not null check(received_pence>=0),confirmed_at timestamptz,failure_code text,provider_mandate_id text,provider_created_at timestamptz not null,projected_at timestamptz not null default now(),
 check((state='succeeded')=(confirmed_at is not null)),unique(account_id,environment,provider_payment_id),unique(organisation_id,id)
);
create table operations.payment_allocations (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null,invoice_id uuid not null,payment_id uuid not null,provider_allocation_id text not null,
 amount_pence numeric(18,0) not null check(amount_pence>=0),provider_paid_pence numeric(18,0) not null check(provider_paid_pence>=amount_pence),excess_pence numeric(18,0) generated always as (provider_paid_pence-amount_pence) stored,
 foreign key(organisation_id,invoice_id) references operations.invoices(organisation_id,id),foreign key(organisation_id,payment_id) references operations.payments(organisation_id,id),
 unique(payment_id,provider_allocation_id),unique(payment_id,invoice_id)
);
alter table operations.payments add unique(organisation_id,id,account_id,environment);
alter table operations.invoices add unique(organisation_id,id,account_id,environment);
create table operations.payment_refunds (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null,account_id text not null,environment text not null,payment_id uuid not null,provider_refund_id text not null,
 amount_pence numeric(18,0) not null check(amount_pence>0),status text not null check(status in ('pending','requires_action','succeeded','failed','canceled')),projected_at timestamptz not null default now(),
 foreign key(organisation_id,payment_id,account_id,environment) references operations.payments(organisation_id,id,account_id,environment),unique(payment_id,provider_refund_id),unique(account_id,environment,provider_refund_id)
);
create table operations.payment_disputes (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null,account_id text not null,environment text not null,payment_id uuid not null,provider_dispute_id text not null,
 amount_pence numeric(18,0) not null check(amount_pence>0),status text not null check(status in ('warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','won','lost','prevented')),projected_at timestamptz not null default now(),
 foreign key(organisation_id,payment_id,account_id,environment) references operations.payments(organisation_id,id,account_id,environment),unique(payment_id,provider_dispute_id),unique(account_id,environment,provider_dispute_id)
);
create table operations.invoice_credits (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null,account_id text not null,environment text not null,invoice_id uuid not null,provider_credit_id text not null,
 amount_pence numeric(18,0) not null check(amount_pence>=0),status text not null check(status in ('issued','void')),projected_at timestamptz not null default now(),
 foreign key(organisation_id,invoice_id,account_id,environment) references operations.invoices(organisation_id,id,account_id,environment),unique(invoice_id,provider_credit_id),unique(account_id,environment,provider_credit_id)
);
create table operations.mandate_projections (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null,customer_id uuid not null,account_id text not null,environment text not null check(environment in ('test','live')),
 provider_mandate_id text not null,status text not null check(status in ('active','inactive','pending')),projected_at timestamptz not null default now(),
 foreign key(organisation_id,customer_id) references operations.billing_customers(organisation_id,id),unique(account_id,environment,provider_mandate_id)
);
create table operations.billing_collection_holds (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null,invoice_id uuid not null,created_by text not null,created_at timestamptz not null default now(),released_at timestamptz,
 foreign key(organisation_id,invoice_id) references operations.invoices(organisation_id,id)
);
create unique index billing_active_hold on operations.billing_collection_holds(invoice_id) where released_at is null;
create table operations.billing_exceptions (
 id uuid primary key default gen_random_uuid(),organisation_id uuid references operations.organisations(id),account_id text not null,environment text not null check(environment in ('test','live')),
 object_id text not null,category text not null check(category in ('unknown_mapping','scope_mismatch','incomplete_provider_data','invalid_projection','provider_unavailable','overpayment_review','refund_review','dispute_review','uncollectible_review','overdue_review','provider_retry_review','new_mandate_required','payment_method_required')),
 operation_key text not null unique,created_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),resolved_at timestamptz
);
create index billing_open_exceptions on operations.billing_exceptions(account_id,environment,created_at) where resolved_at is null;
-- A service principal is explicit in append-only invoice audit records.
alter table operations.audit_events drop constraint audit_events_actor_id_check;
alter table operations.audit_events add constraint audit_events_actor_id_check check(actor_id ~ '^[a-f0-9]{64}$' or actor_id='system:operations-billing');
create function operations.guard_payment_evidence() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['state','method','received_pence','confirmed_at','failure_code','provider_mandate_id','projected_at']) is distinct from (to_jsonb(old)-array['state','method','received_pence','confirmed_at','failure_code','provider_mandate_id','projected_at']) then raise exception 'Payment identity and amount are immutable'; end if;
 if old.state='succeeded' and (new.state<>old.state or new.received_pence<>old.received_pence or new.confirmed_at is distinct from old.confirmed_at) then raise exception 'Paid evidence is immutable'; end if;
 return new;
end $$;
create trigger guard_payment_evidence before update on operations.payments for each row execute function operations.guard_payment_evidence();
create function operations.guard_payment_allocation() returns trigger language plpgsql set search_path='' as $$
declare p operations.payments; i operations.invoices; allocated numeric;
begin
 select * into strict p from operations.payments where organisation_id=new.organisation_id and id=new.payment_id for update;
 select * into strict i from operations.invoices where organisation_id=new.organisation_id and id=new.invoice_id for update;
 if p.account_id<>i.account_id or p.environment<>i.environment then raise exception 'Allocation account mismatch'; end if;
 if tg_op='UPDATE' and ((to_jsonb(new)-array['amount_pence','provider_paid_pence','excess_pence']) is distinct from (to_jsonb(old)-array['amount_pence','provider_paid_pence','excess_pence']) or (old.provider_paid_pence>0 and (new.amount_pence<>old.amount_pence or new.provider_paid_pence<>old.provider_paid_pence))) then raise exception 'Paid allocation evidence is immutable'; end if;
 select coalesce(sum(provider_paid_pence),0) into allocated from operations.payment_allocations where payment_id=new.payment_id and invoice_id<>new.invoice_id;
 if allocated+new.provider_paid_pence>p.received_pence then raise exception 'Payment over-allocation'; end if;
 select coalesce(sum(amount_pence),0) into allocated from operations.payment_allocations where invoice_id=new.invoice_id and payment_id<>new.payment_id;
 if allocated+new.amount_pence>i.amount_due_pence then raise exception 'Invoice over-allocation'; end if;
 select coalesce(sum(excess_pence),0) into allocated from operations.payment_allocations where invoice_id=new.invoice_id and payment_id<>new.payment_id;
 if allocated+new.provider_paid_pence-new.amount_pence>i.amount_overpaid_pence then raise exception 'Unverified invoice excess allocation'; end if;
 return new;
end $$;
create trigger guard_payment_allocation before insert or update on operations.payment_allocations for each row execute function operations.guard_payment_allocation();
create function operations.guard_financial_adjustment() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['status','projected_at']) is distinct from (to_jsonb(old)-array['status','projected_at']) then raise exception 'Financial adjustment identity and amount are immutable'; end if;
 return new;
end $$;
create trigger guard_financial_adjustment before update on operations.payment_refunds for each row execute function operations.guard_financial_adjustment();
create trigger guard_financial_adjustment before update on operations.payment_disputes for each row execute function operations.guard_financial_adjustment();
create trigger guard_financial_adjustment before update on operations.invoice_credits for each row execute function operations.guard_financial_adjustment();
create function operations.guard_billing_receipt() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['state','attempts','lease_token','lease_until','next_attempt_at','completed_at']) is distinct from (to_jsonb(old)-array['state','attempts','lease_token','lease_until','next_attempt_at','completed_at']) then raise exception 'Verified event receipt is immutable'; end if;
 return new;
end $$;
create trigger guard_billing_receipt before update on operations.billing_provider_events for each row execute function operations.guard_billing_receipt();
do $$ declare t text; begin
 foreach t in array array['billing_projection_leases','billing_provider_events','billing_reconciliation_cursors','payments','payment_allocations','payment_refunds','payment_disputes','invoice_credits','mandate_projections','billing_collection_holds','billing_exceptions'] loop
 execute format('alter table operations.%I enable row level security',t);
 execute format('alter table operations.%I force row level security',t);
 execute format('revoke all on operations.%I from public,anon,authenticated,service_role,growth_app,operations_portal',t);
 execute format('create policy worker_read on operations.%I for select to operations_billing_worker using(true)',t);
 execute format('grant select on operations.%I to operations_billing_worker',t);
 execute format('create policy founder_read on operations.%I for select to operations_founder using(current_setting(''operations.actor_id'',true) ~ ''^[a-f0-9]{64}$'')',t);
 execute format('grant select on operations.%I to operations_founder',t);
 if t<>'billing_collection_holds' then
 execute format('create policy worker_insert on operations.%I for insert to operations_billing_worker with check(true)',t);
 execute format('create policy worker_update on operations.%I for update to operations_billing_worker using(true) with check(true)',t);
 execute format('grant insert,update on operations.%I to operations_billing_worker',t);
 end if;
 end loop;
 foreach t in array array['billing_customers','billing_schedules','invoices'] loop
 execute format('create policy worker_read on operations.%I for select to operations_billing_worker using(true)',t);
 execute format('grant select on operations.%I to operations_billing_worker',t);
 end loop;
end $$;
create policy worker_insert on operations.invoices for insert to operations_billing_worker with check(created_by='system:operations-billing');
create policy worker_update on operations.invoices for update to operations_billing_worker using(true) with check(true);
grant insert on operations.invoices to operations_billing_worker;
grant update(status,amount_paid_pence,amount_remaining_pence,amount_due_pence,amount_overpaid_pence,projected_at) on operations.invoices to operations_billing_worker;
create policy founder_insert on operations.billing_collection_holds for insert to operations_founder with check(created_by=current_setting('operations.actor_id',true) and created_by ~ '^[a-f0-9]{64}$');
create policy founder_update on operations.billing_collection_holds for update to operations_founder using(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$') with check(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
grant insert on operations.billing_collection_holds to operations_founder;
grant update(released_at) on operations.billing_collection_holds to operations_founder;
create policy founder_update on operations.billing_exceptions for update to operations_founder using(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$') with check(current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
grant update(resolved_at) on operations.billing_exceptions to operations_founder;
do $$ declare t text; begin
 foreach t in array array['payments','payment_allocations','payment_refunds','payment_disputes','invoice_credits','mandate_projections'] loop
 execute format('create policy portal_read on operations.%I for select to operations_portal using(operations.portal_has_membership(organisation_id,array[''owner'',''billing_contact'']))',t);
 execute format('grant select on operations.%I to operations_portal',t);
 end loop;
end $$;
revoke all on function operations.guard_payment_evidence(),operations.guard_payment_allocation(),operations.guard_financial_adjustment(),operations.guard_billing_receipt() from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder,operations_billing_worker;
