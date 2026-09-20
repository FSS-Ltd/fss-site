# Public SEO/AEO release checks

The public crawl uses a running production build. It does not submit forms, send email, call search services or change provider state.

Use Node 24, then run:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:public-redesign
pnpm perf:budget:homepage
pnpm start --port 3104 --hostname 127.0.0.1
# In another terminal:
PUBLIC_SITE_TEST_URL=http://127.0.0.1:3104 pnpm test:public-site
```

The crawl checks the 27 current indexable routes against the built sitemap, statuses, unique titles, self-canonicals, one H1, robots directives, internal links and fragments, orphaned commercial pages, PDF downloads and single-hop resource redirects. Growth and preview routes are excluded from the sitemap. Local private-route checks require the existing server environment schema to initialise; they do not require a successful login or a database connection.

For a completely isolated local smoke test, start the server with the following explicit fake values. These are fixtures, never production configuration. They disable automations and point the unused database address at an unavailable local port.

```sh
DATABASE_URL=postgres://crawl:crawl@127.0.0.1:1/crawl \
AUTH_SECRET=local-crawl-placeholder-secret-000000000000 \
AUTH_TRUST_HOST=true \
GOOGLE_AUTH_CLIENT_ID=local-crawl \
GOOGLE_AUTH_CLIENT_SECRET=local-crawl \
GROWTH_OS_OWNER_EMAIL=j.ntagengwa@faithfulsoftware.dev \
TOKEN_ENCRYPTION_KEY=local-crawl-placeholder-key-000000000000 \
GROWTH_OS_AUTOMATIONS_ENABLED=false \
pnpm start --port 3104 --hostname 127.0.0.1
```

## Readiness PDF

`pnpm generate:readiness-kit` generates the four-page PDF from `scripts/generate-readiness-kit.ts`. The asset test checks deterministic bytes, page count and equality with the published file. Render and inspect all pages after edits:

```sh
mkdir -p tmp/pdfs
pdftoppm -png public/resource-downloads/software-project-readiness-kit.pdf tmp/pdfs/readiness
```

The 4 September 2026 edition was rendered and every final page inspected. The first render exposed a footer overflow; the final version has four pages with legible headings, prompts, ruled writing space, sources and page numbers. Intermediates are ignored. The accompanying HTML page provides the planning guidance in an accessible web format. The two pre-existing Manual Process Audit and Software Investment Framework PDFs were retained; their expanded charity and church examples are on the HTML pages.

## Content and redirect rulings

- The two thin legacy blog posts remain served at their original URLs with unchanged MDX. They receive no new related-post promotion. Search Console and backlink evidence must precede any future rewrite/removal decision.
- `sdk-integration-readiness-kit` redirects to `software-project-readiness-kit`; `technical-content-conversion-playbook` redirects to `software-investment-framework`. Replacements exist before redirects are configured. Landing and thank-you paths preserve query parameters with HTTP 308; explicit www rules avoid host/slug chains.
- Publication and modification dates describe the web content. No personal reviewer is claimed without approved review evidence. Organisation authorship is explicit. Examples are illustrative, with no invented results, prices, ratings or customer endorsements.
- DigitalDocument markup is limited to the regenerated readiness workbook's supported visible file facts. No file date, size or page-count schema is inferred from the web page's dates.

## External follow-up

The full test command skips 39 database and 9 preview integration cases without their environment configuration. Run them in the configured test environments before release. A Vercel preview should verify deployed host redirects, platform headers, form persistence and delivery, mobile/desktop rendering and lab performance. Production deployment requires human approval.

Search Console coverage and backlink evidence, Google structured-data tooling, GA4 event verification and real-user performance data remain external follow-up. A local crawl and payload budget do not establish ranking, rich-result eligibility or field Core Web Vitals.
