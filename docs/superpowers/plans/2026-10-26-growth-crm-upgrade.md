# Growth CRM Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver lead capture/editing, enquiry conversion, saved views, pipeline board/list, opportunity editing, notes, tasks and activity within Growth.

**Architecture:** Keep business/contact/prospect/engagement identity and existing founder-authenticated SQL commands. Add small CRM domain modules, additive private-schema tables and focused UI components. Use command-triggered refresh, cross-tab commit events, and focus/reconnect reconciliation without polling.

**Tech Stack:** Existing Next.js, strict TypeScript, React, Zod, postgres.js, CSS modules, Node test runner and Playwright. No new production dependency.

**Spec:** `docs/superpowers/specs/2026-10-26-growth-crm-upgrade-design.md`

## Global Constraints

- Preserve founder authorization, same-origin protection, outreach eligibility/approval, suppression, consent and lifecycle transitions.
- No Production migration or deployment; isolate from the dirty original checkout.
- Keep company/contact identity unique, one open prospect per business, integer-pence money and versioned writes.
- All writes commit with content-free audit events. Activity is escaped plain text; queries and history are bounded.
- Use Design Craft, existing Growth branding and accessible controls; verify mobile and desktop.
- No interval polling, new paid service, automatic sends or generic workflow/object engine.

## Review Focus

- Concurrent duplicate lead or enquiry conversion must preserve one identity and return a usable record link.
- Contact edits cannot fabricate verification or change suppression/consent; closed opportunity values cannot change.
- Stale task promotion must roll back both task and next-step changes, including when the task belongs to another prospect.
- Cursor and filter changes must not corrupt totals or lose filters across board/list/saved views.
- A hidden/unmounted CRM view must release listeners; reconnect/focus must reconcile authoritative data without idle requests.

### Task 1: Record capture and editable CRM identity

**Files:** Create `lib/growth/crm/{schemas,errors,lead-repository,lead-service,record-repository,record-service}.ts`; corresponding tests and `tests/integration/growth/crm-records.test.ts`; migration `*_growth_crm_workspace.sql` generated with Supabase CLI. Add `lib/growth/crm/route-handler.ts` and `app/api/growth/crm/[id]/route.ts`.

**Interfaces:** Consume `GrowthDb`, `FounderSession`, `withGrowthTransaction` and existing message-action HTTP wrapper. Produce validated `CrmCommand`, `executeCrmCommand(db, command, founder, correlationId): Promise<CrmCommandResult>` and `CrmError` with safe status/code. Lead capture returns `prospectId`; duplicate/conflict errors expose only scoped record links.

- [ ] Write failing schema/record tests for bounded input, safe URLs, duplicate company/contact, stale versions, repeat enquiry conversion, closed-record protection and unchanged consent.
- [ ] Run `node --import tsx --test lib/growth/crm/*.test.ts`; confirm the new behavior fails.
- [ ] Generate additive tables for capture request idempotency/enquiry links, tasks, activities and private views with grants/RLS/indexes. Implement transactional identity commands and shared authenticated command route.
- [ ] Run the unit tests and disposable PostgreSQL integration tests; inspect real stored identity, audit and permission effects.
- [ ] Commit the tested domain slice and record exact checks/limitations in the ledger.

### Task 2: Activity, tasks and saved views

**Files:** Create `lib/growth/crm/{activity-service,task-service,view-service,workspace-repository,workspace-query}.ts`, tests and `tests/integration/growth/crm-workspace.test.ts`.

**Interfaces:** Extend `CrmCommand` with append activity, create/update task, set task status, promote task to next step, save/rename/delete view. Produce `getCrmWorkspace(db, prospectId, query)` with bounded keyset activity and task pages and private saved views. Use separate expected prospect/task versions on promotion.

- [ ] Write failing tests for task lifecycle, chronological activity, cross-prospect protection, transaction rollback on stale promotion, view privacy and validated filters.
- [ ] Run focused tests to see the missing behavior fail.
- [ ] Implement narrow SQL services, immutable activity and audit entries, and bounded workspace queries.
- [ ] Run focused tests plus integration tests under the runtime role.
- [ ] Commit and ledger the verification.

### Task 3: Filtered pipeline board and table

**Files:** Modify `lib/growth/dashboard/pipeline.ts`, its tests and Growth pipeline components; create `lib/growth/crm/pipeline-query.ts`, `pipeline-query.test.ts`, `components/growth/pipeline/{pipeline-toolbar,pipeline-table,pipeline-summary}.tsx`.

**Interfaces:** Parse one validated `PipelineBoardQuery` for search/stage/sector/location/next-step/view and per-stage cursors. Extend column aggregates with separate one-off/monthly and weighted pence. Keep old aggregate fields for existing consumers until updated. Saved views store filters without cursors.

- [ ] Write failing tests for filter preservation, cursor validation, board/table equivalence and filtered aggregate reconciliation.
- [ ] Run tests; confirm failure.
- [ ] Share SQL filter fragments across rows and aggregates. Add typed opportunity update command guarded against closed stages. Build labelled toolbar, built-in/private views and board/table states.
- [ ] Run focused tests and real database reconciliation tests.
- [ ] Commit and ledger verification.

### Task 4: Complete record UI and enquiry workflow

**Files:** Create focused components under `components/growth/crm/` for lead forms, record properties, activity, tasks, saved views and commit reconciliation; create lead creation/enquiry pages; modify prospect/deal details, prospect list and navigation as needed. Create `lib/growth/dashboard/crm-record.ts` and tests.

**Interfaces:** Read edit defaults with business/contact/prospect versions separately. Render `CrmWorkspace` on both record types using the same prospect identity. All forms use the authenticated command route and announce pending/error/conflict/success results. Reconciliation subscribes to local committed events/BroadcastChannel and refreshes on focus/online with listener cleanup.

- [ ] Write behavior tests for form validation/payloads, safe rendering and reconciliation cleanup/no idle requests.
- [ ] Run the tests to observe failures.
- [ ] Build compact Growth UI, source-aware capture/contact fields, enquiry review/convert, ordinary property editing, task/activity forms and pagination. Preserve original research and stage controls.
- [ ] Verify unit tests, types and keyboard/mobile browser flows using synthetic records.
- [ ] Commit and ledger verification.

### Task 5: Release verification and handoff

**Files:** Add `tests/e2e/growth-crm.spec.ts` and a dedicated local browser configuration/fixture route guarded consistently with existing fixtures; add `docs/runbooks/growth-crm.md`; update design status and plan checks.

**Interfaces:** Exercise public UI commands against synthetic isolated database records through existing founder fixture conventions; no Production credentials/data in tests or screenshots.

- [ ] Add browser flows for capture/edit/duplicate conflict, saved filters and board/list, opportunity editing, notes/calls/meetings, task complete/reopen/promote and enquiry conversion.
- [ ] Run relevant Growth integration suite, full unit suite, `pnpm typecheck`, `pnpm lint`, changed-file Prettier checks, `pnpm build`, `pnpm verify:migrations`, dependency audit and desktop/mobile browser checks. Record failures by name.
- [ ] Inspect every changed file and the full diff for identity, security, money, history, accessibility and modularity. Dispatch one independent whole-branch reviewer; fix material findings with regression tests.
- [ ] Document additive migration rollout, data-preserving rollback, explicit refresh limitations, test commands and results. Commit final changes; preserve the worktree until safely handed off.
