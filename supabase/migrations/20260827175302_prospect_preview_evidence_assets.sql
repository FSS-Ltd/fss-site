alter table growth.website_assessments
  add column experience_brief jsonb
    check (
      experience_brief is null
      or jsonb_typeof(experience_brief) = 'object'
    );

create table growth.prospect_preview_evidence (
  id uuid primary key,
  prospect_id uuid not null
    references growth.prospects(id) on delete restrict,
  research_run_id uuid not null
    references growth.research_runs(id) on delete restrict,
  evidence_kind text not null
    check (
      evidence_kind in (
        'logo',
        'brand_colours',
        'service_language',
        'on_site_image'
      )
    ),
  source_url text not null
    check (source_url ~ '^https?://'),
  evidence_text text not null
    check (length(trim(evidence_text)) between 1 and 2000),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint prospect_preview_evidence_id_prospect_unique unique (id, prospect_id),
  constraint prospect_preview_evidence_source_unique unique (
    prospect_id,
    evidence_kind,
    source_url,
    evidence_text
  )
);

create index prospect_preview_evidence_prospect_id_idx
  on growth.prospect_preview_evidence (prospect_id, evidence_kind, created_at desc);

create index prospect_preview_evidence_research_run_id_idx
  on growth.prospect_preview_evidence (research_run_id);

create table growth.prospect_preview_assets (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null
    references growth.prospects(id) on delete restrict,
  preview_evidence_id uuid,
  asset_kind text not null
    check (asset_kind in ('logo', 'on_site_image', 'hero_media')),
  blob_url text not null
    check (blob_url ~ '^https://'),
  content_type text not null
    check (content_type = 'image/webp'),
  byte_size integer not null check (byte_size > 0 and byte_size <= 1048576),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  alt_text text not null
    check (length(trim(alt_text)) between 1 and 1000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  review_status text not null
    check (
      review_status in ('source_verified', 'pending_review', 'approved', 'rejected')
    ),
  created_by text not null
    check (created_by in ('agent_ingestion', 'founder_upload')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint prospect_preview_asset_evidence_kind check (
    (asset_kind in ('logo', 'on_site_image') and preview_evidence_id is not null)
    or (asset_kind = 'hero_media' and preview_evidence_id is null)
  ),
  constraint prospect_preview_asset_hero_review check (
    asset_kind <> 'hero_media'
    or review_status in ('pending_review', 'approved', 'rejected')
  ),
  constraint prospect_preview_asset_review_timestamp check (
    (review_status in ('approved', 'rejected')) = (reviewed_at is not null)
  ),
  constraint prospect_preview_asset_evidence_fkey foreign key (
    preview_evidence_id,
    prospect_id
  ) references growth.prospect_preview_evidence (id, prospect_id)
    on delete restrict
);

create unique index prospect_preview_assets_prospect_hash_unique_idx
  on growth.prospect_preview_assets (prospect_id, sha256);

create index prospect_preview_assets_prospect_status_idx
  on growth.prospect_preview_assets (prospect_id, asset_kind, review_status, created_at desc);

revoke all on
  growth.prospect_preview_evidence,
  growth.prospect_preview_assets
from public, anon, authenticated, service_role;

grant select, insert, update on
  growth.prospect_preview_evidence,
  growth.prospect_preview_assets
to growth_app;
