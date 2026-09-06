# Operations portal implementation

User-authorised execution: work through plan 07 in order, one task PR at a time. Do not start the next task until the preceding PR checks pass and the PR is merged.

## Current step

Task 1: organisation register and historical engagement mapping. Implemented and locally verified on `feat/operations-client-register`, starting from GitHub main `64c7ab9a` (fetched 6 September 2026).

Tasks 2–14 remain unstarted. The authoritative requirements are in [plan 07](../superpowers/plans/fss-operations-station/07-implementation-plan.md) and its linked specifications. Provider, identity and commercial decisions remain gates before dependent tasks.

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

PR checks and merge remain required before Task 2. Live founder login, provider integrations, real data and production rollout were not exercised by Task 1. The feature remains disabled until its approved environment is configured. See the [operator guide](client-register.md) for the reviewed mapping workflow.
