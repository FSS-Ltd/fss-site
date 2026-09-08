# Billing schedules and hosted payments

Task 7 derives collection obligations from a signed agreement revision. One-off installments allocate the exact signed one-off total; each recurring line belongs to a Stripe subscription or future subscription schedule. The separate `requiredDepositPence` activation condition does not add another charge.

Operations and billing remain disabled by default. The migration is staged under `supabase/operations/migrations`; normal main merges do not activate it in production. Task 14 owns rollout.

## Reviewed commands

Use Node 24 and the repository dependencies. Supply a reviewed JSON file to `pnpm exec tsx scripts/manage-operations-billing.ts <file.json>`. Without flags this validates the input shape only. Add `--apply --reviewed-by <configured-founder-email>` to execute it. The configured founder identity and database role are checked, and commands carry a correlation ID.

Examples, using actual internal UUIDs in place of the placeholders:

```json
{
  "action": "schedule",
  "organisationId": "<uuid>",
  "agreementId": "<uuid>",
  "revision": 1
}
```

The response contains schedule IDs. Issuance accepts a stored schedule ID and a durable command UUID, never an amount or a customer supplied by the browser:

```json
{
  "action": "issue",
  "organisationId": "<uuid>",
  "scheduleId": "<uuid>",
  "commandKey": "<uuid>"
}
```

Retain the command key when retrying. A completed subscription command stays bound to its original invoice, so a later retry cannot finalize a renewal invoice. The database also binds an obligation to one command even if a caller supplies a different retry key. Provider operation metadata is checked before creation. An uncertain command without a recovered reference stops after 23 hours rather than risk a new charge after Stripe prunes its idempotency key. Investigate the stored command, correlation ID and provider metadata before resuming; never delete the command to force a retry.

A start-now retainer uses its subscription's initial invoice. A deposit with a later retainer creates the deposit invoice and a future schedule with no premature retainer invoice. Contract dates are preserved. Past recurring start dates stop for reviewed recovery. Stripe owns renewals; no application renewal loop exists.

Amendment previews use an independently signed proposed agreement and a precise effective date:

```json
{
  "action": "preview-amendment",
  "organisationId": "<uuid>",
  "scheduleId": "<uuid>",
  "agreementId": "<signed-proposed-agreement-uuid>",
  "revision": 1,
  "lineNumber": 1,
  "effectiveAt": "2026-10-01T09:00:00Z"
}
```

A preview is stored as `awaiting_founder_approval`. The proposed signed terms are then blocked from ordinary schedule creation and issuance, including schedules prepared before the preview. Concurrent issue and preview commands are serialized; a proposal already claimed for issuance cannot be presented as held. This command cannot apply the change or cancel service. Proration timestamps are converted to whole seconds before calling Stripe. For a not-yet-started retainer, the held preview records current and proposed rates/dates with zero proration; the amendment review time must precede both service start dates.

## Client access

Owners and billing contacts can view invoices and manage payment methods. Contributors and viewers cannot read billing records. Every hosted action checks current membership and tenant scope, retrieves stored provider references, and checks membership again after the provider responds. Responses are private, uncached and use a no-referrer policy.

Configure `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` with a reviewed configuration for the same Stripe account and mode. Enable payment-method updates and invoice history; disable customer changes, subscription cancellation and subscription updates. The application validates these settings before creating a session. Do not use the provider default implicitly. Service changes and cancellation requests go through FSS under the agreement's terms.

Invoice links are retrieved from Stripe after authorization. Hosted URLs, client secrets and bank details are not stored in the invoice snapshot. The screen labels when its financial projection was checked and directs the client to the hosted invoice for current payment status. A browser return never marks an invoice paid. Task 8 supplies event reconciliation, allocation and mandate state.

## Tax and release requirements

Explicit nonzero signed tax stops issuance before provider mutations until a reviewed provider tax mapping exists. It is not silently folded into untaxed revenue. Automatic tax remains off until registrations and treatment are verified. This is a release dependency for agreements containing tax.

The account-bound Stripe client, private test environment and live-mode deployment guard from Task 6 remain in force. Credentials never belong in command files, Git, logs or the vault. See [provider verification](provider-sandbox-results.md).

## Verification evidence

On 8 September 2026, the application commands ran against the approved Stripe test account with synthetic organisations in a disposable PostgreSQL database:

- £200 deposit due 22 September plus a future monthly retainer: one invoice, no premature subscription invoice; retry reused the same invoice and schedule.
- Immediate £500 monthly and £1,200 annual subscriptions: one initial invoice each; retries reused their subscriptions and invoices.
- Application hosted portal and invoice link validation passed against actual Stripe responses.
- A future £500 retainer changed to a proposed £650 first period and later start returned a held £650 preview with no immediate subscription or invoice. The provider schedule phases remained unchanged.
- A £500-to-£650 active subscription amendment produced a held £799.99 preview, including the provider's time-dependent proration. The subscription price was unchanged. A fractional-second timestamp failure was reproduced, fixed and rerun successfully.

Synthetic subscriptions and schedules were cancelled, open invoices voided, customers deleted and products archived. The dedicated portal configuration was deactivated. Stripe retains test financial records. No live collection was activated.

## Payment reconciliation (Task 8)

`POST /api/webhooks/operations/stripe` verifies the exact request bytes with `OPERATIONS_STRIPE_WEBHOOK_SECRET`, rejects wrong mode/account and durably stores a minimal receipt before acknowledging. Requests are bounded to 1 MiB. Invalid signatures cannot open a database connection; receipt failures return a retryable 503. The receipt contains object references and a payload hash, not the raw payment payload.

`GET /api/cron/operations-billing` requires `CRON_SECRET` and both Operations feature flags. Its five-minute schedule runs bounded event claims and resumes the daily invoice cursor. The sweep checkpoints each completed invoice and retains unfinished page items across timeouts. Only a completed sweep waits a day. Set `OPERATIONS_BILLING_DATABASE_URL` to the dedicated worker login; connections enforce `operations_billing_worker`. This role cannot access Growth, alter signed schedules or delete payment evidence. Provider reads happen outside database transactions. The worker retrieves current provider state instead of trusting event order, and leases permit recovery after interrupted processing.

Payments, allocations, refunds, credits, disputes and mandate projections remain separate records. Provider-confirmed funds, the amount applied to the invoice and any excess are tracked separately. Account balances can change the amount due without changing the signed invoice total. Confirmed overpayments create a financial review item and remain visible in the portal. A refund or dispute does not erase the original successful payment. Unknown mappings, incomplete provider records and exhausted retries become founder review items at `/growth/operations/billing`. Portal owners and billing contacts see payment processing and linked mandate state; browser redirects do not confirm settlement.

Stripe is the sole reminder and retry owner. The application creates internal review items only. Before Task 14 activation, verify the account's reminder schedule, Bacs retry eligibility, notices and suppression behavior for paid/void invoices, processing payments, disputes and founder holds. A local review hold does not pause Stripe's reminders. Do not activate collection classes whose provider configuration cannot satisfy those conditions. No automatic legal escalation or service suspension is implemented.

Read bounds are explicit: 20 related payments/refunds/disputes/credits and 100 invoice lines or customer schedules. Larger records and invoice payment sources without a PaymentIntent are routed to review rather than partially projected. The founder queue uses 50-item pages. Accounting exports and verified manual payment-record allocation remain separate release work; a screenshot is never payment evidence.

Sandbox verification on 8 September used real £60 test invoices. A £10 partial refund and a £60 dispute matched persisted provider projections; duplicate event receipt returned 200 and repeated reconciliation retained one payment. Replay used locally generated test signatures over authentic Stripe event payloads, followed by authenticated provider retrieval. This proves replay and projection behavior, not deployed webhook delivery. Synthetic customers were deleted; Stripe retains their test financial records. Production flags and migrations remain gated until Task 14.
