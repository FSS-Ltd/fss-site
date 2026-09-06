# FSS Operations Station Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task only after explicit implementation authorisation. The current instruction is Markdown plans only. Do not start implementation from this document.

**Goal:** Deliver founder operations, secure client delivery/billing access and a reliable welcome journey in independently reviewable slices.

**Architecture:** Extend Growth OS with private operations domain modules and a separate portal identity boundary. PostgreSQL owns commercial/delivery records and durable work queues; managed providers own payment execution and signing evidence.

**Tech Stack:** Existing Next.js, React, TypeScript, PostgreSQL, Resend, PDFKit, Vercel. Proposed additions: managed client auth SDKs, Stripe SDK and a selected signature integration, each justified at its slice.

**Spec:** [Product](01-product-specification.md), [architecture](02-architecture-data-security.md), [metrics](03-operations-and-metrics.md), [portal](04-client-portal-and-requests.md), [billing](05-billing-and-provider-decision.md), [journey](06-welcome-journey.md).

## Global constraints

- Markdown planning only until a new user instruction authorises a build slice.
- Preserve existing founder-only Growth access, terminal engagement rules and existing completion thank-you behaviour.
- No paid AI application calls, production writes, real sends, live collections, migration execution or deployment without the relevant explicit authorisation.
- Every new tenant-owned row carries an organisation ID; every public operation verifies membership and capability.
- Keep routes/pages thin, use strict types and the existing Node test runner, Zod and PostgreSQL patterns.
- Use small focused files. No speculative provider framework, generic workflow builder or monolithic dashboard.
- Money uses integer pence and explicit GBP; no float-based accounting.
- Read the applicable `node_modules/next/dist/docs/` guides before writing framework code. Recheck versions and provider contracts then.
- Existing uncommitted changes are out of scope. Use a clean appropriately prefixed branch/worktree at execution time and stage only authorised slice files.

## Build ordering and stop points

| Slice                 | Tasks | Dependencies                     | Reviewable deliverable                                                      |
| --------------------- | ----- | -------------------------------- | --------------------------------------------------------------------------- |
| A: Client register    | 1–2   | None                             | Founder can link clients to existing deals and register verified agreements |
| B: Client workspace   | 3–5   | A                                | Two isolated clients can track milestones and submit/review work            |
| C: Billing            | 6–8   | A, B identity                    | Sandbox invoice, recurring collection and payment management reconcile      |
| D: Welcome automation | 9–11  | C plus signature capability gate | Complete timed journey with replay-safe sandbox effects                     |
| E: Operations insight | 12–13 | A–D                              | Reconciled metrics, offers, retention and exception queue                   |
| F: Release            | 14    | All prior slices                 | Tested preview and a concrete release approval package                      |

Each slice ends with a handoff recording tests, decisions, unresolved blockers and the next allowed task. Completing a slice does not authorise starting the next. No time/usage estimate is promised; API onboarding, auth and asynchronous failure handling are the largest uncertainties.

## Shared interface contracts

These are proposed internal contracts, not production code. Keep their names consistent across slices; exported implementation types live in the domain file that owns them.

- `PortalContext`: verified `userId`, selected `organisationId`, `role` and correlation ID, created only by the server identity guard.
- `FounderContext`: verified founder identity and correlation ID, created only by existing founder guard integration.
- `Money`: `currency: 'GBP'`, `pence: string` representing a nonnegative integer. Negative adjustments have explicit credit/refund types.
- `CommandResult<T>`: success with value/version, or typed `invalid_input`, `forbidden`, `not_found`, `conflict`, `dependency_unavailable`, `approval_required` error; redact provider internals.
- `activateService`: consumes signed agreement-line ID, start date and founder authority; returns versioned service instance after deposit/assets/start checks.
- `transitionRequest`: consumes authenticated actor, request ID, expectedVersion, next state and transition evidence; returns current safe view or conflict.
- `prepareFirstInvoice`: consumes signed agreement revision and stable operation key; returns provider invoice reference and projection, or unknown outcome requiring reconciliation.
- `startJourney`: consumes founder identity, expected agreement version and approved content snapshots; returns journey ID, generation and planned steps.
- `reconcileProviderEvent`: consumes verified durable event ID; returns applied/no-op/held with safe reason.
- `calculateRevenueSnapshot`: consumes dated service/contract events, observation time and definition version; returns GBP metrics and audit drill-down identifiers.

No route accepts a provider customer ID, price ID, trusted role or recipient list from the client as authority. Resolve them server-side.

## Task 1: Organisation register and historical mapping

**Create:** `lib/operations/organisations/types.ts`, `repository.ts`, `link-engagement.ts`, `link-engagement.test.ts`; `tests/integration/operations/organisations.test.ts`.
**Create UI:** `app/(growth)/(dashboard)/growth/operations/clients/page.tsx`, `components/operations/clients/client-list.tsx`.
**Migration:** generate `operations_organisations` using CLI during authorised build; apply only to isolated test database.
**Consumes:** founder context and existing engagement IDs. **Produces:** stable organisations and unique engagement links.

- [ ] Write fixtures for two engagements linked to one organisation, conflicting organisation links, unauthorised access and repeated imports; assert one unique link per engagement.
- [ ] Run focused Node tests and the new database test to establish failing behaviour.
- [ ] Implement scoped repositories, reviewed mapping command and read-only client list; no bulk domain matching or historical automation.
- [ ] Run tests as runtime database roles; verify existing pipeline integration tests still pass.
- [ ] Review/stage only task files and commit with why the new identity is separate from prospect history.

## Task 2: Agreement register and effective services

**Create:** `lib/operations/agreements/{types,validation,repository,service}.ts`, `lib/operations/services/{types,activation}.ts`, matching `.test.ts`; `components/operations/agreements/agreement-form.tsx`.
**Create UI:** `app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/agreements/page.tsx`.
**Consumes:** organisation and engagement links. **Produces:** immutable revisions, evidence-labelled signed records and effective service instances.

- [ ] Test one-off/quarterly/annual lines, invalid installments, changes to signed revision, absent signature evidence and deposit-gated activation.
- [ ] Confirm failures; create the smallest revisioned register and manual-evidence workflow that satisfies these cases.
- [ ] Add optimistic conflict handling and clear validation at fields; never mutate terminal Growth deals to model renewals.
- [ ] Verify signed totals, effective dates and audit records using actual database integration tests.
- [ ] Self-review and commit. Stop after Slice A if that is the only authorised scope.

## Task 3: Invite-only client authentication and tenant policies

**Create:** `lib/operations/auth/{client,server,require-member,permissions,invites}.ts` and their tests; `app/(portal)/portal/login/page.tsx`, `app/(portal)/portal/auth/callback/route.ts`, `app/(portal)/portal/activate/page.tsx`, `app/(portal)/portal/layout.tsx`; `tests/integration/operations/tenant-isolation.test.ts`.
**Consumes:** organisations/contacts. **Produces:** verified PortalContext and protected portal boundary.

- [ ] Prototype managed auth in sandbox; verify non-Google login, SSR cookie refresh, expired/replayed invites and independent founder access. Justify and pin required auth dependencies.
- [ ] Write role tests for guessed IDs, forged organisation fields, revoked membership, wrong invite email and simultaneous invite claim.
- [ ] Implement private schema permissions/RLS with a separate portal role and transaction-local identity; preserve founder Auth.js configuration.
- [ ] Prove database rejection using real portal role and pool-reuse tests, including views/files/search counts.
- [ ] Run existing founder routing/auth tests and new client tests; review and commit.

## Task 4: Projects, milestones and private documents

**Create:** `lib/operations/projects/{types,repository,service}.ts`, `lib/operations/documents/{repository,access,uploads}.ts` and tests; `components/portal/{project-summary,milestone-list,document-list}.tsx`; `app/(portal)/portal/projects/[projectId]/page.tsx`.
**Consumes:** PortalContext and agreement scope. **Produces:** explicitly client-safe project/document views.

- [ ] Test no projects, missing schedule, internal notes, unauthorised downloads, file expiry and quarantined uploads.
- [ ] Implement authorised queries and milestones, accessible list rendering and private downloads.
- [ ] Integrate scanning only after provider choice; otherwise keep uploads disabled with an explicit configuration gate.
- [ ] Verify mobile/keyboard flow and real tenant storage access, then commit.

## Task 5: Request board, comments and versioned review

**Create:** `lib/operations/requests/{types,validation,repository,transitions,reviews}.ts`, matching tests; `components/portal/requests/{board,list,request-form,request-detail,review-actions}.tsx`; `app/(portal)/portal/requests/page.tsx`, `app/(portal)/portal/requests/[requestId]/page.tsx`; `app/api/portal/requests/route.ts` and thin action routes as required.
**Consumes:** projects, PortalContext, document access. **Produces:** state machine from plan 04 and public notification events.

- [ ] Encode every allowed/forbidden transition from plan 04 as parameterised Node tests, including stale acceptance and quote-required work.
- [ ] Add database tests for duplicate submit keys and concurrent version changes; assert conflict on the second writer.
- [ ] Implement transition services and separate public/internal comment projections; then form/list/board views.
- [ ] Test keyboard status control without dragging, failed-submit draft recovery and no internal fields in response serialization.
- [ ] Verify and commit Slice B handoff.

## Task 6: Provider capability and contract fixture gate

**Create:** `docs/operations/provider-sandbox-results.md` during execution; `lib/operations/billing/{types,client,configuration}.ts`, `configuration.test.ts` only after provider selection.
**Consumes:** proposed provider decision. **Produces:** verified integration choice and pinned versions.

- [ ] Recheck UK pricing, FSS account eligibility/limits, Bacs enablement, invoice/portal support and current API/SDK versions.
- [ ] In an authorised sandbox, prove first invoice, future recurring anchor, hosted payment update, Bacs processing/failure and signed webhook replay.
- [ ] Record exact event fixtures without personal data or secrets; confirm invoicing versus Billing fee classification.
- [ ] Stop this slice if required Bacs or contract behaviour cannot be supported. Keep the documented manual workflow available; do not silently substitute recurring cards for Direct Debit.
- [ ] Approve choice and commit sandbox evidence plus narrowly justified dependency changes.

## Task 7: Billing schedules, invoices and payment portal

**Create:** `lib/operations/billing/{schedules,invoice-service,customer-repository,invoice-repository,portal-session}.ts` and tests; `components/portal/billing/{invoice-list,payment-status}.tsx`; `app/(portal)/portal/billing/page.tsx`, `app/api/portal/billing/session/route.ts`.
**Consumes:** signed agreement revision and organisation mapping. **Produces:** single invoice/subscription owner per obligation and hosted sessions.

- [ ] Write tests for deposit+later retainer, start-now retainer, annual billing, partial allocation, unauthorised role and repeated command key.
- [ ] Implement hosted invoice and payment-management commands; use stored references and contract dates, not browser amounts.
- [ ] Preview amendments/prorations and hold for approval. Keep payment-method changes separate from service cancellation rights.
- [ ] Verify actual sandbox invoice totals/dates and that retry does not create a second invoice/subscription. Commit.

## Task 8: Payment events, reconciliation and collections

**Create:** `lib/operations/billing/{webhook,events,reconciliation,collections}.ts`, `app/api/webhooks/operations/stripe/route.ts`, `tests/integration/operations/billing.test.ts`; matching unit tests.
**Consumes:** verified provider events and stored mapping. **Produces:** accurate balances/status and exception queue.

- [ ] Test invalid signatures, wrong live/test account, duplicate/out-of-order delivery, timeout after success, partial refund, dispute and paid-during-reminder race.
- [ ] Implement durable event receipt, bounded processing, stable operation keys and daily reconciliation cursor.
- [ ] Configure one owner for reminders/retries and method-specific policies; no automatic legal escalation or service suspension.
- [ ] Prove payment projections match sandbox provider records after replay and recovery. Commit Slice C handoff.

## Task 9: Proposal approval and managed signatures

**Create:** `lib/operations/agreements/{approval,signature-client,signature-events}.ts` and tests; `components/operations/agreements/{proposal-editor,approval-preview}.tsx`; `app/api/webhooks/operations/signatures/route.ts`.
**Consumes:** immutable agreement revisions. **Produces:** verified signed-agreement event with document evidence.

- [ ] Confirm signature provider API access, pricing, callback verification and evidence retrieval before dependency purchase or implementation.
- [ ] Test edited-after-approval, signer changes, partial signature, declined/expired/replaced envelope and repeated completion event.
- [ ] Implement provider send for the exact revision and secure evidence retrieval; signature completion alone advances signing state.
- [ ] Verify existing Growth won transition/outreach stopping occurs once and historical terminal deals are not rewritten. Commit.

## Task 10: Welcome content and durable scheduling

**Create:** `lib/operations/onboarding/{types,schedule,approval,repository,outbox,worker}.ts` and tests; `lib/operations/onboarding/content/{welcome-email,welcome-pdf,thank-you}.ts`; `app/api/cron/operations-dispatch/route.ts`.
**Consumes:** approved revision/content, invoice service, signature events. **Produces:** resumable journey with exact timing in plan 06.

- [ ] Write fake-clock tests for +2 elapsed hours, next-calendar-day London 09:00, DST, weekend and late webhook.
- [ ] Test duplicate start, stale generation, cancelled/paused lease, expired provider dedupe window and invoice-success/email-failure.
- [ ] Implement bounded worker and immutable outbound snapshots; use provider idempotency plus permanent application records.
- [ ] Render approved template fixtures and PDF in sandbox during implementation only; inspect pagination, text extraction, links and accessible equivalent.
- [ ] Verify no unapproved revision or cold/marketing-ineligible recipient receives a promotional line; commit.

## Task 11: Founder journey controls and notification recovery

**Create:** `components/operations/onboarding/{journey-preview,journey-timeline,step-recovery}.tsx`; `app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/journey/page.tsx`; `lib/operations/onboarding/{commands,recovery}.ts` and tests.
**Consumes:** durable journey records. **Produces:** concrete preview/start/pause/resume/cancel/reconcile controls.

- [ ] Test separate welcome/proposal approvals, failed dependency display, cancellation in-flight and safe resumption.
- [ ] Implement controls with pending/disabled/error states, recipient preview and typed conflict errors.
- [ ] Exercise full sandbox journey; verify one first invoice and one appropriate invitation after signing.
- [ ] Inspect existing completion-thanks/newsletter logic for duplicate invitations without altering approved cold outreach. Commit Slice D handoff.

## Task 12: Metrics and founder exceptions

**Create:** `lib/operations/metrics/{definitions,revenue,retention,receivables,snapshot-repository}.ts` and tests; `components/operations/overview/{metric-cards,exception-queue,revenue-movements,receivables-table}.tsx`; `app/(growth)/(dashboard)/growth/operations/page.tsx`.
**Consumes:** service history and reconciled billing/events. **Produces:** metrics exactly defined in plan 03.

- [ ] Convert every numeric fixture in plan 03 into deterministic Node tests. Assert N/A for empty denominators and exact MRR movement identity.
- [ ] Implement pure calculations and bounded read models; add required indexes based on query plans.
- [ ] Test late-event restatement, stale-data display and export scope/formula injection.
- [ ] Verify each card equals its drill-down total and performance at stated seeded scale; commit.

## Task 13: Offers, renewal reminders and outcomes

**Create:** `lib/operations/offers/{types,repository,enquiries}.ts`, `lib/operations/retention/{renewals,outcomes}.ts` with tests; `components/portal/services/{offer-list,enquiry-form}.tsx`; `app/(portal)/portal/services/page.tsx`.
**Consumes:** published offers, client context and agreement dates. **Produces:** enquiries and founder-reviewed retention actions.

- [ ] Test unpublished offer access, duplicate enquiry, no implicit charge, notice deadline and changed renewal date.
- [ ] Implement simple enquiry intake and proposed 60/30/14-day renewal work items; do not send unapproved renewal pricing.
- [ ] Add explicit goals/outcomes and founder-visible risk reasons rather than predictive AI scores.
- [ ] Verify memberships and contract/notification gates, then commit Slice E handoff.

## Task 14: Verification, rollout and recovery exercise

**Create:** `docs/operations/{release-checklist,incident-runbook,reconciliation-runbook,rollback-runbook}.md`, `tests/integration/operations/journey.test.ts`. Add a browser-test harness only if current repository tooling cannot cover the critical flow; justify dependency first.
**Modify when authorised:** package scripts to include operations database/coverage checks, deployment cron configuration and navigation. Inspect actual current configuration file names before edits.

- [ ] Run all unit tests, type checking, linting, formatting, build and existing Growth integration regressions.
- [ ] Run operations real-database integration tests with least-privilege roles and sandbox-provider contract tests.
- [ ] Exercise two-client access, signature→invoice→invite→request→review in a non-production preview, mobile and keyboard flows included.
- [ ] Simulate duplicate events, provider outage, worker crash, restored database and revoked membership; prove external effects stay paused during recovery.
- [ ] Scan dependencies, inspect security headers/cache/private storage and verify no secret/content leakage in logs.
- [ ] Record all evidence and unresolved limits; prepare migration/backfill counts, environment changes, cron enablement and rollback actions for founder review.
- [ ] Only after explicit release approval, execute the specified rollout. A separate approval is needed to enable real sends/collections if it was not part of that exact release authorisation.

## Verification commands for future implementation

Current repository commands verified from package.json:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:unit`
- `pnpm test:integration:growth`
- `pnpm verify:migrations`
- `pnpm build`

Focused test convention: `node --import tsx --test lib/operations/requests/transitions.test.ts`.
Proposed operations integration command after files exist: `node --import tsx --test --test-concurrency=1 tests/integration/operations/*.test.ts` with dedicated sandbox database configuration and an explicit environment preflight that fails if missing or production.

Add scoped operations coverage using the repository's native Node coverage pattern; target at least 80% of new business logic, plus all critical permission and payment state cases. Existing Growth-only coverage globs will not cover operations automatically. Formatting: `pnpm exec prettier --check` followed by the explicit changed file list. Do not format unrelated files.

## Review and handoff checklist per slice

- [ ] Every changed file reopened; syntax, imports, props, types and formatting inspected.
- [ ] Relevant tests passed, commands and environment recorded; missing services explained precisely.
- [ ] Diff contains only authorised scope, no placeholder code or debug logs.
- [ ] Data access, financial invariants and external side effects reviewed separately from UI correctness.
- [ ] New configuration/dependency cost and operational owner recorded.
- [ ] Handoff states completed task IDs, decisions, remaining work and exact next command. Stop at the user's authorised boundary.
