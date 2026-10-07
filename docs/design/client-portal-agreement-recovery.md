# Client portal agreement recovery

Status: Implemented locally; production signing connection correction pending approval
Date: 2026-10-07

## Problem and scope

The Agreements navigation points at a route that returns 404 when the signing release flag is off. Getting started and Billing report a portal outage when their own feature is disabled. An already prepared or approved agreement still displays as Draft in its admin detail and offers preparation again instead of the next review step.

## Design

Target: responsive web, including Safari on macOS, iPadOS and iOS. Apply the Apple Design skill's sidebar, feedback, loading and accessibility guidance to the existing portal primitives. Keep navigation stable, describe unavailable features in context, preserve workspace links, and show a clear next action. Retain existing colour tokens, keyboard focus and 44px controls.

- Disabled modules render an informative page with workspace/help links, not a 404 or a claim of service downtime. Release gates remain enforced.
- Unexpected load failures use accurate page-level wording and recovery controls.
- Admin agreement detail reflects the matching revision's signing approval. Prepared documents lead to review and publication; open requests lead to signing status. Publication stays an explicit reviewed action.
- Client agreement lists distinguish signatures still needed from signatures already recorded and use one useful empty state.
- No legal signatures, emails or migrations are part of this implementation. The user separately authorised enabling electronic signing in production.

## Verification and rollback

Add regressions for disabled modules, prepared/approved admin states, empty agreements and already-signed client states. Run unit tests, typecheck, scoped lint/formatting, production build, and desktop/mobile browser checks. Preserve the original dirty checkout; implement on an isolated branch from current main. Roll back with the application commit; no data changes are required.

## Session findings and production activation

Documents failed with PostgreSQL 42501 because the workspace query directly filtered internal visibility, scan and revocation columns that the portal role cannot read. Existing forced RLS already applies those conditions, including expiry and project visibility. The query now selects only allowed metadata, keeps the explicit organisation filter, and relies on those policies. No grants were widened.

On 2026-10-07, the user explicitly asked to enable electronic signing. `OPERATIONS_SIGNING_ENABLED` was set to `true` in production and the existing main commit `3f5addfb` was redeployed as `dpl_FjymJUYUWBuwCXcoxtNNTyTYj7JS`. The deployment is READY and authenticated browser verification confirms `/agreements` renders rather than returning 404. No agreements were published or signed.

The signing completion cron then reported SQLSTATE XX000. Supabase pooler logs identify `operations_signing_worker_runtime` as a nonexistent database user; the provisioned login is `operations_signing_runtime`, with membership only in `operations_signing_worker`. The analogous onboarding connection uses `operations_onboarding_worker_runtime` instead of the provisioned `operations_onboarding_runtime`. These are connection-setting problems, not a database outage. Reading/correcting the stored signing URL is awaiting explicit approval after automatic approval review blocked reading production configuration. Do not replace these credentials with a privileged database URL or broaden role grants.

An authenticated admin register visit also returned the existing generic unavailable page. Its cause is not confirmed; the client Agreements page loaded successfully with the same browser session.

## Validation and handoff

- Full unit suite: 2,237 passed; the final two additional signer/revision boundary tests also passed in the focused 14-test suite.
- Operations integration suite: 154 passed against disposable PostgreSQL 17 with all migrations applied.
- Expanded Documents integration regression: passed, including private documents/projects, quarantine, expiry/revocation, tenant isolation and revoked membership.
- Desktop/mobile recovery and mocked signing journey: 10 passed. No production signature was submitted.
- TypeScript, scoped ESLint and production build: passed.
- Agreement visual checks: 10 passed; the two intentional recovery-page changes were visually reviewed, their macOS baselines updated, and both rerun successfully.
- Dependency audit: no high or critical advisories; one existing moderate `sprintf-js` denial-of-service advisory through `gray-matter`/`js-yaml` has no published patched version. No dependency changes in this branch.
- Linux verification: started the installed Docker runtime and used the official Playwright 1.63.0 image against the local fixture server. All 42 selected desktop/mobile visual checks passed after reviewing and updating the two S04 recovery baselines. Coverage includes Agreements, Billing, Documents, project and support screens. All 10 recovery/publication/mocked signing interaction checks also passed with the same loopback origin as the repository test configuration. The initial container hostname did not hydrate the signing form; using the established 127.0.0.1 development origin resolved the harness failure without application changes.

The application fixes remain on `fix/client-portal-agreements`, separate from the user's dirty working checkout. They require review and deployment. The production feature-flag activation is independent of this branch. To roll it back, set `OPERATIONS_SIGNING_ENABLED=false` and redeploy; signed data is unaffected.

## Signing origin correction

The reported “The request origin is not allowed” failure happens before authentication or database access: both staff and client signing factories registered the public website origin, although their requests originate on the portal subdomain. Those factories now use the existing `resolvePortalOrigin()` configuration. The legacy Growth founder endpoint retains the public website origin. The strict check still requires both the request URL and the Origin header to match the registered origin. No cross-origin allowance was added.

This covers preparation, publication, cancellation and client signing/decline because they share these command handlers. A regression exercises the actual route factories with distinct public and portal domains. Before the fix, both portal cases reproduce the reported 403; after the fix, the expected origins reach command execution while foreign, mismatched, missing and null origins remain blocked without writes. Existing authentication, rate limiting, payload and error-handling tests also pass.

Verification for the origin correction: all 2,243 unit tests, TypeScript, scoped ESLint, Prettier and the production build passed. The full unit suite needed loopback networking for its mock HTTP servers; the initial sandbox-only run could not bind 127.0.0.1. No database schema, signing business rules or UI markup changed in this correction. Production prepare/sign actions were not submitted; deployment and the separate signing database connection correction remain pending.
