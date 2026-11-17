set lock_timeout = '5s';

alter table growth.contacts add column email_source_visibility text not null default 'standard' check (email_source_visibility in ('standard', 'private_founder'));

alter table growth.source_evidence alter column research_run_id drop not null;
alter table growth.source_evidence
  add column origin text not null default 'research' check (origin in ('research', 'founder')),
  add column founder_actor_id text,
  add column request_id uuid,
  add column request_hash text,
  add column contact_id uuid,
  add column business_id uuid,
  add column contact_version integer,
  add column prospect_version integer,
  add constraint source_evidence_provenance_check check (
    (origin = 'research' and research_run_id is not null and founder_actor_id is null and request_id is null and request_hash is null and contact_id is null and business_id is null and contact_version is null and prospect_version is null)
    or (origin = 'founder' and research_run_id is null and founder_actor_id ~ '^[a-f0-9]{64}$' and founder_actor_id is not null and request_id is not null and request_hash ~ '^[a-f0-9]{64}$' and request_hash is not null and contact_id is not null and business_id is not null and contact_version > 0 and contact_version is not null and prospect_version > 0 and prospect_version is not null and source_type = 'founder_verified' and claim_type in ('contact_email', 'business_observation'))
  ),
  add constraint source_evidence_contact_business_fk foreign key (contact_id, business_id) references growth.contacts(id, business_id) on delete restrict,
  add constraint source_evidence_prospect_business_fk foreign key (prospect_id, business_id) references growth.prospects(id, business_id) on delete restrict;

drop index growth.unique_evidence_claim;
create unique index unique_evidence_claim on growth.source_evidence (prospect_id, source_url, claim_type) where origin = 'research';
create unique index founder_evidence_request_claim_idx on growth.source_evidence (request_id, claim_type) where origin = 'founder';
create index founder_evidence_current_idx on growth.source_evidence (prospect_id, contact_id, verified_at desc) where origin = 'founder';

create function growth.protect_founder_source_evidence() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.origin = 'founder' or (tg_op = 'UPDATE' and new.origin = 'founder') then
    raise exception 'founder source evidence is append-only';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger protect_founder_source_evidence before update or delete on growth.source_evidence for each row execute function growth.protect_founder_source_evidence();
