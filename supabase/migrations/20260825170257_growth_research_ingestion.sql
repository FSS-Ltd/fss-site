create table growth.research_runs (
  id uuid primary key default gen_random_uuid(),
  external_run_id text not null,
  run_date date not null,
  timezone text not null check (timezone = 'Europe/London'),
  status text not null check (status in ('processing', 'completed', 'failed')),
  target_count integer not null,
  accepted_count integer not null default 0,
  duplicate_count integer not null default 0,
  rejected_count integer not null default 0,
  prompt_version text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  error_code text,
  error_summary text,
  created_at timestamptz not null default now(),
  constraint research_run_target_positive check (target_count > 0),
  constraint research_run_counts_nonnegative check (
    accepted_count >= 0
    and duplicate_count >= 0
    and rejected_count >= 0
  )
);

create unique index unique_research_external_run
  on growth.research_runs (external_run_id);

alter table growth.prospects
  add constraint prospects_research_run_id_fkey
  foreign key (research_run_id)
  references growth.research_runs(id)
  on delete restrict
  deferrable initially deferred;

create index prospects_research_run_id_idx
  on growth.prospects (research_run_id)
  where research_run_id is not null;

create table growth.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null
    references growth.research_runs(id) on delete restrict,
  prospect_id uuid not null
    references growth.prospects(id) on delete restrict,
  task_type text not null,
  status text not null,
  input_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(input_snapshot) = 'object'),
  output_snapshot jsonb
    check (output_snapshot is null or jsonb_typeof(output_snapshot) = 'object'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_summary text,
  run_after timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index unique_agent_task_idempotency
  on growth.agent_tasks (idempotency_key);

create index agent_tasks_research_run_id_idx
  on growth.agent_tasks (research_run_id);

create index agent_tasks_prospect_id_idx
  on growth.agent_tasks (prospect_id);

create index agent_tasks_status_run_after_idx
  on growth.agent_tasks (status, run_after);

create table growth.source_evidence (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null
    references growth.prospects(id) on delete restrict,
  research_run_id uuid not null
    references growth.research_runs(id) on delete restrict,
  source_type text not null,
  source_url text not null,
  external_reference text,
  claim_type text not null,
  claim_summary text not null,
  observed_at timestamptz not null,
  verified_at timestamptz not null,
  retention_class text not null,
  created_at timestamptz not null default now()
);

create unique index unique_evidence_claim
  on growth.source_evidence (prospect_id, source_url, claim_type);

create index source_evidence_research_run_id_idx
  on growth.source_evidence (research_run_id);

create table growth.website_assessments (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null
    references growth.prospects(id) on delete restrict,
  business_goal text not null,
  primary_cta text not null,
  sitemap jsonb not null,
  homepage_sections jsonb not null,
  conversion_plan jsonb not null,
  local_seo_plan jsonb not null,
  trust_signals jsonb not null,
  technology_plan jsonb not null,
  future_opportunities jsonb not null,
  hero_concept jsonb not null,
  mobile_fallback jsonb not null,
  performance_budget jsonb not null,
  status text not null,
  reviewed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index website_assessments_prospect_id_unique_idx
  on growth.website_assessments (prospect_id);

create table growth.email_assets (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null
    references growth.prospects(id) on delete restrict,
  asset_kind text not null
    check (asset_kind in ('cold_first_email', 'newsletter', 'site_email')),
  blob_url text not null check (blob_url ~ '^https://'),
  content_type text not null
    check (content_type in ('image/webp', 'image/jpeg', 'image/png')),
  byte_size integer not null check (byte_size > 0),
  width integer not null,
  height integer not null,
  alt_text text not null,
  prompt_summary text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  review_status text not null
    check (review_status in ('pending', 'approved', 'rejected', 'fallback')),
  created_by text not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint cold_asset_size check (
    asset_kind <> 'cold_first_email' or byte_size <= 184320
  ),
  constraint email_asset_dimensions check (width > 0 and height > 0),
  constraint email_asset_alt_text check (length(trim(alt_text)) >= 20),
  constraint email_asset_cold_aspect_ratio check (
    asset_kind <> 'cold_first_email'
    or width::bigint * 100 between height::bigint * 185 and height::bigint * 195
  )
);

create unique index unique_email_asset_hash
  on growth.email_assets (sha256);

create index email_assets_prospect_id_idx
  on growth.email_assets (prospect_id);

revoke all on
  growth.research_runs,
  growth.agent_tasks,
  growth.source_evidence,
  growth.website_assessments,
  growth.email_assets
from public, anon, authenticated, service_role;

grant select, insert, update on
  growth.research_runs,
  growth.agent_tasks,
  growth.source_evidence,
  growth.website_assessments,
  growth.email_assets
to growth_app;
