-- Keep legacy GBP rows and signed financial evidence immutable. No currency conversion.
alter table operations.billing_customers add column currency text not null default 'GBP' check(currency in ('GBP','USD','EUR'));
alter table operations.billing_customers drop constraint billing_customers_organisation_id_account_id_environment_key;
alter table operations.billing_customers add unique(organisation_id,account_id,environment,currency);
alter table operations.billing_schedules drop constraint billing_schedules_currency_check;
alter table operations.billing_schedules add check(currency in ('GBP','USD','EUR'));
alter table operations.invoices drop constraint invoices_currency_check;
alter table operations.invoices add check(currency in ('GBP','USD','EUR'));
alter table operations.payments drop constraint payments_currency_check;
alter table operations.payments add check(currency in ('GBP','USD','EUR'));
alter table operations.payment_refunds add column currency text not null default 'GBP' check(currency in ('GBP','USD','EUR'));
alter table operations.payment_disputes add column currency text not null default 'GBP' check(currency in ('GBP','USD','EUR'));
alter table operations.invoice_credits add column currency text not null default 'GBP' check(currency in ('GBP','USD','EUR'));

create or replace function operations.guard_billing_schedule() returns trigger language plpgsql set search_path='' as $$
declare snapshot jsonb; obligation jsonb; idx integer; expected_amount numeric; expected_owner text;
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-'provider_reference') is distinct from (to_jsonb(old)-'provider_reference') or old.provider_reference is not null then raise exception 'Billing schedule is immutable'; end if;
  return new;
 end if;
 select r.snapshot into strict snapshot from operations.agreement_revisions r where r.organisation_id=new.organisation_id and r.agreement_id=new.agreement_id and r.revision=new.revision;
 if new.currency is distinct from snapshot->>'currency' then raise exception 'Billing currency must match signed revision'; end if;
 if snapshot is distinct from new.signed_snapshot then raise exception 'Billing snapshot must match signed revision'; end if;
 if new.obligation_key !~ '^(installment|line):[1-9][0-9]*$' then raise exception 'Invalid billing obligation'; end if;
 idx:=split_part(new.obligation_key,':',2)::integer-1;
 if split_part(new.obligation_key,':',1)='installment' then
  obligation:=snapshot->'installments'->idx;expected_amount:=(obligation->>'amountPence')::numeric;expected_owner:='invoice';
  if new.due_date::text is distinct from obligation->>'dueDate' or new.end_date is not null then raise exception 'Invalid installment dates'; end if;
 else
  if snapshot->'revenueShare' is not null and snapshot->'revenueShare'<>'null'::jsonb then raise exception 'Revenue share does not create fixed recurring billing'; end if;
  obligation:=snapshot->'lines'->idx;expected_amount:=(obligation->>'unitPence')::numeric*(obligation->>'quantity')::numeric-(obligation->>'discountPence')::numeric+(obligation->>'taxPence')::numeric;expected_owner:='subscription';
  if new.due_date::text is distinct from obligation->>'startDate' or new.end_date::text is distinct from obligation->>'endDate' or new.recurrence_months is distinct from (obligation->>'recurrenceMonths')::integer or new.recurrence_months=0 then raise exception 'Invalid recurring dates'; end if;
 end if;
 if obligation is null or expected_amount is distinct from new.amount_pence or expected_owner<>new.owner then raise exception 'Billing obligation must match signed allocation'; end if;
 if new.due_date<(select (e.evidence->>'signedDate')::date from operations.signature_evidence e where e.organisation_id=new.organisation_id and e.agreement_id=new.agreement_id and e.revision=new.revision) then raise exception 'Billing date precedes signing'; end if;
 return new;
end $$;

create or replace function operations.guard_billing_invoice() returns trigger language plpgsql set search_path='' as $$
begin
 if new.amount_due_pence is null then new.amount_due_pence:=new.total_pence; end if;
 if tg_op='UPDATE' and (to_jsonb(new)-array['status','amount_paid_pence','amount_remaining_pence','amount_due_pence','amount_overpaid_pence','projected_at']) is distinct from (to_jsonb(old)-array['status','amount_paid_pence','amount_remaining_pence','amount_due_pence','amount_overpaid_pence','projected_at']) then raise exception 'Issued invoice snapshot is immutable'; end if;
 if not exists(select 1 from operations.billing_schedules s where s.organisation_id=new.organisation_id and s.id=new.schedule_id and s.account_id=new.account_id and s.environment=new.environment and s.currency=new.currency) then raise exception 'Invoice account must match schedule'; end if;
 return new;
end $$;

create or replace function operations.guard_payment_allocation() returns trigger language plpgsql set search_path='' as $$
declare p operations.payments; i operations.invoices; allocated numeric;
begin
 select * into strict p from operations.payments where organisation_id=new.organisation_id and id=new.payment_id for update;
 select * into strict i from operations.invoices where organisation_id=new.organisation_id and id=new.invoice_id for update;
 if p.account_id<>i.account_id or p.environment<>i.environment or p.currency<>i.currency then raise exception 'Allocation account mismatch'; end if;
 if tg_op='UPDATE' and ((to_jsonb(new)-array['amount_pence','provider_paid_pence','excess_pence']) is distinct from (to_jsonb(old)-array['amount_pence','provider_paid_pence','excess_pence']) or (old.provider_paid_pence>0 and (new.amount_pence<>old.amount_pence or new.provider_paid_pence<>old.provider_paid_pence))) then raise exception 'Paid allocation evidence is immutable'; end if;
 select coalesce(sum(provider_paid_pence),0) into allocated from operations.payment_allocations where payment_id=new.payment_id and invoice_id<>new.invoice_id;
 if allocated+new.provider_paid_pence>p.received_pence then raise exception 'Payment over-allocation'; end if;
 select coalesce(sum(amount_pence),0) into allocated from operations.payment_allocations where invoice_id=new.invoice_id and payment_id<>new.payment_id;
 if allocated+new.amount_pence>i.amount_due_pence then raise exception 'Invoice over-allocation'; end if;
 select coalesce(sum(excess_pence),0) into allocated from operations.payment_allocations where invoice_id=new.invoice_id and payment_id<>new.payment_id;
 if allocated+new.provider_paid_pence-new.amount_pence>i.amount_overpaid_pence then raise exception 'Unverified invoice excess allocation'; end if;
 return new;
end $$;

create or replace function operations.guard_billing_amendment_hold() returns trigger language plpgsql set search_path='' as $$
declare org uuid; agreement uuid; rev integer; env text; schedule operations.billing_schedules;
begin
 if tg_table_name='billing_schedules' then
  org:=new.organisation_id;agreement:=new.agreement_id;rev:=new.revision;env:=new.environment;
 elsif tg_table_name='billing_commands' then
  if new.target='customer' or new.target in ('customer:USD','customer:EUR') then return new; end if;
  if new.target !~ '^schedule:[0-9a-f-]{36}$' then raise exception 'Invalid billing command target'; end if;
  select * into strict schedule from operations.billing_schedules where organisation_id=new.organisation_id and id=split_part(new.target,':',2)::uuid and account_id=new.account_id and environment=new.environment;
  org:=schedule.organisation_id;agreement:=schedule.agreement_id;rev:=schedule.revision;env:=schedule.environment;
 else
  select * into strict schedule from operations.billing_schedules where organisation_id=new.organisation_id and id=new.schedule_id;
  if new.preview->>'currency' is distinct from schedule.currency or (select snapshot->>'currency' from operations.agreement_revisions where organisation_id=new.organisation_id and agreement_id=new.proposed_agreement_id and revision=new.proposed_revision) is distinct from schedule.currency then raise exception 'Amendment currencies must match'; end if;
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

create function operations.guard_adjustment_currency() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='invoice_credits' then
  if not exists(select 1 from operations.invoices i where i.id=new.invoice_id and i.organisation_id=new.organisation_id and i.account_id=new.account_id and i.environment=new.environment and i.currency=new.currency) then raise exception 'Credit currency must match invoice'; end if;
 else
  if not exists(select 1 from operations.payments p where p.id=new.payment_id and p.organisation_id=new.organisation_id and p.account_id=new.account_id and p.environment=new.environment and p.currency=new.currency) then raise exception 'Adjustment currency must match payment'; end if;
 end if;
 return new;
end $$;
create trigger guard_adjustment_currency before insert or update on operations.payment_refunds for each row execute function operations.guard_adjustment_currency();
create trigger guard_adjustment_currency before insert or update on operations.payment_disputes for each row execute function operations.guard_adjustment_currency();
create trigger guard_adjustment_currency before insert or update on operations.invoice_credits for each row execute function operations.guard_adjustment_currency();
revoke all on function operations.guard_adjustment_currency() from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder,operations_billing_worker;

create or replace function operations.onboarding_billing_context(job uuid, token uuid, expected_generation integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs; j operations.onboarding_journeys; a operations.onboarding_approvals; p operations.signing_approvals;
 s operations.billing_schedules; customer_command operations.billing_commands; invoice_command operations.billing_commands;
 currency text; customer_target text; account text; env text; selected_key text; obligation jsonb; idx integer; owner text; amount numeric; due date; finish date; months integer; description text;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' then raise exception 'Onboarding billing is unavailable' using errcode='42501'; end if;
 select * into strict j from operations.onboarding_journeys where id=(select journey_id from operations.onboarding_jobs where id=job) for update;
 select * into strict b from operations.onboarding_jobs where id=job and step='invoice' for update;
 if not operations.onboarding_can_execute(job,token,expected_generation) then raise exception 'Onboarding billing is unavailable' using errcode='42501'; end if;
 select * into strict a from operations.onboarding_approvals where id=j.approval_id;
 select p1.* into strict p from operations.signing_approvals p1 join operations.onboarding_proposal_approvals p2 on p2.signing_approval_id=p1.id where p2.id=j.proposal_approval_id and p1.status='completed';
 if exists(select 1 from jsonb_array_elements(p.snapshot->'lines') line where (line->>'taxPence')::numeric>0) then raise exception 'Signed tax mapping requires founder review'; end if;
 account:=a.snapshot->'invoice'->>'accountId'; env:=case when (a.snapshot->'invoice'->>'livemode')::boolean then 'live' else 'test' end;
 currency:=p.snapshot->>'currency';
 customer_target:=case when currency='GBP' then 'customer' else 'customer:'||currency end;
 selected_key:=a.snapshot->'invoice'->>'obligationKey';
 if selected_key !~ '^(installment|line):[1-9][0-9]*$' then raise exception 'Invalid first billing obligation'; end if;
 idx:=split_part(selected_key,':',2)::integer-1;
 if split_part(selected_key,':',1)='installment' then
  obligation:=p.snapshot->'installments'->idx;owner:='invoice';amount:=(obligation->>'amountPence')::numeric;due:=(obligation->>'dueDate')::date;months:=0;description:=(p.snapshot->>'title')||': installment '||(idx+1)::text;
 else
  if p.snapshot->'revenueShare' is not null and p.snapshot->'revenueShare'<>'null'::jsonb then raise exception 'Revenue share does not create fixed recurring billing'; end if;
  obligation:=p.snapshot->'lines'->idx;owner:='subscription';amount:=(obligation->>'unitPence')::numeric*(obligation->>'quantity')::numeric-(obligation->>'discountPence')::numeric+(obligation->>'taxPence')::numeric;
  due:=(obligation->>'startDate')::date;finish:=(obligation->>'endDate')::date;months:=(obligation->>'recurrenceMonths')::integer;description:=obligation->>'description';
 end if;
 if obligation is null then raise exception 'Approved billing obligation is missing'; end if;
 if not operations.onboarding_can_execute(job,token,expected_generation) then raise exception 'Onboarding billing is unavailable' using errcode='42501'; end if;
 insert into operations.billing_schedules(organisation_id,agreement_id,revision,account_id,environment,obligation_key,owner,amount_pence,currency,due_date,end_date,recurrence_months,description,signed_snapshot,created_by,correlation_id)
 values(b.organisation_id,j.agreement_id,p.revision,account,env,selected_key,owner,amount,currency,due,finish,months,description,p.snapshot,'system:operations-onboarding',job) on conflict do nothing;
 select * into strict s from operations.billing_schedules x where x.organisation_id=b.organisation_id and x.agreement_id=j.agreement_id and x.revision=p.revision and x.environment=env and x.obligation_key=selected_key;
 if s.account_id<>account then raise exception 'Billing account conflict'; end if;
 insert into operations.billing_commands(organisation_id,account_id,environment,command_key,target,created_by,correlation_id)
 values(b.organisation_id,account,env,customer_target,customer_target,'system:operations-onboarding',job) on conflict do nothing;
 select * into strict customer_command from operations.billing_commands where organisation_id=b.organisation_id and account_id=account and environment=env and target=customer_target;
 insert into operations.billing_commands(organisation_id,account_id,environment,command_key,target,created_by,correlation_id)
 values(b.organisation_id,account,env,'onboarding:'||job::text,'schedule:'||s.id::text,'system:operations-onboarding',job) on conflict do nothing;
 select * into strict invoice_command from operations.billing_commands where organisation_id=b.organisation_id and account_id=account and environment=env and target='schedule:'||s.id::text;
 return jsonb_build_object(
 'schedule',jsonb_build_object('id',s.id,'organisationId',s.organisation_id,'agreementId',s.agreement_id,'revision',s.revision,'accountId',s.account_id,'mode',s.environment,'key',s.obligation_key,'owner',s.owner,'currency',s.currency,'amountPence',s.amount_pence::text,'dueDate',s.due_date::text,'endDate',s.end_date::text,'recurrenceMonths',s.recurrence_months,'description',s.description,'providerReference',s.provider_reference),
 'customerCommand',jsonb_build_object('id',customer_command.id,'createdAt',customer_command.created_at,'target',customer_command.target,'result',customer_command.result),
 'invoiceCommand',jsonb_build_object('id',invoice_command.id,'createdAt',invoice_command.created_at,'target',invoice_command.target,'result',invoice_command.result),
 'customerId',(select provider_customer_id from operations.billing_customers where organisation_id=b.organisation_id and account_id=account and environment=env and billing_customers.currency=s.currency),
 'name',p.organisation_legal_name,'email',p.snapshot->>'billingContact');
end $$;

create or replace function operations.onboarding_record_billing(job uuid, token uuid, kind text, payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs; j operations.onboarding_journeys; a operations.onboarding_approvals; p operations.onboarding_proposal_approvals; s operations.billing_schedules; c operations.billing_commands;
 account text; env text; provider_ref text:=payload->>'providerId'; selected_target text;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' or not exists(select 1 from operations.onboarding_attempts where job_id=job and lease_token=token) then raise exception 'No authorized billing attempt' using errcode='42501'; end if;
 select * into strict j from operations.onboarding_journeys where id=(select journey_id from operations.onboarding_jobs where id=job) for update;
 select * into strict b from operations.onboarding_jobs where id=job and step='invoice' for update;
 select * into strict a from operations.onboarding_approvals where id=j.approval_id;
 select * into strict p from operations.onboarding_proposal_approvals where id=j.proposal_approval_id;
 account:=a.snapshot->'invoice'->>'accountId';env:=case when (a.snapshot->'invoice'->>'livemode')::boolean then 'live' else 'test' end;
 select * into strict s from operations.billing_schedules where organisation_id=b.organisation_id and agreement_id=j.agreement_id and revision=(p.snapshot->>'revision')::integer and account_id=account and environment=env and obligation_key=a.snapshot->'invoice'->>'obligationKey';
 if kind='customer' then
  if provider_ref !~ '^cus_[A-Za-z0-9]+$' then raise exception 'Invalid customer receipt'; end if;
  selected_target:=case when s.currency='GBP' then 'customer' else 'customer:'||s.currency end;
  insert into operations.billing_customers(organisation_id,account_id,environment,currency,provider_customer_id,created_by,correlation_id) values(b.organisation_id,account,env,s.currency,provider_ref,'system:operations-onboarding',job) on conflict do nothing;
  if not exists(select 1 from operations.billing_customers where organisation_id=b.organisation_id and account_id=account and environment=env and provider_customer_id=provider_ref and currency=s.currency) then raise exception 'Customer receipt conflict'; end if;
 elsif kind='invoice' then
  if provider_ref !~ '^(in|sub|sub_sched)_[A-Za-z0-9]+$' then raise exception 'Invalid billing receipt'; end if;
  selected_target:='schedule:'||s.id::text;
  if s.provider_reference is not null and s.provider_reference<>provider_ref then raise exception 'Billing owner conflict'; end if;
  if s.provider_reference is null then update operations.billing_schedules set provider_reference=provider_ref where id=s.id; end if;
  if payload->'invoice' is not null and payload->'invoice'<>'null'::jsonb then
   if payload->'invoice'->'snapshot'->>'currency' is distinct from s.currency then raise exception 'Invoice currency differs from signed obligation'; end if;
   if payload->'invoice'->>'status' not in ('open','paid','void','uncollectible') or (payload->'invoice'->>'totalPence')::numeric<>s.amount_pence or payload->'invoice'->>'providerInvoiceId' !~ '^in_[A-Za-z0-9]+$' then raise exception 'Invoice differs from signed obligation'; end if;
   insert into operations.invoices(organisation_id,schedule_id,account_id,environment,provider_invoice_id,number,status,currency,total_pence,amount_due_pence,amount_overpaid_pence,amount_paid_pence,amount_remaining_pence,due_date,issued_snapshot,projected_at,created_by,correlation_id)
   values(b.organisation_id,s.id,account,env,payload->'invoice'->>'providerInvoiceId',payload->'invoice'->>'number',payload->'invoice'->>'status',s.currency,(payload->'invoice'->>'totalPence')::numeric,(payload->'invoice'->>'amountDuePence')::numeric,(payload->'invoice'->>'amountOverpaidPence')::numeric,(payload->'invoice'->>'amountPaidPence')::numeric,(payload->'invoice'->>'amountRemainingPence')::numeric,(payload->'invoice'->>'dueDate')::date,payload->'invoice'->'snapshot',clock_timestamp(),'system:operations-onboarding',job) on conflict do nothing;
  end if;
 else raise exception 'Invalid billing effect';
 end if;
 select * into strict c from operations.billing_commands where organisation_id=b.organisation_id and account_id=account and environment=env and billing_commands.target=selected_target for update;
 if c.state='completed' and c.result->>'providerId' is distinct from provider_ref then raise exception 'Permanent billing command conflict'; end if;
 if c.state='pending' then update operations.billing_commands set state='completed',result=jsonb_build_object('providerId',provider_ref,'invoiceId',payload->'invoice'->>'providerInvoiceId') where id=c.id; end if;
end $$;

create or replace function operations.guard_billing_customer() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from operations.signature_evidence e join operations.agreement_revisions r using(organisation_id,agreement_id,revision) where e.organisation_id=new.organisation_id and r.snapshot->>'currency'=new.currency) then raise exception 'Signed agreement in customer currency required for billing customer'; end if;
 return new;
end $$;
