# Portal access invitation lifecycle

Status: Implemented in the application and migration source; production rollout pending approval.
Owner: Technical Agent
Updated: 2026-10-07

## Problem and scope

The FSS Studio access register needs bounded pages and a way to clear invitation rows without erasing their history. A recipient of a new client invitation must be able to decline before creating an account. Declines remain visible for staff follow-up. Existing invitation links keep their current activation path.

## Design

- The Clients, FSS staff, and Invitations views each query 10 rows at a time. Filters run before the count and limit. A deleted final row clamps the requested page to the preceding page.
- New client invitations receive a random 256-bit decline token. Only its SHA-256 hash is stored. The token travels in the activation URL and is removed from browser history after the page loads. The hash is cleared after Clerk revocation succeeds; a provider failure leaves it available for a retry. The token is a bearer capability; declining means the link was used, not that the client's identity was verified.
- Claim, decline, and delete acquire the same per-email advisory lock and lock the invitation row before changing its state. Accepted and completed client invitations are absent from the Invitations view; active memberships appear in Clients.
- Studio deletion first rechecks staff access and the selected row, then locally revokes a pending invitation. Clerk cleanup matches the exact local invitation ID in provider metadata. The row is hidden only after cleanup succeeds. A provider error leaves the row visible and the command can be retried.
- Older invitation rows without an exact provider ID are revoked locally and remain visible with a review error. Email alone is insufficient to identify a Clerk invitation.
- Declines and dismissals are audited. A dismissal stores the required review reference and keeps the invitation record. Declined rows remain in the register and in the attention count until dismissed.

## Rollout and verification

Apply `20261006120000_operations_portal_invitation_lifecycle.sql` before deploying the application. Roll back the application first if needed; the additive columns and extended states can remain safely until a separate, reviewed schema rollback. Production deployment and migration application require human approval.

Unit and browser tests cover pagination, deletion retries, exact provider matching, token handling, and confirmations. All migrations applied to a temporary local PostgreSQL 17 database, and the Operations integration suite passed, including decline, expiry, accepted-invitation, dismissal, and audit checks. The production database was inspected read-only to verify existing table columns; it was not changed.
