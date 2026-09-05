# Sector example verification

Verified locally on 2026-09-05. Implementation is local; release is pending.

## Passed

- TypeScript: `pnpm exec tsc --noEmit`.
- Scoped ESLint over example routes/components/domain modules and changed
  outreach files.
- Focused tests: 101 passed. Covers all 40 independent registry entries,
  unique headings/anchors, local assets, service links, all 120 guide params,
  ten-sector classification, business-name exceptions, safe four-link emails,
  retained concepts, historical narrative fallback, idempotency, enrollment
  exclusion and accessible initial enquiry controls.
- Production build: Node 24, `pnpm exec next build --webpack`. Compiled and
  typechecked successfully; 249 total static pages generated, including the
  40 example homepages and 120 service pages.
- Browser DOM checks: all 40 homepages at 390px, each has its distinct h1 and no
  horizontal document overflow. Representative desktop visual reviews include
  Maison, Unfold, Ember & Oast and Axis Workshop; mobile Crownline, Current Care
  and Bay Plan were also visually reviewed after image loading. All 40 pages
  also passed a text-range check for clipped headings and buttons at 390px.
- Browser enquiry: selected cash-flow need, reviewed retained answers, attempted
  empty slot submission (native validation focused the required radio), chose
  Wednesday 11:00, and reached an explicitly fictional appointment summary.
  Each stage heading received focus. No network submission or booking occurs.
- Earlier four-site browser checks: property filters returned one rental, zero
  rental/4+ bedroom results and three after reset; Folio changed £5,800 to £1,600;
  roofing scroll video advanced to 4.17 seconds and had a compact mobile fallback.
- Reduced-motion guards and CSS inspected/tested. OS preference emulation was
  not available in the browser tool.
- Direct Supabase read plus actual local renderer dry run: 14 eligible drafts,
  14 valid refreshed copies, zero failures, all with four correct sector links.
  Email lengths 179–198 words; one existing published concept preserved.
- `git diff --check`.

## Limits and release checks

- Full unit suite: 1,398 passed, zero failures. An initial run found a stale
  Gmail-sync expectation of three automated follow-ups after the existing
  Day 11 founder-approval change. The test now asserts the exact automated
  steps `[1, 3]` (Day 5 and Day 14); production sequence behaviour is unchanged.
- Database transaction integration tests were not run: DATABASE_URL is
  unavailable locally. Direct connector reads and renderer dry runs succeeded;
  they do not substitute for transaction integration tests. Run
  `pnpm test:integration:growth:database` in its configured test environment.
- Default Turbopack build had stalled earlier; the webpack build succeeds.
- Browserslist reports stale compatibility data; no dependency update was made.
- No production Lighthouse measurement, external accessibility audit or AWWWARDS
  assessment has been run. No performance, ranking or award score is claimed.
- Production deployment and stored-draft mutation are pending. Draft eligibility
  changed from 16 to 14 during work; re-read and lock current records at apply.
- No emails sent or provider drafts created. No blanket commit of the extensively
  modified shared worktree was made.

## Changed files

- `app/examples/`: sector collection, 40-homepage dynamic route, 120-service-guide
  dynamic route, layout and focused styles.
- `components/sector-examples/`: site compositions, registry, shared enquiry,
  chrome, motion, useful interactive tools and tests.
- `lib/sector-examples/`: ten-sector catalogs/services/journeys, classification,
  safe first-email renderer and tests.
- `public/sector-examples/restaurant-interior.png`: generated hospitality image.
- `lib/growth/research/candidate-details.ts`: examples at draft ingestion.
- `lib/growth/prospect-previews/approval.ts`, `approval-repository.ts` and test:
  sector/name-aware rendering while keeping private concepts.
- `lib/growth/sequences/first-email-template-refresh.ts` and test: protected,
  idempotent refresh including historical assessment fallback.
- `lib/growth/sequences/gmail-sync.test.ts`: corrected the stale expectation to
  assert only the existing Day 5 and Day 14 automatic steps.
- `scripts/refresh-pending-first-email-drafts.ts`: dry-run default, public-route
  preflight, locks and enrollment recheck.
- `docs/growth-os/first-email-template.md`, `prompts/weekday-research.md` and
  `docs/sector-examples/`: policy, design, verification and release handoff.
