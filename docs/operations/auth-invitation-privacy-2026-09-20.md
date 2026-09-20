# Invitation privacy and account switching

- Owner: Technical Agent
- Status: Implemented locally; release pending
- Date: 2026-09-20
- Branch: `fix/invitation-account-switch`
- Follows: merged PR #261

## Problem

The shared staff/client invitation screen rendered the email returned by Clerk's `useUser` hook before the visitor accepted the invitation. A mismatched saved session was detected only after submission. Its server sign-out action also dropped the invitation at the login page. Browser profile identity does not establish portal identity.

## Change

- Remove saved-account and recipient email addresses from invitation markup, including email-bearing provider error messages.
- Show a generic account-switch action before accepting a mismatched session. If a refresh has removed the email hint, require switching rather than assuming the saved identity matches.
- Use Clerk's client sign-out, suppress its default router navigation, then perform a full page replacement to the same activation route. Preserve the original ticket and invitation context. The full reload resets pending form state and reruns personal-query-field scrubbing.
- Permit only `/activate` and `/portal/activate` as return destinations. On sign-out failure, preserve the invitation and show a retryable generic error.

The email hint is not an authorization input. Existing verified-primary-email checks, database grants, staff precedence, and Clerk ticket signup remain the authority. This patch changes no database schema, memberships, provider settings, or production records.

## Verification and release

Regression tests first reproduced the disclosure and the same-route navigation defect. Tests cover both activation routes, signed-out and matching/mismatching sessions, loading, refresh without a hint, provider errors, failed sign-out, redirect restrictions, and an already-cleared session.

Validation used Node 24.21.0:

- All 1,899 unit tests and 39 Growth database integration tests passed. Nine preview checks skipped because `GROWTH_OS_PREVIEW_URL` was not configured.
- Type checking, the production build, changed-file formatting, and ESLint passed. Repository ESLint excluded pre-existing `.worktrees/**` and `.freebuff/**` directories.
- A Playwright browser fixture exercised the real component with a simulated Clerk session on both activation routes. Clicking the switch action caused a full reload, preserved the ticket and name, removed personal query fields, displayed no emails, and enabled account creation. This did not contact Clerk or accept a live invitation.
- A separate review confirmed the corrected sign-out flow resets the component and scrubs the URL after reload.

Before production release, review CI. After release, verify one approved FSS invitation and one approved client invitation in a browser with an unrelated saved portal session. Confirm no email is displayed, account switching preserves the invitation, the signup form is enabled, and acceptance reaches the approved workspace. Live Clerk acceptance requires approved recipients and is not exercised by the simulated browser fixture.

Rollback: revert this application patch. No database rollback is required; reverting would restore the invitation-screen disclosure and broken recovery behaviour.
