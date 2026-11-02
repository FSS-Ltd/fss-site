# Signing deadline: extend or withdraw

Owner: Technical Agent
Status: Implemented in PR; database verification pending
Created: 2026-11-02

## Problem

Approval opens a signing request with a deadline (30 days from an approved
commercial offer). When the deadline passes before every required signature
is recorded, the record is read as `expired`, but:

- the stage logic folds `expired` into `withdrawn`, so the progress timeline
  shows no current step and staff see "Withdrawn" although nobody withdrew;
- the commercial offer stays `selected`, so the offer card still tells the
  client "Review and sign" and staff "Awaiting signatures";
- the staff signing page shows no controls for an expired request, and there
  is no way to reopen it. The only recovery is a buried "Withdraw agreement".

## Decision

Treat an expired signing request as its own stage, `signing_expired`, sitting
on the "Sent for signing" step, and give staff two explicit actions:

1. **Extend signing deadline.** Staff choose a window of 7, 14, 30, 60 or 90
   days; the server computes the new deadline from its own clock, so a skewed
   browser clock cannot break it. A new `operations.extend_agreement_signing`
   function moves `expires_at` to that time (at most 90 days ahead, the same
   bound as approval). It requires an `approved` request whose deadline has
   passed, an outstanding signature, and an unchanged draft agreement revision.
   The approval hash and retained document are unchanged, so signatures already
   recorded before the old deadline stay valid. The change is audited as
   `deadline_extended` with the previous and new deadline.
2. **Withdraw agreement.** Reuses the existing agreement lifecycle `withdraw`,
   which cancels the open signing request and marks the agreement withdrawn.

No email is sent automatically on extension, matching offer deadline
extensions. After extension the request is `approved` again, so the existing
per-recipient resend action becomes available.

The commercial offer read model now carries the status of the latest signing
request for the offer's agreement, so a `selected` offer reflects an expired
or closed request instead of claiming it is still awaiting signatures, and a
later revision is not hidden behind a superseded one. Client offer views now
use client-facing stage labels.

After either action the page reloads with `?signing=reopened|withdrawn`, so
the confirmation survives the panel unmounting.

## Data model

- `signing_audit_events.action` gains `deadline_extended`.
- `signing_audit_events` gains nullable `previous_expires_at` and `expires_at`.
- No change to `signing_approvals` columns.

## Failure modes

- Concurrent signer and staff: rows are locked `for update` on the agreement and
  approval, as in approve/cancel. A stale UI gets the standard conflict message.
- Request not actually expired, fully signed, superseded or revision changed:
  the function raises `P0001`, surfaced as "reload before trying again".
- Invalid deadline (past, or beyond 90 days): rejected in the service and in SQL.

## Security

Staff only (`assert_active_staff_membership`, hashed actor ID), granted to
`operations_founder` only. Clients cannot extend; they see a closed-window
notice with any recorded signature kept.

## Rollout and rollback

Apply `20261102120000_operations_signing_deadline_extension.sql` before
deploying the app. Rollback: deploy the previous app; the function and columns
are additive and unused by older code.

## Success metrics

Expired signing requests show "Signing deadline expired" with extend and
withdraw actions on the signing page, agreement page and client list; the
client sees "Signing window closed"; no expired request is labelled withdrawn.
