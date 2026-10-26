# Growth CRM operations

## Scope and identity

Growth remains the authoritative CRM. Twenty's local development references informed compact record workflows; there is no Twenty server, SDK runtime or synchronization dependency.

- `/growth/prospects`: research leads, contacts and next steps.
- `/growth/prospects/new`: founder-only manual capture.
- `/growth/prospects/enquiries`: bounded inbound review with explicit conversion.
- `/growth/prospects/:id` and `/growth/deals/:id`: shared record overview, properties, activity and tasks alongside existing evidence and commercial controls.
- `/growth/pipeline`: filtered board/list, separate forecast measures and private saved views.

Company registration numbers normalize whitespace and case within the selected country. An existing business is reused; an existing open prospect returns a conflict and a record link. Contacts normalize email and can only be reused for their existing business. A closed commercial lifecycle permits a new prospect on that same business. Won/lost engagement history is retained. If a historical closed engagement still has an open prospect status, capture repairs that projection under the prospect lock with a content-free audit event before creating the new prospect. Existing rejected/suppressed status remains unchanged.

Manual leads start at `needs_review`, with fit score zero and corporate status `uncertain`. Their corporate verification date is null. A supplied contact requires a source, a checked date and an explicit holding basis; its subscriber type remains `uncertain`. Manual capture/conversion cannot create newsletter consent, approve outreach, or enroll a sequence. Existing verification and outreach gates continue to apply. Evidence-controlled identity fields are not exposed as ordinary editable properties.

## Daily workflow

Capture or convert a lead, review its business/contact/offer details, and create a deal explicitly when appropriate. A new deal starts at New. The existing forward-only stage controls own qualification, proposal, negotiation, won and lost decisions. Commercial moves synchronize the prospect's commercial status while preserving rejected/suppressed states and stopping outreach through the existing transaction. Delivery remains separate.

Record notes, calls and meetings as escaped plain text. Activity is append-only and paginated. Task creation does not overwrite a lead's primary next step. Use Make next step explicitly; the task and prospect versions are checked together. Complete/reopen and task edits are recorded in activity. Completing a task does not silently erase the separately maintained primary next step.

Ordinary company, contact, prospect and engagement edits use independent versions. Closed deals retain agreed commercial terms. If a record changes, refresh and review its current state before saving again.

Board and list use the same server filters and per-stage pagination. Saved views store validated filters/layout only, without cursors or SQL. Views belong to the founder actor; save, rename and confirmed deletion do not change CRM records. There is a 30-view bound per actor.

## Forecast definitions

One-off and monthly values are integer pence in storage and separate fields in every upgraded display. The open forecast excludes won/lost engagements. Probability-weighted one-off/monthly forecasts sum each deal's corresponding value multiplied by its probability, rounded per deal to pence. They are estimates, not recognised revenue or an annual contract value. CRM commands cap combined one-off/monthly input at 2,147,483,647 pence to remain compatible with existing integer-based commercial checks. The existing Deals minimum-value filter retains its one-off-plus-one-month comparison; its displayed amounts are separate.

## Updates, reconnect and privacy

Successful command responses publish a content-free commit ID locally and across same-origin founder tabs. The consumer refreshes authoritative server data after commit, deduplicates notifications and closes the channel while hidden or unmounted. Focus, visibility return and online events reconcile state missed while disconnected. No idle database/API polling, background reminder worker or paid event service was added.

This release does not claim live server push for research/provider updates while a tab remains focused. Those updates appear on navigation, explicit refresh or focus/reconnect. The authenticated server request rechecks founder access; a browser notification never grants authority. No contact, activity text, credentials or email bodies enter notification payloads or command audit metadata.

The existing founder-authenticated, same-origin HTTP wrapper bounds bodies to 64 KiB. New tables use private Growth schema grants and RLS. The runtime cannot update/delete activity or capture history. Saved-view commands scope every operation to the current founder actor.

## Rollout and rollback

Production migration and deployment require explicit founder approval. No Production data or infrastructure was changed during local implementation.

1. Review the branch, [dependency review](../security/growth-crm-dependency-review-2026-10-26.md), verification results and existing Operations billing failures.
2. Apply reviewed ordered migrations using the repository's Production migration workflow. The additive migration is `20261026155821_growth_crm_workspace.sql`.
3. Verify the four CRM tables, their policies/grants and indexes, nullable `growth.businesses.verified_at`, and the country-scoped identity migration before deploying the application.
4. Deploy the reviewed application, then verify a real founder session and the prospect-to-deal lifecycle without sending outreach.

Rollback must preserve captured data and verification-null compatibility. Keep the dependency security fixes and the nullable-date read compatibility. Disable/revert the CRM UI integration while retaining the additive tables and domain compatibility commit. Do not revert to an older read model that assumes every manually captured business has a verification date. Do not delete notes, tasks, saved views or enquiry links, or set `verified_at` non-null by inventing dates. Snapshot/export retained CRM records through an approved secure process before any later data migration.

## Local verification

Use Node 24 and `pnpm install --frozen-lockfile`. Apply all migrations to a fresh disposable PostgreSQL cluster with the normal `anon`, `authenticated` and `service_role` roles, matching CI. Several older Operations migrations create cluster-scoped roles, so replaying them into a second database in the same already-migrated cluster is not a clean bootstrap.

```sh
pnpm typecheck
pnpm lint
pnpm verify:migrations
pnpm build
pnpm audit --prod --audit-level high
DIRECT_DATABASE_URL=postgres://postgres@127.0.0.1:PORT/fss_crm_verification pnpm test
FSS_CRM_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:PORT/fss_crm_browser pnpm exec playwright test --config playwright.growth-crm.config.ts
```

CRM database/browser fixtures refuse non-loopback or non-test database names. Browser tests use actual protected routes with a randomly signed local NextAuth session and synthetic data. No authentication bypass is added. The browser server disables automations and uses the `growth_app` role. The local origin is `http://localhost:3229` because Next development canonicalizes API request URLs to localhost.

Domain coverage is measured with Node's test coverage across `lib/growth/crm/**/*.ts`, excluding test files, and includes real PostgreSQL integration tests. Browser checks cover desktop/mobile capture, editing, duplicate recovery, enquiry conversion, pipeline layout/filters, private views, tasks/activity, pending/lost-response retry, unauthenticated writes, focus catch-up and zero idle refresh requests.

## Verification status and known limits

Verified locally on 2026-10-26:

| Check                                           | Result                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Full `pnpm test`                                | 2,161 unit tests and 57 Growth database tests passed                                                              |
| Desktop/mobile browser journeys                 | 16 passed on actual protected routes                                                                              |
| TypeScript and ESLint                           | Passed, no new warnings                                                                                           |
| Changed TypeScript/CSS/Markdown/JSON formatting | Passed                                                                                                            |
| Production build                                | Passed with Next.js 16.4.2                                                                                        |
| Migration policy                                | All 64 migrations passed                                                                                          |
| Fresh disposable cluster bootstrap              | All ordered migrations applied successfully                                                                       |
| Production dependency audit                     | Zero vulnerabilities at all severity levels                                                                       |
| CRM domain coverage                             | 97.81% lines, 86.31% branches, 96.75% functions                                                                   |
| Independent code review                         | All changed production files reviewed; six findings fixed and regression-tested; no remaining actionable findings |

Nine existing deployed-preview contract checks require external preview configuration and were skipped. Remote CI, OAuth provider sign-in, production provider delivery, independent screen-reader testing and Production deployment were not run. Keyboard workflows, real desktop/mobile screens and responsive layout were checked with synthetic data.

The review fixes cover lossless timestamp pagination, same-route filter-control state, contact-conflict recovery links, historical deal closure, row-lock ordering and integer money bounds. The earlier task timing regression also has a gated-response browser test: controls remain disabled through the authoritative post-commit refresh. No review finding was deferred.

The broader Operations integration suite has two inherited billing failures reproduced on base source `b74be239` in the same local environment: `synthetic HTTP journey issues one invoice and appropriate per-recipient messages after all signatures, preserving newsletter opt-out` and `invoice bridge reuses permanent billing owner and records accepted outcome after cancellation`. The second reports `Billing date precedes signing`; 129 other Operations checks passed. No Operations billing source was changed for this CRM work.

## Worldwide manual capture and readable validation (2026-10-26)

The founder requested City labels and worldwide CRM capture after the company-number validator exposed raw Zod JSON. Manual capture now includes a country selector, accepts bounded overseas registration numbers and applies the eight-character Companies House rule only to UK companies. City labels replace Kent town throughout capture, company editing, prospect filters and pipeline filters. Prospect records display city and country.

Main’s existing migration `20261026100000_growth_global_research.sql` adds `country_code` with GB as the compatible default for existing records, removes the Kent-only county check, makes county nullable and scopes registration uniqueness by country. New manual leads do not invent a county. Existing records retain their stored locality/county. Identity lookups and capture locks use country plus registration number; the existing UK research importer remains UK-specific and its duplicate checks explicitly scope GB. This change enables worldwide manual records, while existing verification, suppression, consent and send-approval checks still govern outreach. It does not expand automated research to every jurisdiction or change the existing GBP money fields.

Validation shows readable messages beside fields, connects them through `aria-describedby`, marks invalid controls and focuses the first affected field on capture. Editing clears stale feedback. The error summary includes recovery instructions without schema paths, JSON or regex text. Contact-source errors target the contact field, and local validation does not offer an unrelated record-refresh action.

The country migration is already part of main. The PR adds only `20261026155821_growth_crm_workspace.sql`; the duplicate local country migration was removed when preparing the PR. The CRM migration has been verified on a fresh disposable cluster. Production application of the CRM migration still requires approval. To roll back the UI, retain country-aware reads and the country-scoped unique index; do not restore global registration uniqueness while different countries share registration numbers. Do not fabricate Kent values to restore a non-null constraint. Preserve all captured foreign records.

Follow-up verification passed: 2,164 unit tests, 58 Growth integrations, all 18 desktop/mobile browser journeys, TypeScript, ESLint, formatting, production build and all 65 migration policies. Both disposable local databases accepted the migration. The exact reported error and contact-field targeting have regression coverage. Independent review found no remaining production issues. Nine external-preview checks remain skipped because preview configuration is absent. The original report above describes the initial upgrade; this section supersedes its UK-only manual-capture assumptions. Main also now supports global research intake; its research-only safeguards are preserved in this PR.

## Pull request preparation

The PR branch starts from `origin/main` at `245998423`. Only the five CRM commits were transplanted from the preview checkout; its unrelated Studio settings, portal-access and welcome-experience commits were excluded. Main’s global research intake, nullable contact names, county/country reads and research-only approval/display safeguards were preserved. Country identity storage comes from main’s migration; this PR adds one CRM workspace migration.

Rebased verification so far: 2,366 unit tests and 60 Growth database integrations passed; TypeScript passed. All 82 ordered migrations applied to a fresh disposable PostgreSQL cluster. Final browser/build/lint/security and Operations results will be recorded before handoff. Test browser port can be set with `FSS_CRM_TEST_PORT`; 3239 allows verification while the user’s original preview remains on 3229.

The earlier Operations billing failures in the initial implementation section refer to the original checkout, which included unrelated unmerged welcome work. They are historical evidence; the current PR is checked independently against main below.
