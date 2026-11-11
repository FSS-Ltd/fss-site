begin;

-- Posts published through POST /api/blog. MDX files in content/blog stay the
-- primary source; rows are merged in by lib/blog.ts (the file wins a slug clash).
create table growth.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  title text not null check (char_length(title) between 1 and 300),
  excerpt text not null check (char_length(excerpt) between 1 and 500),
  body_markdown text not null
    check (char_length(body_markdown) between 1 and 60000),
  category text not null check (char_length(category) between 1 and 80),
  tags text[] not null
    check (cardinality(tags) between 1 and 10
      and char_length(array_to_string(tags, ',')) <= 509),
  primary_keyword text not null check (char_length(btrim(primary_keyword)) > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  publish_date date not null,
  modified_date date not null,
  author text not null check (char_length(author) between 1 and 120),
  cover_image text not null check (char_length(cover_image) > 0),
  seo_title text not null check (char_length(seo_title) between 1 and 70),
  seo_description text not null
    check (char_length(seo_description) between 1 and 200),
  featured boolean not null default false,
  indexable boolean not null default true,
  evidence jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence) = 'object'
      and pg_column_size(evidence) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blog_posts_status_publish_date_idx
  on growth.blog_posts (status, publish_date desc);

-- RLS on; only growth_app has a policy, so the browser roles can never read
-- drafts. The grant below (select, insert, update) bounds what the policy allows.
alter table growth.blog_posts enable row level security;
create policy growth_app_access on growth.blog_posts for all to growth_app using (true) with check (true);

revoke all on growth.blog_posts from public, anon, authenticated, service_role;

grant select, insert, update on growth.blog_posts to growth_app;

commit;
