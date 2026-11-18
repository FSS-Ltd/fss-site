set lock_timeout = '5s';
set statement_timeout = '30s';

alter table growth.research_runs
  add column verified_key_id text,
  add column signed_body_sha256 text,
  add constraint research_signed_identity_check check (
    (verified_key_id is null and signed_body_sha256 is null) or
    (verified_key_id is not null and length(trim(verified_key_id)) between 1 and 200 and signed_body_sha256 is not null and signed_body_sha256 ~ '^[a-f0-9]{64}$')
  );
create function growth.protect_research_run_identity() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.external_run_id is distinct from old.external_run_id or new.verified_key_id is distinct from old.verified_key_id or new.signed_body_sha256 is distinct from old.signed_body_sha256 then
    raise exception 'research run identity is immutable';
  end if;
  return new;
end $$;
create trigger protect_research_run_identity before update on growth.research_runs for each row execute function growth.protect_research_run_identity();
alter table growth.facebook_discovery_runs
  add column signed_body_sha256 text check (signed_body_sha256 is null or signed_body_sha256 ~ '^[a-f0-9]{64}$');
alter table growth.source_evidence add constraint source_evidence_id_prospect_run_unique unique (id, prospect_id, research_run_id);

create table growth.research_source_proof_bindings (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references growth.research_runs(id) on delete restrict,
  prospect_id uuid not null,
  business_id uuid not null,
  contact_id uuid not null,
  prospect_version integer not null check (prospect_version > 0),
  contact_version integer not null check (contact_version > 0),
  contact_evidence_id uuid not null,
  observation_evidence_id uuid not null,
  created_at timestamptz not null default now(),
  unique (research_run_id, prospect_id),
  check (contact_evidence_id <> observation_evidence_id),
  foreign key (prospect_id, business_id) references growth.prospects(id, business_id) on delete restrict,
  foreign key (contact_id, business_id) references growth.contacts(id, business_id) on delete restrict,
  foreign key (contact_evidence_id, prospect_id, research_run_id) references growth.source_evidence(id, prospect_id, research_run_id) on delete restrict,
  foreign key (observation_evidence_id, prospect_id, research_run_id) references growth.source_evidence(id, prospect_id, research_run_id) on delete restrict
);
create index research_proof_current_idx on growth.research_source_proof_bindings(prospect_id,contact_id,prospect_version,contact_version);
alter table growth.research_source_proof_bindings enable row level security;
create policy growth_app_access on growth.research_source_proof_bindings for all to growth_app using (true) with check (true);
revoke all on growth.research_source_proof_bindings from public, anon, authenticated, service_role;
grant select, insert on growth.research_source_proof_bindings to growth_app;

create function growth.validate_research_proof_binding() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from growth.research_runs r
    join growth.prospects p on p.id = new.prospect_id and p.business_id = new.business_id
    join growth.contacts c on c.id = new.contact_id and c.business_id = new.business_id
    join growth.businesses business on business.id = p.business_id
    join growth.source_evidence ce on ce.id = new.contact_evidence_id
    join growth.source_evidence oe on oe.id = new.observation_evidence_id
    where r.id = new.research_run_id and r.verified_key_id is not null and r.signed_body_sha256 is not null
      and p.primary_contact_id = c.id and p.version = new.prospect_version and c.version = new.contact_version
      and substring(lower(business.first_party_source_url) from '^https?://([^/:?#]+)') !~ '(@|:|^[0-9]+[.][0-9]+[.][0-9]+[.][0-9]+$|(^|[.])(localhost|local)$)'
      and substring(lower(business.first_party_source_url) from '^https?://([^/:?#]+)') !~ '(^|[.])(facebook[.]com|instagram[.]com|linkedin[.]com|youtube[.]com|tiktok[.]com|google[.]com|maps[.]app[.]goo[.]gl|linktr[.]ee|wa[.]me|wixsite[.]com|wordpress[.]com|square[.]site|business[.]site)$'
      and (business.website_url is null or regexp_replace(substring(lower(business.website_url) from '^https?://([^/:?#]+)'), '^www[.]', '') = regexp_replace(substring(lower(business.first_party_source_url) from '^https?://([^/:?#]+)'), '^www[.]', ''))
      and ce.origin = 'research' and ce.claim_type = 'contact_email' and ce.source_type = 'first_party' and ce.source_url = c.email_source_url
      and regexp_replace(substring(lower(ce.source_url) from '^https?://([^/:?#]+)'), '^www[.]', '') = regexp_replace(substring(lower(business.first_party_source_url) from '^https?://([^/:?#]+)'), '^www[.]', '')
      and oe.origin = 'research' and oe.claim_type = 'business_observation' and oe.source_type = 'first_party'
      and length(trim(oe.claim_summary)) >= 20
      and regexp_replace(substring(lower(oe.source_url) from '^https?://([^/:?#]+)'), '^www[.]', '') = regexp_replace(substring(lower(business.first_party_source_url) from '^https?://([^/:?#]+)'), '^www[.]', '')
      and business.verified_at <= now() and c.email_verified_at <= now()
      and ce.observed_at <= now() and ce.verified_at <= now() and oe.observed_at <= now() and oe.verified_at <= now()
      and business.verified_at >= now() - interval '30 days' and c.email_verified_at >= now() - interval '30 days'
      and ce.observed_at >= now() - interval '30 days' and ce.verified_at >= now() - interval '30 days'
      and oe.observed_at >= now() - interval '30 days' and oe.verified_at >= now() - interval '30 days'
  ) then raise exception 'invalid research proof binding'; end if;
  return new;
end $$;
create trigger validate_research_proof_binding before insert on growth.research_source_proof_bindings for each row execute function growth.validate_research_proof_binding();
create function growth.protect_research_proof() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'research_source_proof_bindings' or exists (select 1 from growth.research_source_proof_bindings b where b.contact_evidence_id = old.id or b.observation_evidence_id = old.id) then
    raise exception 'research proof is append-only';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger protect_research_proof_binding before update or delete on growth.research_source_proof_bindings for each row execute function growth.protect_research_proof();
create trigger protect_bound_research_evidence before update or delete on growth.source_evidence for each row execute function growth.protect_research_proof();

alter table growth.outreach_permissions drop constraint outreach_permission_proof_pair_check;
alter table growth.outreach_permissions
  add column proof_origin text,
  add column research_proof_id uuid references growth.research_source_proof_bindings(id) on delete restrict,
  add constraint outreach_permission_source_check check (
    (proof_origin is null and research_proof_id is null and ((contact_id is null) = (proof_request_id is null))) or
    (proof_origin is not null and proof_origin = 'founder' and contact_id is not null and proof_request_id is not null and research_proof_id is null) or
    (proof_origin is not null and proof_origin = 'research' and contact_id is not null and proof_request_id is null and research_proof_id is not null)
  );
create index outreach_permission_research_proof_idx on growth.outreach_permissions(research_proof_id) where research_proof_id is not null;
create function growth.validate_permission_research_proof() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.proof_origin = 'research' and not exists (
    select 1 from growth.research_source_proof_bindings b join growth.campaign_memberships m on m.id = new.membership_id
    where b.id = new.research_proof_id and b.prospect_id = m.prospect_id and b.business_id = m.business_id
      and b.contact_id = new.contact_id and b.contact_version = new.contact_version and b.prospect_version = new.prospect_version
  ) then raise exception 'invalid permission research proof'; end if;
  return new;
end $$;
create trigger validate_permission_research_proof before insert on growth.outreach_permissions for each row execute function growth.validate_permission_research_proof();
revoke all on function growth.protect_research_run_identity(), growth.validate_research_proof_binding(), growth.protect_research_proof(), growth.validate_permission_research_proof() from public, anon, authenticated, service_role;

reset statement_timeout;
reset lock_timeout;
