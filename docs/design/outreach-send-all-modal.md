# Outreach draft sending

Owner: Technical Agent
Status: Implemented, awaiting release review
Created: 2026-10-26

## Intent and scope

Add Send all to the current email draft queue and move research approval into a true modal. The existing queue is bounded to 50 loaded drafts. The Email drafts tab shows 10 per page; Send all covers the entire loaded queue across pages and never sends on opening. Sequences and Audit follow-ups have separate tabs.

## Approach

Reuse native modal dialogs and the existing individual approval endpoints. Load current review data on demand through a founder-authenticated, uncached read endpoint. Provide one permission selection and one reason for the batch. Copy those values into every eligible research email approval request so each recipient retains an individual audit record. Keep recipients, subjects, copy, and eligibility available in a collapsible review list before final confirmation. Legacy drafts retain their existing sequence approval behavior; research drafts send individually without follow-ups.

A separate bulk sending endpoint would duplicate existing version, fingerprint, suppression, permission, and audit checks. Preloading all full email reviews on every queue visit would increase idle reads. Neither is needed.

## Interaction and failure states

Use the existing Growth colors and controls. Modal content scrolls on small screens. Native dialogs provide focus containment and background isolation; closing restores trigger focus. Escape and cancel work before sending and remain blocked while requests are in flight. Shared permission fields sit above the collapsible recipient list. The final confirmation is reachable without scrolling through every draft. Per-recipient errors remain visible in the expanded delivery results. Unconfirmed delivery is never called sent. The batch submits sequentially once and does not automatically retry ambiguous outcomes.

## Verification and rollback

Add route authorization and error tests, plus desktop/mobile browser coverage for focus, dismissal, permission validation, blocked drafts, partial failures, duplicate clicks, and delivery outcomes. Run typecheck, lint, formatting, units, production build, and dependency audit. Browser tests use intercepted provider boundaries and fixture data. No production deploy, migration, or real email send is part of this task. Reverting the feature commit restores the previous UI.

## Verification record

- 2,375 unit tests passed, including founder authorization, review identity validation, legacy/research endpoint selection, blocked recipients, and delivery outcomes.
- 24 Chromium browser tests passed across desktop (1440px) and mobile (390px). They cover editing, shared and individual permission, partial batches, suppressed recipients, load failures, keyboard focus/dismissal, duplicate submissions, pending delivery, ten-row pagination, cross-page sending, and keyboard tab navigation.
- Typecheck, repository lint, formatting, production build, and production dependency audit passed. No new dependencies or migrations were introduced.
- Review/request helper tests verify current review identity, eligibility, exact approval payloads, and delivery outcomes.
- Desktop/mobile screenshots were inspected. Modal headers keep a close control visible while scrolling; checkbox sizing is tested. White text on the primary teal button has a 4.77:1 contrast ratio.
- Local database integration could not start because this isolated worktree has no DIRECT_DATABASE_URL. CI supplies an isolated database. Run `pnpm test:integration:growth:database:ci` with a disposable test database configured to repeat locally.

## Handoff

Keep the browser window open until batch processing finishes. Each recipient is submitted independently; a failure does not roll back messages already approved or sent. Closing results reloads the queue. No production deployment or real provider send was performed during follow-up verification. The changes require the normal reviewed merge and release.

## Workspace and batch interaction

- Email drafts, Sequences, and Audit follow-ups are separate accessible tabs. Arrow keys, Home, and End move between tabs; draft pagination is retained when switching tabs.
- Drafts show ten rows or mobile cards per page, with Previous/Next controls, page count, and visible range. Empty/error states retain their existing messages.
- The existing loaded-queue limit of 50 is unchanged. Pagination does not narrow Send all to the current ten-row page. It remains one explicit review of the complete loaded queue.
- Shared permission is required only when the batch includes eligible research drafts. Legacy sequences keep their existing approval behavior. A blocked recipient is skipped regardless of the common permission values.
- No polling, subscriptions, provider logic, database schemas, migrations, or dependencies were added. Tabs and pagination use already-loaded list data without polling or additional list-fetch requests.
