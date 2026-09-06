# Founder operations and metric specification

Status: Proposed. Depends on [data model](02-architecture-data-security.md).

## Overview screen

First row: active MRR, annualised run-rate ARR, signed recurring revenue awaiting activation, overdue value, client retention. Each card shows currency, period, denominator when relevant, definition tooltip, reconciliation freshness and drill-down. Never show unverified zero when a provider is unavailable.

Second row: action queue sorted by operational severity: failed/ambiguous collection, blocked onboarding, overdue invoice, request awaiting acknowledgement, deliverable awaiting review, renewal needing a decision. An action has client, reason, age, owner and one clear next step.

Lower sections: MRR movement chart, receivables ageing, active services, requests by state, upcoming milestones and renewal dates. Offer tables/list alternatives to charts. Filters: date period, client, service, delivery owner, currency and payment state; defaults GBP/current calendar month in Europe/London.

## Exact reporting definitions

| Metric                          | Definition                                                                                         | Boundary cases                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Signed deals                    | Agreements with complete verified signature evidence during period                                 | Historical manually marked won deals need evidence before counted as verified signed                      |
| Signed one-off value            | Net one-off amounts on signed agreement revisions in period                                        | Excludes tax and recurring commitments; show voided deals separately                                      |
| Signed recurring MRR equivalent | Monthly-normalised signed recurring lines                                                          | Split awaiting activation from active; not active MRR                                                     |
| Active MRR                      | Sum net recurring service amounts effective at observation time, divided by recurrence months      | £1,200 annual = £100 MRR; £300 quarterly = £100; excludes setup, VAT, usage overage and unstarted service |
| ARR                             | 12 × active MRR                                                                                    | Label annualised run rate, not cash, recognised accounting revenue or guaranteed annual sales             |
| Collected cash                  | Confirmed payments received during period, with refunds separately and net total                   | Invoice issue, mandate creation and pending Bacs are not cash; provider balance not equal bank payout     |
| Outstanding balance             | Issued total less valid allocations and credits                                                    | Partial payment remains outstanding; refund affects balance only with corresponding receivable treatment  |
| Overdue balance                 | Positive outstanding balance on invoices past contractual due date                                 | Processing debit and disputes remain visible with separate badges; collection reminders may be held       |
| On-time payment rate            | Eligible invoices fully satisfied by due cutoff / eligible invoices due in period                  | Exclude voids and wholly credited invoices; unpaid overdue is a failure, zero denominator is N/A          |
| Days late                       | Max(0, calendar dates between due date and fully paid date, or observation date while outstanding) | Due cutoff 23:59:59 Europe/London; store actual instants; amended due dates need audit                    |
| Logo retention                  | Starting recurring-client cohort still active at period end / starting recurring-client cohort     | Count organisations once; exclude new clients; completed one-off projects are not churn                   |
| Logo churn                      | Starting cohort no longer active at period end / starting cohort                                   | Same denominator; a client losing one of two services is contraction, not logo churn                      |
| Gross revenue retention         | Sum over starting clients of min(start MRR, end MRR) / starting MRR                                | Excludes expansion and new clients; range 0–100%                                                          |
| Net revenue retention           | End MRR from starting client cohort / starting MRR                                                 | Includes expansion/contraction; excludes new clients; may exceed 100%                                     |
| MRR movements                   | Start + new + expansion + reactivation − contraction − churn = end                                 | Use mutually exclusive event classifications; check exact identity before publishing                      |
| Request lead/cycle time         | Submitted→done / first in-progress→done                                                            | Show calendar elapsed time and sample count; blocked time separately                                      |
| Review age                      | Now minus latest ready-for-review timestamp                                                        | Revisions reset current review age but preserve full history                                              |

One-off engagement repeat-business rate is a separate later report with its own observation window, not customer retention. If multi-currency is added, report separately until an approved FX source and conversion-date policy exist.

## Revenue edge policies

Active service is determined by contracted activation/end dates and lifecycle, not by a payment provider's subscription status alone. Delinquent but still delivered service remains in active MRR with a delinquent-MRR badge. An explicitly non-billable service pause removes it for the effective interval; future return is scheduled, not current MRR. Scheduled cancellation removes MRR only on its effective end date.

Recurring discounts affect the months where they apply. Annual cash receipts are normalised across the annual service term. One-time credits/refunds change collections/receivables, not future MRR unless the service contract changes. Exclude uncommitted metered usage from MRR and show it as variable revenue. Never replace historical contract values with today's offer price.

Payment punctuality uses successful confirmation timestamp initially. For Bacs show “submitted by due date, awaiting confirmation” separately so banking delay is visible. Contract wording may choose another agreed basis; version that policy rather than silently changing the metric. Do not move an invoice's due date automatically merely because a collection is delayed.

## Worked acceptance fixtures

- Organisation A: £300/month active. B: £1,200/year active. C: £500/month signed but starts next month. Active MRR £400, ARR £4,800, signed awaiting-activation equivalent £500.
- Starting cohort A £300, B £100. At end A £350, B cancelled; new C £200. End MRR £550; logo retention 50%; GRR 75%; NRR 87.5%. New C is excluded from retention denominators and numerators.
- Five invoices due: two paid on time, one paid late, one overdue unpaid, one fully void. On-time rate 2/4 = 50%. If none due, N/A, never 100%.
- £1,000 invoice with £300 allocation and £100 credit leaves £600 outstanding. A duplicate payment event must not reduce it again.
- Annual renewal invoice does not add new MRR when the existing annual service continues at the same price.
- Two recurring services on one organisation, one cancelled: organisation retained; MRR contracts.

## Finance and customer views

Receivables table: invoice number, client, issue/due date, gross amount, credit, paid, remaining, current payment attempt, days late, next retry, dispute flag and owner. Age bands: current, 1–7, 8–30, 31–60, 61–90, 91+ days. Totals must equal invoice-level balances.

Client detail: goals/outcomes, active agreements and services, renewal/notice deadline, requests waiting on each party, invoice health and last meaningful contact. Initially use explicit health reasons, not an opaque numeric score. Founder can dismiss a risk with reason and expiry, preserving history.

CSV exports are founder-only for cross-client reports, tenant-scoped for permitted client billing exports, audit-logged and protected against spreadsheet formula injection. Show generated-at and definition version. Paginate at 50 with a maximum 100; bound exports as background jobs. Query indexed projections and avoid one query per client/card.

## Operational acceptance

All cards reconcile to their drill-down. Late webhooks restate affected periods with a correction marker. Display last successful provider reconciliation; stale after 24 hours is a visible warning, not live status. Performance target: typical founder overview under 2 seconds at 1,000 organisations and 100,000 requests/invoices in seeded staging, with query counts measured. Target is proposed, not a production claim.
