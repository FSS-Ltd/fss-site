# Approved welcome and onboarding scheduling

Task 10 implements the queue and provider adapters. Founder preview, controls and recovery UI are Task 11. Production activation and migration promotion remain Task 14. No real messages or invoices were issued during implementation.

## Approval and timing

The founder approves an immutable welcome recipient, email, five-page PDF and accessible HTML/text equivalent. The proposal has a separate approval containing the current signing revision/hash, exact signers, email content and explicit portal access roles. Contacts must already belong to the organisation. The welcome recipient must have approved billing access. No default owner grant is made, and revoked or conflicting access requires founder review.

A welcome can proceed while proposal terms are still being reviewed. The proposal becomes due two elapsed hours after Resend's original acceptance time, retrieved by the accepted message ID. A retry cannot move that anchor. The cron runs every five minutes; due times are eligibility times, not a guarantee of delivery to the inbox at that second.

All required signatures plus retained evidence schedule the first invoice, portal invitation and thank-you for the next calendar day at 09:00 Europe/London, including weekends. DST follows London civil time. Late processing becomes eligible immediately without rewriting the signature time. Invoice, access and email are separate effects.

## Durable effects and access

Jobs have permanent idempotency keys, generations, leases and an attempt journal. Pause/cancel fences future provider calls. Accepted in-flight outcomes remain recorded even if the journey has since stopped. Stripe writes reuse the existing signed billing obligation logic and check the current lease immediately before each write. Automatic SDK retries are disabled for this worker.

The first obligation is explicitly selected by its signed `installment:N` or recurring `line:N` key, account and mode. Amounts and dates are derived from the retained signed revision and checked again by existing billing triggers. Tax mapping and past recurring dates retain the existing founder-review holds. A future subscription schedule is retained as a provider owner but does not count as an issued invoice; thank-you remains held until an actual invoice is reconciled. Payment links use authenticated portal billing, so bearer payment URLs never enter the outbox.

Portal accounts are provisioned without sending an email or creating a login session. First access still verifies inbox ownership and claims an approved invitation. Tokens are stored with AES-256-GCM encryption bound to the issuing job and recipient; the normal invite table retains only the token hash. Email retries resolve the same stored token. An expired invitation may be replaced only by the later invitation effect within the same journey; an attempted email never silently receives a new body. Existing or revoked invitations outside that scope require founder review.

Resend retains idempotency keys for [24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys). Unresolved old attempts stop for reconciliation. Retries use 1, 5, 15 and 60 minutes, then 4 hours, with at most six total attempts. Provider rate limits are honored within the configured bound. A founder can record independently verified acceptance, with its original timestamp and review reference, without issuing another send. Unknown absence is never treated as proof that a resend is safe.

The dedicated signed webhook checks the [Resend job tag](https://resend.com/docs/webhooks/emails/bounced), intended recipient, sender and any already retained provider ID. It handles bounce/complaint callbacks before API acknowledgement and stops future work. Existing global suppressions are checked before each send. No newsletter or promotional content is included in these templates.

## Release configuration

All gates default off. Task 14 must provision and review:

- `OPERATIONS_ENABLED=true` and `OPERATIONS_ONBOARDING_ENABLED=true`.
- `OPERATIONS_ONBOARDING_DATABASE_URL`: isolated login allowed to assume only `operations_onboarding_worker`.
- `OPERATIONS_PORTAL_ORIGIN`: exact HTTPS origin used by approved proposal URLs.
- `OPERATIONS_RESEND_API_KEY`: dedicated Resend credential with send and retrieve-email permissions, approved sending domain and reply address.
- `OPERATIONS_RESEND_WEBHOOK_SECRET` and `OPERATIONS_RESEND_ACCOUNT_SCOPE`: verified endpoint `/api/webhooks/operations/resend`, subscribing to bounced and complained events. Scope identifies the credential's account and must stay stable across secret rotation.
- `OPERATIONS_ONBOARDING_INVITE_KEY`: canonical base64 encoding of 32 random bytes, in the secret store. Keep the key until all associated encrypted invitations are no longer needed; rotation requires a reviewed re-encryption migration.
- Existing portal provisioning, Stripe account/mode and billing enablement configuration. Test credentials must remain in test environments.
- `CRON_SECRET`, with `/api/cron/operations-dispatch` scheduled every five minutes.

Apply the three Task 10 staged migrations only after Tasks 1–9 staged schema. Rollback first disables `OPERATIONS_ONBOARDING_ENABLED`; retain the queue, evidence, encrypted tokens and permanent billing commands. Do not delete provider ownership records or reset idempotency keys to recover a send.

Inspect overdue counts, held jobs, failure codes and verified provider records. Never log tokens, raw provider errors, email bodies or credentials. A 503 webhook response requests a provider retry; signature failures return 400, oversized bodies 413, and unrelated signed events 200.
