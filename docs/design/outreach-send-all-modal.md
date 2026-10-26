# Outreach draft sending

Owner: Technical Agent
Status: Implemented, awaiting release review
Created: 2026-10-26

## Intent and scope

Add Send all to the current email draft queue and move research approval into a true modal. The queue is bounded to 50 displayed drafts; the button approves exactly that reviewed set. It does not select unseen drafts or send on opening.

## Approach

Reuse native modal dialogs and the existing individual approval endpoints. Load current review data on demand through a founder-authenticated, uncached read endpoint. Display recipients, subjects, copy, eligibility, and permission fields per research recipient before a final confirmation. Legacy drafts retain their existing sequence approval behavior; research drafts send individually without follow-ups.

A separate bulk sending endpoint would duplicate existing version, fingerprint, suppression, permission, and audit checks. Preloading all full email reviews on every queue visit would increase idle reads. Neither is needed.

## Interaction and failure states

Use the existing Growth colors and controls. Modal content scrolls on small screens. Native dialogs provide focus containment and background isolation; closing restores trigger focus. Escape and cancel work before sending and remain blocked while requests are in flight. Per-recipient errors remain visible. Unconfirmed delivery is never called sent. The batch submits sequentially once and does not automatically retry ambiguous outcomes.

## Verification and rollback

Add route authorization and error tests, plus desktop/mobile browser coverage for focus, dismissal, permission validation, blocked drafts, partial failures, duplicate clicks, and delivery outcomes. Run typecheck, lint, formatting, units, production build, and dependency audit. Browser tests use intercepted provider boundaries and fixture data. No production deploy, migration, or real email send is part of this task. Reverting the feature commit restores the previous UI.

## Verification record

- 2,374 unit tests passed, including founder authorization, review identity validation, legacy/research endpoint selection, blocked recipients, and delivery outcomes.
- 20 Chromium browser tests passed across desktop (1440px) and mobile (390px). They cover editing, recipient permission, partial batches, suppressed recipients, load failures, keyboard focus/dismissal, duplicate submissions, and pending delivery.
- Typecheck, repository lint, formatting, production build, and production dependency audit passed. No new dependencies or migrations were introduced.
- The new review/request helper tests cover 99.48% of lines, 93.51% of branches, and 96.88% of functions in those modules.
- Desktop/mobile screenshots were inspected. Modal headers keep a close control visible while scrolling; checkbox sizing is tested. White text on the primary teal button has a 4.77:1 contrast ratio.
- Local database integration could not start because this isolated worktree has no DIRECT_DATABASE_URL. CI supplies an isolated database. Run `pnpm test:integration:growth:database:ci` with a disposable test database configured to repeat locally.

## Handoff

Keep the browser window open until batch processing finishes. Each recipient is submitted independently; a failure does not roll back messages already approved or sent. Closing results reloads the queue. No merge, production deployment, or real provider send has been performed.
