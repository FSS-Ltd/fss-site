alter table growth.prospect_previews
  add column slug text,
  add column composition_digest text,
  add column generation_status text not null default 'pending_pr',
  add column generation_pr_number integer,
  add column generation_branch text,
  add column review_deployment_url text,
  add column generation_external_run_id text,
  add column generated_at timestamptz,
  add constraint prospect_previews_slug_format check (
    slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  add constraint prospect_previews_composition_digest_format check (
    composition_digest is null or composition_digest ~ '^[a-f0-9]{64}$'
  ),
  add constraint prospect_previews_generation_status check (
    generation_status in (
      'pending_pr',
      'pr_open',
      'merged_draft',
      'composition_unavailable',
      'published',
      'withdrawn'
    )
  ),
  add constraint prospect_previews_generation_pr_number check (
    generation_pr_number is null or generation_pr_number > 0
  ),
  add constraint prospect_previews_generation_branch check (
    generation_branch is null
    or generation_branch ~ '^generated/prospect-previews/[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ),
  add constraint prospect_previews_review_deployment_url check (
    review_deployment_url is null or review_deployment_url ~ '^https://'
  ),
  add constraint prospect_previews_generated_package_requires_metadata check (
    generation_status not in ('pr_open', 'merged_draft', 'published')
    or (
      slug is not null
      and composition_digest is not null
      and generation_pr_number is not null
      and generation_branch is not null
      and generated_at is not null
    )
  );

create unique index prospect_previews_slug_unique_idx
  on growth.prospect_previews (slug)
  where slug is not null;

create index prospect_previews_generation_status_idx
  on growth.prospect_previews (generation_status, created_at, id);

create table growth.prospect_preview_change_requests (
  id uuid primary key default gen_random_uuid(),
  prospect_preview_id uuid not null
    references growth.prospect_previews(id) on delete restrict,
  composition_digest text not null
    check (composition_digest ~ '^[a-f0-9]{64}$'),
  generation_pr_number integer
    check (generation_pr_number is null or generation_pr_number > 0),
  notes text not null
    check (length(trim(notes)) between 1 and 2000 and notes = trim(notes)),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'superseded')),
  created_by text not null
    check (created_by ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index prospect_preview_change_requests_preview_status_idx
  on growth.prospect_preview_change_requests (
    prospect_preview_id,
    status,
    created_at desc
  );

revoke all on growth.prospect_preview_change_requests
  from public, anon, authenticated, service_role;

grant select, insert, update on growth.prospect_preview_change_requests
  to growth_app;
