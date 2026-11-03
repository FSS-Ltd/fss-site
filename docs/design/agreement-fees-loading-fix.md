# Agreement Fees loading repair

Owner: Technical Agent
Status: Implemented locally; production release pending
Created: 2026-11-03

## Cause and change

Opening Fees for an unpriced agreement created a shared service identity. Its
description placed a native textarea inside `PortalField`, which only accepts a
native input and throws during rendering. Existing drafts with shared services
and legacy drafts adding their first shared service encountered the same failure.

Use the existing `PortalTextarea` for the description. Keep the controlled value,
change handler, required validation and 3,700-character limit. No schema,
permission, pricing, dependency or API changes are required.

## Verification and release

The regression test renders the actual builder at Fees with an unpriced draft,
asserts the fee controls render and verifies the description has an associated
label. Before the repair, it failed with `PortalField requires exactly one native
input child.` After the repair, it passes.

Verified shared-service creation and retained description edits in the in-app
browser. All 2,397 unit tests, type checking, repository lint, changed-file
formatting, production dependency audit and production build passed. Database
integration and automated Playwright suites were not run: this change affects
rendering only, and browser verification used the required in-app browser.

Production deployment requires founder approval. Rollback is a code revert; no
data migration is involved.
