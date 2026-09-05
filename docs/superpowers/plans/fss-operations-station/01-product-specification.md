# Operations Station product specification

Status: Proposed. Scope: complete requested system, delivered in slices. Read [pack index](README.md) first.

## Goals and scope

- Founder can trace a deal from approved proposal to signed agreement, service activation, invoicing, collections and renewal.
- Founder can see MRR, ARR, customer retention, signed revenue, overdue balances and requests needing action without joining spreadsheets.
- Client can securely see only its organisation's projects, public updates, documents and authorised billing information.
- Client can submit work/help requests, provide missing information, review deliverables and enquire about extra services.
- Founder can trigger, preview, pause and recover a complete welcome journey without resending messages or duplicating invoices.
- Every material commercial or delivery transition has attributable evidence and a timestamp.

Out of scope: payroll, general-ledger accounting, public self-signup, a marketplace, a generic automation builder, autonomous prices/quotes, automatic legal collections, actual AI telephony and moving unrelated Growth OS features. No paid AI application calls are introduced; the existing separate decision threshold remains applicable.

## Users and capabilities

| User                   | Permitted work                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Founder                | All organisations; approve terms/sends, run onboarding, manage delivery, inspect finance, authorise refunds and account changes |
| Client owner           | Own organisation projects, requests, billing, agreements; request teammate invitations and removals                             |
| Client contributor     | Own organisation projects and requests; create/comment, provide assets; no billing or contractual acceptance                    |
| Client billing contact | Own organisation invoices, payment methods and receipts; no delivery editing                                                    |
| Client viewer          | Read public project information and permitted documents                                                                         |
| Automated worker       | Specific queued operation only; no interactive user authority or unbounded data access                                          |

Launch invitation management is founder-operated. Client owners can request changes; self-service team administration is a later convenience. A signer is an explicitly authorised agreement contact, not automatically every portal owner. Future internal staff access requires an explicit role design before adding staff.

## Founder information architecture

Extend `/growth` with Operations navigation:

- Overview: exceptions, revenue cards, aged receivables, delivery commitments, onboarding failures.
- Clients: organisation search, services, account owner, billing contact, current risks, next action.
- Client detail tabs: Summary, Agreements, Projects, Requests, Billing, Journey, Activity.
- Agreements: proposals, approved revisions, signature evidence, contracted start/end dates, renewals.
- Requests: cross-client board/list, assignee, priority, age, due date, blocked reason and scope decision.
- Billing: invoices, payment state, collection status, credit/refund status and reconciliation exceptions.
- Offers: client-visible packages, included/excluded work, enquiry handling, publication approval.
- Automations: per-client timeline, approval holds, next action, failed jobs and recovery.

Client routes live under `/portal`, not `/growth`. Client navigation: Home, Projects, Requests, Help, Services, Documents, Billing (per role), Account.

## Principal journeys

1. Prospect requests help; founder records goals, stakeholders and terms under the existing deal.
2. Founder links or creates a client organisation. Similar company names/email domains produce merge suggestions, never automatic merges.
3. Founder creates proposal revision with line items and milestones, and previews welcome content. Triggering welcome means agreement in principle; binding agreement is still subject to signature.
4. Welcome goes out, then the approved proposal after the delay. Revision changes invalidate approval and block its scheduled send.
5. All required signatures are verified. The agreement is recorded once; existing commercial transition logic marks an eligible open deal won and stops outreach.
6. Next day, issue the first agreed invoice and send a thank-you with its payment link and portal activation link. Optional newsletter invitation is governed separately by marketing policy.
7. Client claims access, checks the shared goals, supplies assets and chooses a payment method or Direct Debit mandate.
8. Work begins under the agreement's start/deposit conditions. Client sees milestones and submits requests. Founder acknowledges, works, blocks with a reason, or submits a deliverable for review.
9. Client accepts the specific deliverable version or requests changes. Completion and support transitions remain separate from commercial status.
10. Recurring billing, health reviews and renewal notices continue according to approved contract terms. Cancellation stops future billing according to its effective date; unpaid invoices remain visible.

## Cross-cutting product rules

- Every request has a client-visible acknowledgement, even when it becomes a paid change request.
- “Acknowledged” means received and triaged. It does not mean included in scope or scheduled.
- “Ready for review” means delivered for client review. “Done” requires recorded acceptance or an explicit founder closure reason, never silence by default.
- Missing dates show “Not scheduled”, not an invented deadline or percentage.
- Extra-service enquiry creates a sales item; it never activates a subscription or changes price.
- Failure to pay does not remove access to invoices, support, disputes or account export. Pausing service is a founder decision under the contract.
- Client-facing updates explicitly distinguish “Waiting for us” and “Waiting for you”.
- Founder sees internal estimates, costs and notes. These are absent from client response objects, exports and notifications.

## Success measures

Pilot targets are proposals: zero cross-client disclosure; zero duplicate external effects in replay tests; all active invoices reconcile; every open request has an owner and next action; every automatic message links to approved evidence; no unsigned revision is billed. Measure acknowledgement time, request age, days to first agreed outcome, overdue value and renewal outcomes over the first 30 days. Do not claim percentage improvements without a baseline.

## Rollout and rollback

Use independent feature flags for founder operations, client portal, billing writes and onboarding sends. Initial pilot: founder plus two synthetic organisations, then a founder-selected real client after explicit release approval. Read-only dashboards precede writes. Turning off sends must retain all queued records and timestamps. Disable new collection commands during a billing incident; do not blindly cancel real provider subscriptions or replay queues.
