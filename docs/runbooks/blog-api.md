# Blog publishing API

Publishes blog posts without a redeploy. MDX files in `content/blog` remain the
primary source; posts sent here are stored in `growth.blog_posts` and merged in
by `lib/blog.ts`. If a file and a row share a slug, the file wins.

## Setup (founder)

1. Merge the PR. The CI `migrate-production` job applies
   `supabase/migrations/20261111120000_growth_blog_posts.sql` through the
   existing reviewed `supabase db push --linked` workflow. Nothing is applied by hand.
2. In Vercel (Production only), add `BLOG_API_TOKEN`: a random string of at
   least 32 characters. Do not set it in Preview. Redeploy once so it is read.
   Until it is set, `POST /api/blog` returns 503 and accepts nothing.

## Contract

`GET /api/blog` is public and returns published posts (files and database rows):
`{ ok, posts: [{ slug, title, excerpt, category, tags, publishDate, url }] }`.
Memoised in the server for 5 minutes and cached at the CDN for 5 minutes; query strings do not bypass the memo, so they cause no extra database work. A write resets the memo.

`POST /api/blog` creates or updates a post by `slug`. Header
`Authorization: Bearer <BLOG_API_TOKEN>`, JSON body:

| Field | Notes |
|---|---|
| `slug` | lowercase letters, digits, hyphens, max 100 |
| `title`, `excerpt`, `author`, `category`, `seoTitle`, `seoDescription` | required strings |
| `publishDate` | `YYYY-MM-DD`; a future date schedules the post |
| `tags` | at least one |
| `coverImage` | a path under `/public`, e.g. `/images/covers/x.svg` |
| `bodyMarkdown` | plain Markdown, max 60,000 characters |
| `primaryKeyword` | required; must be in the keyword bank when `docs/seo/keyword-bank.md` is present (the file is bundled with the route through `outputFileTracingIncludes`; if it is absent the check fails open and only a non-empty keyword is required) |
| `status` | `draft` (default) or `published`; drafts are never public |
| optional | `modifiedDate`, `featured`, `indexable`, `authorUrl`, `reviewedBy`, `reviewedDate`, `audience`, `summary`, `sources` (http/https URLs only) |

Responses: `201` created, `200` updated, `400 invalid_json|invalid_body`,
`401 unauthorized`, `413 body_too_large`, `422 unsupported_markup|unknown_primary_keyword`,
`429 rate_limited`, `503 api_disabled|storage_unavailable`. Errors are
`{ ok: false, code, ... }`; no stack traces.

Bodies containing `import`/`export` lines, any raw HTML or JSX tag, `<script`, `{expression}` blocks, or link/image destinations other than http, https, mailto or a single-slash path are refused with 422 (line-start code fences and inline code are exempt; an unclosed fence hides nothing). Rows are also rendered as plain Markdown, so nothing in them is evaluated.

```sh
curl -X POST https://www.faithfulsoftware.dev/api/blog \
  -H "Authorization: Bearer $BLOG_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"example-post","title":"Example","excerpt":"One line.","publishDate":"2026-11-12","author":"FSS Growth Team","category":"AI","tags":["ai"],"coverImage":"/images/covers/example.svg","seoTitle":"Example","seoDescription":"One line.","primaryKeyword":"AI automation cost UK","status":"draft","bodyMarkdown":"## Heading\n\nText."}'
```

A write revalidates `/blog`, `/blog/<slug>`, `/sitemap.xml` and `/feed.xml`.

## Limits

- The write rate limit is 20 per minute per client IP (first `x-forwarded-for` hop, which Vercel sets), held in memory per
  serverless instance, evicting expired then oldest entries at 1000 clients. It slows token guessing; the token's length is the real defence.
- The row query has a 2.5 s timeout. When it fails or times out, the blog does not cache a files-only result:
  the index, post page, sitemap and feed throw, so ISR keeps the last good page, and a missing post is an error rather
  than a 404. (A production build is exempt, so a database outage cannot block a deploy; hourly revalidation repairs
  it.) Writes return 503. A timed-out query still occupies a pool connection until it completes.
- Precedence: a slug that exists as an MDX file is owned by that file whatever its date. A scheduled (future-dated)
  file hides a row with the same slug until the file's date. Rows with a future `publishDate` appear on that date:
  the index and post page revalidate hourly.
- Updates by slug keep omitted optional fields (`status`, `featured`, `indexable`, evidence keys), merge evidence keys, and
  set `modifiedDate` to today unless supplied. Required fields are replaced.
- Staleness after a write: the writing instance refreshes immediately (`revalidatePath` is global). Other instances
  keep the `GET /api/blog` list for up to 5 minutes (memo) and the CDN holds it for up to 5 more (plus
  `stale-while-revalidate` up to 10), so the JSON list can lag a write by roughly 5 to 20 minutes. Pages, sitemap and feed use `revalidatePath` and do not wait.
- The keyword-bank check is inactive until `docs/seo/keyword-bank.md` is on main (it is not in the repo yet), and it
  stays inactive whenever the file is absent.
- No delete endpoint. To retire a row, POST it again with `status: "draft"`.

## Rollback

- Stop writes immediately: remove `BLOG_API_TOKEN` in Vercel and redeploy. The
  API returns 503; stored posts keep rendering.
- Hide one post: POST it with `status: "draft"`.
- Revert the code: revert the PR (a revert is a production deploy). The table
  stays, unused. Dropping it needs its own reviewed migration, because the
  migration policy refuses `drop table`.
