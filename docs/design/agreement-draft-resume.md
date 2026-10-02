# Saved agreement draft discovery

Owner: Technical Agent
Status: Prepared for review; production migration and release require approval
Created: 2026-10-02
Last updated: 2026-10-02

## Problem and scope

Save draft persists the content, version and current stage, but returning to New agreement without its draft ID started a new Work stage. The client Agreements page listed created records and commercial offers, leaving working drafts undiscoverable. Production investigation confirmed successful save responses and existing unfinished drafts; no production data was changed.

Expose a separate saved-draft list on the client Agreements page and a chooser when returning to New agreement. Continue draft opens the existing builder by its saved ID and restores the saved stage and values. Start new agreement explicitly bypasses the chooser. A client with no saved drafts retains the original fresh-builder experience. Stage navigation and save validation remain unchanged.

The list shows title, saved version, stage and timestamp, orders newest first and uses the existing 25-item pagination convention. Untitled drafts remain visible. Finalised drafts are excluded, including those closed by commercial publication. No new dependency, endpoint or draft schema is introduced.

## Data boundary and security

The runtime role cannot SELECT the draft table. Migration `20261002213000_operations_agreement_draft_discovery.sql` adds a bounded, organisation-scoped SECURITY DEFINER function returning summary fields only. It uses an empty search path, schema-qualified references and the existing active-staff check. Only `operations_founder` receives EXECUTE; browser and worker roles remain excluded, and direct table permissions stay unchanged. The existing organisation/updated-at/id index supports the query.

The repository runs the function inside the existing staff transaction, validates returned summaries and uses parameterised arguments. The pages preserve authentication, organisation checks and the existing draft loading/version boundaries. Ambiguous new-and-resume URLs are rejected. No agreement contents or contact details appear in the listing response or diagnostics.

## Verification

Regression tests exercise the real server pages and rendered controls while replacing external authentication and database boundaries. They reproduce the missing chooser before the fix, restore persisted Fees values through the existing loader, cover deliberate creation of a new draft, reject conflicting intent and preserve the agreement-record pagination cursor.

Database integration tests use the restricted runtime role against a disposable local PostgreSQL database. They cover save/discover/load with retained edits, organisation isolation, finalised-draft exclusion, revoked membership, role grants, denied direct table access, untitled drafts and bounded pagination.

Browser tests use the existing gated visual fixture routes to cover native keyboard resumption, saved-state presentation and mobile width in both appearances. These fixtures do not replace the separate database and server-page tests of persistence. Browser artifacts capture the new chooser; production authentication and data are unchanged.

## Rollout and rollback

Apply the reviewed migration before releasing the application code: the new pages depend on its function. This is a function-only migration and does not modify existing drafts, tables or indexes. Production rollout requires explicit human approval.

Rollback application code first, then optionally remove only `operations.list_agreement_builder_drafts(uuid, integer)`. Existing saved drafts remain accessible through their original draft-ID URLs. Do not delete draft data or grant direct table access as part of rollback.

Validation on Node 24 and pnpm 9.7:

- Type checking, repository lint, changed-file formatting and all 68 migration policy checks passed.
- All 2,203 unit tests passed; the fixture-registration check was rerun after adding the chooser scenario.
- All 153 Operations integration tests passed against the disposable local database. The Operations coverage gate passed 603 tests at 92.37% lines, 88.38% branches and 93.56% functions; the new repository reaches 97.67% lines and 100% functions.
- All 40 agreement browser interaction checks passed in installed Chrome across desktop/mobile. An initial cold development-server compile exhausted the first existing test's timeout; the complete rerun passed. The new chooser artifacts were inspected in both appearances.
- The production dependency audit found no known vulnerabilities, and the production build passed.

The matching Playwright browser download did not complete locally, so existing pixel baseline comparisons were not rerun. Browser verification uses controlled fixtures; no production draft was mutated and no authenticated production publishing journey was exercised. The unrelated Growth database suite is outside this repair's scope.
