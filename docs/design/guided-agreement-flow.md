# Guided agreement flow and creation repair

Owner: Technical Agent
Status: Guided flow merged in PR #283; publication guidance and spacing follow-up prepared for review
Last updated: 2026-10-02
Created: 2026-10-01

## Problem and scope

The staff agreement builder needs focused prompts, fewer repeated labels and readable document previews in both appearances. Final creation also failed at 21:19 Europe/London on 2026-10-01: database error `42501` identified an explicit `FOR KEY SHARE` read against `operations.engagement_links`, where the runtime role lacks UPDATE permission.

This change retains the six stages, existing draft schema and endpoints, commercial terms, client signing and FSS styling. It adds no dependencies, permission grants or migrations. PR #282 has merged into `main`; this PR now targets `main` and retains its currency and compensation controls in Fees. Unrelated local welcome, settings, access and engagement changes are excluded.

## Implementation

Remove the explicit engagement-row lock while retaining the organisation-scoped eligibility read, draft lock, version checks and transaction. The existing composite foreign key protects the linked engagement during insertion. The deployed portal-origin fix remains intact.

Split Work, Scope, Fees, People, Document and Review into focused modules. Keep controls mounted within each stage and show one group at a time. Local Back and Continue retain values without a request; stage changes save through the existing API. Reload resumes the saved stage at its first group.

Validate the active group on Continue and every mounted group before saving. Reveal and focus the relevant control or group when validation fails. Recurring rates may remain empty while reaching compensation choices, but fixed rates remain required when saving. Text, financial choices and final creation or publication require explicit confirmation.

Auto-advance reviewed-work choices only on deliberate pointer, keyboard or assistive activation. Arrow exploration and restored selections stay in place. Focus new headings and use approximately 200 ms directional fading, with movement disabled for reduced-motion users. Pending requests disable controls and use a synchronous guard against duplicate submissions.

Use prompt headings as accessible labels for obvious single inputs; amounts, dates and related inputs keep compact labels. Dark cards use dedicated foreground and muted colours. The document and commercial summaries describe proposed or share-covered recurring prices without displaying misleading zero amounts.

Use typed feedback internally: pending messages describe the operation, successful saves use a quiet status and failures use alerts. Save, creation and publication have distinct fallback messages, including network failures. Server diagnostics contain a correlation ID, allow-listed operation, sanitised error name and SQLSTATE; they exclude agreement contents and contacts.

## Verification

The isolated PR branch was checked with Node 24 and pnpm 9.7, using its frozen lockfile:

- Unit suite: 2,128 passed.
- Operations integration suite: 144 passed against a fresh disposable PostgreSQL cluster containing only the PR branch's migrations. The four new tests cover complete finalisation without engagement UPDATE privileges, a missing organisation link, stale versions and transactional rollback.
- Agreement browser suite: 54 passed on macOS across desktop and mobile. Coverage includes retained values, local and saved transitions, native and money validation, keyboard/assistive selection, pending controls, HTTP/network failures, reduced motion and preview text contrast of at least 4.5:1 in both appearances.
- Screenshot baselines: 12 existing light screenshots refreshed and 12 dark screenshots added against the PR base. The comparison run uses the baselines without updating them.
- Type checking, repository lint, six blog-cover checks, changed-file formatting, production dependency audit and production build passed.

The earlier full local checkout had 2,183 unit and 148 integration tests; those counts include unrelated work and are not the PR's validation counts. Its database also contained unrelated welcome migrations, so the PR suite was rerun against a fresh cluster.

## Remaining verification and release

Linux screenshot baselines are still required before marking the PR ready. The matching Playwright container download did not complete locally. Do not copy macOS images over Linux baselines. On Linux, run:

```sh
pnpm exec playwright test --config=playwright.agreement.config.ts --workers=1 --grep 'agreement-builder.spec.ts|Phase 8 F1[0-5] ' --update-snapshots
pnpm exec playwright test --config=playwright.agreement.config.ts --workers=1 --grep 'agreement-builder.spec.ts|Phase 8 F1[0-5] '
```

PR #282 merged on 2026-10-02 Europe/London. The four overlapping macOS Fees and Review baselines were resolved in favour of the guided flow; other commercial screenshots from `main` were retained. Review the changed modules and screenshots, resolve Linux visual checks, and obtain explicit approval before production deployment. Rollback is a code revert; this repair changes no database schema or runtime grants. The isolated worktree is retained for PR feedback.

Conflict repair verification (2026-10-02): type checking, documentation formatting and all eight affected macOS Fees/Review comparisons passed in light and dark appearances across desktop/mobile. Runtime source files were unchanged, so unit, database and build checks were not repeated for this image/documentation-only merge.

## Publication guidance and compensation spacing follow-up

The deployed publication request at 20:25 Europe/London on 2026-10-02 returned HTTP 400. Vercel confirmed the request; a read-only lookup scoped to its client returned redacted validation flags: client-proposed recurring cash was selected, but the draft contained no recurring service. Required text fields and signers were present. No production draft was changed.

The publishing schema correctly rejects this combination, but the route previously converted its validation error into a generic instruction to check the draft. Review now uses the same complete-draft and publication schemas as the saved-draft command. It lists unfinished details with their stages, offers repair actions and disables publication or creation while those details are incomplete. Repair actions save through the existing draft API and retain agreement values. The server returns safe, actionable issue messages, without reflecting contact details, content or unexpected input keys.

For one-off work, use Fees → Ongoing compensation → Recurring payment → “Set the recurring amount.” For ongoing work with a client-proposed amount, add a monthly, quarterly or annual service; recurring services must share their interval and dates. The existing commercial rule, tenant boundaries, transactions and version checks remain intact. The compensation fieldset now uses the shared 16 px grid gap between its dropdown, explanation, checkbox and subsequent fields.

Follow-up validation uses Node 24 and pnpm 9.7. The local dependency tree was reused after verifying identical package manifests and lockfiles; the fresh download was slow. Unit tests: 2,197 passed. Operations integration tests: 149 passed against a fresh temporary local PostgreSQL cluster with the current migrations. The new database regression confirms that invalid publication retains the saved content/version and creates neither an offer nor an agreement.

All 36 agreement interaction, contrast and spacing checks passed in installed Chrome across desktop/mobile. The matching Playwright browser download did not finish, so the existing pixel baseline comparisons were not rerun. Four new compensation previews are captured as browser-test artifacts in light/dark appearances. Spacing assertions measure the real dropdown, helper text and checkbox rectangles, rather than relying on platform-specific image baselines. The repair action returns focus to Fees and preserves the service description.

The Operations coverage gate passed all 599 tests: 92.41% lines, 88.51% branches and 93.54% functions overall; both new validation modules have 100% line coverage. Type checking, lint, changed-file formatting, production dependency security audit and production build passed. The full Growth database suite is outside this follow-up's scope. Production release still requires explicit approval. Rollback is a code revert; there are no migrations, grants or new dependencies. The isolated follow-up worktree is retained for review.
