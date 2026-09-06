# Billing, agreements and payment provider decision

Status: Research-based recommendation, not a provider purchase or activation. Checked 5 September 2026. Recheck at implementation.

## Recommendation

Start with Stripe for billing and GBP collection. Use hosted invoices and hosted payment-method management to reduce custom payment UI and recurring-billing logic. Revolut remains a credible alternative for some payment mixes, and can be assessed separately as the receiving bank. Do not run two collection systems for the same contractual obligation.

This is a fit/maintenance recommendation, not a claim Stripe always has the lowest fees. Revolut's lower consumer-card rate is not its business-card rate. GBP Direct Debit is a deciding requirement: Revolut's documented SEPA collection API uses EUR; that is not evidence of Bacs support. Confirm UK merchant collection capabilities in writing before choosing Revolut for this requirement.

## Published UK fee comparison

| Service                                    | Public standard rate observed | Source and limitation                                                                                                              |
| ------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Stripe standard UK card                    | 1.5% + £0.20                  | [UK Payments pricing](https://stripe.com/gb/pricing); other card categories differ                                                 |
| Stripe Bacs                                | 1%, minimum £0.20, maximum £4 | [UK Payments pricing](https://stripe.com/gb/pricing); processing fee only                                                          |
| Stripe Billing pay-as-you-go               | 0.7% of Billing volume        | [Billing pricing](https://stripe.com/gb/billing/pricing); excludes one-off invoices, includes eligible volume processed off Stripe |
| Stripe one-off Invoicing Starter           | 0.4% per paid invoice         | [Invoicing pricing](https://stripe.com/gb/invoicing/pricing); not automatically added on top of Billing for subscription invoices  |
| Revolut online UK consumer Visa/Mastercard | 1% + £0.20                    | [Business Basic fee schedule](https://www.revolut.com/legal/business-basic-fees/)                                                  |
| Revolut online other cards                 | 2.8% + £0.20                  | Same schedule; UK consumer Amex separately 1.7% + £0.20                                                                            |
| Revolut Business Basic                     | £10/month                     | Same schedule; existing paid account may make incremental cost zero                                                                |

Totals also depend on chosen billing products, card mix, currency conversion, disputes, refund treatment, tax tooling and optional service fees. Do not compare Stripe's full billing cost with only Revolut's acquiring fee as if both deliver identical functions.

### Calculated scenarios

Assume GBP amounts charged, standard UK card where labelled, no FX/refund/dispute, published pay-as-you-go rates. These are arithmetic examples, not quotes. Fee bases may include VAT charged to the customer; MRR excludes VAT.

| Transaction    | Stripe card + Billing | Stripe Bacs + Billing | Revolut consumer card processing | Revolut other card processing |
| -------------- | --------------------- | --------------------- | -------------------------------- | ----------------------------- |
| £100 monthly   | £2.40                 | £1.70                 | £1.20                            | £3.00                         |
| £500 monthly   | £11.20                | £7.50                 | £5.20                            | £14.20                        |
| £1,000 monthly | £22.20                | £11.00                | £10.20                           | £28.20                        |

For 20 clients paying £500 monthly, illustrative Stripe Bacs+Billing costs £150/month; Stripe standard card+Billing £224; Revolut consumer processing £104 plus incremental plan and any invoicing/automation costs. All-“other card” Revolut processing is £284 before those costs. This demonstrates why client payment mix matters.

A £2,000 one-off invoice with Stripe Starter: standard card £38.20 total (£30.20 processing + £8 invoicing); Bacs £12 (£4 + £8). Verify billing classification before applying rates. Provider quote, actual card-category mix and expected time saved determine the final choice.

## Capability and acceptance matrix

| Need                      | Stripe evidence                                                       | Revolut evidence / unresolved point                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GBP bank debit collection | [Bacs documentation](https://docs.stripe.com/payments/bacs-debit)     | Reviewed EUR SEPA flow does not establish GBP Bacs availability                                                                                                                    |
| Recurring payment method  | Billing plus mandates                                                 | [Saved payment methods](https://developer.revolut.com/docs/guides/merchant/optimise-checkout/save-payment-methods/charge-saved-payment-method) supports merchant-initiated charges |
| Verified event processing | [Stripe webhooks](https://docs.stripe.com/webhooks)                   | [Merchant signature verification](https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/verify-the-payload-signature)                                    |
| Client payment management | [Stripe customer portal](https://docs.stripe.com/customer-management) | Prototype required for desired self-service and permissions                                                                                                                        |
| Bank debit alternative    | GBP Bacs supported subject to enablement                              | [Revolut SEPA](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/sepa-direct-debit/server-to-server) is EUR                                       |

## Agreement and signature flow

Proposal editor holds versioned scope, goals, line items, currency, tax treatment, payment installments, recurring start/anchor, notice period, minimum term, support expectations and client responsibilities. Validate totals and require approved billing/signatory contacts. Preview the exact rendered document and recipient list before approval. A price/scope/recipient/document change invalidates approval.

Use a managed signature service; DocuSign is a candidate, not a final cost decision. Capability gate: API production entitlement/price, test environment, authenticated webhook, complete-envelope state, ordered/multiple signers, immutable signed document and audit certificate retrieval, void/expiry/replacement, accessible signing and data processing terms. Obtain account-specific quote rather than inventing envelope fees. [DocuSign Connect overview](https://developers.docusign.com/platform/webhooks/connect/) describes the webhook model; verify current entitlement in the prototype.

When all required parties complete signing, verify the envelope against the stored revision, fetch authoritative status, retain signed document and audit evidence privately, and record signed_at once. Partial signature, browser return or uploaded unsigned PDF cannot advance automatically. Manual evidence import is allowed only with founder confirmation, source document hash, signatories and recorded date; label its provenance.

## Billing lifecycle

1. Create a provider customer mapped to the organisation after verified signing or founder-reviewed historical import.
2. Generate a billing schedule from the signed revision: deposit, milestone installments and recurring lines. Validate total installment allocation and future dates.
3. Next-day onboarding creates/finalises the first invoice exactly once. Invoice displays its actual contractual due date, not automatically tomorrow.
4. For recurring start-now work, the subscription's first invoice is the onboarding invoice. For a setup deposit plus later retainer, issue the deposit invoice once and schedule subscription start separately. Never charge both a standalone invoice and subscription invoice for the same service period.
5. Email the hosted invoice link and portal activation landing link. If an invoice PDF supports a footer, include the non-secret activation landing URL there. Do not embed a raw invitation bearer in a permanent PDF.
6. Customer pays through the hosted invoice flow or sets up eligible bank debit through a provider-supported hosted mandate/payment-management flow. Confirm exact Bacs flow and capability in sandbox; do not assume every SetupIntent UI supports it.
7. Subscription renewals and collection retries belong to Stripe Billing. Application mirrors outcomes and informs the founder; it does not run its own recurring charge loop.

Use server-resolved provider customer and signed price references. Allow payment-method changes and invoice downloads in the provider portal; disable self-service price changes/cancellation where they conflict with negotiated terms. Provide a cancellation request route and honour contract/legal requirements. No Stripe Connect is needed because FSS is collecting its own invoices.

## Direct Debit behaviour

Mandate consent is separate from signing a service agreement. Keep bank details provider-hosted. The portal distinguishes mandate pending/active/inactive and payment pending/succeeded/failed. Keep provider mandate/debit notices enabled. Published Bacs confirmation can take around four business days with an existing mandate and seven with a new one; approval, limits and timing must be checked on FSS's account. Do not show “Paid” on browser return. [Stripe Bacs](https://docs.stripe.com/payments/bacs-debit).

Retain provider-managed retries: Bacs insufficient-funds retries require enabling the relevant setting; current documentation permits up to two within 30 days. Do not apply card retry assumptions to all bank failures. Invalid/revoked mandates require new consent, not blind retries. [Recovery documentation](https://docs.stripe.com/billing/revenue-recovery/smart-retries).

## Collections, tax and accounting

Proposed reminder policy: one reminder three days before due, due-day reminder, then 3/7/14 days overdue. Suppress duplicates, paid/void invoices, active processing, current disputes and founder holds. Founder reviews escalation at 14 days; no automatic penalty, legal demand or service shutdown. Use provider reminders OR application reminders per invoice class, not both.

Invoice fields: unique number, supplier/client details, description, supply and issue dates, amounts, applicable VAT and total. Collect purchase-order/reference requirements before first issue to prevent rejection. [UK invoice requirements](https://www.gov.uk/invoicing-and-taking-payment-from-customers/invoices-what-they-must-include). Confirm FSS VAT registration and applicable treatment with its accountant; do not enable automatic tax without registrations/configuration. This portal is an operations ledger, not statutory accounting software.

Support partial allocations, credits, refunds, disputed charges, bank-transfer reconciliation and invoices marked uncollectible. Founder-approved manual reconciliation needs external reference and evidence; do not mark paid from an unverified screenshot. Provider payouts reconcile separately from customer payments. Accounting export is a later slice after the accountant specifies destination and chart-of-accounts mapping.

## Failure tests and recovery

Duplicate webhook → one ledger change. Out-of-order failure after success → authoritative reconciliation, not unconditional regression. Timeout creating invoice → look up operation reference before retry. Payment succeeds while UI times out → webhook updates status. Card paid while debit already processing → block additional attempt or route to reviewed refund workflow. Cancellation/price change → approved effective-date amendment and provider preview, no hidden proration. Refund/dispute → dedicated event and updated finance exception, not erased payment history.
