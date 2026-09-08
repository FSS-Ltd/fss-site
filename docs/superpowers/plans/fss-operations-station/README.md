# FSS Operations Station planning pack

Status: Draft for future implementation. Markdown planning only. 5 September 2026.
Owner: Jean-Fidele, FSS. Planning role: Technical and product architecture.

## Intended outcome

Extend the existing Growth OS into a single place to manage signed work, recurring revenue, collections, client relationships and delivery. Give each client a private portal to request work, see progress, review deliverables, obtain help, inspect agreed services and pay invoices. Add a founder-triggered welcome journey that progresses from an approved welcome pack to an approved proposal, verified signature, first invoice and portal invitation.

These files are a specification and phased implementation handoff, not permission to implement, contact customers, create provider accounts, enable jobs or deploy. No production code, migrations, emails, PDFs or live configuration were created by this planning task.

## Read in this order

1. [Product specification and decisions](01-product-specification.md)
2. [Architecture, data and access boundaries](02-architecture-data-security.md)
3. [Operations dashboard and metric definitions](03-operations-and-metrics.md)
4. [Client portal and request boards](04-client-portal-and-requests.md)
5. [Payments, contracts and provider comparison](05-billing-and-provider-decision.md)
6. [Welcome journey and content specification](06-welcome-journey.md)
7. [Phased implementation and acceptance tests](07-implementation-plan.md)
8. [Research-backed improvements and sources](08-research-and-recommendations.md)

## Recommended first build slice

When authorised, start with organisation identity, founder-only client records and a manually verified contract register. Then secure the client portal and request board. Add billing in a provider sandbox, then proposal/signature automation and the timed welcome journey. Finish with reconciled metrics and release exercises. Each slice has its own stop point in plan 07, so work can fit future usage allowances.

Do not build a second CRM, payment processor, e-signature engine, accounting ledger or AI receptionist in this project. The receptionist is an enquiry offer in this scope. Its actual telephony service requires a separate product decision and delivery plan.

## Repository findings

Inspected package.json, recent commits, the Growth OS README, authentication, database access, pipeline repository and pipeline/client-message migrations. Current stack: Next.js 16.3.1, React 19.2.8, strict TypeScript, Node 24, pnpm, PostgreSQL on Supabase, Auth.js founder login, Resend, PDFKit and Vercel Blob. Source files take precedence over the older August context pack.

Existing `growth.delivery_engagements` already holds commercial stage, one-off/monthly deal values and delivery status, with one engagement per prospect. Won/lost stages are terminal. Client records currently derive from those engagements; a durable multi-engagement customer organisation is needed. Do not reopen terminal deals to represent renewals.

Existing `growth.client_messages` supports one immutable, founder-approved completion thank-you per engagement. It cannot store an entire onboarding sequence. Keep completion thanks distinct from post-signature thanks. Existing newsletter consent and suppression must be reused deliberately.

The checkout already contains substantial unrelated changes. All files from this task are new Markdown files under this folder. No baseline changes belong in a later operations-station commit.

## Decisions to confirm at build kickoff

| Decision              | Proposed default                                                      | Why it matters                                                                                                |
| --------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Market/currency       | UK B2B, GBP only initially                                            | Bacs, tax and payment fees depend on geography                                                                |
| Billing provider      | Stripe Billing plus hosted invoice/payment management                 | Meets recurring billing and GBP Direct Debit requirements                                                     |
| Portal identity       | Supabase Auth, invite-only, separate from founder Auth.js             | Clients need non-Google access without widening /growth                                                       |
| Electronic signing    | In-house ordinary electronic signing, explicitly approved 8 September | Verified portal access, frozen documents and retained evidence; see [signing](../../../operations/signing.md) |
| Proposal timing       | Two elapsed hours after accepted welcome send                         | Exact timing is a business preference, not research evidence                                                  |
| Post-signature timing | 09:00 Europe/London next calendar day                                 | “Following day” interpreted explicitly, including weekends                                                    |
| Service start         | Signed agreement plus cleared deposit when contract requires it       | Portal access must not imply work has started                                                                 |
| Support target        | One business day to acknowledge ordinary requests                     | Proposed target, not a sold SLA                                                                               |
| Commercial terms      | Enter per agreement; no invented package prices or VAT status         | Prevents automation making commercial promises                                                                |

No answers are required to finish this planning pack. Confirm these before their dependent build slice; proposed defaults are not approved commercial policy.

## Planning handoff

Completed: repository discovery, product/data/workflow specifications, public-source payment comparison, prioritised improvements and testable build slices. Next action: founder chooses a slice and authorises implementation. Recheck provider documentation, prices, repository state and local Next.js guides at that time. Do not start automatically.

## Planning validation

All nine Markdown files were inspected for scope coverage and consistency. Prettier check, local Markdown-link validation, placeholder scan and independent fee/metric arithmetic checks passed. No application typecheck, unit/integration tests or build was run because no application files changed. Provider behaviour remains documentation-backed planning, not a live or sandbox integration test. The signature provider page could be opened but its body was unavailable to the text reader; its original account gate was later superseded by the approved in-house signing direction.
