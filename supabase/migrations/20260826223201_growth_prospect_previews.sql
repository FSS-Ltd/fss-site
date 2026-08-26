create table growth.prospect_previews (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null unique
    references growth.prospects(id) on delete restrict,
  public_id text not null unique
    check (public_id ~ '^[A-Za-z0-9_-]{32}$'),
  status text not null
    check (status in ('draft', 'published', 'withdrawn')),
  version integer not null default 1 check (version > 0),
  content_snapshot jsonb not null
    check (jsonb_typeof(content_snapshot) = 'object'),
  approved_at timestamptz,
  approved_by text,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prospect_previews_published_requires_approval check (
    (status = 'published') = (approved_at is not null and approved_by is not null)
  ),
  constraint prospect_previews_withdrawn_requires_timestamp check (
    (status = 'withdrawn') = (withdrawn_at is not null)
  )
);

create index prospect_previews_published_public_id_idx
  on growth.prospect_previews (public_id)
  where status = 'published';

revoke all on growth.prospect_previews
  from public, anon, authenticated, service_role;

grant select, insert, update on growth.prospect_previews to growth_app;
