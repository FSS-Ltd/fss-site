-- New approvals begin with a retained signature. Existing journeys retain their lifecycle.
alter table operations.onboarding_journeys
  add column journey_mode text not null default 'legacy_pre_signature'
  check (journey_mode in ('legacy_pre_signature', 'post_signature'));
alter table operations.onboarding_journeys add column welcome_delivered_at timestamptz;
alter table operations.onboarding_delivery_events add column provider_id text;
alter table operations.onboarding_delivery_events
  drop constraint onboarding_delivery_events_event_type_check;
alter table operations.onboarding_delivery_events
  add constraint onboarding_delivery_events_event_type_check
  check (event_type in ('delivered','bounced','complained'));

create or replace function operations.start_onboarding(
  approval uuid, journey uuid, org uuid, agreement uuid,
  content jsonb, artifact bytea, content_hash text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor text := current_setting('operations.actor_id', true);
  snapshot_input jsonb := content;
  j operations.onboarding_journeys;
  a operations.agreements;
  e operations.signature_evidence;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder approval required'; end if;
  select * into a from operations.agreements x where x.id=agreement and x.organisation_id=org for update;
  if a.id is null then raise exception 'Agreement unavailable'; end if;
  select * into j from operations.onboarding_journeys where agreement_id=agreement;
  if found then
    if j.approval_id=approval
      and (select snapshot from operations.onboarding_approvals where id=approval)=snapshot_input
      and (select pdf from operations.onboarding_approvals where id=approval)=artifact
    then return j.id; end if;
    raise exception 'Journey already exists for this agreement';
  end if;
  select * into e from operations.signature_evidence
    where organisation_id=org and agreement_id=agreement and revision=a.current_revision;
  if a.status<>'signed' or a.archived_at is not null or e.id is null
    or e.id::text is distinct from snapshot_input->'postSignature'->>'evidenceId'
    or e.revision is distinct from (snapshot_input->'postSignature'->>'revision')::integer
    or e.provenance is distinct from snapshot_input->'postSignature'->>'provenance'
  then raise exception 'Current signed agreement evidence required'; end if;
  if snapshot_input->'content'->>'journeyPhase' is distinct from 'post_signature'
    or not coalesce(snapshot_input->'postSignature'->>'recipientRole' in ('owner','billing_contact'),false)
    or not exists(
      select 1 from operations.welcome_pack_versions v
      join operations.welcome_packs p on p.id=v.pack_id
      where v.id=(snapshot_input->'content'->>'welcomePackVersionId')::uuid
        and p.published_version=v.version
        and v.content->>'journeyPhase'='post_signature'
        and v.content->>'rendererVersion'='2'
        and v.content->>'edition'=snapshot_input->'content'->>'edition'
    )
  then raise exception 'Current published post-signature packet required'; end if;
  if not exists(select 1 from operations.contacts where organisation_id=org and email=snapshot_input->>'recipient')
    then raise exception 'Approved contact required'; end if;
  if snapshot_input->'welcome'->>'to' is distinct from snapshot_input->>'recipient'
    then raise exception 'Approval recipient mismatch'; end if;
  if snapshot_input->>'pdfHash' is distinct from encode(sha256(artifact),'hex')
    then raise exception 'Approval PDF mismatch'; end if;
  if content_hash is distinct from encode(sha256(convert_to(snapshot_input::text,'UTF8')||artifact),'hex')
    then raise exception 'Approval content hash mismatch'; end if;
  insert into operations.onboarding_approvals(id,organisation_id,agreement_id,approved_by,snapshot,pdf,pdf_hash,approval_hash)
    values(approval,org,agreement,actor,snapshot_input,artifact,encode(sha256(artifact),'hex'),content_hash);
  insert into operations.onboarding_journeys(id,organisation_id,agreement_id,approval_id,journey_mode,signature_at)
    values(journey,org,agreement,approval,'post_signature',e.created_at) returning * into j;
  update operations.onboarding_journeys
    set schedule_policy='next_09_after_welcome_Europe/London'
    where id=journey returning * into j;
  perform operations.onboarding_enqueue(j,'welcome',snapshot_input->>'recipient',clock_timestamp());
  return j.id;
end $$;

create function operations.queue_post_signature_welcome() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  j operations.onboarding_journeys;
  recipient text;
  local_delivered timestamp;
  due_date date;
begin
  if old.welcome_delivered_at is not null or new.welcome_delivered_at is null
    or new.journey_mode<>'post_signature' then return new; end if;
  local_delivered := new.welcome_delivered_at at time zone 'Europe/London';
  due_date := local_delivered::date + case when local_delivered::time < time '09:00' then 0 else 1 end;
  update operations.onboarding_journeys
    set post_signature_due_at=(due_date + time '09:00') at time zone 'Europe/London'
    where id=new.id returning * into j;
  select snapshot->>'recipient' into recipient from operations.onboarding_approvals where id=j.approval_id;
  perform operations.onboarding_enqueue(j,'invoice',recipient,j.post_signature_due_at);
  perform operations.onboarding_enqueue(j,'invitation',recipient,j.post_signature_due_at);
  perform operations.onboarding_enqueue(j,'thank_you',recipient,j.post_signature_due_at);
  return new;
end $$;
create trigger queue_post_signature_welcome
  after update of welcome_delivered_at on operations.onboarding_journeys
  for each row execute function operations.queue_post_signature_welcome();
revoke all on function operations.queue_post_signature_welcome() from public;

create function operations.confirm_onboarding_delivery(
  account text, event text, job uuid, provider_id text
) returns boolean language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs; effect operations.onboarding_effects;
begin
  if current_setting('role',true)<>'operations_onboarding_worker' then raise exception 'Onboarding delivery is unavailable' using errcode='42501'; end if;
  if length(account) not between 1 and 200 or length(event) not between 1 and 200
    or length(provider_id) not between 1 and 300 then raise exception 'Invalid delivery event'; end if;
  select * into b from operations.onboarding_jobs where id=job and step='welcome';
  if b.id is null then return false; end if;
  select * into effect from operations.onboarding_effects where job_id=job;
  if effect.job_id is null then return false; end if;
  if effect.status='succeeded' and effect.receipt->>'providerId' is distinct from provider_id
    then raise exception 'Delivery receipt mismatch'; end if;
  insert into operations.onboarding_delivery_events
    (provider,account_scope,event_id,job_id,organisation_id,event_type,provider_id)
  values ('resend',account,event,job,b.organisation_id,'delivered',provider_id)
  on conflict do nothing;
  if not found then return false; end if;
  if effect.status='succeeded' then
    update operations.onboarding_journeys
      set welcome_delivered_at=clock_timestamp()
      where id=b.journey_id and journey_mode='post_signature'
        and state='active' and welcome_delivered_at is null;
  end if;
  return true;
end $$;
revoke all on function operations.confirm_onboarding_delivery(text,text,uuid,text)
  from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder;
grant execute on function operations.confirm_onboarding_delivery(text,text,uuid,text)
  to operations_onboarding_worker;

create function operations.activate_pending_onboarding_delivery() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='succeeded' and old.status is distinct from 'succeeded'
    and exists(
      select 1 from operations.onboarding_jobs b
      join operations.onboarding_journeys j on j.id=b.journey_id
      join operations.onboarding_delivery_events d on d.job_id=b.id
      where b.id=new.job_id and b.step='welcome' and j.journey_mode='post_signature'
        and d.event_type='delivered' and d.provider_id=new.receipt->>'providerId'
    ) then
    update operations.onboarding_journeys j set welcome_delivered_at=clock_timestamp()
    from operations.onboarding_jobs b
    where b.id=new.job_id and j.id=b.journey_id
      and j.state='active' and j.welcome_delivered_at is null;
  end if;
  return new;
end $$;
create trigger activate_pending_onboarding_delivery
  after update of status on operations.onboarding_effects
  for each row execute function operations.activate_pending_onboarding_delivery();
revoke all on function operations.activate_pending_onboarding_delivery() from public;

create function operations.prevent_post_signature_proposal() returns trigger
language plpgsql set search_path='' as $$
begin
  if exists(select 1 from operations.onboarding_journeys j
    where j.agreement_id=new.agreement_id and j.journey_mode='post_signature')
  then raise exception 'Post-signature journeys do not send signing notices'; end if;
  return new;
end $$;
create trigger prevent_post_signature_proposal
  before insert on operations.onboarding_proposal_approvals
  for each row execute function operations.prevent_post_signature_proposal();
revoke all on function operations.prevent_post_signature_proposal() from public;

create or replace function operations.onboarding_dependencies_ready(job operations.onboarding_jobs)
returns boolean language sql stable security definer set search_path='' as $$
  select case job.step
    when 'proposal' then exists(select 1 from operations.onboarding_journeys j where j.id=job.journey_id and j.proposal_approval_id is not null)
      and not exists(select 1 from operations.onboarding_journeys j join operations.onboarding_proposal_approvals p on p.id=j.proposal_approval_id cross join lateral jsonb_array_elements(p.snapshot->'access') x where j.id=job.journey_id and not exists(select 1 from operations.onboarding_jobs a where a.journey_id=j.id and a.step='proposal_access' and a.recipient=x->>'email' and a.state='succeeded'))
    when 'thank_you' then exists(select 1 from operations.onboarding_jobs a where a.journey_id=job.journey_id and a.step='invoice' and a.state='succeeded')
      and not exists(select 1 from operations.onboarding_jobs a where a.journey_id=job.journey_id and a.step='invitation' and a.state<>'succeeded')
    when 'activation' then exists(select 1 from operations.onboarding_jobs a where a.journey_id=job.journey_id and a.step='invitation' and a.recipient=job.recipient and a.state='succeeded')
    when 'invitation' then exists(select 1 from operations.onboarding_journeys j where j.id=job.journey_id and j.journey_mode='post_signature' and j.welcome_delivered_at is not null)
      or exists(select 1 from operations.onboarding_jobs a where a.journey_id=job.journey_id and a.step='invoice' and a.state='succeeded')
    else true end;
$$;

create or replace function operations.onboarding_access(job uuid, token uuid, expected_generation integer, token_hash text, encrypted jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs; j operations.onboarding_journeys; p operations.onboarding_proposal_approvals; a operations.onboarding_approvals; approved_by text; approval_id uuid;
 c operations.contacts; m operations.memberships; existing operations.portal_invites; binding operations.onboarding_access_bindings; wanted_role text; invite uuid; original_job uuid:=job;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' then raise exception 'Onboarding access is unavailable' using errcode='42501'; end if;
 -- Serialize scoped writes with pause/cancel, always journey -> job -> contact.
 select * into strict j from operations.onboarding_journeys where id=(select journey_id from operations.onboarding_jobs where id=job) for update;
 select * into strict b from operations.onboarding_jobs where id=job and step in ('proposal_access','invitation') for update;
 if j.journey_mode='post_signature' then
  if b.step<>'invitation' then raise exception 'Invalid post-signature access step'; end if;
  select * into strict a from operations.onboarding_approvals where id=j.approval_id;
  if a.snapshot->>'recipient' is distinct from b.recipient then raise exception 'Approved recipient mismatch'; end if;
  wanted_role:=a.snapshot->'postSignature'->>'recipientRole';
  approved_by:=a.approved_by; approval_id:=a.id;
 else
  select * into strict p from operations.onboarding_proposal_approvals where id=j.proposal_approval_id;
  select x->>'role' into strict wanted_role from jsonb_array_elements(p.snapshot->'access') x where x->>'email'=b.recipient;
  approved_by:=p.approved_by; approval_id:=p.id;
 end if;
 if not coalesce(wanted_role in ('owner','contributor','billing_contact','viewer'),false) then raise exception 'Invalid approved access'; end if;
 select * into strict c from operations.contacts where organisation_id=b.organisation_id and email=b.recipient for update;
 select * into m from operations.memberships where contact_id=c.id for update;
 if not operations.onboarding_can_execute(job,token,expected_generation) then raise exception 'Onboarding access is unavailable' using errcode='42501'; end if;
 if m.revoked_at is not null then raise exception 'Revoked access requires founder review'; end if;
 if m.id is not null and m.role<>wanted_role and (j.journey_mode='post_signature' or m.role<>'owner') then raise exception 'Billing access requires founder review'; end if;
 select * into binding from operations.onboarding_access_bindings where job_id=job;
 if binding.job_id is not null then
  if binding.invitation_id is not null and (select role from operations.portal_invites where id=binding.invitation_id) is distinct from wanted_role then raise exception 'Bound invitation role requires founder review'; end if;
  if binding.invitation_id is not null and m.id is null and not exists(select 1 from operations.portal_invites where id=binding.invitation_id and revoked_at is null and claimed_at is null and expires_at>clock_timestamp()) then raise exception 'Expired invitation requires reviewed recovery'; end if;
  return jsonb_build_object('providerId',coalesce(binding.invitation_id::text,'membership:'||c.id::text),'acceptedAt',binding.created_at);
 end if;
 if m.id is null then
  if token_hash !~ '^[a-f0-9]{64}$' or encrypted->>'version'<>'1' or jsonb_typeof(encrypted->'ciphertext') is distinct from 'string' then raise exception 'Invalid encrypted invitation'; end if;
  select * into existing from operations.portal_invites where contact_id=c.id and claimed_at is null and revoked_at is null for update;
  if not operations.onboarding_can_execute(job,token,expected_generation) then raise exception 'Onboarding access is unavailable' using errcode='42501'; end if;
  if existing.id is not null then
   -- Only an expired invitation issued by this journey may be replaced.
   select x.* into binding from operations.onboarding_access_bindings x join operations.onboarding_jobs q on q.id=x.job_id where x.invitation_id=existing.id and q.journey_id=j.id order by x.created_at limit 1;
   if binding.job_id is null or existing.role<>wanted_role then raise exception 'Existing invitation requires founder review'; end if;
   if existing.expires_at>clock_timestamp() then
    invite:=existing.id; encrypted:=binding.encrypted_token; original_job:=binding.token_job_id;
   else update operations.portal_invites set revoked_at=clock_timestamp() where id=existing.id;
   end if;
  end if;
  if invite is null then
  insert into operations.portal_invites(organisation_id,contact_id,role,token_hash,created_by,review_reference)
  values(b.organisation_id,c.id,wanted_role,token_hash,approved_by,'onboarding:'||approval_id::text) returning id into invite;
  end if;
 end if;
 insert into operations.onboarding_access_bindings(job_id,invitation_id,encrypted_token,token_job_id) values(job,invite,case when invite is not null then encrypted end,case when invite is not null then original_job end) returning * into binding;
 -- Record the worker as actor and retain the actual founder approval as delegation source.
 insert into operations.audit_events(organisation_id,actor_id,action,entity_id,review_reference,correlation_id)
 values(b.organisation_id,'system:operations-onboarding','invite.issued',coalesce(invite,c.id),'onboarding-delegation:'||approval_id::text,job);
 return jsonb_build_object('providerId',coalesce(invite::text,'membership:'||c.id::text),'acceptedAt',binding.created_at);
end $$;


create or replace function operations.onboarding_billing_context(job uuid, token uuid, expected_generation integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs; j operations.onboarding_journeys; a operations.onboarding_approvals; p operations.signing_approvals;
 s operations.billing_schedules; customer_command operations.billing_commands; invoice_command operations.billing_commands;
 signed_snapshot jsonb; signed_revision integer; legal_name text; billing_email text; currency text; customer_target text; account text; env text; selected_key text; obligation jsonb; idx integer; owner text; amount numeric; due date; finish date; months integer; description text;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' then raise exception 'Onboarding billing is unavailable' using errcode='42501'; end if;
 select * into strict j from operations.onboarding_journeys where id=(select journey_id from operations.onboarding_jobs where id=job) for update;
 select * into strict b from operations.onboarding_jobs where id=job and step='invoice' for update;
 if not operations.onboarding_can_execute(job,token,expected_generation) then raise exception 'Onboarding billing is unavailable' using errcode='42501'; end if;
 select * into strict a from operations.onboarding_approvals where id=j.approval_id;
 if j.journey_mode='post_signature' then
  select r.snapshot, r.revision, coalesce(e.evidence->>'organisationLegalName',o.legal_name)
    into strict signed_snapshot,signed_revision,legal_name
    from operations.agreements g
    join operations.signature_evidence e on e.organisation_id=g.organisation_id and e.agreement_id=g.id and e.revision=g.current_revision
    join operations.agreement_revisions r on r.organisation_id=e.organisation_id and r.agreement_id=e.agreement_id and r.revision=e.revision
    join operations.organisations o on o.id=g.organisation_id
    where g.id=j.agreement_id and g.organisation_id=j.organisation_id
      and g.status='signed' and g.archived_at is null
      and e.id::text=a.snapshot->'postSignature'->>'evidenceId'
      and e.revision=(a.snapshot->'postSignature'->>'revision')::integer;
 else
  select p1.* into strict p from operations.signing_approvals p1 join operations.onboarding_proposal_approvals p2 on p2.signing_approval_id=p1.id where p2.id=j.proposal_approval_id and p1.status='completed';
  signed_snapshot:=p.snapshot; signed_revision:=p.revision; legal_name:=p.organisation_legal_name;
 end if;
 billing_email:=signed_snapshot->>'billingContact';
 if exists(select 1 from jsonb_array_elements(signed_snapshot->'lines') line where (line->>'taxPence')::numeric>0) then raise exception 'Signed tax mapping requires founder review'; end if;
 account:=a.snapshot->'invoice'->>'accountId'; env:=case when (a.snapshot->'invoice'->>'livemode')::boolean then 'live' else 'test' end;
 currency:=signed_snapshot->>'currency';
 customer_target:=case when currency='GBP' then 'customer' else 'customer:'||currency end;
 selected_key:=a.snapshot->'invoice'->>'obligationKey';
 if selected_key !~ '^(installment|line):[1-9][0-9]*$' then raise exception 'Invalid first billing obligation'; end if;
 idx:=split_part(selected_key,':',2)::integer-1;
 if split_part(selected_key,':',1)='installment' then
  obligation:=signed_snapshot->'installments'->idx;owner:='invoice';amount:=(obligation->>'amountPence')::numeric;due:=(obligation->>'dueDate')::date;months:=0;description:=(signed_snapshot->>'title')||': installment '||(idx+1)::text;
 else
  if signed_snapshot->'revenueShare' is not null and signed_snapshot->'revenueShare'<>'null'::jsonb then raise exception 'Revenue share does not create fixed recurring billing'; end if;
  obligation:=signed_snapshot->'lines'->idx;owner:='subscription';amount:=(obligation->>'unitPence')::numeric*(obligation->>'quantity')::numeric-(obligation->>'discountPence')::numeric+(obligation->>'taxPence')::numeric;
  due:=(obligation->>'startDate')::date;finish:=(obligation->>'endDate')::date;months:=(obligation->>'recurrenceMonths')::integer;description:=obligation->>'description';
 end if;
 if obligation is null then raise exception 'Approved billing obligation is missing'; end if;
 if not operations.onboarding_can_execute(job,token,expected_generation) then raise exception 'Onboarding billing is unavailable' using errcode='42501'; end if;
 insert into operations.billing_schedules(organisation_id,agreement_id,revision,account_id,environment,obligation_key,owner,amount_pence,currency,due_date,end_date,recurrence_months,description,signed_snapshot,created_by,correlation_id)
 values(b.organisation_id,j.agreement_id,signed_revision,account,env,selected_key,owner,amount,currency,due,finish,months,description,signed_snapshot,'system:operations-onboarding',job) on conflict do nothing;
 select * into strict s from operations.billing_schedules x where x.organisation_id=b.organisation_id and x.agreement_id=j.agreement_id and x.revision=signed_revision and x.environment=env and x.obligation_key=selected_key;
 if s.account_id<>account or s.signed_snapshot is distinct from signed_snapshot then raise exception 'Billing obligation conflict'; end if;
 insert into operations.billing_commands(organisation_id,account_id,environment,command_key,target,created_by,correlation_id)
 values(b.organisation_id,account,env,customer_target,customer_target,'system:operations-onboarding',job) on conflict do nothing;
 select * into strict customer_command from operations.billing_commands where organisation_id=b.organisation_id and account_id=account and environment=env and target=customer_target;
 insert into operations.billing_commands(organisation_id,account_id,environment,command_key,target,created_by,correlation_id)
 values(b.organisation_id,account,env,'onboarding:'||job::text,'schedule:'||s.id::text,'system:operations-onboarding',job) on conflict do nothing;
 select * into strict invoice_command from operations.billing_commands where organisation_id=b.organisation_id and account_id=account and environment=env and target='schedule:'||s.id::text;
 if (s.provider_reference is not null and (invoice_command.state<>'completed' or invoice_command.result->>'providerId' is distinct from s.provider_reference))
   or (invoice_command.state='completed' and invoice_command.result->>'providerId' is distinct from s.provider_reference)
 then raise exception 'Billing schedule requires staff reconciliation'; end if;
 return jsonb_build_object(
 'schedule',jsonb_build_object('id',s.id,'organisationId',s.organisation_id,'agreementId',s.agreement_id,'revision',s.revision,'accountId',s.account_id,'mode',s.environment,'key',s.obligation_key,'owner',s.owner,'currency',s.currency,'amountPence',s.amount_pence::text,'dueDate',s.due_date::text,'endDate',s.end_date::text,'recurrenceMonths',s.recurrence_months,'description',s.description,'providerReference',s.provider_reference),
 'customerCommand',jsonb_build_object('id',customer_command.id,'createdAt',customer_command.created_at,'target',customer_command.target,'result',customer_command.result),
 'invoiceCommand',jsonb_build_object('id',invoice_command.id,'createdAt',invoice_command.created_at,'target',invoice_command.target,'result',invoice_command.result),
 'customerId',(select provider_customer_id from operations.billing_customers where organisation_id=b.organisation_id and account_id=account and environment=env and billing_customers.currency=s.currency),
 'name',legal_name,'email',billing_email);
end $$;


create or replace function operations.onboarding_record_billing(job uuid, token uuid, kind text, payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs; j operations.onboarding_journeys; a operations.onboarding_approvals; p operations.onboarding_proposal_approvals; s operations.billing_schedules; c operations.billing_commands;
 account text; env text; provider_ref text:=payload->>'providerId'; selected_target text;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' or not exists(select 1 from operations.onboarding_attempts where job_id=job and lease_token=token) then raise exception 'No authorized billing attempt' using errcode='42501'; end if;
 select * into strict j from operations.onboarding_journeys where id=(select journey_id from operations.onboarding_jobs where id=job) for update;
 select * into strict b from operations.onboarding_jobs where id=job and step='invoice' for update;
 select * into strict a from operations.onboarding_approvals where id=j.approval_id;
 if j.journey_mode='legacy_pre_signature' then select * into strict p from operations.onboarding_proposal_approvals where id=j.proposal_approval_id; end if;
 account:=a.snapshot->'invoice'->>'accountId';env:=case when (a.snapshot->'invoice'->>'livemode')::boolean then 'live' else 'test' end;
 select * into strict s from operations.billing_schedules where organisation_id=b.organisation_id and agreement_id=j.agreement_id and revision=case when j.journey_mode='post_signature' then (a.snapshot->'postSignature'->>'revision')::integer else (p.snapshot->>'revision')::integer end and account_id=account and environment=env and obligation_key=a.snapshot->'invoice'->>'obligationKey';
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
