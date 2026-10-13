# AI receptionist guide landing page

Owner: Technical Agent · Status: Implemented, ready for local review · Created: 2026-10-13

## Outcome

Publish a focused, branded resource landing page at
`/resources/ai-receptionist-setup-guide`. The supplied 28-page PDF remains
byte-for-byte unchanged. Visitors submit the existing lead form, then receive
an immediate download. Newsletter consent is optional and unchecked.

## Design and implementation

Use the current FSS warm black, rust and light-surface palette. A focused
logo/CTA header applies only to this resource and its thank-you page; the
existing public shell, footer, consent controls and analytics stay intact.
The hero features the actual PDF cover. Three editorial chapters pair real
workbook, prompt and testing previews with useful descriptions. Desktop uses
a sticky preview; mobile and reduced-motion layouts use inline previews.
The single form stays stationary and all primary CTAs target it.

Use the existing MDX resource catalogue, resource routes, lead API and delivery
flow. Keep page-specific UI and motion in focused components and CSS modules.
Metadata includes canonical/social links, breadcrumbs and a Person author.
No new dependencies, database changes, external integrations or production
deployment are needed. Document contents inform the page; they are not agent
instructions. Do not promise guaranteed coverage, savings or clinical advice.

## Motion and accessibility

Use opacity/transform entrances of 500–700 ms and short control transitions.
The cover has restrained perspective; desktop preview crossfades follow the
currently visible chapter. No scroll hijacking or decorative loops. Content
remains readable without JavaScript. Reduced motion disables entrances and
sticky preview choreography. Keyboard navigation, anchor offsets, field errors,
pending state and server failures must be usable and perceivable.

## Verification

Check source PDF checksum, content catalogue, author schema, sitemap and robots.
Exercise form validation, both consent choices, pending/error/retry and download
success using intercepted API responses, never live email or lead writes.
Review desktop/mobile screenshots, 200% zoom, keyboard access, reduced motion,
preview switching and normal-speed animation. Run typecheck, lint, formatting,
unit/SEO tests, browser tests, production build, public-shell checks and bundle
budget. Record actual results and limitations below before handoff.

## Release and rollback

Implement in `feat/ai-receptionist-guide` in an isolated worktree. Preserve the
original dirty checkout. Deliver a local preview and commit the reviewed change;
production deployment requires a separate request. Reverting the feature commit
removes the resource and restores the original header on these URLs.

## Verification results

- The original PDF and published asset have identical SHA-256 checksums:
  `cd7ddabdd929d04c5f4c5d9275c4f649364fa696d3e2e97e367496d062416ff8`.
  A file-specific Git binary attribute prevents text normalisation and
  meaningless whitespace warnings in the unchanged PDF's internal objects.
- The four optimised WebP previews use original pages 1, 5, 10 and 21.
- All 2,288 unit tests pass, including delivery, consent, metadata and new
  guide/schema/error-association checks.
- All 28 browser checks pass across desktop and mobile: 16 new guide checks
  and 12 existing plumber-resource regression checks. Both specifications are
  included in Playwright's configured selection. Every lead submission is
  intercepted, so these checks create no real leads or emails.
- Browser coverage includes optional consent both ways, validation and focus,
  pending state, network/server errors and retry, thank-you navigation, PDF
  downloads, metadata, resource discovery, normal site navigation, sticky/inline
  previews, keyboard access, reduced motion, 200% text sizing and no-JavaScript
  content. Desktop/mobile screenshots were visually reviewed.
- Form validation now registers fields in visual order, so the first invalid
  visible field receives focus. Challenge errors are associated with the
  textarea. A no-JavaScript notice replaces the interactive form, avoiding a
  native GET submission of personal details.
- No dependencies, lockfiles, API contracts or database schemas changed.
  `pnpm audit --prod --audit-level=high` passes. The existing dependency graph
  has one moderate advisory in `sprintf-js`, transitive through `gray-matter`;
  the audit lists no patched version. See GHSA-hp3w-g68c-fv3c.
- Typecheck, ESLint, blog-cover validation, changed-file Prettier checks,
  `git diff --check`, public-shell checks and the production build all pass.
  The homepage bundle budget passes: JavaScript 68.9 KB raw / 24.4 KB gzip;
  CSS 70.4 KB raw / 14.5 KB gzip.
- `PUBLIC_SITE_TEST_URL=http://127.0.0.1:3216 pnpm test:public-site` passes
  its public-page, sitemap, metadata, links, redirects and PDF assertions,
  then fails at the unrelated `/growth` private-route assertion (500 instead
  of 307). The isolated checkout lacks Growth OS database/auth environment
  variables. Rerun that command with the project's Growth OS environment
  configured to verify the remaining private-route assertions. The guide's
  thank-you/noindex flow is separately covered by the passing browser tests.
- Live CRM/email delivery and database integration suites are not exercised:
  this change reuses the existing API, and browser submissions are mocked as
  requested. Production deployment is outside scope.

## Local handoff

The built preview runs at
`http://127.0.0.1:3216/resources/ai-receptionist-setup-guide`.
To restart from the feature worktree with Node 24 and pnpm 9:
`pnpm start --hostname 127.0.0.1 --port 3216`.
Local live form delivery requires the existing lead API environment; no new
credentials or service contracts were introduced.

Preserve the attached feature worktree while this change is under review.
It contains the reviewed implementation and is not merged or deployed.
The original checkout and its unrelated changes were not modified.
