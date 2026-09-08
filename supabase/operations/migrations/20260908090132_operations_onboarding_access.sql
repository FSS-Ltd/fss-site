-- Staged Task 10 bridge. No production promotion before the release gate.
-- The worker can act only on a leased, explicitly approved recipient and role.
create table operations.onboarding_access_bindings (
 job_id uuid primary key references operations.onboarding_jobs(id),
 invitation_id uuid references operations.portal_invites(id),
 encrypted_token jsonb,
 token_job_id uuid references operations.onboarding_jobs(id),
 created_at timestamptz not null default clock_timestamp(),
 check ((invitation_id is null) = (encrypted_token is null) and (invitation_id is null) = (token_job_id is null))
);
alter table operations.onboarding_access_bindings enable row level security;
alter table operations.onboarding_access_bindings force row level security;
revoke all on operations.onboarding_access_bindings from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,operations_onboarding_worker;
create trigger onboarding_access_immutable before update on operations.onboarding_access_bindings for each row execute function operations.onboarding_immutable();

create function operations.onboarding_access(job uuid, token uuid, expected_generation integer, token_hash text, encrypted jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs; j operations.onboarding_journeys; p operations.onboarding_proposal_approvals;
 c operations.contacts; m operations.memberships; existing operations.portal_invites; binding operations.onboarding_access_bindings; wanted_role text; invite uuid; original_job uuid:=job;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' or not operations.onboarding_can_execute(job,token,expected_generation) then raise exception 'Onboarding access is unavailable' using errcode='42501'; end if;
 select * into strict b from operations.onboarding_jobs where id=job and step in ('proposal_access','invitation') for update;
 select * into strict j from operations.onboarding_journeys where id=b.journey_id;
 select * into strict p from operations.onboarding_proposal_approvals where id=j.proposal_approval_id;
 select x->>'role' into strict wanted_role from jsonb_array_elements(p.snapshot->'access') x where x->>'email'=b.recipient;
 if wanted_role not in ('owner','contributor','billing_contact','viewer') then raise exception 'Invalid approved access'; end if;
 select * into strict c from operations.contacts where organisation_id=b.organisation_id and email=b.recipient for update;
 select * into m from operations.memberships where contact_id=c.id;
 if m.revoked_at is not null then raise exception 'Revoked access requires founder review'; end if;
 if m.id is not null and m.role<>wanted_role and m.role<>'owner' then raise exception 'Billing access requires founder review'; end if;
 select * into binding from operations.onboarding_access_bindings where job_id=job;
 if binding.job_id is not null then
  if binding.invitation_id is not null and m.id is null and not exists(select 1 from operations.portal_invites where id=binding.invitation_id and revoked_at is null and claimed_at is null and expires_at>clock_timestamp()) then raise exception 'Expired invitation requires reviewed recovery'; end if;
  return jsonb_build_object('providerId',coalesce(binding.invitation_id::text,'membership:'||c.id::text),'acceptedAt',binding.created_at);
 end if;
 if m.id is null then
  if token_hash !~ '^[a-f0-9]{64}$' or encrypted->>'version'<>'1' or jsonb_typeof(encrypted->'ciphertext') is distinct from 'string' then raise exception 'Invalid encrypted invitation'; end if;
  select * into existing from operations.portal_invites where contact_id=c.id and claimed_at is null and revoked_at is null for update;
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
  values(b.organisation_id,c.id,wanted_role,token_hash,p.approved_by,'onboarding:'||p.id::text) returning id into invite;
  end if;
 end if;
 insert into operations.onboarding_access_bindings(job_id,invitation_id,encrypted_token,token_job_id) values(job,invite,case when invite is not null then encrypted end,case when invite is not null then original_job end) returning * into binding;
 -- Record the worker as actor and retain the actual founder approval as delegation source.
 insert into operations.audit_events(organisation_id,actor_id,action,entity_id,review_reference,correlation_id)
 values(b.organisation_id,'system:operations-onboarding','invite.issued',coalesce(invite,c.id),'onboarding-delegation:'||p.id::text,job);
 return jsonb_build_object('providerId',coalesce(invite::text,'membership:'||c.id::text),'acceptedAt',binding.created_at);
end $$;

create function operations.onboarding_email_access(job uuid, token uuid, expected_generation integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare b operations.onboarding_jobs; source operations.onboarding_jobs; binding operations.onboarding_access_bindings;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' or not operations.onboarding_can_execute(job,token,expected_generation) then raise exception 'Onboarding access is unavailable' using errcode='42501'; end if;
 select * into strict b from operations.onboarding_jobs where id=job and step in ('proposal','thank_you');
 select * into strict source from operations.onboarding_jobs where journey_id=b.journey_id and recipient=b.recipient and step=case when b.step='proposal' then 'proposal_access' else 'invitation' end;
 select * into strict binding from operations.onboarding_access_bindings where job_id=source.id;
 return jsonb_build_object('jobId',coalesce(binding.token_job_id,source.id),'recipient',source.recipient,'encrypted',binding.encrypted_token);
end $$;

create function operations.onboarding_recipient_suppressed(job uuid, token uuid, expected_generation integer) returns boolean language plpgsql security definer set search_path='' as $$
declare selected_recipient text;
begin
 if current_setting('role',true)<>'operations_onboarding_worker' or not operations.onboarding_can_execute(job,token,expected_generation) then raise exception 'Onboarding access is unavailable' using errcode='42501'; end if;
 select b.recipient into strict selected_recipient from operations.onboarding_jobs b where b.id=job;
 return exists(select 1 from growth.suppressions s where s.normalised_email=selected_recipient)
 or exists(select 1 from operations.onboarding_delivery_events e join operations.onboarding_jobs q on q.id=e.job_id where q.recipient=selected_recipient);
end $$;
revoke all on function operations.onboarding_access(uuid,uuid,integer,text,jsonb),operations.onboarding_email_access(uuid,uuid,integer),operations.onboarding_recipient_suppressed(uuid,uuid,integer) from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal;
grant execute on function operations.onboarding_access(uuid,uuid,integer,text,jsonb),operations.onboarding_email_access(uuid,uuid,integer),operations.onboarding_recipient_suppressed(uuid,uuid,integer) to operations_onboarding_worker;
