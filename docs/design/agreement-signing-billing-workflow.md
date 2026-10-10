# Agreement, signing, and billing workflow

Owner: Technical Agent
Status: Implemented in PR; database and provider verification pending
Created: 2026-10-10

## Decision

The client journey is budget request, proposal, reviewed agreement, signatures,
retained signed copy, then billing setup. Presentation stages are derived from
commercial offers, signing approvals, and retained evidence. Email delivery is
tracked separately and is never inferred from a signing request.

Each service has one identity in builder drafts. Setup and recurring charges
retain their own amounts and intervals in the existing agreement line structure.
Legacy drafts remain readable without inferred groupings. Issued documents and
signed snapshots are immutable.

Stripe Checkout setup mode collects card or GBP Bacs details. FSS stores only
provider references, masked details, setup state, and explicit consent. Revolut
Business remains the intended Stripe payout bank, subject to production account
configuration. Revenue-share collection stays manual.

## Data and failure handling

Additive migrations record signing completion failures, agreement notifications,
delivery events, agreement archive metadata, billing setup sessions and consent,
and scoped onboarding progress. Notification dispatch uses an outbox committed
with the commercial or signing transition. An unknown provider outcome is held
for staff review to avoid an automatic duplicate. Existing issued requests are
backfilled as delivery unverified. A verified delivery event arriving before
provider acceptance is retained and applied after acceptance is recorded.

Signature capture commits before document processing is scheduled with Next.js
`after()`. The signing worker remains the durable retry path. All required
signatures without retained evidence appear as processing, not complete. A
signed agreement may be archived without touching evidence or billing. Draft
deletion and unsigned withdrawal enforce scope, version, dependent-record, and
audit checks in the database.

Billing setup creates or reuses the scoped customer mapping before an invoice
exists. The stored consent and active payment method can authorize only a new
future recurring obligation. Existing invoices and immediate obligations keep
manual payment. Existing provider schedules require the hosted payment-management
flow for changes; the setup flow refuses to replace their payment method.

## Release and verification

Apply the six `2026101016*` migrations before deploying application code.
Verify the signing, notification, onboarding, and billing workers, the Resend
webhook, Stripe webhook events, GBP Bacs availability, and the Revolut payout
account in the target environment. Exercise a test-mode agreement from proposal
through signed evidence, then card and Bacs setup, before enabling live traffic.
Production deployment requires explicit human approval. Rollback disables new
actions while preserving evidence, financial records, notification history, and
audit events.

The local environment has no usable Operations test database or live provider
configuration. Migration execution, Operations integration coverage, and Stripe
sandbox behaviour remain release gates rather than verified claims.
