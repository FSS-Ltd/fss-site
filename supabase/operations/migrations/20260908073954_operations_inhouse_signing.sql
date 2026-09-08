-- Staged release hold. No production application. Ordinary electronic signatures only.
create role operations_signing_worker nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant usage on schema operations to operations_signing_worker;
revoke all on schema growth from operations_signing_worker;

create table operations.signing_approvals (
 id uuid primary key, organisation_id uuid not null, organisation_legal_name text not null check(length(trim(organisation_legal_name)) between 1 and 200), agreement_id uuid not null, revision integer not null,
 agreement_version integer not null, snapshot jsonb not null, source_pdf bytea not null,
 source_hash text not null check(source_hash=encode(sha256(source_pdf),'hex')),
 approval_hash text not null check(approval_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'prepared' check(status in ('prepared','approved','completed','declined','cancelled','superseded')),
 created_by text not null check(created_by ~ '^[a-f0-9]{64}$'), created_at timestamptz not null default now(),
 approved_at timestamptz, expires_at timestamptz, completed_at timestamptz, correlation_id uuid not null,
 completion_attempts integer not null default 0 check(completion_attempts>=0), completion_next_attempt_at timestamptz not null default now(),
 check(octet_length(source_pdf) between 5 and 1048576),
 check(substring(source_pdf from 1 for 5)=convert_to('%PDF-','UTF8')),
 foreign key(organisation_id,agreement_id,revision) references operations.agreement_revisions(organisation_id,agreement_id,revision),
 unique(organisation_id,id), unique(organisation_id,agreement_id,revision)
);
create unique index signing_one_live on operations.signing_approvals(agreement_id) where status in ('prepared','approved');
create table operations.signing_signatures (
 approval_id uuid not null references operations.signing_approvals(id), organisation_id uuid not null,
 email text not null, user_id uuid not null, typed_name text not null check(length(trim(typed_name)) between 2 and 200 and typed_name !~ '[[:cntrl:]]'),
 approval_hash text not null, authority boolean not null check(authority), consent boolean not null check(consent),
 consent_text text not null, signed_at timestamptz not null default clock_timestamp(), correlation_id uuid not null,
 primary key(approval_id,email), unique(approval_id,user_id),
 foreign key(organisation_id,approval_id) references operations.signing_approvals(organisation_id,id)
);
create table operations.signing_artifacts (
 approval_id uuid primary key references operations.signing_approvals(id), organisation_id uuid not null,
 signed_pdf bytea not null, audit_bytes bytea not null, signed_hash text not null, audit_hash text not null,
 created_at timestamptz not null default clock_timestamp(),
 check(octet_length(signed_pdf) between 5 and 1048576), check(octet_length(audit_bytes) between 2 and 1048576),
 check(substring(signed_pdf from 1 for 5)=convert_to('%PDF-','UTF8')),
 check(signed_hash=encode(sha256(signed_pdf),'hex')), check(audit_hash=encode(sha256(audit_bytes),'hex')),
 foreign key(organisation_id,approval_id) references operations.signing_approvals(organisation_id,id)
);
create table operations.signing_audit_events (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null, approval_id uuid not null,
 actor_id text not null, action text not null check(action in ('prepared','approved','signed','declined','cancelled','superseded','completed')),
 occurred_at timestamptz not null default clock_timestamp(), correlation_id uuid not null,
 foreign key(organisation_id,approval_id) references operations.signing_approvals(organisation_id,id)
);
create table operations.signing_completion_outbox (
 id uuid primary key references operations.signing_approvals(id), organisation_id uuid not null,
 agreement_id uuid not null, revision integer not null, engagement_id uuid not null, signed_at timestamptz not null,
 financial_snapshot jsonb not null, state text not null default 'pending' check(state in ('pending','processing','completed','review')),
 lease_token uuid, lease_until timestamptz, next_attempt_at timestamptz not null default now(), attempts integer not null default 0 check(attempts>=0), completed_at timestamptz,
 failure_code text check(failure_code in ('engagement_missing','engagement_terminal','engagement_not_ready','invalid_financials','growth_unavailable')),
 foreign key(organisation_id,agreement_id,revision) references operations.agreement_revisions(organisation_id,agreement_id,revision)
);
create index signing_completion_pending on operations.signing_completion_outbox(next_attempt_at,id) where state in ('pending','processing');

-- Server-verified identity settings are set only by the isolated portal DB adapter.
create function operations.portal_can_signing(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from operations.signing_approvals p
 where p.id=target and p.approved_at is not null and operations.portal_has_membership(p.organisation_id)
 and (p.snapshot->'signatories') ? lower(current_setting('operations.verified_email',true))
 and exists(select 1 from operations.memberships m join operations.contacts c on c.id=m.contact_id
 where m.organisation_id=p.organisation_id and m.user_id=nullif(current_setting('operations.user_id',true),'')::uuid
 and m.revoked_at is null and c.email=lower(current_setting('operations.verified_email',true))));
$$;

do $$ declare t text; begin
 foreach t in array array['signing_approvals','signing_signatures','signing_artifacts','signing_audit_events','signing_completion_outbox'] loop
 execute format('alter table operations.%I enable row level security',t);
 execute format('alter table operations.%I force row level security',t);
 execute format('revoke all on operations.%I from public,anon,authenticated,service_role,growth_app,operations_portal,operations_founder,operations_signing_worker',t);
 execute format('grant select on operations.%I to operations_founder,operations_signing_worker',t);
 execute format('create policy founder_read on operations.%I for select to operations_founder using(current_setting(''operations.actor_id'',true) ~ ''^[a-f0-9]{64}$'')',t);
 execute format('create policy worker_read on operations.%I for select to operations_signing_worker using(true)',t);
 if t in ('signing_approvals','signing_signatures','signing_artifacts') then
 execute format('grant select on operations.%I to operations_portal',t);
 execute format('create policy portal_read on operations.%I for select to operations_portal using(operations.portal_can_signing(%I))',t,case when t='signing_approvals' then 'id' else 'approval_id' end);
 end if;
 end loop;
end $$;
grant insert on operations.signing_approvals to operations_founder;
grant update(completion_attempts,completion_next_attempt_at) on operations.signing_approvals to operations_signing_worker;
create policy worker_retry on operations.signing_approvals for update to operations_signing_worker using(true) with check(true);
create policy founder_prepare on operations.signing_approvals for insert to operations_founder with check(created_by=current_setting('operations.actor_id',true));
grant update(state,lease_token,lease_until,next_attempt_at,attempts,completed_at,failure_code) on operations.signing_completion_outbox to operations_signing_worker;
create policy worker_project on operations.signing_completion_outbox for update to operations_signing_worker using(true) with check(true);

create function operations.guard_signing_outbox() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['state','lease_token','lease_until','next_attempt_at','attempts','completed_at','failure_code']) is distinct from (to_jsonb(old)-array['state','lease_token','lease_until','next_attempt_at','attempts','completed_at','failure_code']) or old.state='completed' then raise exception 'Completion evidence is immutable'; end if;
 return new;
end $$;
create trigger signing_outbox_immutable before update on operations.signing_completion_outbox for each row execute function operations.guard_signing_outbox();

create function operations.guard_signing_prepare() returns trigger language plpgsql security definer set search_path='' as $$
declare a operations.agreements; s jsonb;
begin
 select * into strict a from operations.agreements where id=new.agreement_id and organisation_id=new.organisation_id for update;
 select snapshot into strict s from operations.agreement_revisions where organisation_id=a.organisation_id and agreement_id=a.id and revision=a.current_revision;
 if a.status<>'draft' or new.revision<>a.current_revision or new.agreement_version<>a.version or new.snapshot is distinct from s
 or new.organisation_legal_name is distinct from (select legal_name from operations.organisations where id=new.organisation_id)
 or new.source_hash is distinct from s->>'documentHash' or s->>'documentReference' is distinct from 'private:signing/'||new.id::text||'/source.pdf'
 or new.status<>'prepared' or new.approved_at is not null or new.expires_at is not null or new.completed_at is not null
 then raise exception 'Preparation must match the current immutable revision'; end if;
 new.approval_hash := encode(sha256(convert_to(new.id::text||':'||new.organisation_legal_name||':'||new.source_hash||':'||s::text,'UTF8')),'hex');
 return new;
end $$;
create trigger signing_prepare before insert on operations.signing_approvals for each row execute function operations.guard_signing_prepare();
create function operations.audit_signing_prepare() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into operations.signing_audit_events(organisation_id,approval_id,actor_id,action,correlation_id) values(new.organisation_id,new.id,new.created_by,'prepared',new.correlation_id);
 return new;
end $$;
create trigger signing_prepared after insert on operations.signing_approvals for each row execute function operations.audit_signing_prepare();

-- Every revision change, including direct founder SQL, invalidates old approval.
create function operations.supersede_agreement_signing() returns trigger language plpgsql security definer set search_path='' as $$
declare p operations.signing_approvals;
begin
 if new.current_revision<>old.current_revision or new.status<>old.status then
 for p in update operations.signing_approvals set status='superseded' where agreement_id=new.id and status in ('prepared','approved') returning * loop
 insert into operations.signing_audit_events(organisation_id,approval_id,actor_id,action,correlation_id) values(p.organisation_id,p.id,coalesce(nullif(current_setting('operations.actor_id',true),''),'system:operations-signing'),'superseded',p.correlation_id);
 end loop;
 end if;
 return new;
end $$;
create trigger signing_revision_changed after update on operations.agreements for each row execute function operations.supersede_agreement_signing();

create function operations.approve_agreement_signing(target_org uuid,target uuid,binding text,expiry timestamptz,correlation uuid) returns void language plpgsql security definer set search_path='' as $$
declare p operations.signing_approvals; a operations.agreements; actor text:=current_setting('operations.actor_id',true);
begin
 if coalesce(actor,'') !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization required'; end if;
 select a0.* into strict a from operations.agreements a0 join operations.signing_approvals p0 on p0.agreement_id=a0.id where p0.id=target and p0.organisation_id=target_org for update of a0;
 select * into strict p from operations.signing_approvals where id=target for update;
 if p.status='approved' and p.approval_hash=binding and p.expires_at=expiry then return; end if;
 if p.status<>'prepared' or p.approval_hash is distinct from binding or a.current_revision<>p.revision or a.status<>'draft' or expiry is null or expiry<=clock_timestamp() or expiry>clock_timestamp()+interval '90 days' then raise exception 'Approval conflict or invalid expiry'; end if;
 update operations.signing_approvals set status='approved',approved_at=clock_timestamp(),expires_at=expiry where id=target;
 insert into operations.signing_audit_events(organisation_id,approval_id,actor_id,action,correlation_id) values(target_org,target,actor,'approved',correlation);
end $$;
-- Once all parties have executed, rendering latency cannot reopen the contract.
create function operations.has_pending_signed_execution(target_agreement uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from operations.signing_approvals p where p.agreement_id=target_agreement and p.status='approved'
 and not exists(select 1 from jsonb_array_elements_text(p.snapshot->'signatories') required(email)
 where not exists(select 1 from operations.signing_signatures s where s.approval_id=p.id and s.email=required.email and s.approval_hash=p.approval_hash and s.signed_at<=p.expires_at)));
$$;
create function operations.guard_pending_signed_execution() returns trigger language plpgsql security definer set search_path='' as $$
declare agreement uuid;
begin
 if tg_table_name='agreements' then
  if new.current_revision=old.current_revision and new.status=old.status then return new; end if;
  agreement:=new.id;
 else agreement:=new.agreement_id;
 end if;
 perform 1 from operations.agreements where id=agreement for update;
 if operations.has_pending_signed_execution(agreement) then raise exception 'All parties have signed; completion evidence is being retained'; end if;
 return new;
end $$;
create trigger pending_execution_revision before insert on operations.agreement_revisions for each row execute function operations.guard_pending_signed_execution();
create trigger pending_execution_agreement before update on operations.agreements for each row execute function operations.guard_pending_signed_execution();

create function operations.cancel_agreement_signing(target_org uuid,target uuid,correlation uuid) returns void language plpgsql security definer set search_path='' as $$
declare p operations.signing_approvals; actor text:=current_setting('operations.actor_id',true);
begin
 if coalesce(actor,'') !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization required'; end if;
 perform 1 from operations.agreements a join operations.signing_approvals p0 on p0.agreement_id=a.id where p0.id=target and p0.organisation_id=target_org for update of a;
 select * into strict p from operations.signing_approvals where id=target and organisation_id=target_org for update;
 if p.status='cancelled' then return; end if;
 if p.status not in ('prepared','approved') or operations.has_pending_signed_execution(p.agreement_id) then raise exception 'Approval is no longer cancellable'; end if;
 update operations.signing_approvals set status='cancelled' where id=target;
 insert into operations.signing_audit_events(organisation_id,approval_id,actor_id,action,correlation_id) values(target_org,target,actor,'cancelled',correlation);
end $$;

create function operations.record_agreement_signature(target uuid,binding text,typed text,authority_confirmed boolean,consent_confirmed boolean,declining boolean) returns void language plpgsql security definer set search_path='' as $$
declare p operations.signing_approvals; a operations.agreements; prior operations.signing_signatures;
 signer_email text:=lower(current_setting('operations.verified_email',true)); who uuid:=nullif(current_setting('operations.user_id',true),'')::uuid;
 correlation uuid:=nullif(current_setting('operations.correlation_id',true),'')::uuid;
begin
 if not coalesce(operations.portal_can_signing(target),false) then raise exception 'Portal access is unavailable'; end if;
 select a0.* into strict a from operations.agreements a0 join operations.signing_approvals p0 on p0.agreement_id=a0.id where p0.id=target for update of a0;
 select * into strict p from operations.signing_approvals where id=target for update;
 -- Lock live authority against concurrent membership revocation and org archival.
 perform 1 from operations.memberships m join operations.organisations o on o.id=m.organisation_id where m.organisation_id=p.organisation_id and m.user_id=who and m.revoked_at is null and o.lifecycle='active' for share of m,o;
 if not found or not coalesce(operations.portal_can_signing(target),false) then raise exception 'Portal access is unavailable'; end if;
 if p.approval_hash is distinct from binding or a.current_revision<>p.revision then raise exception 'Approval conflict'; end if;
 select s.* into prior from operations.signing_signatures s where s.approval_id=target and s.email=signer_email;
 if prior.approval_id is not null and not declining and prior.user_id=who and prior.typed_name=trim(typed) and authority_confirmed is true and consent_confirmed is true then return; end if;
 if p.status<>'approved' or a.status<>'draft' or p.expires_at<=clock_timestamp() or prior.approval_id is not null then raise exception 'Approval is no longer open for signing'; end if;
 if declining then
 update operations.signing_approvals set status='declined' where id=target;
 insert into operations.signing_audit_events(organisation_id,approval_id,actor_id,action,correlation_id) values(p.organisation_id,target,who::text,'declined',correlation);
 return;
 end if;
 if authority_confirmed is not true or consent_confirmed is not true or typed is null or length(trim(typed)) not between 2 and 200 or typed ~ '[[:cntrl:]]' or typed ~ '[^ -~ -ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€]' then raise exception 'Typed name, authority and electronic consent required'; end if;
 insert into operations.signing_signatures(approval_id,organisation_id,email,user_id,typed_name,approval_hash,authority,consent,consent_text,correlation_id)
 values(target,p.organisation_id,signer_email,who,trim(typed),binding,true,true,'I agree to this exact agreement and consent to signing it electronically. I confirm that I have authority to bind the named organisation.',correlation);
 insert into operations.signing_audit_events(organisation_id,approval_id,actor_id,action,correlation_id) values(p.organisation_id,target,who::text,'signed',correlation);
end $$;

alter table operations.signature_evidence drop constraint signature_evidence_provenance_check;
alter table operations.signature_evidence add constraint signature_evidence_provenance_check check(provenance in ('manual_founder_confirmation','authenticated_portal_electronic_signature'));
alter table operations.signature_evidence drop constraint signature_evidence_created_by_check;
alter table operations.signature_evidence add constraint signature_evidence_created_by_check check((provenance='manual_founder_confirmation' and created_by ~ '^[a-f0-9]{64}$') or (provenance='authenticated_portal_electronic_signature' and created_by='system:operations-signing'));
alter table operations.audit_events drop constraint audit_events_actor_id_check;
alter table operations.audit_events add constraint audit_events_actor_id_check check(actor_id ~ '^[a-f0-9]{64}$' or actor_id in ('system:operations-billing','system:operations-signing'));

-- Existing manual validation still runs. This additional guard makes in-house
-- evidence impossible without every durable consent and both retained artifacts.
create function operations.guard_inhouse_evidence() returns trigger language plpgsql security definer set search_path='' as $$
declare p operations.signing_approvals; artifact operations.signing_artifacts;
begin
 if new.provenance='manual_founder_confirmation' then
 if operations.has_pending_signed_execution(new.agreement_id) then raise exception 'All parties have signed; completion evidence is being retained'; end if;
 return new; end if;
 select * into strict p from operations.signing_approvals where organisation_id=new.organisation_id and agreement_id=new.agreement_id and revision=new.revision;
 select * into strict artifact from operations.signing_artifacts where approval_id=p.id;
 if p.status<>'completed' or new.created_by<>'system:operations-signing'
 or new.evidence->>'signedDocumentHash' is distinct from artifact.signed_hash
 or new.evidence->>'documentReference' is distinct from 'private:signing/'||p.id::text||'/signed.pdf'
 or new.evidence->>'certificateReference' is distinct from 'private:signing/'||p.id::text||'/audit.json'
 or exists(select 1 from jsonb_array_elements_text(p.snapshot->'signatories') required(email) where not exists(select 1 from operations.signing_signatures s where s.approval_id=p.id and s.email=required.email and s.approval_hash=p.approval_hash and s.signed_at<=p.expires_at))
 then raise exception 'Complete durable in-house execution evidence required'; end if;
 return new;
end $$;
create trigger inhouse_evidence_guard before insert on operations.signature_evidence for each row execute function operations.guard_inhouse_evidence();

create function operations.complete_agreement_signing(target uuid,signed_bytes bytea,evidence_bytes bytea,correlation uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare p operations.signing_approvals; a operations.agreements; audit jsonb; signatures jsonb; signed_time timestamptz;
begin
 select a0.* into strict a from operations.agreements a0 join operations.signing_approvals p0 on p0.agreement_id=a0.id where p0.id=target for update of a0;
 select * into strict p from operations.signing_approvals where id=target for update;
 if p.status='completed' then return false; end if;
 if p.status<>'approved' or a.status<>'draft' or a.current_revision<>p.revision then raise exception 'Approval is no longer completable'; end if;
 if exists(select 1 from jsonb_array_elements_text(p.snapshot->'signatories') required(email) where not exists(select 1 from operations.signing_signatures s where s.approval_id=target and s.email=required.email and s.approval_hash=p.approval_hash and s.signed_at<=p.expires_at)) then raise exception 'All required signatures must be durably recorded'; end if;
 select jsonb_agg(jsonb_build_object('email',email,'typedName',typed_name,'userId',user_id::text,'signedAt',to_char(signed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by email),max(signed_at) into signatures,signed_time from operations.signing_signatures where approval_id=target;
 audit:=convert_from(evidence_bytes,'UTF8')::jsonb;
 if audit is distinct from jsonb_build_object('format','fss-inhouse-signing-v1','provenance','authenticated_portal_electronic_signature','approvalId',p.id::text,'agreementId',p.agreement_id::text,'organisationId',p.organisation_id::text,'organisationLegalName',p.organisation_legal_name,'revision',p.revision,'sourceHash',p.source_hash,'approvalHash',p.approval_hash,'approvedAt',to_char(p.approved_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'requiredSigners',p.snapshot->'signatories','consent','I agree to this exact agreement and consent to signing it electronically. I confirm that I have authority to bind the named organisation.','signatures',signatures) then raise exception 'Audit evidence must match immutable server-recorded signatures'; end if;
 insert into operations.signing_artifacts(approval_id,organisation_id,signed_pdf,audit_bytes,signed_hash,audit_hash) values(target,p.organisation_id,signed_bytes,evidence_bytes,encode(sha256(signed_bytes),'hex'),encode(sha256(evidence_bytes),'hex'));
 update operations.signing_approvals set status='completed',completed_at=signed_time where id=target;
 insert into operations.signature_evidence(organisation_id,agreement_id,revision,provenance,evidence,created_by,correlation_id)
 values(p.organisation_id,p.agreement_id,p.revision,'authenticated_portal_electronic_signature',jsonb_build_object('confirmed',true,'sourceHash',p.source_hash,'signedDocumentHash',encode(sha256(signed_bytes),'hex'),'documentReference','private:signing/'||target::text||'/signed.pdf','certificateReference','private:signing/'||target::text||'/audit.json','signatories',p.snapshot->'signatories','signedDate',(signed_time at time zone 'UTC')::date::text),'system:operations-signing',correlation);
 update operations.agreements set status='signed',version=version+1 where id=a.id;
 insert into operations.signing_completion_outbox(id,organisation_id,agreement_id,revision,engagement_id,signed_at,financial_snapshot) values(target,p.organisation_id,p.agreement_id,p.revision,a.engagement_id,signed_time,p.snapshot);
 insert into operations.signing_audit_events(organisation_id,approval_id,actor_id,action,correlation_id) values(p.organisation_id,target,'system:operations-signing','completed',correlation);
 return true;
end $$;

revoke all on function operations.portal_can_signing(uuid),operations.guard_signing_outbox(),operations.guard_signing_prepare(),operations.audit_signing_prepare(),operations.supersede_agreement_signing(),operations.approve_agreement_signing(uuid,uuid,text,timestamptz,uuid),operations.cancel_agreement_signing(uuid,uuid,uuid),operations.record_agreement_signature(uuid,text,text,boolean,boolean,boolean),operations.guard_inhouse_evidence(),operations.complete_agreement_signing(uuid,bytea,bytea,uuid) from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,operations_signing_worker;
grant execute on function operations.portal_can_signing(uuid),operations.record_agreement_signature(uuid,text,text,boolean,boolean,boolean) to operations_portal;
grant execute on function operations.approve_agreement_signing(uuid,uuid,text,timestamptz,uuid),operations.cancel_agreement_signing(uuid,uuid,uuid) to operations_founder;
grant execute on function operations.complete_agreement_signing(uuid,bytea,bytea,uuid) to operations_signing_worker;

revoke all on function operations.has_pending_signed_execution(uuid),operations.guard_pending_signed_execution() from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,operations_signing_worker;
