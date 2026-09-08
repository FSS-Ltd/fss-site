# Provider capability gate

Task 6 status: sandbox proofs passed; implementation review and PR checks pending. Checked 8 September 2026. Stripe is selected for the integration using SDK 22.6.1 and API `2026-08-26.dahlia`. Live activation remains gated to Task 14; no live payment configuration has changed.

## Account evidence

The Stripe connector exposes one account, named Faithful Software Solutions, in live mode. A read-only account retrieval reports country GB, default currency GBP, `details_submitted: false`, `charges_enabled: false`, `payouts_enabled: false` and an empty capabilities object. Onboarding requirements remain outstanding. This does not establish Bacs enablement or account-specific collection limits.

The founder supplied test credentials on 8 September. They are stored only in the ignored local environment file with owner-only permissions. Direct authentication succeeded to a separate GB/GBP test account, and synthetic customer creation returned `livemode: false`. The existing CLI login remains expired; the test listener uses the supplied test key through its process environment. No credentials are committed.

Live onboarding and acceptance of provider terms remain owner actions. Sandbox results will not by themselves prove live eligibility. Labelled synthetic customers, invoices, subscriptions and a test clock have been created for the proofs below. Bacs initially reported unavailable, then became available after enabling its display preference in the test configuration. The live account was not modified. Synthetic subscriptions/customers and the dedicated test clock were cleaned up after the tests; provider-retained records are described below.

## Current published evidence

| Item                        | Rechecked evidence                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UK standard card processing | 1.5% + 20p, [Payments pricing](https://stripe.com/gb/pricing)                                                                                                                                                                                                                                                                                                               |
| Bacs processing             | 1%, minimum 20p, maximum £4, same pricing source                                                                                                                                                                                                                                                                                                                            |
| Recurring Billing           | 0.7% of Billing volume under pay-as-you-go; one-off invoices excluded, [Billing pricing](https://stripe.com/gb/billing/pricing)                                                                                                                                                                                                                                             |
| One-off Invoicing Starter   | 0.4% per paid invoice, plus payment processing, [Invoicing pricing](https://stripe.com/gb/invoicing/pricing)                                                                                                                                                                                                                                                                |
| Bacs product support        | Checkout, subscriptions, invoicing and customer portal are listed as supported in the [product matrix](https://docs.stripe.com/payments/payment-methods/payment-method-support). The hosted FSS sandbox flow was tested below.                                                                                                                                              |
| Bacs limits                 | Published default £10,000 per transaction and initial £10,000 weekly limit. Account-specific increases require provider confirmation. [Bacs documentation](https://docs.stripe.com/payments/bacs-debit)                                                                                                                                                                     |
| Pinned stable SDK/API       | Node SDK 22.6.1 and API `2026-08-26.dahlia`, verified against [official releases](https://github.com/stripe/stripe-node/releases/tag/v22.6.1), [SDK source](https://github.com/stripe/stripe-node/blob/v22.6.1/src/apiVersion.ts) and [API changelog](https://docs.stripe.com/changelog). Pinned as the sole new dependency for the provider client and signature verifier. |

Published Billing and one-off Invoicing fees apply to their respective invoice classes; do not automatically stack both on a subscription invoice. Actual FSS pricing, any negotiated terms and classifications remain to be confirmed. Automatic tax remains disabled pending verified registrations and accountant-approved treatment.

## Required sandbox proofs

The following table defines the acceptance criteria. Executed results below cover each row; application payment-ledger implementation belongs to Task 8. Use only synthetic customers and provider-documented test payment data. Assert test mode before mutations, label all created resources with the gate run identifier, and remove or cancel those resources after verification.

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

## Executed evidence so far

- First invoice: a £200 synthetic deposit was finalised open with a hosted URL and an exact 22 September 2026 12:00 UTC due date. Repeating creation with the same idempotency key returned the same invoice. Automatic advancement remained off; no send endpoint was invoked.
- Future recurring start: a £500 monthly schedule was initially `not_started`, with only the deposit invoice present. Advancing its dedicated test clock to 1 October 2026 09:00 UTC activated the subscription with that exact billing anchor and one `subscription_create` invoice. Advancing to 1 November produced a separate £500 `subscription_cycle` invoice.
- Immediate recurring start: a separate synthetic customer received exactly one subscription-owned initial invoice, with no standalone duplicate.
- Hosted portal: test configuration enables payment-method updates and invoice history, disables subscription cancellation and price changes. A real browser displayed the Bacs tab and hosted mandate-consent form. The form saved a default Bacs method; the account page displayed invoice history and the deposit as Processing. No cancellation or price-change controls were exposed. The hosted mandate step uses a separate final confirmation screen.
- Signed events: the CLI forwarded actual test events to a loopback verifier using SDK 22.6.1. Original signatures passed; replay was recognised as a duplicate; altered payloads and correctly signed timestamps older than the tolerance were rejected. This proves provider transport and SDK verification, not Task 8's unbuilt persistent payment ledger.

- Bacs success: the existing deposit invoice stayed open with zero paid while its debit processed, then became paid for exactly £200. Verified `payment_intent.succeeded` and `invoice.paid` events arrived.
- Bacs failures: delayed test cases returned `insufficient_funds` and `debit_not_authorized`. The direct test-token cases did not attach a reusable payment method and both mandates ended inactive, despite a `multi_use` type. Repeating insufficient funds with explicit `setup_future_usage: off_session` retained an active mandate. Recovery must inspect authoritative mandate state, never infer it from failure code alone. Revoked authorisation requires fresh consent.
- Actual application SDK factory authenticated the supplied test key and verified the configured account ID. No publishable key is needed for these server-created hosted links.

Nine [sanitised contract fixtures](../../tests/fixtures/operations/stripe/README.md) retain actual provider event structures at the pinned API version. Raw responses and signing material stayed in private temporary files. The signature test used the original bytes; sanitised fixtures are not valid original-signature test vectors.

## Cleanup and activation limits

The owned clock and its synthetic customer were deleted. The immediate subscription was cancelled, its subscription invoice finalised and voided (Stripe rejects deleting subscription invoices), failure intents cancelled and its synthetic customer deleted. The test product was archived. Stripe rejects archiving a product's default price and deactivating the default portal configuration, so those test records remain; portal features were disabled and there are no active synthetic subscriptions. The test Bacs display preference was restored to its original off state. The browser, local verifier and CLI listener were stopped. Financial test records retained by Stripe were not represented as deleted.

Live FSS onboarding, Bacs activation and actual account-specific limits remain unverified production requirements. Published standard fees are verified, but the sandbox cannot prove negotiated account pricing. Task 14 must verify the live configuration and commercial terms before collecting money. These limits do not negate the demonstrated sandbox support.

## Runtime configuration

The provider client is disabled unless both `OPERATIONS_ENABLED` and `OPERATIONS_BILLING_ENABLED` are exactly `true`. Enabled configuration requires `STRIPE_MODE` (`test` or `live`), `STRIPE_ACCOUNT_ID` and `STRIPE_SECRET_KEY`. Restricted `rk_` keys are supported and should have only the required permissions, including read access to the credential's own account for binding verification. Secret-key mode must match the configured mode. Live mode additionally requires both `NODE_ENV=production` and `VERCEL_ENV=production`; a preview deployment cannot silently use live credentials.

The factory verifies the authenticated account before returning its SDK client. It pins API version, bounds request timeout/retry count and returns generic configuration/provider errors without credential values. It does not create payments or bypass the later billing/release gates. A self-hosted production deployment needs an explicit reviewed environment policy rather than assuming the Vercel production guard applies.

The supplied publishable key is saved as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` locally, but the current hosted integration does not consume it. Both supplied credentials stay in ignored `.env.local` with owner-only permissions; billing remains disabled there. Rotate the chat-shared secret after verification and replace it with a restricted key for application use.

## Gate decision and manual fallback

Do not begin Task 7 until these proofs pass, the integration choice is recorded, and Task 6's PR passes checks and merges. If required Bacs or contract behaviour cannot be supported, keep the gate closed and document the precise limitation. Do not substitute recurring cards for Direct Debit.

The existing reviewed agreement/signing evidence workflow remains available. Billing continues through the founder's existing manual process until integration is approved. Record external invoice/payment references and verified evidence through the applicable reviewed workflow; do not infer payment from an uploaded screenshot or turn sandbox observations into live ledger entries.
