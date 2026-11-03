# Agreement fee currency selection

Owner: Technical Agent
Status: Implemented locally, pending production approval
Updated: 2026-11-03

## Request and decisions

The founder and authorised FSS staff can select GBP, USD or EUR in Fees. The existing agreement currency is initially selected. A currency change updates service prices, totals, deposits, installments and compensation labels without converting numeric amounts or changing the client's billing default.

Reuse the existing currency schema, money helpers and labelled portal select. Keep the existing staff command, membership checks, organisation scope and optimistic version checks. No dependency or permission changes are needed.

The previous database trigger overwrote selected currency with the client's default on insert and the old currency on update. The additive migration permits explicit currency selection while the working draft is editable. Missing currency retains the saved currency or, for a new draft, the client default. Published draft currency cannot change. Historical agreements, offers, invoices and their amounts remain unchanged.

## Alternatives and scope

Changing only the client default would not let staff select currency within Fees. Changing only the UI would lose the selection when saving. The selected approach updates the UI and draft trigger together. Exchange conversion and changes to published financial records are outside this request.

## Verification and rollout

Component tests cover all three options and restored fee, deposit and installment labels. Database tests cover explicit initial selection, later changes, stored values, unchanged amounts, client default isolation and published draft protection. Browser checks use the Codex in-app browser.

Local verification passed: 2,400 unit tests, 163 Operations database tests on disposable UTF-8 PostgreSQL, type checking, production build, repository lint, changed-file formatting and migration policy. In-app browser checks confirmed USD and EUR labels and totals, unchanged numeric amounts, deposits, installments and retained selection across group navigation. Automated Playwright suites were not run because browser verification must use the Codex in-app browser. Authenticated browser saves were not tested with the visual fixture's placeholder Clerk configuration; the actual staff save/load path passed database integration tests. The production dependency audit reports the existing low-severity `deepmerge` advisory; dependencies are unchanged.

Apply `20261103120000_operations_builder_currency_selection.sql` before deploying the UI. Production migration and deployment require separate approval. Rollback restores the previous `guard_builder_commercial_terms` function from `20261001133000_operations_builder_commercial_offers.sql`, then reverts the UI change. Existing saved drafts keep their recorded currency. No production changes were made during implementation.
