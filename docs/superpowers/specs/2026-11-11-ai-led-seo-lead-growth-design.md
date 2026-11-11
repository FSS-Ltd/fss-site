# AI-led SEO and lead growth: design

Date: 2026-11-11. Status: approved by delegation (the founder stepped away and
asked for decisions to be made toward one goal: more leads). Calls marked
"my call" were made by the orchestrating agent, not agreed with the founder.

## Problem

The public site is positioned for UK charities and faith organisations. The
founder wants to serve all businesses, small to large, led by AI integration
and automation. The site has no page for AI integration, AI agents, an AI
receptionist or an AI readiness audit, so it cannot rank or be cited for the
terms those buyers use. The contact form asks everything on one screen. The
blog reads as a utility list, not a publication. There is no `llms.txt`, the
organisation schema is thin, and blog posts can only be added through a
repository commit.

Evidence: `docs/seo/research/competitors.md`, `docs/seo/research/icp.md`, the
indexing audit and live check recorded in section "Audit findings".

## Goals

1. Rank and get cited for AI integration, automation and custom software
   terms across business sizes.
2. Turn more visits into enquiries with a one-question-at-a-time form.
3. Publish more often, from a keyword bank every writer must use.
4. Make the blog feel like an editorial publication.
5. Keep and improve the particle and motion effects.

Non-goals: paid ads, new vertical pages (law, clinics, trades), a pricing
calculator, removing charity or faith pages, changing Growth OS, Studio or the
portal, adding a paid AI API to the application.

Anti-goals: invented prices, statistics, client names or case-study numbers;
removing any existing animation; a production migration or domain change
without the founder's approval.

## Audit findings (2026-11-11)

Nothing blocks indexing. Ten live pages return 200, `index, follow`, a
self-canonical, one h1, valid JSON-LD; all 29 sitemap URLs return 200.
Weaknesses: no `/llms.txt` (404); AI crawlers allowed only by wildcard;
Organization node has no business type, description or address; two Article
schema shapes, one with anonymous author and publisher; no page-level schema
on `/about`, `/contact`, resources; hand-set sitemap dates; long titles on
`/services` and `/start`; `www` answers 307 at the Vercel domain layer
(founder action, see Rollout).

## Architecture and decisions

One pull request per change, each from its own worktree and branch.

### PR A `fix/seo-ai-citation-signals`
- `/llms.txt` as a route generated from `publicPages` plus blog and resources,
  so new pages appear without edits. Why: a static file goes stale.
- Explicit allow groups for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot,
  Claude-SearchBot, PerplexityBot, Google-Extended in `lib/seo/robots.ts`.
  Production only; previews stay disallowed.
- Organization node becomes `["Organization","ProfessionalService"]` with
  `description`, `knowsAbout`, logo `ImageObject`, Companies House in
  `sameAs`. Address: only `addressCountry: GB` unless a published address is
  already in `/privacy`. No invented address.
- `components/seo/article-schema.tsx` points author and publisher at the
  organisation `@id` and adds `@id`, `isPartOf`, `inLanguage`.
- `AboutPage` and `ContactPage` nodes.
- Does not edit `lib/seo/pages.ts` or `lib/commercial/*` (owned by PR B).

### PR B `feat/ai-led-service-pages`
Nine service pages (my call on "optimal": every solution type the research
found buyers naming, no page without distinct intent):

| Path | Status | Primary phrase |
|---|---|---|
| /services/ai-integration | new | AI integration services UK |
| /services/ai-agents | new | AI agents for business |
| /services/ai-receptionist | new | AI receptionist for small business UK |
| /services/ai-readiness-audit | new | AI readiness assessment |
| /services/workflow-automation | reframed | business process automation UK |
| /services/private-ai | reframed | private AI for business |
| /services/custom-software-development | reframed | custom software development UK |
| /services/portal-development | reframed | client portal development |
| /services/software-modernisation | reframed | legacy system modernisation |

- New pages extend `servicePages` in `lib/commercial/services.ts` and reuse
  the existing route component, schema, sitemap and tests. No new template.
- Reframed pages drop charity-only wording from title, description, answer
  and fit copy; the charity sector page and church article stay as they are.
- Home, `/services`, `/blog`, `/resources`, `/contact`, `/start` titles and
  descriptions in `lib/seo/pages.ts` move to AI-led, all-business wording,
  titles 60 characters or fewer, descriptions about 155.
- Home page hero and services index copy updated to match. Layout, particles
  and motion untouched.
- Each page: direct answer first paragraph, who it is for and not for, what
  affects cost (no figures), human approval and data handling, FAQs from the
  ICP question list. NexSteps is cited only as operational-software evidence,
  never as an AI deployment.
- Nav gains nothing new at top level; services index lists AI pages first.

### PR C `feat/stepped-enquiry-form`
`/contact` becomes one question per screen with a progress bar, reusing the
pattern in `business-intake-form.tsx` and the existing `/api/lead` route.
Steps (my call, trimmed from the research flow because FSS publishes no
price ranges yet): 1 what do you want to stop doing by hand or have AI do
(chips plus optional text); 2 tools in use (chips); 3 team size (bands);
4 when (bands); 5 name and work email (company optional, phone never).
Answers are folded into the existing `challenge` field so the lead schema,
honeypot, rate limits and downstream handling are unchanged. Keyboard and
screen-reader operable, Back never loses answers, reduced motion respected.
`/start` already has steps and a progress bar and is left alone.

### PR D `feat/editorial-blog-layout`
Blog index and post layout redesigned as an editorial publication: masthead,
lead story, category rail, reading time, dated byline, pull quotes, wide
measure control. Brand colours and fonts kept. Built with `/design-craft`;
not opened as ready until the jury scores 8/10 or higher.

### PR E `feat/blog-api` (held for founder approval)
- `POST /api/blog` creates or updates a post; `GET /api/blog` lists published
  posts as JSON. Bearer token from `BLOG_API_TOKEN`, constant-time compare,
  zod validation with the existing `blogFrontmatterSchema`, per-IP rate limit.
- Storage: a `blog_posts` table in the existing Supabase project
  (`gfeyanrriryihpcgdvqi`), added by a migration file that follows the
  repository migration policy. Why a table: Vercel's filesystem is read-only
  and the founder named the database for this.
- `lib/blog.ts` merges MDX files and published rows; slug collisions favour
  the file. Row bodies render as Markdown without JSX or imports. Why: the
  API must not become a way to run code on the site.
- Posts default to `draft`. `primaryKeyword` is required and must appear in
  `docs/seo/keyword-bank.md`.
- `scripts/generate-blog-post.ts` is updated to read the keyword bank.
- Held because merging runs the production migration workflow.

### PR F `feat/public-motion-polish`
Opus designs and builds better section transitions, scroll reveals and page
intro timing on top of the existing `components/redesign` motion code. No
animation library added, no effect removed, particle canvas kept, reduced
motion and the homepage performance budget respected. `/design-craft` and
jury 8/10 gate. Runs after PR D to avoid overlapping CSS.

### Docs (this branch, `docs/ai-led-seo-growth`)
This design, research, `docs/seo/keyword-bank.md`,
`docs/seo/google-business-profile.md`, `FEATURE_TREE.md` expansion for the
public site, Graphify update.

## Data model

Only PR E adds data: `blog_posts(id uuid pk, slug text unique, title,
excerpt, body_markdown, category, tags text[], primary_keyword, status
check in ('draft','published'), publish_date, modified_date, author,
cover_image, created_at, updated_at)`, RLS on, no anon access, index on
`(status, publish_date desc)`.

## Failure modes

- Database unreachable: blog renders MDX posts only and logs once.
- Form submit fails: answers stay on screen with a retry; nothing is lost.
- `llms.txt` generation error: route returns 500, pages unaffected.
- Motion code throws: existing guard keeps static content visible.

## Security and privacy

No secrets in code. Token and database URL come from Vercel environment
variables. Form collects less personal data than today. API input validated,
size-capped and rate-limited; writes logged with slug and action. No
personal names or emails are sent to third-party services by agents.

## Rollout and rollback

Each PR: unit tests, typecheck, lint, build, public-site crawl test, CI,
Vercel preview check, review agent. UI PRs add the jury gate. A merge is a
production deploy; rollback is a revert PR or Vercel instant rollback. PR E
waits for the founder. Founder-only actions: set `www` to a permanent
redirect in Vercel domain settings; add `BLOG_API_TOKEN`; create the Google
Business Profile from the prepared file; supply price ranges and measured
case-study results if they are to be published.

## Success metrics

Search Console impressions and clicks for the nine primary phrases at 30,
60 and 90 days; enquiries per week from `/contact` (source
`contact-page-v3`) against the current form; number of posts published per
month; citations of faithfulsoftware.dev in AI answers for the six research
questions (manual check monthly).

## Agent and model routing

Haiku: file mapping, list merging, profile document. Sonnet: research,
audit, PRs A, B, C, E, code review. Opus: PRs D and F and jury passes.
Fable: this design, briefs, verification of every agent's output.
