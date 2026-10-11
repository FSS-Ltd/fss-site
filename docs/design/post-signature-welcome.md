# Post-signature welcome journey

**Status:** Implemented in source; production rollout pending review.

## Decision

New welcome journeys start only after the selected agreement has current, unarchived signature evidence. Staff can prepare a draft welcome, but must review a fresh preview after signing before starting it. The approved snapshot binds the evidence ID, revision, provenance, recipient role, packet version, and rendered PDF. The start transaction checks those facts again.

The additive `journey_mode` column defaults existing records to `legacy_pre_signature`. New records use `post_signature`; they enqueue the welcome directly and never create a proposal or signing notice. Once welcome delivery is confirmed, invoice, portal invitation, and thank-you work becomes due at the next 09:00 Europe/London. The invitation may proceed independently of invoice completion; the thank-you still waits for both.

The verified `email.delivered` webhook confirms welcome delivery. If it arrives before the send receipt is recorded, the delivery event is retained and applied when the matching receipt succeeds. Provider acceptance alone does not queue billing or access.

Billing uses the signed agreement revision. Existing matching billing schedules, commands, memberships, and invitations are reused. A different billing owner, recipient role, expired invitation, or conflicting provider receipt holds the job for staff review.

## Rollout and recovery

Apply `20261011190000_operations_post_signature_welcome.sql` through the reviewed production migration process. Publish a newly reviewed post-signature packet version before starting new journeys. Previously approved snapshots and historical packet versions remain unchanged. Deploy the application only after both steps are approved. If the new flow must be stopped, pause affected journeys in the operations UI while reviewing queued effects; do not reverse completed sends or billing effects. The migration is additive and leaves historical journeys on their original mode.

## Verification

The migration was replayed in a fresh local PostgreSQL cluster. Focused unit, database integration, browser, type, lint, formatting, and build checks cover the new path. The current main branch passes the production dependency audit at the high-severity threshold; one moderate advisory remains.
