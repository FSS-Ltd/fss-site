# Research-backed improvements and decision register

Research date: 5 September 2026. Primary sources preferred. Provider documentation establishes capabilities; standards and official guidance establish practices. None establishes a guaranteed commercial uplift for FSS. Recommendations below distinguish those facts from product judgment.

## Prioritised improvements

| Priority   | Addition                                                               | Evidence                                                                                                                                                                                                                                         | FSS application and measure                                                                                             |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Launch     | Capture billing contact, PO and invoice requirements during onboarding | [Small Business Commissioner invoice guidance](https://www.smallbusinesscommissioner.gov.uk/help-and-guidance/all-advice/a-guide-for-effective-invoicing/) recommends clear, complete invoices                                                   | Add a billing readiness checklist before issue; measure rejected invoices and days overdue                              |
| Launch     | Use provider-managed payment recovery with an exception queue          | [Stripe recovery documentation](https://docs.stripe.com/billing/revenue-recovery/smart-retries) distinguishes payment-method retry rules                                                                                                         | Enable supported recovery deliberately; measure recovered value and manual interventions, not assumed savings           |
| Launch     | Show work age and constrain simultaneous work                          | [Kanban Guide](https://kanbanguides.org/the-kanban-guide/) defines flow management and measurements                                                                                                                                              | Display WIP, work-item age, throughput and cycle time; set initial capacity limit, revise from actual outcomes          |
| Launch     | Provide a keyboard/list alternative to the board                       | [W3C WCAG overview](https://www.w3.org/WAI/standards-guidelines/wcag/) supplies testable accessibility criteria                                                                                                                                  | Make all request/payment actions possible without dragging; manual keyboard and screen-reader acceptance                |
| Launch     | Separate marketing choice from service access                          | [ICO electronic-mail guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/) distinguishes recipient categories and marketing obligations | Separate optional Field Notes consent; never block invoices or portal access on newsletter subscription                 |
| Launch     | Reconcile payment state independently of event arrival                 | [Stripe webhooks](https://docs.stripe.com/webhooks) documents duplicate/event-order handling                                                                                                                                                     | Durable event inbox and scheduled reconciliation; measure unresolved mismatches and event lag                           |
| Launch     | Persist message deduplication beyond provider window                   | [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) retains keys for 24 hours                                                                                                                                        | Application send ledger plus unknown-outcome hold; prove no blind resend after expiry                                   |
| After core | Derive delivery expectations from observed cycle time                  | [Kanban Guide](https://kanbanguides.org/the-kanban-guide/) describes probabilistic service-level expectations                                                                                                                                    | After enough similar completed requests, show a measured forecast and sample size; do not present it as contractual SLA |

## Further product recommendations, explicitly hypotheses

These are design judgments supported by the operating model, not proven FSS outcomes:

1. **Client outcome checklist.** Store one to three agreed goals, baseline, target, responsible person and review date. Link deliverables to goals. Measure days to first accepted outcome and percentage of active clients with a reviewed goal. Do not use number of tickets closed as a substitute for client value.
2. **Renewal and notice calendar.** Create internal review items 60/30/14 days before the relevant renewal or notice deadline. The applicable deadline comes from the agreement. Measure unplanned expiries and retained recurring revenue. Confirm prices manually before any renewal offer.
3. **Scope-change approval.** Make quote-required work explicit before delivery starts. Record accepted change order and any allowance impact. Measure unbilled out-of-scope work and review disputes; no general “unlimited requests” promise.
4. **Explainable account health.** Show overdue balance, ageing requests, missing client assets, failed onboarding and upcoming renewal as reasons. No predictive score or AI churn claim before there is enough reliable history to evaluate it.
5. **Weekly client digest.** Optional summary of completed work, current work and next client action. Pilot against status-enquiry volume and satisfaction, not email open rate alone. Client opt-out for routine digests must not suppress critical billing/access communications.
6. **Service cost and margin visibility.** After billing is reliable, add founder-only contracted revenue versus delivery time and third-party costs. This is especially useful before selling call services with variable telephony costs. Build only after actual costing inputs and permissions are defined.
7. **Closeout feedback.** Ask one optional satisfaction question after accepted delivery, with a route to explain concerns. Use a small-sample caveat and avoid automatic public testimonial publication.

Items 1–4 are included in the core plans where inexpensive; 5–7 are later enhancements requiring their own scope approval. Do not turn this list into additional launch requirements.

## Evidence limits and validation plan

The exact two-hour welcome delay, next-day 09:00 send, reminder cadence, three-item WIP limit and one-day acknowledgement target are proposed FSS policies. No claim is made that research proves these numbers optimal. Start with transparent defaults, then review actual completion, late-payment and client-feedback data after a 30-day pilot. Changes to contractual promises require approved terms; internal thresholds can be tuned with an audit trail.

The provider comparison is UK/GBP oriented. Rates and entitlements can change; evaluate the account's quote and payment mix at build time. Revolut's EUR SEPA support does not establish GBP collection support. Signature provider cost/production entitlement remains an explicit capability gate, not an invented price estimate.

## Sources register

| Source                                                                                                                                                 | What it supports                                | Caveat                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Stripe UK pricing](https://stripe.com/gb/pricing)                                                                                                     | Public payment processing rates                 | Account/card mix and extras vary                                                     |
| [Stripe Billing pricing](https://stripe.com/gb/billing/pricing)                                                                                        | Recurring billing product cost                  | Confirm billable volume and contract                                                 |
| [Stripe Invoicing pricing](https://stripe.com/gb/invoicing/pricing)                                                                                    | One-off invoice product cost                    | Avoid double-counting subscription fees                                              |
| [Revolut UK Basic fees](https://www.revolut.com/legal/business-basic-fees/)                                                                            | Card categories and Basic plan cost             | Verify current account-specific terms                                                |
| [Revolut saved payment methods](https://developer.revolut.com/docs/guides/merchant/optimise-checkout/save-payment-methods/charge-saved-payment-method) | Recurring merchant-initiated payment capability | Not proof of GBP bank debit                                                          |
| [Revolut SEPA integration](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/sepa-direct-debit/server-to-server)      | EUR bank collection                             | Merchant eligibility must be confirmed                                               |
| [Revolut webhook verification](https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/verify-the-payload-signature)           | Signed event verification and replay checks     | Preserve raw request payload                                                         |
| [Stripe Bacs](https://docs.stripe.com/payments/bacs-debit)                                                                                             | Mandates, delayed payment lifecycle and notices | Account limits and enablement apply                                                  |
| [Stripe customer management](https://docs.stripe.com/customer-management)                                                                              | Hosted billing management                       | Prototype method/contract restrictions                                               |
| [DocuSign Connect](https://developers.docusign.com/platform/webhooks/connect/)                                                                         | Candidate signature integration reference       | Page body unavailable to text reader; capability and price need sandbox verification |
| [Supabase server-side auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)                | Managed SSR auth integration direction          | Must preserve separate founder boundary                                              |
| [UK invoice requirements](https://www.gov.uk/invoicing-and-taking-payment-from-customers/invoices-what-they-must-include)                              | Required invoice information                    | Confirm business-specific tax treatment                                              |

## Requirement coverage

| Original requirement                          | Where specified          | Implementation tasks                                       |
| --------------------------------------------- | ------------------------ | ---------------------------------------------------------- |
| Signed deals, MRR, ARR, retention             | Plans 01–03              | 1, 2, 12                                                   |
| Who pays on time                              | Plans 03, 05             | 7, 8, 12                                                   |
| Client login and progress                     | Plans 02, 04             | 3, 4                                                       |
| Help and customer request Kanban              | Plan 04                  | 5                                                          |
| Acknowledged and ready-for-review statuses    | Plan 04 transition table | 5                                                          |
| Additional service enquiries, AI receptionist | Plan 04 offers           | 13                                                         |
| Payments and contract Direct Debit            | Plan 05                  | 6–8                                                        |
| Founder-triggered welcome email/PDF           | Plan 06                  | 10, 11                                                     |
| Editable proposal after two hours             | Plans 05, 06             | 9–11                                                       |
| Signature then following-day thanks/invoice   | Plans 05, 06             | 7, 9–11                                                    |
| Newsletter invitation                         | Plans 04, 06             | 10, 11                                                     |
| Invoice includes portal access route          | Plans 02, 05, 06         | 3, 7, 10                                                   |
| Research-backed improvements                  | This document            | Core assignments above; optional items deferred explicitly |
| Markdown plans only                           | Entire pack              | No implementation authorised                               |
