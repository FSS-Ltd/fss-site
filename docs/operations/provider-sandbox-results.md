# Provider capability gate

Task 6 status: incomplete, awaiting FSS sandbox access. Checked 8 September 2026. No provider selection has passed this gate, no billing dependency has been added, and no live payment configuration has changed.

## Account evidence

The Stripe connector exposes one account, named Faithful Software Solutions, in live mode. A read-only account retrieval reports country GB, default currency GBP, `details_submitted: false`, `charges_enabled: false`, `payouts_enabled: false` and an empty capabilities object. Onboarding requirements remain outstanding. This does not establish Bacs enablement or account-specific collection limits.

The installed Stripe CLI's default test-mode account retrieval failed because its stored API key has expired. The connector does not currently expose a sandbox. The founder has been asked to connect the intended FSS sandbox/test account or renew local CLI authentication with `stripe login`. Credentials must stay in the provider/CLI secret store, never in this repository or chat.

Live onboarding and acceptance of provider terms remain owner actions. Sandbox results will not by themselves prove live eligibility. No customer, invoice, subscription, mandate, payment or webhook endpoint was created during these checks.

## Current published evidence

| Item                        | Rechecked evidence                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UK standard card processing | 1.5% + 20p, [Payments pricing](https://stripe.com/gb/pricing)                                                                                                                                                                                                                                                          |
| Bacs processing             | 1%, minimum 20p, maximum £4, same pricing source                                                                                                                                                                                                                                                                       |
| Recurring Billing           | 0.7% of Billing volume under pay-as-you-go; one-off invoices excluded, [Billing pricing](https://stripe.com/gb/billing/pricing)                                                                                                                                                                                        |
| One-off Invoicing Starter   | 0.4% per paid invoice, plus payment processing, [Invoicing pricing](https://stripe.com/gb/invoicing/pricing)                                                                                                                                                                                                           |
| Bacs product support        | Checkout, subscriptions, invoicing and customer portal are listed as supported in the [product matrix](https://docs.stripe.com/payments/payment-methods/payment-method-support). Exact FSS hosted flows still require testing.                                                                                         |
| Bacs limits                 | Published default £10,000 per transaction and initial £10,000 weekly limit. Account-specific increases require provider confirmation. [Bacs documentation](https://docs.stripe.com/payments/bacs-debit)                                                                                                                |
| Candidate stable SDK/API    | Node SDK 22.6.1 and API `2026-08-26.dahlia`, verified against [official releases](https://github.com/stripe/stripe-node/releases/tag/v22.6.1), [SDK source](https://github.com/stripe/stripe-node/blob/v22.6.1/src/apiVersion.ts) and [API changelog](https://docs.stripe.com/changelog). Not yet installed or pinned. |

Published Billing and one-off Invoicing fees apply to their respective invoice classes; do not automatically stack both on a subscription invoice. Actual FSS pricing, any negotiated terms and classifications remain to be confirmed. Automatic tax remains disabled pending verified registrations and accountant-approved treatment.

## Required sandbox proofs

Every row remains **not run**. Use only synthetic customers and provider-documented test payment data. Assert test mode before mutations, label all created resources with the gate run identifier, and remove or cancel those resources after verification.

| Scenario                     | Required evidence                                                                                                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First invoice                | Finalised hosted invoice with exact signed amount and contractual due date; repeated idempotent operation resolves to the same invoice. No explicit email send.                                                                                |
| Start-now recurring work     | Subscription owns its initial invoice; no duplicate standalone invoice for the same service period.                                                                                                                                            |
| Deposit plus future retainer | One deposit invoice; future subscription schedule preserves the agreed start/anchor and creates no premature recurring charge. Advance an authorised test clock to verify renewal.                                                             |
| Hosted payment update        | Synthetic customer can add/update the eligible Bacs method through the hosted flow; invoice history remains accessible; negotiated price changes and cancellation controls are disabled as required by the contract.                           |
| Bacs processing then success | Observe pending before success using the documented delayed-success test case; browser return cannot imply paid.                                                                                                                               |
| Bacs failure                 | Observe delayed insufficient funds with mandate still active, and debit-not-authorised with mandate inactive. Verify distinct recovery decisions.                                                                                              |
| Signed webhook replay        | Capture provider-delivered test payload and signature locally; verify original, reject tampered/stale payloads, replay the same event and prove one logical outcome. Retain sanitised fixtures without signing secrets or hosted-session URLs. |
| Cleanup                      | Record cancellation/deletion of synthetic resources and stop local listeners.                                                                                                                                                                  |

Stripe provides delayed test cases and mandate outcomes in its [Bacs subscription testing guide](https://docs.stripe.com/billing/subscriptions/bacs-debit#test-the-integration). Those documented outcomes are test expectations, not execution evidence.

## Gate decision and manual fallback

Do not begin Task 7 until these proofs pass, the integration choice is recorded, and Task 6's PR passes checks and merges. If required Bacs or contract behaviour cannot be supported, keep the gate closed and document the precise limitation. Do not substitute recurring cards for Direct Debit.

The existing reviewed agreement/signing evidence workflow remains available. Billing continues through the founder's existing manual process until integration is approved. Record external invoice/payment references and verified evidence through the applicable reviewed workflow; do not infer payment from an uploaded screenshot or turn sandbox observations into live ledger entries.
