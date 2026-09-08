-- Narrow delegation of the approved first billing obligation. No founder impersonation.
alter table operations.audit_events drop constraint audit_events_actor_id_check;
alter table operations.audit_events add constraint audit_events_actor_id_check check(actor_id ~ '^[a-f0-9]{64}$' or actor_id in ('system:operations-billing','system:operations-signing','system:operations-onboarding'));
create function operations.onboarding_billing_context(job uuid, token uuid, expected_generation integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs; j operations.onboarding_journeys; a operations.onboarding_approvals; p operations.signing_approvals;
 s operations.billing_schedules; customer_command operations.billing_commands; invoice_command operations.billing_commands;
 account text; env text; selected_key text; obligation jsonb; idx integer; owner text; amount numeric; due date; finish date; months integer; description text;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' or not operations.onboarding_can_execute(job,token,expected_generation) then raise exception 'Onboarding billing is unavailable' using errcode='42501'; end if;
 select * into strict b from operations.onboarding_jobs where id=job and step='invoice' for update;
 select * into strict j from operations.onboarding_journeys where id=b.journey_id;
 select * into strict a from operations.onboarding_approvals where id=j.approval_id;
 select p1.* into strict p from operations.signing_approvals p1 join operations.onboarding_proposal_approvals p2 on p2.signing_approval_id=p1.id where p2.id=j.proposal_approval_id and p1.status='completed';
 if exists(select 1 from jsonb_array_elements(p.snapshot->'lines') line where (line->>'taxPence')::numeric>0) then raise exception 'Signed tax mapping requires founder review'; end if;
 account:=a.snapshot->'invoice'->>'accountId'; env:=case when (a.snapshot->'invoice'->>'livemode')::boolean then 'live' else 'test' end;
 selected_key:=a.snapshot->'invoice'->>'obligationKey';
 if selected_key !~ '^(installment|line):[1-9][0-9]*$' then raise exception 'Invalid first billing obligation'; end if;
 idx:=split_part(selected_key,':',2)::integer-1;
 if split_part(selected_key,':',1)='installment' then
  obligation:=p.snapshot->'installments'->idx;owner:='invoice';amount:=(obligation->>'amountPence')::numeric;due:=(obligation->>'dueDate')::date;months:=0;description:=(p.snapshot->>'title')||': installment '||(idx+1)::text;
 else
  obligation:=p.snapshot->'lines'->idx;owner:='subscription';amount:=(obligation->>'unitPence')::numeric*(obligation->>'quantity')::numeric-(obligation->>'discountPence')::numeric+(obligation->>'taxPence')::numeric;
  due:=(obligation->>'startDate')::date;finish:=(obligation->>'endDate')::date;months:=(obligation->>'recurrenceMonths')::integer;description:=obligation->>'description';
 end if;
 if obligation is null then raise exception 'Approved billing obligation is missing'; end if;
 insert into operations.billing_schedules(organisation_id,agreement_id,revision,account_id,environment,obligation_key,owner,amount_pence,due_date,end_date,recurrence_months,description,signed_snapshot,created_by,correlation_id)
 values(b.organisation_id,j.agreement_id,p.revision,account,env,selected_key,owner,amount,due,finish,months,description,p.snapshot,'system:operations-onboarding',job) on conflict do nothing;
 select * into strict s from operations.billing_schedules x where x.organisation_id=b.organisation_id and x.agreement_id=j.agreement_id and x.revision=p.revision and x.environment=env and x.obligation_key=selected_key;
 if s.account_id<>account then raise exception 'Billing account conflict'; end if;
 insert into operations.billing_commands(organisation_id,account_id,environment,command_key,target,created_by,correlation_id)
 values(b.organisation_id,account,env,'customer','customer','system:operations-onboarding',job) on conflict do nothing;
 select * into strict customer_command from operations.billing_commands where organisation_id=b.organisation_id and account_id=account and environment=env and target='customer';
 insert into operations.billing_commands(organisation_id,account_id,environment,command_key,target,created_by,correlation_id)
 values(b.organisation_id,account,env,'onboarding:'||job::text,'schedule:'||s.id::text,'system:operations-onboarding',job) on conflict do nothing;
 select * into strict invoice_command from operations.billing_commands where organisation_id=b.organisation_id and account_id=account and environment=env and target='schedule:'||s.id::text;
 return jsonb_build_object(
 'schedule',jsonb_build_object('id',s.id,'organisationId',s.organisation_id,'agreementId',s.agreement_id,'revision',s.revision,'accountId',s.account_id,'mode',s.environment,'key',s.obligation_key,'owner',s.owner,'amountPence',s.amount_pence::text,'dueDate',s.due_date::text,'endDate',s.end_date::text,'recurrenceMonths',s.recurrence_months,'description',s.description,'providerReference',s.provider_reference),
 'customerCommand',jsonb_build_object('id',customer_command.id,'createdAt',customer_command.created_at,'target',customer_command.target,'result',customer_command.result),
 'invoiceCommand',jsonb_build_object('id',invoice_command.id,'createdAt',invoice_command.created_at,'target',invoice_command.target,'result',invoice_command.result),
 'customerId',(select provider_customer_id from operations.billing_customers where organisation_id=b.organisation_id and account_id=account and environment=env),
 'name',p.organisation_legal_name,'email',p.snapshot->>'billingContact');
end $$;

create function operations.onboarding_record_billing(job uuid, token uuid, kind text, payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs; j operations.onboarding_journeys; a operations.onboarding_approvals; p operations.onboarding_proposal_approvals; s operations.billing_schedules; c operations.billing_commands;
 account text; env text; provider_ref text:=payload->>'providerId'; selected_target text;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' or not exists(select 1 from operations.onboarding_attempts where job_id=job and lease_token=token) then raise exception 'No authorized billing attempt' using errcode='42501'; end if;
 select * into strict b from operations.onboarding_jobs where id=job and step='invoice' for update;
 select * into strict j from operations.onboarding_journeys where id=b.journey_id;
 select * into strict a from operations.onboarding_approvals where id=j.approval_id;
 select * into strict p from operations.onboarding_proposal_approvals where id=j.proposal_approval_id;
 account:=a.snapshot->'invoice'->>'accountId';env:=case when (a.snapshot->'invoice'->>'livemode')::boolean then 'live' else 'test' end;
 select * into strict s from operations.billing_schedules where organisation_id=b.organisation_id and agreement_id=j.agreement_id and revision=(p.snapshot->>'revision')::integer and account_id=account and environment=env and obligation_key=a.snapshot->'invoice'->>'obligationKey';
 if kind='customer' then
  if provider_ref !~ '^cus_[A-Za-z0-9]+$' then raise exception 'Invalid customer receipt'; end if;
  selected_target:='customer';
  insert into operations.billing_customers(organisation_id,account_id,environment,provider_customer_id,created_by,correlation_id) values(b.organisation_id,account,env,provider_ref,'system:operations-onboarding',job) on conflict do nothing;
  if not exists(select 1 from operations.billing_customers where organisation_id=b.organisation_id and account_id=account and environment=env and provider_customer_id=provider_ref) then raise exception 'Customer receipt conflict'; end if;
 elsif kind='invoice' then
  if provider_ref !~ '^(in|sub|sub_sched)_[A-Za-z0-9]+$' then raise exception 'Invalid billing receipt'; end if;
  selected_target:='schedule:'||s.id::text;
  if s.provider_reference is not null and s.provider_reference<>provider_ref then raise exception 'Billing owner conflict'; end if;
  if s.provider_reference is null then update operations.billing_schedules set provider_reference=provider_ref where id=s.id; end if;
  if payload->'invoice' is not null and payload->'invoice'<>'null'::jsonb then
   if payload->'invoice'->>'status' not in ('open','paid','void','uncollectible') or (payload->'invoice'->>'totalPence')::numeric<>s.amount_pence or payload->'invoice'->>'providerInvoiceId' !~ '^in_[A-Za-z0-9]+$' then raise exception 'Invoice differs from signed obligation'; end if;
   insert into operations.invoices(organisation_id,schedule_id,account_id,environment,provider_invoice_id,number,status,currency,total_pence,amount_due_pence,amount_overpaid_pence,amount_paid_pence,amount_remaining_pence,due_date,issued_snapshot,projected_at,created_by,correlation_id)
   values(b.organisation_id,s.id,account,env,payload->'invoice'->>'providerInvoiceId',payload->'invoice'->>'number',payload->'invoice'->>'status','GBP',(payload->'invoice'->>'totalPence')::numeric,(payload->'invoice'->>'amountDuePence')::numeric,(payload->'invoice'->>'amountOverpaidPence')::numeric,(payload->'invoice'->>'amountPaidPence')::numeric,(payload->'invoice'->>'amountRemainingPence')::numeric,(payload->'invoice'->>'dueDate')::date,payload->'invoice'->'snapshot',clock_timestamp(),'system:operations-onboarding',job) on conflict do nothing;
  end if;
 else raise exception 'Invalid billing effect';
 end if;
 select * into strict c from operations.billing_commands where organisation_id=b.organisation_id and account_id=account and environment=env and billing_commands.target=selected_target for update;
 if c.state='completed' and c.result->>'providerId' is distinct from provider_ref then raise exception 'Permanent billing command conflict'; end if;
 if c.state='pending' then update operations.billing_commands set state='completed',result=jsonb_build_object('providerId',provider_ref,'invoiceId',payload->'invoice'->>'providerInvoiceId') where id=c.id; end if;
end $$;
revoke all on function operations.onboarding_billing_context(uuid,uuid,integer),operations.onboarding_record_billing(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal;
grant execute on function operations.onboarding_billing_context(uuid,uuid,integer),operations.onboarding_record_billing(uuid,uuid,text,jsonb) to operations_onboarding_worker;
