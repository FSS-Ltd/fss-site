# Operations portal implementation

User-authorised execution: work through plan 07 in order, one task PR at a time. Do not start the next task until the preceding PR checks pass and the PR is merged.

## Current step

Task 1: complete. [PR #204](https://github.com/FSS-Ltd/fss-site/pull/204) passed CI, Mobile Lighthouse and Vercel checks, then merged on 6 September 2026 at `6d945ff8`.

Task 2: complete. [PR #205](https://github.com/FSS-Ltd/fss-site/pull/205) passed CI, Mobile Lighthouse and Vercel checks, then merged on 7 September 2026 at `2b875aa4`.

Task 3: complete. [PR #206](https://github.com/FSS-Ltd/fss-site/pull/206) passed CI, Mobile Lighthouse and Vercel checks, then merged on 7 September 2026 at `8dff65a4`.

Task 4: complete. [PR #207](https://github.com/FSS-Ltd/fss-site/pull/207) passed CI, Mobile Lighthouse and Vercel checks, then merged on 7 September 2026 at `6bba9598`.

Task 5: complete. [PR #208](https://github.com/FSS-Ltd/fss-site/pull/208) passed CI, Mobile Lighthouse and Vercel checks, then merged on 7 September 2026 at `ad2499a2`.

Task 6: provider capability gate in progress on `feat/operations-provider-sandbox`, from freshly fetched main at `ad2499a2`. Initial account checks require renewed FSS sandbox access; see [provider gate evidence](provider-sandbox-results.md). Tasks 7–14 remain unstarted. The authoritative requirements remain in [plan 07](../superpowers/plans/fss-operations-station/07-implementation-plan.md).

The founder explicitly approved the entire build plan after Task 1 checks completed. Continue the sequential PR process without requesting the same build/merge approval again. Prepare and verify the concrete rollout in Task 14 before enabling live services.

## Release boundary

The existing main workflow automatically applies files in `supabase/migrations` to production. Operations migrations are generated using Supabase CLI, then staged in `supabase/operations/migrations` during implementation. CI applies both folders to its disposable PostgreSQL service. `pnpm verify:migrations` checks both sets together, including timestamp collisions. The production migration job continues to read only its existing folder.

Moving the staged migrations into the release folder is part of Task 14's concrete approval package. Review ordering against migrations added in the meantime before promotion. Do not execute these migrations in production or enable Operations before that release gate. Operations is disabled by default. Merging code does not activate the portal, run historical mappings, send messages or collect payments.

## Verification environment

Use Node 24 and the lockfile's pnpm version. Operations tests require `OPERATIONS_TEST_DATABASE_URL` and fail closed unless it names `fss_operations_test` or CI's `fss_growth_test` on loopback, without URL parameters. These databases must be disposable and dedicated to tests. Credentials must never be copied from production.

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:unit`
- `pnpm test:integration:operations`
- `pnpm test:coverage:operations`
- `pnpm test:integration:growth:database:ci`
- `pnpm verify:migrations`
- `pnpm build`

## Task 1 verification, 6 September 2026

- Node 24.20.0, pnpm 9.7.0, disposable PostgreSQL 17.
- `pnpm test:coverage:growth`: 1,515 unit/component/script/database tests passed, zero failures/skips; 94.37% lines, 86.00% branches, 94.21% functions. This includes the repository unit tests and Growth database integration suite.
- `pnpm test:coverage:operations`: 8 tests passed, zero failures/skips; 100% lines, 97.56% branches, 95.24% functions.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm verify:migrations`, `pnpm test:redesign`, `pnpm perf:budget:homepage`: passed.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- Changed-file Prettier and diff whitespace checks: passed.
- Independent source review: specification and code quality passed; no critical or important findings.
- Browser check of synthetic component fixtures using the actual client-list markup/CSS: desktop 1440 px and mobile 375 px inspected, no mobile horizontal overflow, visible keyboard focus, empty/error recovery, 200% text error state fits. This does not claim authenticated end-to-end portal testing.

PR #204 checks and merge are verified. Live founder login, provider integrations, real data and production rollout were not exercised by Task 1. The feature remains disabled until its approved environment is configured. See the [operator guide](client-register.md) for the reviewed mapping workflow.

## Task 2 verification, 7 September 2026

- Immutable draft revisions, manual signed evidence and per-line effective services implemented. See [agreement register](agreement-register.md).
- Operations database/unit coverage: 17 tests passed with no failures or skips; runtime-role integration includes concurrent revisions, exact totals, signing immutability, deposit/assets/date gates, malformed direct SQL, audit correlation and unchanged Growth history.
- Full Growth/unit/component/script/database suite: 1,523 tests passed, no failures/skips. The added field-accessibility test also passed separately after the final UI correction.
- Type checking, lint, production build, migration policy, redesign checks and homepage bundle budget passed. Production dependency audit found no known vulnerabilities.
- Independent source review passed after all SQL and form findings were fixed.
- Interactive synthetic browser fixture: successful creation sends exact pence and clears the new form; field errors preserve inputs and expose the correct accessible label/description; desktop 1440 px and mobile 375 px have no horizontal overflow. Actual mobile screenshot inspected. API responses were mocked in this fixture; real persistence and authorization boundaries were verified separately by automated tests.
- Authenticated deployed end-to-end testing, managed signing, live billing and production migration remain outside Task 2. PR #205 checks and merge are verified.

## Task 3 design direction, 7 September 2026

The user requested a stronger Apple-inspired premium treatment after reviewing the initial portal screens. Login and activation now use a borderless focused composition, larger typography, restrained FSS colour, a softly raised brand mark, refined controls and quieter supporting text. The shared shell and organisation list use the same spacing, surface and type rules. Preserve this direction in subsequent Operations UI work.

Desktop 1440×1000 and mobile 390×844 screenshots were inspected. The mobile page and activation page at 200% text have no horizontal overflow. The primary touch target is 54px; reduced motion disables press movement. Typecheck and focused lint pass. The broader Task 3 production build, repository lint, 40 Operations tests and the full Growth regression suite passed before the final image aspect-ratio polish. Actual application SDK adapters also passed the disposable managed-auth/Mailpit flow, including reuse of an existing provisioned account, email/PKCE replay rejection, cookie refresh and revoked-session rejection. Final operator integration, typecheck, formatting and production build passed after the visual polish. Task 3 PR checks and merge are verified.

## Task 3 local verification

- Operations: 41 tests passed, no failures/skips; coverage 97.71% lines, 94.06% branches, 97.25% functions.
- Full Growth/unit/component/script/database suite: 1,546 tests passed, no failures/skips. The final operator integration test additionally passed in the Operations suite.
- Final typecheck, production build, repository lint, changed-file formatting, migration policy, redesign shell and homepage bundle budget passed. Production dependency audit found no known vulnerabilities.
- Independent domain and SDK/operator source reviews passed after the internal organisation column grant was narrowed and covered by a restricted-role regression.
- Founder auth configuration remains unchanged. Actual-role tests cover simultaneous invitation claims, wrong email, expiry/replay/replacement, archived organisations, revocation, pooled tenant context, restricted views/files/counts and atomic rate limits.
- Managed-auth verification uses disposable local services and synthetic mailboxes. Hosted SMTP delivery and full production-environment end-to-end testing remain deferred to the Task 14 release gate. See [client identity](client-identity.md).

## Task 4 local verification, 7 September 2026

- Added tenant-scoped projects, milestones, shared documents, reviewed founder updates and protected downloads. See [projects and documents](projects-and-documents.md).
- Operations: 51 tests passed, no failures/skips; 98.19% lines, 94.22% branches, 97.31% functions. Full Growth/unit/component/script/database suite: 1,557 tests passed, no failures/skips.
- Fixed the user-reported Growth proxy 500: the exported-handler regression reproduced `founderProxy is not a function`; direct Auth.js invocation passes anonymous redirect, login, authenticated founder and portal cases.
- Real private Vercel Blob verification passed with synthetic bytes and actual restricted PostgreSQL roles. Anonymous, cross-tenant and revoked access were denied. Temporary object, store and empty project were removed; production resources remained untouched.
- Actual component screenshots inspected at desktop 1440 px and mobile 390 px; no overflow at mobile or 200% text, visible keyboard focus and 44 px document controls. Temporary preview route removed.
- Independent review passed after adding file-content signatures and the correctly hashed/mislabeled-file regression. Proxy fix also passed scoped review.
- Typecheck, lint, production build, formatting, migration policy, redesign shell, homepage budget and production dependency audit passed. Build initially found stale generated development types for the removed preview; clearing that generated cache resolved it.
- Task 4 PR checks passed and merge is verified. The merged Vercel deployment passed; production Growth login returns 200 and the protected prospects route returns 307. Uploads and production Operations activation remain gated to the approved release process.

## Task 5 local verification, 7 September 2026

- Added client request list/board, creation, public comments, exact-version review and founder workflow controls. Founder priority remains separate from client-reported impact. See [requests](requests.md).
- Final Operations coverage: 142 tests passed, zero failures/skips; 97.85% lines, 92.63% branches, 97.28% functions. Final Growth/unit/component/script/database suite: 1,668 tests passed, zero failures/skips.
- Typecheck, repository lint, clean production build, changed-file formatting, migration policy, redesign shell and homepage bundle budget passed. Production dependency audit found no known vulnerabilities.
- Independent primary/API and domain/UI reviews passed after fixing administrative New-request reopening, current versus historical document associations and the missing founder priority control. All fixes have covering tests and scoped re-review.
- Clean migration replay and restricted-role tests used a fresh isolated native PostgreSQL 17.7 cluster after Docker Desktop became unavailable. Tests prove tenant isolation, reviewer revocation, concurrent submission/writes, stale deliverables, capacity, quote gates, private comments, priority boundaries and audit integrity. No production database was used.
- Actual-component browser fixtures verified desktop 1440 px, mobile 375 px and 200% text reflow; native keyboard review/founder selectors, visible focus, stable failed-submit idempotency keys and retained conflict drafts passed. Screenshots inspected. Fixtures and preview server were removed/stopped before final build.
- Browser/compile slowness included a transient generated-cache disk-space error. Clearing only this worktree's generated cache resolved the clean-build path. A sandbox IPC failure in lint's existing cover script passed when rerun with the required execution permission.
- Hosted authentication-to-request end-to-end testing and a dedicated screen-reader session remain part of the release gate. Uploads and notification delivery remain gated to their later approved integrations. Task 5 PR checks passed and merge is verified. CI completed in 7m47s and mobile Lighthouse in 3m21s.
