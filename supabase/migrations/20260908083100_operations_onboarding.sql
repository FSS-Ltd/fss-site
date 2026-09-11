-- Promoted through the approved Operations production release gate. Dedicated queue role remains feature-flagged.
create role operations_onboarding_worker nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant usage on schema operations to operations_onboarding_worker;
revoke all on schema growth from operations_onboarding_worker;
create table operations.onboarding_approvals (
 id uuid primary key, organisation_id uuid not null references operations.organisations(id), agreement_id uuid not null,
 approved_by text not null check(approved_by ~ '^[a-f0-9]{64}$'), approved_at timestamptz not null default clock_timestamp(),
 snapshot jsonb not null, pdf bytea not null, pdf_hash text not null check(pdf_hash=encode(sha256(pdf),'hex')),
 approval_hash text not null check(approval_hash ~ '^[a-f0-9]{64}$'),
 check(octet_length(pdf) between 5 and 2097152), check(substring(pdf from 1 for 5)=convert_to('%PDF-','UTF8')),
 foreign key(organisation_id,agreement_id) references operations.agreements(organisation_id,id), unique(organisation_id,id)
);
create table operations.onboarding_proposal_approvals (
 id uuid primary key, organisation_id uuid not null, agreement_id uuid not null, signing_approval_id uuid not null,
 snapshot jsonb not null, approved_by text not null check(approved_by ~ '^[a-f0-9]{64}$'), approved_at timestamptz not null default clock_timestamp(),
 foreign key(organisation_id,signing_approval_id) references operations.signing_approvals(organisation_id,id),
 foreign key(organisation_id,agreement_id) references operations.agreements(organisation_id,id), unique(organisation_id,id)
);
create table operations.onboarding_journeys (
 id uuid primary key, organisation_id uuid not null, agreement_id uuid not null,
 approval_id uuid not null unique, proposal_approval_id uuid,
 state text not null default 'active' check(state in ('active','paused','blocked','completed','cancelled')),
 generation integer not null default 1 check(generation>0), created_at timestamptz not null default clock_timestamp(),
 welcome_accepted_at timestamptz, proposal_due_at timestamptz, signature_at timestamptz, post_signature_due_at timestamptz,
 schedule_policy text not null default 'next_calendar_day_09:00_Europe/London', failure_code text,
 foreign key(organisation_id,agreement_id) references operations.agreements(organisation_id,id),
 foreign key(organisation_id,approval_id) references operations.onboarding_approvals(organisation_id,id),
 foreign key(organisation_id,proposal_approval_id) references operations.onboarding_proposal_approvals(organisation_id,id), unique(organisation_id,id)
);
-- Restart cannot replay a commercial agreement's permanent outbound effects.
create unique index onboarding_one_agreement on operations.onboarding_journeys(agreement_id);
create table operations.onboarding_jobs (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null, journey_id uuid not null,
 step text not null check(step in ('welcome','proposal_access','proposal','invoice','invitation','activation','thank_you')),
 recipient text not null, idempotency_key text not null unique,
 state text not null default 'pending' check(state in ('pending','leased','succeeded','retryable_failure','unknown_outcome','held','cancelled')),
 generation integer not null default 1, lease_token uuid, lease_until timestamptz,
 attempts integer not null default 0 check(attempts>=0), first_attempt_at timestamptz,
 due_at timestamptz not null, next_attempt_at timestamptz not null, failure_code text, succeeded_at timestamptz,
 unique(journey_id,step,recipient), foreign key(organisation_id,journey_id) references operations.onboarding_journeys(organisation_id,id)
);
create index onboarding_due on operations.onboarding_jobs(next_attempt_at,id) where state in ('pending','retryable_failure','unknown_outcome','leased');
create table operations.onboarding_effects (
 job_id uuid primary key references operations.onboarding_jobs(id), organisation_id uuid not null,
 idempotency_key text not null unique, first_attempt_at timestamptz not null,
 status text not null check(status in ('unknown_outcome','retryable_failure','held','succeeded')), receipt jsonb,
 -- An unresolved earlier acceptance survives the latest attempt's definite rejection.
 unresolved_acceptance boolean not null default false,
 check((status='succeeded')=(receipt is not null))
);
create table operations.onboarding_attempts (
 job_id uuid not null references operations.onboarding_jobs(id), organisation_id uuid not null,
 lease_token uuid not null, generation integer not null, started_at timestamptz not null default clock_timestamp(),
 primary key(job_id,lease_token)
);
create table operations.onboarding_delivery_events (
 provider text not null, account_scope text not null, event_id text not null, job_id uuid not null references operations.onboarding_jobs(id),
 organisation_id uuid not null, event_type text not null check(event_type in ('bounced','complained')), received_at timestamptz not null default clock_timestamp(),
 primary key(provider,account_scope,event_id)
);
create table operations.onboarding_reconciliations (
 job_id uuid primary key references operations.onboarding_jobs(id), organisation_id uuid not null,
 reviewed_by text not null check(reviewed_by ~ '^[a-f0-9]{64}$'), review_reference text not null check(length(trim(review_reference)) between 1 and 500),
 receipt jsonb not null, reviewed_at timestamptz not null default clock_timestamp()
);
create function operations.onboarding_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Approved onboarding evidence is immutable'; end $$;
do $$ declare t text; begin
 foreach t in array array['onboarding_approvals','onboarding_proposal_approvals','onboarding_journeys','onboarding_jobs','onboarding_effects','onboarding_attempts','onboarding_delivery_events','onboarding_reconciliations'] loop
 execute format('alter table operations.%I enable row level security',t);
 execute format('alter table operations.%I force row level security',t);
 execute format('revoke all on operations.%I from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder,operations_onboarding_worker',t);
 execute format('grant select on operations.%I to operations_founder,operations_onboarding_worker',t);
 execute format('create policy founder_read on operations.%I for select to operations_founder using(current_setting(''operations.actor_id'',true) ~ ''^[a-f0-9]{64}$'')',t);
 execute format('create policy worker_read on operations.%I for select to operations_onboarding_worker using(true)',t);
 if t in ('onboarding_approvals','onboarding_proposal_approvals','onboarding_attempts','onboarding_delivery_events','onboarding_reconciliations') then
 execute format('create trigger immutable before update on operations.%I for each row execute function operations.onboarding_immutable()',t);
 end if;
 end loop;
end $$;
create function operations.onboarding_enqueue(j operations.onboarding_journeys, kind text, email text, due timestamptz) returns void language sql security definer set search_path='' as $$
 insert into operations.onboarding_jobs(organisation_id,journey_id,step,recipient,idempotency_key,generation,due_at,next_attempt_at)
 values(j.organisation_id,j.id,kind,email,'onboarding:'||j.id::text||':'||kind||':'||encode(sha256(convert_to(email,'UTF8')),'hex'),j.generation,due,due)
 on conflict(journey_id,step,recipient) do nothing;
$$;
create function operations.start_onboarding(approval uuid, journey uuid, org uuid, agreement uuid, content jsonb, artifact bytea, content_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor text := current_setting('operations.actor_id',true); j operations.onboarding_journeys;
begin
 if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder approval required'; end if;
 perform 1 from operations.agreements where id=agreement and organisation_id=org for update;
 if not found then raise exception 'Agreement unavailable'; end if;
 select * into j from operations.onboarding_journeys where agreement_id=agreement;
 if found then
 if j.approval_id=approval and (select snapshot from operations.onboarding_approvals where id=approval)=content and (select pdf from operations.onboarding_approvals where id=approval)=artifact then return j.id; end if;
 raise exception 'Journey already exists for this agreement';
 end if;
 if not exists(select 1 from operations.contacts where organisation_id=org and email=content->>'recipient') then raise exception 'Approved contact required'; end if;
 if content->'welcome'->>'to' is distinct from content->>'recipient' then raise exception 'Approval recipient mismatch'; end if;
 if content->>'pdfHash' is distinct from encode(sha256(artifact),'hex') then raise exception 'Approval PDF mismatch'; end if;
 if content_hash is distinct from encode(sha256(convert_to(content::text,'UTF8')||artifact),'hex') then raise exception 'Approval content hash mismatch'; end if;
 insert into operations.onboarding_approvals(id,organisation_id,agreement_id,approved_by,snapshot,pdf,pdf_hash,approval_hash)
 values(approval,org,agreement,actor,content,artifact,encode(sha256(artifact),'hex'),content_hash);
 insert into operations.onboarding_journeys(id,organisation_id,agreement_id,approval_id) values(journey,org,agreement,approval) returning * into j;
 perform operations.onboarding_enqueue(j,'welcome',content->>'recipient',clock_timestamp());
 return j.id;
end $$;
create function operations.approve_onboarding_proposal(journey uuid, approval uuid, content jsonb) returns void language plpgsql security definer set search_path='' as $$
declare actor text:=current_setting('operations.actor_id',true); j operations.onboarding_journeys; p operations.signing_approvals; recipient text;
begin
 if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder approval required'; end if;
 select * into strict j from operations.onboarding_journeys where id=journey for update;
 if j.state in ('cancelled','completed') then raise exception 'Journey is terminal'; end if;
 select * into strict p from operations.signing_approvals where id=(content->>'signingApprovalId')::uuid and organisation_id=j.organisation_id and agreement_id=j.agreement_id;
 if p.status<>'approved' or p.expires_at<=clock_timestamp() or p.approval_hash is distinct from content->>'approvalHash'
 or p.revision is distinct from (content->>'revision')::integer or p.snapshot->'signatories' is distinct from content->'signers'
 or (select jsonb_agg(e->>'to' order by e->>'to') from jsonb_array_elements(content->'emails') e) is distinct from (select jsonb_agg(e order by e) from jsonb_array_elements_text(content->'signers') e)
 or jsonb_typeof(content->'activationEmails') is distinct from 'array'
 or coalesce((select jsonb_agg(e->>'to' order by e->>'to') from jsonb_array_elements(content->'activationEmails') e),'[]'::jsonb) is distinct from coalesce((select jsonb_agg(x->>'email' order by x->>'email') from jsonb_array_elements(content->'access') x where not ((content->'signers') ? (x->>'email')) and x->>'email'<>(select snapshot->>'recipient' from operations.onboarding_approvals where id=j.approval_id)),'[]'::jsonb)
 or jsonb_typeof(content->'access') is distinct from 'array'
 or exists(select 1 from jsonb_array_elements(content->'access') x where (x->>'role' is null or x->>'role' not in ('owner','contributor','billing_contact','viewer')) or not exists(select 1 from operations.contacts c where c.organisation_id=j.organisation_id and c.email=x->>'email'))
 or (select count(*) from jsonb_array_elements(content->'access'))<>(select count(distinct x->>'email') from jsonb_array_elements(content->'access') x)
 or exists(select 1 from jsonb_array_elements_text(content->'signers') s where not exists(select 1 from jsonb_array_elements(content->'access') x where x->>'email'=s))
 or not exists(select 1 from jsonb_array_elements(content->'access') x join operations.onboarding_approvals a on a.id=j.approval_id where x->>'email'=a.snapshot->>'recipient' and x->>'role' in ('owner','billing_contact'))
 then raise exception 'Current signing approval must match the proposal'; end if;
 if exists(select 1 from operations.onboarding_jobs where journey_id=journey and step='proposal' and first_attempt_at is not null)
 then raise exception 'An attempted signing notice must be reconciled before replacement'; end if;
 -- An issued or uncertain access effect cannot become a different role in a new preview.
 if exists(select 1 from operations.onboarding_jobs q join operations.onboarding_proposal_approvals prior on prior.id=j.proposal_approval_id
 where q.journey_id=j.id and q.step in ('proposal_access','invitation') and q.first_attempt_at is not null
 and (select x->>'role' from jsonb_array_elements(prior.snapshot->'access') x where x->>'email'=q.recipient) is distinct from (select x->>'role' from jsonb_array_elements(content->'access') x where x->>'email'=q.recipient))
 then raise exception 'Previously attempted access roles require founder reconciliation'; end if;
 insert into operations.onboarding_proposal_approvals(id,organisation_id,agreement_id,signing_approval_id,snapshot,approved_by) values(approval,j.organisation_id,j.agreement_id,p.id,content,actor);
 update operations.onboarding_journeys set proposal_approval_id=approval,generation=generation+1 where id=journey;
 -- Unattempted old recipients may be replaced; attempted access is retained permanently.
 update operations.onboarding_jobs set state='cancelled' where journey_id=journey and step in ('proposal_access','proposal') and state<>'succeeded';
end $$;
create function operations.control_onboarding(journey uuid, command text) returns void language plpgsql security definer set search_path='' as $$
declare j operations.onboarding_journeys; actor text:=current_setting('operations.actor_id',true);
begin
 if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder approval required'; end if;
 select * into strict j from operations.onboarding_journeys where id=journey for update;
 if command not in ('pause','resume','cancel') or j.state in ('completed','cancelled') or (command='resume' and j.state<>'paused') then raise exception 'Invalid journey transition'; end if;
 update operations.onboarding_journeys set state=case command when 'pause' then 'paused' when 'resume' then case when exists(select 1 from operations.onboarding_jobs where journey_id=journey and step='thank_you' and state='succeeded') and not exists(select 1 from operations.onboarding_jobs where journey_id=journey and step='activation' and state<>'succeeded') then 'completed' else 'active' end else 'cancelled' end,generation=generation+1 where id=journey;
 if command='cancel' then update operations.onboarding_jobs set state='cancelled' where journey_id=journey and state<>'succeeded'; end if;
end $$;
create function operations.refresh_onboarding(batch_size integer default 100) returns void language plpgsql security definer set search_path='' as $$
declare j operations.onboarding_journeys; a operations.onboarding_approvals; p operations.onboarding_proposal_approvals; signer text; signed timestamptz;
begin
 if batch_size not between 1 and 100 then raise exception 'Invalid batch size'; end if;
 -- Only actionable rows enter the bound: waiting signatures never starve later completions.
 for j in select q.* from operations.onboarding_journeys q where q.state='active' and q.welcome_accepted_at is not null and q.proposal_approval_id is not null
 and ((q.signature_at is null and operations.onboarding_current_proposal(q.id) and not exists(select 1 from operations.onboarding_jobs b where b.journey_id=q.id and b.step='proposal' and b.state<>'cancelled'))
 or (q.signature_at is null and exists(select 1 from operations.onboarding_proposal_approvals pa join operations.signing_approvals s on s.id=pa.signing_approval_id where pa.id=q.proposal_approval_id and s.status='completed')))
 order by q.created_at,q.id limit batch_size for update skip locked loop
 select * into strict a from operations.onboarding_approvals where id=j.approval_id;
 select * into strict p from operations.onboarding_proposal_approvals where id=j.proposal_approval_id;
 select completed_at into signed from operations.signing_approvals where id=p.signing_approval_id and status='completed' and approval_hash=p.snapshot->>'approvalHash';
 if signed is not null then
 update operations.onboarding_journeys set signature_at=signed,post_signature_due_at=((signed at time zone 'Europe/London')::date+1+time '09:00') at time zone 'Europe/London' where id=j.id returning * into j;
 update operations.onboarding_jobs set state='cancelled' where journey_id=j.id and step in ('proposal_access','proposal') and state<>'succeeded' and first_attempt_at is null;
 perform operations.onboarding_enqueue(j,'invoice',a.snapshot->>'recipient',j.post_signature_due_at);
 for signer in select x->>'email' from jsonb_array_elements(p.snapshot->'access') x loop
 perform operations.onboarding_enqueue(j,'invitation',signer,j.post_signature_due_at);
 if exists(select 1 from jsonb_array_elements(p.snapshot->'activationEmails') e where e->>'to'=signer) then perform operations.onboarding_enqueue(j,'activation',signer,j.post_signature_due_at); end if;
 end loop;
 perform operations.onboarding_enqueue(j,'thank_you',a.snapshot->>'recipient',j.post_signature_due_at);
 else
 for signer in select x->>'email' from jsonb_array_elements(p.snapshot->'access') x loop
 perform operations.onboarding_enqueue(j,'proposal_access',signer,greatest(j.proposal_due_at,p.approved_at));
 if (p.snapshot->'signers') ? signer then perform operations.onboarding_enqueue(j,'proposal',signer,greatest(j.proposal_due_at,p.approved_at)); end if;
 update operations.onboarding_jobs set state='pending',next_attempt_at=greatest(j.proposal_due_at,p.approved_at),due_at=greatest(j.proposal_due_at,p.approved_at) where journey_id=j.id and recipient=signer and step in ('proposal_access','proposal') and state='cancelled' and first_attempt_at is null;
 end loop;
 end if;
 end loop;
end $$;
create function operations.onboarding_dependencies_ready(job operations.onboarding_jobs) returns boolean language sql stable security definer set search_path='' as $$
 select case job.step
 when 'proposal' then exists(select 1 from operations.onboarding_journeys j where j.id=job.journey_id and j.proposal_approval_id is not null) and not exists(select 1 from operations.onboarding_journeys j join operations.onboarding_proposal_approvals p on p.id=j.proposal_approval_id cross join lateral jsonb_array_elements(p.snapshot->'access') x where j.id=job.journey_id and not exists(select 1 from operations.onboarding_jobs a where a.journey_id=j.id and a.step='proposal_access' and a.recipient=x->>'email' and a.state='succeeded'))
 when 'thank_you' then exists(select 1 from operations.onboarding_jobs a where a.journey_id=job.journey_id and a.step='invoice' and a.state='succeeded') and not exists(select 1 from operations.onboarding_jobs a where a.journey_id=job.journey_id and a.step='invitation' and a.state<>'succeeded')
 when 'activation' then exists(select 1 from operations.onboarding_jobs a where a.journey_id=job.journey_id and a.step='invitation' and a.recipient=job.recipient and a.state='succeeded')
 when 'invitation' then exists(select 1 from operations.onboarding_jobs a where a.journey_id=job.journey_id and a.step='invoice' and a.state='succeeded')
 else true end;
$$;
create function operations.onboarding_current_proposal(journey uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from operations.onboarding_journeys j join operations.onboarding_proposal_approvals p on p.id=j.proposal_approval_id join operations.signing_approvals s on s.id=p.signing_approval_id join operations.agreements a on a.id=j.agreement_id
 where j.id=journey and s.status='approved' and s.expires_at>clock_timestamp() and s.approval_hash=p.snapshot->>'approvalHash' and a.current_revision=s.revision);
$$;
create function operations.claim_onboarding(batch_size integer, at_time timestamptz) returns setof operations.onboarding_jobs language plpgsql security definer set search_path='' as $$
begin
 if batch_size not between 1 and 100 then raise exception 'Invalid batch size'; end if;
 perform operations.refresh_onboarding(batch_size);
 update operations.onboarding_jobs b set state='held',failure_code='proposal_reapproval_required' from operations.onboarding_journeys j where j.id=b.journey_id and j.state='active' and b.step in ('proposal','proposal_access') and b.state in ('pending','retryable_failure','unknown_outcome') and not operations.onboarding_current_proposal(j.id);
 return query with due as (
 select b.id from operations.onboarding_jobs b join operations.onboarding_journeys j on j.id=b.journey_id
 where j.state='active' and b.next_attempt_at<=at_time and (b.state in ('pending','retryable_failure','unknown_outcome') or (b.state='leased' and b.lease_until<=at_time)) and operations.onboarding_dependencies_ready(b)
 order by b.next_attempt_at,b.id limit batch_size for update of b skip locked
 ) update operations.onboarding_jobs b set state='leased',generation=j.generation,lease_token=gen_random_uuid(),lease_until=at_time+interval '2 minutes'
 from due d,operations.onboarding_journeys j where b.id=d.id and j.id=b.journey_id returning b.*;
end $$;
create function operations.onboarding_can_execute(job uuid, token uuid, expected_generation integer) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from operations.onboarding_jobs b join operations.onboarding_journeys j on j.id=b.journey_id
 where b.id=job and b.lease_token=token and b.generation=expected_generation and j.generation=expected_generation and j.state='active' and b.state='leased' and b.lease_until>clock_timestamp()
 and operations.onboarding_dependencies_ready(b)
 and (b.step not in ('proposal','proposal_access') or operations.onboarding_current_proposal(j.id))
 and not exists(select 1 from operations.onboarding_effects e where e.job_id=b.id and e.status='succeeded'));
$$;
create function operations.begin_onboarding_effect(job uuid, token uuid, expected_generation integer) returns boolean language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs;
begin
 perform 1 from operations.onboarding_journeys where id=(select journey_id from operations.onboarding_jobs where id=job) for update;
 select * into strict b from operations.onboarding_jobs where id=job for update;
 if not operations.onboarding_can_execute(job,token,expected_generation) then return false; end if;
 if b.attempts>=6 then update operations.onboarding_jobs set state='held',failure_code='retry_budget_exhausted',lease_until=null where id=job; return false; end if;
 if exists(select 1 from operations.onboarding_effects where job_id=job and (status='unknown_outcome' or unresolved_acceptance) and first_attempt_at<=clock_timestamp()-interval '24 hours') then
 update operations.onboarding_jobs set state='held',failure_code='dedupe_window_expired',lease_until=null where id=job; return false;
 end if;
 insert into operations.onboarding_attempts(job_id,organisation_id,lease_token,generation) values(job,b.organisation_id,token,expected_generation) on conflict do nothing;
 if not found then return false; end if;
 insert into operations.onboarding_effects(job_id,organisation_id,idempotency_key,first_attempt_at,status) values(job,b.organisation_id,b.idempotency_key,clock_timestamp(),'unknown_outcome')
 on conflict(job_id) do update set unresolved_acceptance=operations.onboarding_effects.unresolved_acceptance or operations.onboarding_effects.status='unknown_outcome',status='unknown_outcome' where operations.onboarding_effects.status<>'succeeded';
 update operations.onboarding_jobs set first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),attempts=attempts+1 where id=job;
 return true;
end $$;
create function operations.finish_onboarding_effect(job uuid, token uuid, result jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs; accepted timestamptz;
begin
 perform 1 from operations.onboarding_journeys where id=(select journey_id from operations.onboarding_jobs where id=job) for update;
 select * into strict b from operations.onboarding_jobs where id=job for update;
 if not exists(select 1 from operations.onboarding_attempts where job_id=job and lease_token=token) then raise exception 'No authorized attempt'; end if;
 if nullif(result->>'providerId','') is null or length(result->>'providerId')>300 then raise exception 'Provider acceptance required'; end if;
 accepted:=(result->>'acceptedAt')::timestamptz;
 if accepted is null or accepted>clock_timestamp()+interval '1 minute' then raise exception 'Invalid acceptance timestamp'; end if;
 if exists(select 1 from operations.onboarding_effects where job_id=job and status='succeeded') then
 if (select receipt->>'providerId' from operations.onboarding_effects where job_id=job)<>result->>'providerId' then raise exception 'Conflicting external acceptance requires review'; end if;
 return;
 end if;
 update operations.onboarding_effects set status='succeeded',receipt=result,unresolved_acceptance=false where job_id=job;
 update operations.onboarding_jobs set state='succeeded',succeeded_at=accepted,lease_until=null,failure_code=null where id=job;
 if b.step='welcome' then update operations.onboarding_journeys set welcome_accepted_at=accepted,proposal_due_at=accepted+interval '2 hours' where id=b.journey_id and welcome_accepted_at is null; end if;
 if b.step in ('thank_you','activation') then update operations.onboarding_journeys set state='completed' where id=b.journey_id and state='active' and exists(select 1 from operations.onboarding_jobs where journey_id=b.journey_id and step='thank_you' and state='succeeded') and not exists(select 1 from operations.onboarding_jobs where journey_id=b.journey_id and step='activation' and state<>'succeeded'); end if;
end $$;
create function operations.fail_onboarding_effect(job uuid, token uuid, code text, retry timestamptz, uncertain boolean) returns void language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs;
begin
 select * into strict b from operations.onboarding_jobs where id=job for update;
 if b.lease_token is distinct from token or b.state<>'leased' then return; end if;
 if code !~ '^[a-z_]{1,80}$' then raise exception 'Safe failure code required'; end if;
 update operations.onboarding_effects set unresolved_acceptance=unresolved_acceptance or uncertain,status=case when uncertain then 'unknown_outcome' when retry is null then 'held' else 'retryable_failure' end where job_id=job and status<>'succeeded';
 update operations.onboarding_jobs set state=case when retry is null then 'held' when uncertain then 'unknown_outcome' else 'retryable_failure' end,
 next_attempt_at=coalesce(retry,next_attempt_at),failure_code=code,lease_until=null where id=job;
end $$;
create function operations.halt_onboarding_delivery(provider_name text, account text, event text, job uuid, kind text) returns boolean language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs;
begin
 if kind not in ('bounced','complained') or length(account) not between 1 and 200 or length(event) not between 1 and 200 or provider_name<>'resend' then raise exception 'Invalid delivery event'; end if;
 select * into strict b from operations.onboarding_jobs where id=job;
 if b.step not in ('welcome','proposal','activation','thank_you') then raise exception 'Email job required'; end if;
 insert into operations.onboarding_delivery_events(provider,account_scope,event_id,job_id,organisation_id,event_type) values(provider_name,account,event,job,b.organisation_id,kind) on conflict do nothing;
 if not found then return false; end if;
 update operations.onboarding_journeys set state='blocked',generation=generation+1,failure_code=kind where id=b.journey_id and state in ('active','paused');
 update operations.onboarding_jobs set state='held',failure_code=kind where journey_id=b.journey_id and step in ('welcome','proposal','activation') and state in ('pending','retryable_failure','unknown_outcome');
 return true;
end $$;
-- All mutations are bounded routines. The worker cannot alter approvals or write portal/billing tables.
revoke execute on all functions in schema operations from operations_onboarding_worker;
revoke all on function operations.onboarding_enqueue(operations.onboarding_journeys,text,text,timestamptz),operations.onboarding_immutable(),operations.start_onboarding(uuid,uuid,uuid,uuid,jsonb,bytea,text),operations.approve_onboarding_proposal(uuid,uuid,jsonb),operations.control_onboarding(uuid,text),operations.refresh_onboarding(integer),operations.onboarding_dependencies_ready(operations.onboarding_jobs),operations.onboarding_current_proposal(uuid),operations.claim_onboarding(integer,timestamptz),operations.onboarding_can_execute(uuid,uuid,integer),operations.begin_onboarding_effect(uuid,uuid,integer),operations.finish_onboarding_effect(uuid,uuid,jsonb),operations.fail_onboarding_effect(uuid,uuid,text,timestamptz,boolean),operations.halt_onboarding_delivery(text,text,text,uuid,text) from public,anon,authenticated,service_role,growth_app,operations_portal;
grant execute on function operations.start_onboarding(uuid,uuid,uuid,uuid,jsonb,bytea,text),operations.approve_onboarding_proposal(uuid,uuid,jsonb),operations.control_onboarding(uuid,text) to operations_founder;
grant execute on function operations.claim_onboarding(integer,timestamptz),operations.onboarding_can_execute(uuid,uuid,integer),operations.begin_onboarding_effect(uuid,uuid,integer),operations.finish_onboarding_effect(uuid,uuid,jsonb),operations.fail_onboarding_effect(uuid,uuid,text,timestamptz,boolean),operations.halt_onboarding_delivery(text,text,text,uuid,text) to operations_onboarding_worker;

create function operations.reconcile_onboarding_acceptance(job uuid, provider_receipt jsonb, review_reference text) returns void language plpgsql security definer set search_path='' as $$
declare actor text:=current_setting('operations.actor_id',true); b operations.onboarding_jobs; token uuid;
begin
 if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder reconciliation required'; end if;
 perform 1 from operations.onboarding_journeys where id=(select journey_id from operations.onboarding_jobs where id=job) for update;
 select * into strict b from operations.onboarding_jobs where id=job for update;
 if not exists(select 1 from operations.onboarding_effects where job_id=job and (status='unknown_outcome' or unresolved_acceptance)) then raise exception 'An uncertain permanent attempt is required'; end if;
 select lease_token into strict token from operations.onboarding_attempts where job_id=job order by started_at desc limit 1;
 insert into operations.onboarding_reconciliations(job_id,organisation_id,reviewed_by,review_reference,receipt) values(job,b.organisation_id,actor,review_reference,provider_receipt);
 perform operations.finish_onboarding_effect(job,token,provider_receipt);
end $$;
revoke all on function operations.reconcile_onboarding_acceptance(uuid,jsonb,text) from public,anon,authenticated,service_role,growth_app,operations_portal,operations_onboarding_worker;
grant execute on function operations.reconcile_onboarding_acceptance(uuid,jsonb,text) to operations_founder;
