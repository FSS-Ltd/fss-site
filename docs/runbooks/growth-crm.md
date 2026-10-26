# Growth CRM operations

## Scope and identity

Growth remains the authoritative CRM. Twenty's local development references informed compact record workflows; there is no Twenty server, SDK runtime or synchronization dependency.

- `/growth/prospects`: research leads, contacts and next steps.
- `/growth/prospects/new`: founder-only manual capture.
- `/growth/prospects/enquiries`: bounded inbound review with explicit conversion.
- `/growth/prospects/:id` and `/growth/deals/:id`: shared record overview, properties, activity and tasks alongside existing evidence and commercial controls.
- `/growth/pipeline`: filtered board/list, separate forecast measures and private saved views.

Company numbers normalize whitespace and case. An existing business is reused; an existing open prospect returns a conflict and a record link. Contacts normalize email and can only be reused for their existing business. A closed commercial lifecycle permits a new prospect on that same business. Won/lost engagement history is retained.

Manual leads start at `needs_review`, with fit score zero and corporate status `uncertain`. Their corporate verification date is null. A supplied contact requires a source, a checked date and an explicit holding basis; its subscriber type remains `uncertain`. Manual capture/conversion cannot create newsletter consent, approve outreach, or enroll a sequence. Existing verification and outreach gates continue to apply. Evidence-controlled identity fields are not exposed as ordinary editable properties.

## Daily workflow

Capture or convert a lead, review its business/contact/offer details, and create a deal explicitly when appropriate. A new deal starts at New. The existing forward-only stage controls own qualification, proposal, negotiation, won and lost decisions. Commercial moves synchronize the prospect's commercial status while preserving rejected/suppressed states and stopping outreach through the existing transaction. Delivery remains separate.

Record notes, calls and meetings as escaped plain text. Activity is append-only and paginated. Task creation does not overwrite a lead's primary next step. Use Make next step explicitly; the task and prospect versions are checked together. Complete/reopen and task edits are recorded in activity. Completing a task does not silently erase the separately maintained primary next step.

Ordinary company, contact, prospect and engagement edits use independent versions. Closed deals retain agreed commercial terms. If a record changes, refresh and review its current state before saving again.

Board and list use the same server filters and per-stage pagination. Saved views store validated filters/layout only, without cursors or SQL. Views belong to the founder actor; save, rename and confirmed deletion do not change CRM records. There is a 30-view bound per actor.

## Forecast definitions

One-off and monthly values are integer pence in storage and separate fields in every upgraded display. The open forecast excludes won/lost engagements. Probability-weighted one-off/monthly forecasts sum each deal's corresponding value multiplied by its probability, rounded per deal to pence. They are estimates, not recognised revenue or an annual contract value. The existing Deals minimum-value filter retains its one-off-plus-one-month comparison; its displayed amounts are separate.

## Updates, reconnect and privacy

Successful command responses publish a content-free commit ID locally and across same-origin founder tabs. The consumer refreshes authoritative server data after commit, deduplicates notifications and closes the channel while hidden or unmounted. Focus, visibility return and online events reconcile state missed while disconnected. No idle database/API polling, background reminder worker or paid event service was added.

This release does not claim live server push for research/provider updates while a tab remains focused. Those updates appear on navigation, explicit refresh or focus/reconnect. The authenticated server request rechecks founder access; a browser notification never grants authority. No contact, activity text, credentials or email bodies enter notification payloads or command audit metadata.

The existing founder-authenticated, same-origin HTTP wrapper bounds bodies to 64 KiB. New tables use private Growth schema grants and RLS. The runtime cannot update/delete activity or capture history. Saved-view commands scope every operation to the current founder actor.

## Rollout and rollback

Production migration and deployment require explicit founder approval. No Production data or infrastructure was changed during local implementation.

1. Review the branch, [dependency review](../security/growth-crm-dependency-review-2026-10-26.md), verification results and existing Operations billing failures.
2. Apply reviewed ordered migrations using the repository's Production migration workflow. The additive migration is `20261026155821_growth_crm_workspace.sql`.
3. Verify the four CRM tables, their policies/grants and indexes, and nullable `growth.businesses.verified_at` before deploying the application.
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

Final command results are recorded below after the final review. Nine existing deployed-preview contract checks require external preview configuration; local runs skip them. OAuth provider sign-in, production provider delivery and Production deployment are outside these local tests.

The broader Operations integration suite has two inherited billing failures reproduced on base source `b74be239` in the same local environment: `synthetic HTTP journey issues one invoice and appropriate per-recipient messages after all signatures, preserving newsletter opt-out` and `invoice bridge reuses permanent billing owner and records accepted outcome after cancellation`. The second reports `Billing date precedes signing`; 129 other Operations checks passed. No Operations billing source was changed for this CRM work.
