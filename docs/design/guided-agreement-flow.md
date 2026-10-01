# Guided agreement flow and creation repair

Owner: Technical Agent
Status: Prepared for draft PR review; Linux visual baselines pending
Created: 2026-10-01

## Problem and scope

The staff agreement builder needs focused prompts, fewer repeated labels and readable document previews in both appearances. Final creation also failed at 21:19 Europe/London on 2026-10-01: database error `42501` identified an explicit `FOR KEY SHARE` read against `operations.engagement_links`, where the runtime role lacks UPDATE permission.

This change retains the six stages, existing draft schema and endpoints, commercial terms, client signing and FSS styling. It adds no dependencies, permission grants or migrations. The review branch is based on PR #282 (`feat/client-commercial-terms`) because the Fees stage uses its currency and compensation controls. Unrelated local welcome, settings, access and engagement changes are excluded.

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

Retarget the PR to `main` after #282 merges. Review the changed modules and screenshots, resolve Linux visual checks, and obtain explicit approval before production deployment. Rollback is a code revert; this repair changes no database schema or runtime grants. The isolated worktree is retained for PR feedback.
