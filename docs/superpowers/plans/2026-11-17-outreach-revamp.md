# Outreach Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Extend the canonical Growth CRM with safe campaign automation, manual Facebook discovery/activity, and one-calendar-month experiment reporting.

**Architecture:** Keep one prospect store and the existing Gmail dispatcher. Add validated campaign policy versions, memberships, reservations, durable events/outbox and due jobs around existing ingestion, message snapshots and suppression. Pure campaign rules remain independent of database, HTTP and React.

**Tech Stack:** Node 24, pnpm 9.7, Next 16.4.5, React 19, strict TypeScript, postgres, Zod 4, existing date-fns/timezone utilities and node:test. No new dependencies.

**Spec:** [Approved design](../specs/2026-11-17-outreach-revamp-design.md), [video brief](../../growth-os/research/2026-11-17-video-outreach-brief.md). Conversation approval supersedes the design file's old draft header. Approval to implement does not fill missing operational permission evidence or bypass release gates. Baseline environment is ready: Node 24.22.1, pnpm 9.7.0, 2,533 unit tests pass and typecheck is clean; disposable PostgreSQL 17 is available through `DIRECT_DATABASE_URL`. Use only the isolated test database for migrations/tests.

## Execution status, 18 November 2026

Task1 domain rules and Task2 persistence/lifecycle/account/reservation foundations are reviewed. Task3.1 signed research provenance (`d61a02a9f`), Task3.2 Gmail observation/routing (`df44ef7c9`) and Task3.3a recipient approval (`317991cae`) are reviewed, with current maps at `ceb387f11`. Task4 public/manual Facebook workspace (`97ab9ec0f`) passed scoped source and actual browser checks; final integrated UI jury is pending. Task3.3b atomic confirmation is in progress. Remaining sender integration, Resend, commercial/outcome/report/UI work, schedules and release gates are incomplete. No new sending automation, production deployment or first run has occurred.

The original checklists below describe required task reach. Detailed per-slice execution and verification are recorded in the local SDD progress ledger; unchecked historical steps must not be read as proof that no work exists. Current source coverage and limitations are in [FEATURE_TREE.md](../../../FEATURE_TREE.md) and [Graphify report](../../../graphify-out/GRAPH_REPORT.md). Current cached Node is24.22.3. Earlier baseline version/count claims describe the planning-time run, not the latest revision.

## Global Constraints

- Maximum **150 total outbound attempts** per Europe/London day, including follow-ups and retries; confirmed actual sends, not attempts, determine throughput. 100/day is a goal, never a minimum obligation.
- Rolling 24-hour Gmail account allowance includes other/manual/alias sends and recipients, outstanding reservations and a **50-message reserve**. Start at **25/day**; increases to 50, 100 and 150 require explicit founder approval and measured health.
- Automatic eligibility requires approved immutable policy, verified offer capability, explicit documented provider/jurisdiction-appropriate permission and fresh evidence. Public email alone never qualifies. Unknowns stay review-only.
- Protect every current Operations client and suppression, not a hard-coded five/two list. Ambiguous identity requires review. Resend remains explicitly opted-in only.
- Facebook is manual/public-only. Two private one-page preview slots total, one revision each; preserve domain ownership and current pricing. No invented completed previews, owners, capabilities or scarcity.
- New policy cadence: Facebook +2/+4 days then stop; review +5/+10 days then stop. Existing legacy cadence stays unchanged.
- One active business membership across campaigns and legacy sequences. Commit state before notification; events contain stable IDs and no PII. No idle API/database polling.
- Research runs weekends too. Schedule Europe/London: 07:00 research, 07:30 Facebook discovery, 08:30 preparation, 09:00–17:00 recipient-policy sends, 17:30 summary.
- No production migrations, deployment, sends or scheduler activation until exact-revision reviews/checks and applicable existing approval gates pass. No paid infrastructure, DNS, MTA, provider watch/cloud resources or tracking pixels added.
- Coordinator implementation defaults: campaigns start paused; automatic eligibility requires source/contact verification no older than 30 days and unexpired permission evidence. Policy approval must explicitly confirm supported jurisdiction/provider permission, evidence expiry and offer capability. These conservative defaults are implementation rulings, not provider/legal guarantees.
- Browser verification uses Codex in-app browser only. Fresh design-craft jury raw weighted score must be **>=7.5**, targeting 8 per category.

## Source and reuse map

Consulted `FEATURE_TREE.md` GROWTH-CRM, GROWTH-RESEARCH, GROWTH-OUTREACH, GROWTH-SUPPRESSION, GROWTH-FB-SOURCE and planned campaign IDs, plus `graphify-out/graph.json` nodes `lib_growth_crm_commands_ts`, `lib_growth_research_global_ingest_ts`, `lib_growth_sequences_dispatcher_ts` and their neighbors. Followed source references into CRM commands/capture, v2 ingestion/schema, dispatcher/repository, Gmail types/sync, dashboards and cron. Graph contains inferred edges and is not directed proof; source remains authoritative. Planning-time structural coverage was198 selected sources; consult FEATURE_TREE.md for current selected coverage and gaps.

Reuse `ingestGlobalResearchRun`, `executeCrmCommand`, `createOutreachDispatcher`, `createGmailReplySync`, private message snapshots, existing founder auth, HMAC intake, suppression and audit. `crm/change-events.ts` is browser cross-tab refresh only, not a backend/provider event bus. Gmail currently exposes history and metadata but no Sent listing or remaining-quota API; add the former, never invent the latter.

## Review Focus

1. Jan 31 and London DST changes: month anniversary clamps correctly without shifting local reporting dates (Task 1).
2. A previously eligible prospect changes or becomes a client after queueing: submission recheck blocks it and cancels due work (Tasks 2–3).
3. Gmail history expires, paginated Sent results exceed bounds, or manual mail consumes allowance: hold sends until complete fresh reconciliation (Task 3).
4. Unknown Facebook rules or a duplicated page/business: retain evidence and one canonical prospect without implying permission (Tasks 2, 4).
5. Late replies, bot replies, refunds and unmapped historical payments: show censoring/unknowns and never credit two campaigns (Tasks 1, 5).

## Ownership and execution

Coordinator owns integration, maps, review dispatch and release decisions; all implementation/fixes use gpt-6.1-terra. Maximum three workers plus coordinator. Every worker is told others are present and must not revert their work. Do not run tasks sharing files concurrently. A reused worker can own multiple sequential tasks.

| Task | Owner                               | Depends on     | Concurrent-safe boundary                                                      |
| ---- | ----------------------------------- | -------------- | ----------------------------------------------------------------------------- |
| 1    | Domain Terra                        | none           | Owns campaign contracts/pure rules only; freeze first                         |
| 2    | Persistence Terra                   | 1              | Owns migration, repository, command/source backend                            |
| 3    | Delivery Terra                      | 1, 2 contracts | Owns Gmail, sequence dispatcher/sync, research intake wiring                  |
| 4    | UI Terra                            | 1, 2 contracts | Owns Facebook UI/API adapters/navigation                                      |
| 5    | UI Terra, then Domain Terra         | 2, 3, 4        | UI owns presentation; domain worker owns report service, no shared file edits |
| 6    | Delivery Terra                      | 2, 3, 5        | Owns cron/scheduler/runtime and operational documentation                     |
| 7    | Coordinator + independent reviewers | all            | Freeze revision, fix through original owners, invalidate reviews after edits  |

Task 2 freezes repository interfaces before Tasks 3/4 consume them. Task 2 alone edits CRM schemas/commands/source service; Task 3 alone edits global research ingestion. Task 4 alone edits navigation and source-filter UI; Task 2 owns its CRM query/backend changes, exposing specific source predicates rather than indiscriminate field filtering. Task 6 alone edits cron routes/runtime. Task 5 must hand off analytics service types before UI changes. Tests follow their production-file owner. Commit each task when independently green, with no attribution trailer.

### Task 1: Freeze campaign contracts and pure decisions

**Files:** Create `lib/growth/campaigns/{schemas,policy,variants,copy,time,report}.ts` and corresponding `.test.ts` files. Keep report calculation pure; persistence comes later.

**Interfaces:** Export Zod-inferred `CampaignPolicy`, `CampaignVariant`, `EligibilitySnapshot`, `EligibilityDecision`, `CampaignCommand`, `CampaignCommandResult`, `CampaignEvent`, `CampaignReportInput`, `CampaignReport`, `ProviderUsageSnapshot`, `SourceLeadInput`, `CampaignOutcomeInput`, `CampaignDueJob`, `CampaignRunSummary`. Export `FacebookWorkspaceResult` and typed dashboard read DTO contracts here as well, so UI/repository workers share stable shapes. Policy includes version, approval/effective dates, offer/capability evidence, jurisdiction/provider permission requirements, windows, ramp, thresholds, variants and cadence. Snapshot contains versions, source/contact verification, permission evidence, exclusion/stop state and provider health; it is never an LLM qualification score.

- `evaluateCampaignEligibility(policy: CampaignPolicy, snapshot: EligibilitySnapshot, now: Date): EligibilityDecision`, discriminated `eligible | review | blocked` with reason codes.
- `assignCampaignVariant(input: { businessId: string; market: string; seed: string; variantIds: readonly [string, string] }): string`.
- `buildCampaignSubject(input: { businessName: string; verifiedOwnerName: string | null }): string` and validated copy generation using only verified facts.
- `campaignMonthAnniversary(firstSentAt: Date): Date`; `londonDayKey(now: Date): string`; `buildCampaignReport(input: CampaignReportInput): CampaignReport`.

- [ ] Write failing tests asserting public email/no permission => review; revoked approval => blocked; unknown owner => business subject; no preview artifact => no completed-preview claim; deterministic assignment fixed by business/market/seed, single CTA factor only.
- [ ] Add tests for Jan 31 => Feb last day, leap year, both London DST transitions; first 14 London days and complete 14-day observation; bot/OOO/opt-out exclusion, denominators/intervals, missing and censored outcomes, cleared net payment only.
- [ ] Run `node --import tsx --test lib/growth/campaigns/*.test.ts`; expect missing-module/export failures before implementation.
- [ ] Implement exact contracts/rules with existing Zod/date utilities; reject header injection and unsafe copy using existing email policy helpers. Do not ship active offer/pricing defaults as approval.
- [ ] Run the same tests and `pnpm typecheck`; expect PASS. Share frozen exports with every owner and commit `feat: define outreach campaign policy and experiment rules`.

### Task 2: Persist campaign lifecycle and canonical manual sources

**Files:** Create `supabase/migrations/20261117100000_growth_campaigns.sql`, `lib/growth/campaigns/{repository,commands,lifecycle,source-service}.ts`, focused unit tests and `tests/integration/growth/campaigns.test.ts`. Modify `lib/growth/crm/{schemas,commands,lead-service,lead-repository}.ts` only where source capture requires it. Reuse global identity helpers; preserve legacy capture validation.

**Schema:** Prefer nine focused tables in `growth`: `campaigns` (immutable versioned policy/variant JSON validated in application, unique campaign/version), `campaign_memberships`, `outreach_events`, `outreach_reservations`, `outreach_outbox`, `outreach_jobs`, `experiment_reviews`, `facebook_destinations`, `facebook_activities`. Do not add generic workflow tables. Reuse existing messages for private copy, and existing business/prospect/source-evidence relations. Add source enum/check support only where the actual schema requires it.

**Interfaces:** `executeCampaignCommand(db: GrowthDb, raw: CampaignCommand, founder: FounderSession, correlationId: string): Promise<CampaignCommandResult>`; `captureSourceLead(tx: GrowthTransaction, input: SourceLeadInput, founder: FounderSession, correlationId: string): Promise<CrmCommandResult>`; `persistCampaignMembership(tx: GrowthTransaction, input: CampaignMembershipInput): Promise<CampaignMembershipResult>`; export both membership types from this repository. Task 3 owns eligibility-driven enrollment orchestration.

Export `postgresCampaignRepository` and typed ports for: immutable policy reads/approval, eligibility snapshot loading, business-lock membership acquisition, guarded attempt reservation, reservation completion/uncertainty, append-event/outbox, due-job claim/complete/cancel, snapshot reports and Facebook evidence/activity. Freeze method input/result types with delivery/UI owners before they implement adapters. All mutations transaction-scoped; no adapter queries from React.

- [ ] Add failing integration tests for duplicate request replay, campaign/legacy membership race, immutable used policies, competing last budget slot, cancellation after suppression/client transition, event-before-commit invisibility, duplicate event IDs, unauthorized founder and rollback.
- [ ] Add source tests: Facebook page with no company number or person name creates research-only canonical prospect; invalid/private source rejected; repeated URL/business deduplicates; legacy capture still requires its existing fields; all current clients/opt-outs stay unchanged.
- [ ] Run `DIRECT_DATABASE_URL=postgresql://postgres@127.0.0.1:55487/fss_growth_test node --import tsx --test tests/integration/growth/campaigns.test.ts` against authorised isolated test DB; expect schema/function failure first. Never apply this migration to production for a test.
- [ ] Implement constraints/indexes/FKs/RLS following adjacent migrations. Lock canonical business when checking every active legacy/campaign membership. Task 3 must apply the same business-lock protocol to legacy per-message approval in `approval-repository.ts`; cross-table uniqueness alone cannot establish this invariant. Store immutable versioned JSON and approval identity; validate before persistence. Keep PII out of events/outbox, private evidence protected by founder authority.
- [ ] Atomically reserve London-day total including retries/uncertainty, then provider allowance; unique idempotency keys prevent replay. Due jobs/outbox commit alongside state. Stop events cancel future jobs immediately. Add reversible migration verification and query-plan evidence.
- [ ] Run focused tests, `pnpm verify:migrations`, `pnpm typecheck`; expect PASS or explicit environment blocker. Commit `feat: persist campaign lifecycle and source-aware lead capture`.

### Task 3: Wire automatic eligibility into the existing sender

**Files:** Create `lib/growth/campaigns/{enrolment,dispatch-guard,usage-repository}.ts`, `lib/growth/integrations/gmail/usage.ts` and tests. Modify `lib/growth/integrations/gmail/{types,client,live-client}.ts`, relevant provider fixtures, `lib/growth/sequences/{dispatcher,dispatcher-repository,gmail-sync,gmail-sync-repository,approval-repository}.ts`, `lib/growth/research/{global-ingest,global-schema}.ts`, and focused existing tests. Do not edit cron routes yet.

**Interfaces:** `enrolEligibleProspects(db: GrowthDb, input: { campaignId: string; limit: number; now: Date }): Promise<{ enrolled: number; review: number; blocked: number }>` belongs to `campaigns/enrolment.ts`. Extend `GmailClient` with `listSentMessages(input: { after: Date; pageToken?: string }): Promise<{ messageIds: string[]; nextPageToken?: string }>` and explicit `to`, `cc`, `bcc` recipient metadata for usage. Update every fake/client implementation. `reconcileGmailUsage(db: GrowthDb, client: GmailClient, now: Date): Promise<ProviderUsageSnapshot>` records completeness/freshness/cutoff/history; type comes from Task 1. `createCampaignDispatchGuard(input: { repository: CampaignRepository; founderEmail: string })` returns typed reserve/recheck/settle hooks consumed inside `createOutreachDispatcher`, rather than a second sender. `prepareCampaignMembership(db: GrowthDb, input: { membershipId: string; now: Date }): Promise<CampaignCommandResult>` writes protected first-email snapshots and due messages using existing message storage.

- [ ] Write failing tests: approved/evidenced recipient automatically enrolled/drafted/queued; public-only candidate remains review; changing contact/policy version cancels; current client, opt-out, reply, booking, talks and cleared payment all stop before provider call; cold Resend remains blocked.
- [ ] Add tests for 150th/151st attempt, 25 initial ramp, follow-up/retry counting, manual/alias recipient usage, 50 reserve, stale/incomplete/bounded pagination and expired history, auth revocation and quota 403/429 halt. Unknown provider outcome retains reservation and uses RFC-message reconciliation before any retry.
- [ ] Run focused campaign/provider/dispatcher tests with `node --import tsx --test` and each touched `.test.ts`; expect relevant assertions FAIL before changes.
- [ ] Integrate eligibility after committed signed v2 ingestion through durable wakeups; automatic membership preparation requires policy approval/evidence. Preserve existing per-message approval for everyone else and legacy schedule semantics. Reuse `createResearchEmailApprover` snapshot/enrollment mechanisms behind a separate campaign-approved authority wrapper: record policy version and policy approver actor, never impersonate a founder session. Existing research permission accepts corporate legitimate interest or consent; requested-service evidence needs an explicit campaign contract and provider/jurisdiction check, never a cast into the old schema. Preserve existing `manual_only` follow-up policy for manual v2 sends.
- [ ] Reconstruct bounded paginated Sent usage on startup/reconnect; increment through Gmail history including manual mail. Provider watch is absent unless separately authorised; request-scoped reconciliation before a due batch is the conservative fallback. Use at most 10 Sent pages of 100 IDs (1,000 IDs) and at most 1,000 metadata reads per reconstruction; a bound exceeded holds work visibly. Partial history/page limit/unknown quota holds work visibly.
- [ ] Execute reservation and authoritative snapshot recheck immediately before the existing provider call; persist provider accepted vs actual sent/delivery evidence distinctly. First actual-send event freezes assignment/cohort and creates exactly one anniversary job. Reply sync maps thread/enrollment uniquely; keep manual classification reviewable.
- [ ] Run all touched tests, `pnpm typecheck` and legacy dispatcher/research integration suites. Commit `feat: guard and automate eligible campaign sends through Gmail`.

### Task 4: Deliver manual Facebook workspace

**Files:** Create `app/(growth)/(dashboard)/growth/facebook/page.tsx`, `components/growth/facebook/{facebook-workspace,destination-form,manual-lead-form,activity-list}.tsx`, focused module CSS/tests, `lib/growth/dashboard/facebook.ts`, `app/api/growth/facebook/route.ts` and handler/tests. Modify `lib/growth/dashboard/navigation.ts`, its test and existing CRM source filter components/query only. Task 2 owns any required CRM backend changes.

**Interfaces:** `getFacebookWorkspace(db?: GrowthQueryExecutor): Promise<FacebookWorkspaceResult>` provides discriminated ready/error state; Task 1/2 command contracts back thin founder-authenticated route. Reuse existing CRM request/idempotency and committed-change refresh patterns, with no idle refresh interval.

- [ ] Add failing component/route tests: pages say follow, groups say join; stale/unknown rules block post-ready status; manual actions never call Facebook; source capture accepts unknown person/registration; duplicate maps to existing prospect; unauthorised POST rejected.
- [ ] Run focused node:test files; expect missing implementation FAIL.
- [ ] Implement destination evidence/locality/rules/timestamp and manual follow/join/post history, direct prospect link/capture and source filter. Show two total pilot slots, approved private-preview scope and actual expiry only where artifact exists; no payment required for free private preview.
- [ ] Verify semantic labels, keyboard/focus, narrow layout and loading/empty/error/success states through component tests; use current Growth tokens/primitives. Run touched tests and `pnpm typecheck`, then commit `feat: add manual Facebook discovery and prospect workspace`.

### Task 5: Deliver campaign controls, daily operations and honest report

**Files:** Create `lib/growth/campaigns/{report-service,outcomes}.ts`, tests, `lib/growth/dashboard/campaigns.ts`, `components/growth/outreach/{campaign-controls,daily-campaign-summary,campaign-report}.tsx` and tests. Modify `app/(growth)/(dashboard)/growth/outreach/page.tsx`, `components/growth/outreach/outreach-workspace.tsx`, `components/growth/analytics/analytics-page.tsx`, `lib/growth/dashboard/analytics.ts`, and add thin `app/api/growth/campaigns/route.ts` with handler/tests. Keep current draft/sequence screens usable.

**Interfaces:** `generateCampaignReport(db: GrowthDb, input: { campaignId: string; cutoff: Date }): Promise<CampaignReport>` loads evidence then uses Task 1 pure calculator and stores immutable `experiment_reviews`. `recordCampaignOutcome(db: GrowthDb, input: CampaignOutcomeInput, founder: FounderSession, correlationId: string): Promise<CampaignCommandResult>` validates origin membership and reviewed evidence; input/result types exported from Task 1 schema. Dashboard readers return discriminated ready/error DTOs, not database rows.

- [ ] Write failing tests for active/pause/version approval/ramp controls, eligibility and shortfall reason counts, no forced goal sending, accepted vs actual sent/delivered unknown, manual reply review, explicit meeting/proposal origin and reviewed agreement/invoice net-cleared-payment link.
- [ ] Add report tests for identical eligibility/one CTA factor, market/offer/version-separated cohorts, deduplicated provider/outcome IDs, later censoring, 14-day maturity, missing evidence, refunded payments and no thin/confounded winner. Historical unmapped outcomes remain unknown.
- [ ] Run focused tests; expect missing routes/components/services FAIL. Domain owner implements report/outcome services first and shares typed DTOs; UI owner consumes them after handoff.
- [ ] Implement versioned founder policy editor/approval and daily queue/cap/ramp/halts/failures/shortfalls, campaign history and one-month report navigation. Render denominators, intervals, maturity and attribution windows explicitly. Keep pricing/capability approval unresolved until evidenced, never auto-fill permission from a public address.
- [ ] Run tests, `pnpm typecheck`, relevant existing outreach/analytics tests; inspect changed components for readability and accessible states. Commit `feat: expose daily campaign operations and month experiment results`.

### Task 6: Integrate due work, research schedule and release runbook

**Files:** Create `lib/growth/campaigns/{worker,daily-runs}.ts`, tests and `docs/growth-os/runbooks/campaign-outreach.md`. Modify `app/api/cron/{outreach-dispatch,gmail-sync}/route.ts`, `app/api/cron/runtime.ts`, `scripts/run-scheduled-research-agent.ts`, `lib/growth/research/scheduled-workflow.ts`, corresponding tests and existing global-research/cron runbooks. Add an authenticated due-job cron route only if existing dispatch cannot own the due stages cleanly; no parallel scheduler engine.

**Interfaces:** `runDueCampaignJobs(db: GrowthDb, input: { now: Date; limit: number }): Promise<CampaignRunSummary>` consumes Task 2 leased due jobs and Task 3 preparation/dispatch hooks, Task 5 report service. `planCampaignDay(now: Date): readonly CampaignDueJob[]` uses named London times and idempotent daily keys; definitions live in Task 1 time module via its owner if additions are needed.

- [ ] Write failing tests: weekend research, DST timing, one daily discovery despite retry, recipient-window pacing, summary reason counts, first actual send creates one month job, duplicate wakeup harmless, reconnect catch-up and lease recovery, cancellation/revocation and graceful shutdown.
- [ ] Assert no repeating idle query/request timer; measure zero worker queries when no invocation/event occurs. Each bounded invocation claims at most 25 due jobs and completes/retries at most those 25, with a documented fixed query/page ceiling per stage; excess work schedules a committed follow-on due job, never a busy loop.
- [ ] Run focused tests; expect absent workflow behavior FAIL. Implement authenticated post-commit wakeups and existing cron execution of already-due jobs. Browser BroadcastChannel remains UI-only. Describe exact fallback reconciliation frequency (once per invoked send batch, no extra idle timer) and bounds; keep unknown/incomplete provider state halted.
- [ ] Update signed-v2 Keychain wrapper/prompts for source evidence and public manual Facebook discovery, redacted output and all-week research. Do not print prospect content or credentials. Prepare the requested first research automation configuration, disabled until release/activation gates; after authorised gates coordinator may invoke first run and record redacted result.
- [ ] Document migration up/down, live preflight (current OAuth/plan/DKIM/provider rules, reserve, client/suppression reconciliation), ramp approval, instrumentation, disable/cancel/unknown reconciliation rollback, watch prerequisites and no new paid resources. Run tests and `pnpm typecheck`; commit `feat: schedule durable campaign work and document staged activation`.

### Task 7: Verify complete branch, maps and release evidence

**Files:** Update `FEATURE_TREE.md`, affected `graphify-out` artifacts through installed Graphify incremental/scoped workflow, and project context handoff. Preserve explicit graph coverage gaps. Update this plan checkboxes as tasks finish; no production activation claim without evidence.

- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration:growth`, `pnpm verify:migrations`, `pnpm test:coverage:growth` and `pnpm build` under Node 24. New meaningful logic requires >80% tested coverage. Missing DB/services are blockers, not passes; record exact skipped command and reason.
- [ ] Run authorised isolated-DB concurrent reservation/membership tests, source/legacy regression and all current client/suppression invariants; verify migration rollback and query plans. Inspect every changed file/diff, imports/exports, no debug/placeholder code and no new dependency.
- [ ] Use Codex in-app browser on safe fixtures for desktop/mobile daily outreach, policy approval/paused/error/empty, Facebook capture/manual activity and report keyboard/focus. Do not launch Chrome or Chrome-backed Playwright. Report IAB availability gaps explicitly.
- [ ] Apply design-craft critical jury with fresh screenshots/evidence; record each category, raw weights and raw weighted score. Require >=7.5, aim >=8 each. Fix through original owners and rerun affected checks/jury.
- [ ] Update feature IDs/dependencies/consumers/tests and Graphify affected scopes; verify mapped paths resolve. Preserve research->campaign->dispatcher->provider and source->CRM reuse connections, auth/suppression and report/due-job links. Do not graph secrets, runtime data, dependencies or generated output.
- [ ] Freeze exact revision; independent Code Reviewer and Security Reviewer must both pass. Required CI must be green on latest revision and test merge. Any fix invalidates prior revision reviews/CI and triggers rerun. No merge beyond existing authorization.
- [ ] Present concrete release evidence and operational prerequisites to coordinator. Production deployment remains explicit human gate; campaign activation separately checks approved version, evidence, account health and 25/day initial ramp. Original requested first automation can run only after those gates are satisfied; if blocked, state exact missing gate and leave disabled, preserving all work.
