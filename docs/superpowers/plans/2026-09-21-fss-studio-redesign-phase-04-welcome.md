# FSS Studio Redesign Phase 4 Welcome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the authorised FSS Studio welcome-journey, template, activation and client-checklist experiences for C02, C26–C29, F18–F26, F33, F35, M02 and M08, without treating planned work or browser input as durable evidence.

**Architecture:** Extend the existing durable onboarding scheduler with a versioned template and organisation-scoped draft/task layer. Founder routes remain server-authorised and invoke narrowly validated domain commands; client routes read a membership-scoped checklist and can only persist profile data or attach already-cleared documents. Journey activation snapshots the selected template and valid checklist data into the existing immutable journey path, so later template edits never rewrite active work.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, PostgreSQL/RLS migrations, existing Operations onboarding services, Portal shadcn-compatible primitives, Lucide, CSS Modules, Zod, Node test runner and Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-fss-studio-experience-redesign-design.md`, `docs/design/fss-studio-experience/02-workflow-contracts.md` sections D1–D5, `docs/design/fss-studio-experience/03-screen-contracts.md` (C02, C26–C29, F18–F26, F33, F35, M02 and M08), and `docs/design/fss-studio-experience/screen-coverage.csv`.

## Global Constraints

- Preserve `OPERATIONS_FSS_STUDIO_ENABLED`, `OPERATIONS_ONBOARDING_ENABLED`, provider configuration and every production enablement setting. Do not run a production migration, send invitations or invoke provider effects.
- Keep existing `operations.onboarding_journeys`, immutable approval snapshots, worker leases, idempotency keys, proposal timing and recovery semantics authoritative. A visual save action must only claim durable state after its domain command succeeds.
- Use PortalButton, PortalCard, PortalField, PortalSelect, PortalTextarea, PortalCheckbox, PortalActionLink, Notice and StatusBadge for all new or touched FSS Studio controls. Use existing Lucide icons only.
- RLS and tenant scope are mandatory: client profile/task commands use the verified portal identity and current membership; staff draft/template/journey commands use `requireFssAdmin`. Browser-supplied organisation, role, template, task and document IDs are validated and scoped server-side.
- A client profile update cannot grant or alter portal access. Signature, invoice and document evidence derive from existing signed, billed and cleared records; client buttons never mark those tasks complete by themselves.
- Booking opens only a configured trusted HTTPS destination. It completes only through a signed booking event or an audited FSS-admin confirmation; opening a calendar never completes the task.
- Template publishing creates an immutable version. Active journeys and task instances stay pinned to their approved source/template version; no edit rewrites existing journeys.
- Keep visual fixtures deterministic, non-production-only and behind `FSS_VISUAL_TESTS_ENABLED`; never use production identities, provider records or secrets.

## Review Focus

1. A member of organisation A must not read, mutate or attach a document to a checklist task belonging to organisation B; Task 2 adds portal-scope and integration rejection tests.
2. A profile form must not expose or alter role membership, and a forged contact ID must be rejected rather than reassigned; Task 3 tests server-side contact scope and immutable membership boundaries.
3. A task requiring a document remains incomplete while any selected document is quarantined, revoked, expired or belongs to another organisation; Task 3 covers each evidence state.
4. A circular task dependency, invalid relative due rule or a task type without its required target must prevent template publication; Task 1/Task 2 cover schema and graph validation.
5. A stale journey draft, template version or activation preflight cannot start/restart a journey; Task 4 verifies version conflict, durable snapshot retention and unchanged provider work.

---

### Task 1: Add versioned onboarding templates and scoped task persistence

**Files:**
- Create: `supabase/migrations/20260921120000_operations_onboarding_workspace.sql`
- Create: `lib/operations/onboarding/workspace-types.ts`
- Create: `lib/operations/onboarding/workspace-schema.ts`
- Create: `lib/operations/onboarding/workspace-schema.test.ts`
- Modify: `lib/operations/onboarding/queries.ts`
- Modify: `tests/integration/operations/onboarding-fixtures.ts`
- Create: `tests/integration/operations/onboarding-workspace.test.ts`

**Interfaces:**
- Produces `OnboardingTemplateVersion`, `OnboardingTaskDefinition`, `OnboardingJourneyDraft`, `ClientChecklistTask` and `OnboardingReadinessCheck` display DTOs.
- Consumes the existing agreement, contact, document, signing and journey tables only through organisation-scoped SQL functions.
- Provides `operations.read_onboarding_workspace(uuid)`, `operations.save_onboarding_template_draft(...)`, `operations.publish_onboarding_template_version(...)`, `operations.save_onboarding_journey_draft(...)` and `operations.complete_onboarding_task(...)` as security-definer command boundaries with explicit role checks.

- [ ] **Step 1: Write failing pure schema tests for task definitions and dependencies**

```ts
assert.throws(
  () => parseOnboardingTemplateDraft({ tasks: [assetTaskDependingOnItself] }),
  /dependency/i,
)
assert.throws(
  () => parseOnboardingTemplateDraft({ tasks: [uploadTaskWithoutEvidenceRule] }),
  /evidence/i,
)
assert.equal(parseOnboardingTemplateDraft(validDraft).tasks[0].kind, "profile")
```

- [ ] **Step 2: Run the schema test to verify it fails**

Run: `node --import tsx --test lib/operations/onboarding/workspace-schema.test.ts`

Expected: FAIL because the workspace schema module does not exist.

- [ ] **Step 3: Implement strict template/task schemas and exported DTOs**

Define the permitted task kinds as `profile | agreement | billing | upload | booking | acknowledgement | custom`; constrain owner roles to existing portal roles; allow dependencies only on sibling task UUIDs; restrict relative due rules to `activation`, `signature`, or `previous_task`; and require a type-specific completion rule. Reject unknown properties, em dashes in client copy, empty content and browser-provided completion timestamps.

```ts
export type OnboardingTaskDefinition = Readonly<{
  id: string
  title: string
  instructions: string
  kind: OnboardingTaskKind
  ownerRole: PortalRole
  required: boolean
  dependsOnTaskId: string | null
  dueRule: OnboardingDueRule
  evidenceRule: OnboardingEvidenceRule
  bookingUrl: string | null
}>
```

- [ ] **Step 4: Add the migration and RLS-safe SQL boundaries**

Create template/version, journey-draft, client-profile and journey-task tables. Store template and draft content as validated JSON snapshots, retain the template version ID on a draft and copy immutable task definitions into journey tasks at activation. Add `enable row level security` and `force row level security` to each table; revoke direct access from portal/founder roles; grant only bounded security-definer functions. The portal read function returns display-safe task/evidence status, never raw provider receipts, token material or unscoped contacts.

The migration must reject template publication if a dependency cycle exists, a source agreement/contact is unavailable, or a required task lacks a valid evidence rule. It must audit template publication, journey-draft saves, staff booking confirmation and client profile completion using existing audit conventions.

- [ ] **Step 5: Add integration proof of tenant, RLS and version isolation**

```ts
await assert.rejects(readClientChecklist(fixture.portal, fixture.identityA, fixture.organisationB))
await assert.rejects(saveTemplateDraft(fixture.founderDb, fixture.founder, invalidCycle))
assert.equal((await publishTemplate(validDraft)).version, 2)
assert.equal((await loadStartedJourney(fixture)).templateVersion, 1)
```

Use two organisations and a revoked portal membership. Assert that published versions are immutable, an active journey keeps its original task snapshot, and direct writes under `operations_portal` and `operations_founder` fail.

- [ ] **Step 6: Run focused schema and integration tests**

Run: `node --import tsx --test lib/operations/onboarding/workspace-schema.test.ts tests/integration/operations/onboarding-workspace.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the durable workspace foundation**

```bash
git add supabase/migrations/20260921120000_operations_onboarding_workspace.sql lib/operations/onboarding tests/integration/operations/onboarding-workspace.test.ts
git commit -m "feat: add versioned onboarding workspace data"
```

### Task 2: Add founder template and journey-draft commands

**Files:**
- Create: `lib/operations/onboarding/workspace-commands.ts`
- Create: `lib/operations/onboarding/workspace-commands.test.ts`
- Modify: `lib/operations/onboarding/route.ts`
- Modify: `app/api/portal/admin/clients/[organisationId]/journey/route.ts`
- Create: `app/api/portal/admin/welcome/templates/route.ts`
- Create: `app/api/portal/admin/welcome/templates/[templateId]/route.ts`
- Modify: `lib/operations/onboarding/http.test.ts`
- Modify: `tests/integration/operations/staff-onboarding.test.ts`

**Interfaces:**
- Produces `executeStaffOnboardingWorkspaceCommand(db, admin, organisationId, raw, options)` and exact Zod discriminated actions: `save_template_draft`, `publish_template`, `save_journey_draft`, `discard_journey_draft`, and `confirm_booking`.
- Consumes verified `FssAdminContext`, the Task 1 SQL functions and existing `JourneyCommandOptions` without broadening provider side effects.
- Leaves the existing `preview_welcome`, `start`, `preview_proposal`, `approve_proposal`, pause/resume/cancel/retry/reconcile commands unchanged.

- [ ] **Step 1: Write failing staff command tests**

```ts
await assert.rejects(
  executeStaffOnboardingWorkspaceCommand(db, revokedAdmin, organisationId, draftCommand, options),
)
const saved = await executeStaffOnboardingWorkspaceCommand(db, admin, organisationId, draftCommand, options)
assert.equal(saved.kind, "journey_draft")
assert.equal(saved.stage, "content")
```

- [ ] **Step 2: Run the focused command tests to verify they fail**

Run: `node --import tsx --test lib/operations/onboarding/workspace-commands.test.ts tests/integration/operations/staff-onboarding.test.ts`

Expected: FAIL because no workspace command boundary exists.

- [ ] **Step 3: Implement the command boundary and HTTP adapters**

Parse a strict bounded JSON payload before the transaction. Require the selected agreement, named contact, approved template version and permitted access role to belong to the same organisation. Draft saves retain only reviewed copy and task configuration, increment a version, and return server-derived readiness checks. `confirm_booking` requires a real journey task, ISO timestamp and bounded review reference; it cannot create a membership, send mail or change a payment/signature state.

Expose POST only through the existing staff route pattern, registered-origin check, 4.1 MB bound, correlation headers and private error mapping. Do not add browser authority to the request body.

- [ ] **Step 4: Extend integration coverage for stale and conflicting drafts**

Test that a stale expected draft version returns a conflict, duplicate active journeys are refused, a template from another organisation/global scope cannot be selected, and a booking confirmation records the admin actor plus evidence while an arbitrary client request cannot.

- [ ] **Step 5: Run command, HTTP and integration tests**

Run: `node --import tsx --test lib/operations/onboarding/workspace-commands.test.ts lib/operations/onboarding/http.test.ts tests/integration/operations/staff-onboarding.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the staff command boundary**

```bash
git add lib/operations/onboarding app/api/portal/admin/clients app/api/portal/admin/welcome tests/integration/operations/staff-onboarding.test.ts
git commit -m "feat: add FSS Studio onboarding workspace commands"
```

### Task 3: Add client checklist projections and evidence-safe task commands

**Files:**
- Create: `lib/operations/onboarding/client-workspace.ts`
- Create: `lib/operations/onboarding/client-workspace.test.ts`
- Modify: `lib/operations/onboarding/client-checklist.ts`
- Create: `app/api/portal/organisations/[organisationId]/onboarding/tasks/route.ts`
- Create: `app/api/portal/organisations/[organisationId]/onboarding/tasks/[taskId]/route.ts`
- Modify: `tests/integration/operations/portal-onboarding-checklist.test.ts`
- Create: `tests/integration/operations/portal-onboarding-tasks.test.ts`

**Interfaces:**
- Produces `loadClientOnboardingWorkspace(db, identity, organisationId, correlationId): Promise<ClientOnboardingWorkspace>`.
- Produces `completeClientProfile` and `attachClearedDocumentToTask` as portal-scoped commands; their only mutable inputs are profile fields, task ID and document IDs already retained in the same organisation.
- Consumes `operations.portal_onboarding_checklist` as derived agreement/billing/service evidence, and never replaces it with browser-asserted completion.

- [ ] **Step 1: Write failing portal workspace tests**

```ts
const workspace = await loadClientOnboardingWorkspace(db, owner, organisationId, correlationId)
assert.equal(workspace.tasks.find((task) => task.kind === "agreement")?.state, "complete")
await assert.rejects(attachClearedDocumentToTask(db, owner, otherOrganisationTaskId, [documentId]))
await assert.rejects(attachClearedDocumentToTask(db, owner, uploadTaskId, [quarantinedDocumentId]))
```

- [ ] **Step 2: Run the portal workspace tests to verify they fail**

Run: `node --import tsx --test lib/operations/onboarding/client-workspace.test.ts tests/integration/operations/portal-onboarding-tasks.test.ts`

Expected: FAIL because no client task projection or command exists.

- [ ] **Step 3: Implement display-safe client DTOs and task commands**

```ts
export type ClientOnboardingTask = Readonly<{
  id: string
  title: string
  instructions: string
  kind: OnboardingTaskKind
  required: boolean
  ownerLabel: string
  dueAt: string | null
  state: "blocked" | "available" | "complete"
  completionDetail: string | null
  action: ClientTaskAction
}>;
```

Derive agreement, billing and readiness completion from existing evidence. The profile command updates only the new profile row and validated existing contacts. The upload command accepts only matching organisation documents with `scan_status = cleared`, unrevoked and unexpired. Booking remains available/open until a verified booking event or Task 2 staff confirmation. Return `PortalAccessDenied` for scope/capability failures.

- [ ] **Step 4: Add HTTP boundary and integration security cases**

Use the established portal origin/body-size/auth pattern. Assert owner/contributor permissions as defined by the task owner role, rejected viewer mutation, task-version conflict, document quarantine, cross-tenant IDs and that no profile field can alter a portal membership.

- [ ] **Step 5: Run client onboarding tests**

Run: `node --import tsx --test lib/operations/onboarding/client-workspace.test.ts tests/integration/operations/portal-onboarding-checklist.test.ts tests/integration/operations/portal-onboarding-tasks.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the client workspace boundary**

```bash
git add lib/operations/onboarding app/api/portal/organisations tests/integration/operations/portal-onboarding-*.test.ts
git commit -m "feat: add client onboarding task workspace"
```

### Task 4: Connect drafts, template snapshots and activation preflight to the durable journey

**Files:**
- Modify: `lib/operations/onboarding/command-schema.ts`
- Modify: `lib/operations/onboarding/commands.ts`
- Modify: `lib/operations/onboarding/prepare-preview.ts`
- Modify: `lib/operations/onboarding/approval.ts`
- Modify: `lib/operations/onboarding/command-types.ts`
- Create: `lib/operations/onboarding/readiness.ts`
- Create: `lib/operations/onboarding/readiness.test.ts`
- Modify: `lib/operations/onboarding/worker.test.ts`
- Modify: `tests/integration/operations/onboarding-activation.test.ts`

**Interfaces:**
- Produces `buildOnboardingReadiness(input): readonly OnboardingReadinessCheck[]` with `passed | needs_action | failed` statuses, exact reason and repair destination.
- Extends welcome-preview envelopes with a validated draft/version fingerprint and task snapshot, while retaining the existing HMAC envelope, 30-minute expiry and actor/org/agreement/version binding.
- Consumes a persisted staff draft but still creates the actual journey only through the existing reviewed `start` command.

- [ ] **Step 1: Write failing preflight tests**

```ts
assert.deepEqual(
  buildOnboardingReadiness({ senderConfigured: false, currentAgreement: true }).find((check) => check.id === "sender"),
  { id: "sender", status: "needs_action", reason: "Choose an authorised FSS sender.", href: "/portal/admin/settings" },
)
assert.equal(canStartOnboardingJourney(blockedChecks), false)
```

- [ ] **Step 2: Run the focused preflight test to verify it fails**

Run: `node --import tsx --test lib/operations/onboarding/readiness.test.ts`

Expected: FAIL because readiness projection has not been defined.

- [ ] **Step 3: Implement server-derived preflight and snapshot binding**

Use the existing agreement/version, active-journey check, contacts, approved template, allowed recipient roles, billing account, signing state and `journeyCommandOptions` configuration. Do not trust a browser `passed` value. `preview_welcome` returns the read-only server result; `start` rejects a changed draft/template/recipient or any non-passing required check before calling `operations.start_onboarding`.

- [ ] **Step 4: Instantiate task snapshots only after successful activation**

Add the Task 1 stored procedure to copy the approved template tasks into the journey once the HMAC-bound welcome snapshot is accepted. Duplicate start returns the same existing journey and task set. A failed start persists neither partial tasks nor mail/provider work.

- [ ] **Step 5: Test activation, stale data and worker compatibility**

Assert a changed agreement revision, template version, sender configuration, task dependency or contact invalidates the preview. Assert a repeat start returns the existing journey, proposal timing remains acceptance + two elapsed hours, and all later invoice/access/thank-you effects retain their current idempotency and signature gates.

- [ ] **Step 6: Run focused readiness and onboarding tests**

Run: `node --import tsx --test lib/operations/onboarding/readiness.test.ts lib/operations/onboarding/worker.test.ts tests/integration/operations/onboarding-activation.test.ts tests/integration/operations/onboarding-reapproval.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit durable preflight and activation**

```bash
git add lib/operations/onboarding tests/integration/operations/onboarding-activation.test.ts
git commit -m "feat: bind welcome activation to reviewed task snapshots"
```

### Task 5: Rebuild client getting-started and task views with Portal primitives

**Files:**
- Create: `components/portal/onboarding/client-onboarding-workspace.tsx`
- Create: `components/portal/onboarding/client-onboarding-task.tsx`
- Create: `components/portal/onboarding/client-onboarding.module.css`
- Create: `components/portal/onboarding/client-onboarding-workspace.test.tsx`
- Modify: `components/portal/onboarding/client-setup-checklist.tsx`
- Modify: `app/(portal)/(client)/portal/getting-started/page.tsx`
- Create: `app/(portal)/(client)/portal/onboarding/tasks/[taskId]/page.tsx`
- Create: `app/(portal)/(client)/portal/onboarding/tasks/[taskId]/upload/page.tsx`
- Create: `app/(portal)/(client)/portal/onboarding/tasks/[taskId]/booking/page.tsx`

**Interfaces:**
- Consumes only `ClientOnboardingWorkspace` from Task 3 and existing organisation-aware portal paths.
- Produces C02/M02, C26, C27, C28 and C29 with labelled controls, truthful completion states and no fabricated percentage or task result.

- [ ] **Step 1: Write failing component assertions for real task states**

```tsx
assert.match(html, /Your launch checklist/)
assert.match(html, /Share brand assets/)
assert.match(html, /Safety checks passed/)
assert.match(blockedHtml, /Complete the previous required step first/)
assert.doesNotMatch(profileHtml, /Owner role.*select/i)
```

- [ ] **Step 2: Run the client presentation test to verify it fails**

Run: `node --import tsx --test components/portal/onboarding/client-onboarding-workspace.test.tsx`

Expected: FAIL because the new workspace components do not exist.

- [ ] **Step 3: Implement C02/M02 and task-specific C26–C29 presentations**

Use PageHeader, PortalCard, Notice, StatusBadge, PortalButton, PortalField, PortalSelect and PortalTextarea. The overview prioritises the first available required task, shows the owner/due/status of every task and provides an accessible route to details. Profile fields omit membership role controls. Upload uses document IDs returned by the real safe document workspace and disables submit while evidence is not cleared. Booking opens only the supplied trusted URL with London context and explains that it is not completion. The completion hero renders only when the server says every required task is complete; optional tasks remain visible.

- [ ] **Step 4: Add loading, unavailable and mobile behaviour**

Keep server failures as `PortalUnavailable`, not an empty checklist. At narrow width, stack task cards and render task editors as full-width pages with persistent return links and focusable labels; never horizontally scroll the form.

- [ ] **Step 5: Run component and client domain tests**

Run: `node --import tsx --test components/portal/onboarding/client-onboarding-workspace.test.tsx lib/operations/onboarding/client-workspace.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the client onboarding experience**

```bash
git add app/'(portal)'/'(client)'/portal/getting-started app/'(portal)'/'(client)'/portal/onboarding components/portal/onboarding
git commit -m "feat: redesign FSS Studio client onboarding"
```

### Task 6: Rebuild founder journey list, template editor, builder, activation and recovery

**Files:**
- Create: `components/portal/onboarding/onboarding-presentation.ts`
- Create: `components/portal/onboarding/staff-journey-builder.tsx`
- Create: `components/portal/onboarding/journey-template-editor.tsx`
- Create: `components/portal/onboarding/journey-checklist-editor.tsx`
- Create: `components/portal/onboarding/staff-journey-detail.tsx`
- Create: `components/portal/onboarding/staff-journey-overview.test.tsx`
- Create: `components/portal/onboarding/staff-journey-builder.test.tsx`
- Modify: `components/portal/onboarding/staff-journey-overview.tsx`
- Modify: `components/portal/onboarding/staff-journey-workspace.tsx`
- Modify: `components/operations/onboarding/{journey-preview,journey-timeline,welcome-form,proposal-form,retry-failure,step-recovery}.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/welcome/page.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/journey/page.tsx`
- Create: `app/(portal)/(studio)/portal/admin/welcome/templates/page.tsx`
- Create: `app/(portal)/(studio)/portal/admin/welcome/templates/[templateId]/tasks/page.tsx`
- Create: `app/(portal)/(studio)/portal/admin/welcome/templates/[templateId]/tasks/[taskId]/page.tsx`

**Interfaces:**
- Consumes staff-scoped overview/draft/template/readiness DTOs and the existing/onboarding workspace command endpoints.
- Produces F18–F26, F33 and F35 in small presentation components; each action has a supported command, an explicit unavailable reason or a real navigable repair route.

- [ ] **Step 1: Write failing staff overview/builder assertions**

```tsx
assert.match(overviewHtml, /Draft journeys/)
assert.match(overviewHtml, /Needs attention/)
assert.match(builderHtml, /Prepare a warm welcome/)
assert.match(builderHtml, /Preflight/)
assert.match(blockedHtml, /Choose an authorised FSS sender/)
assert.doesNotMatch(blockedHtml, /<button[^>]*>Start journey<\/button>/)
```

- [ ] **Step 2: Run the focused staff tests to verify they fail**

Run: `node --import tsx --test components/portal/onboarding/staff-journey-overview.test.tsx components/portal/onboarding/staff-journey-builder.test.tsx`

Expected: FAIL because the staff FSS Studio components do not exist.

- [ ] **Step 3: Implement F18 list and F19–F23 builder over actual draft/preview commands**

Present client/agreement/template choices, content, people/access, sequence/tasks and preflight as labelled stages. Save uses Task 2 and shows the returned server save state; preview/start retains the existing exact PDF, email and confirmation flow. The activation button is disabled only when the server preflight names an unmet check, with an adjacent repair link. Use no direct `<button>`, `<input>`, `<select>`, `<textarea>` or checkbox controls where a Portal primitive is available.

- [ ] **Step 4: Implement F24/F25 monitoring and recovery**

Map `JourneyView`/jobs to human-readable status, due versus executed time, verified provider acceptance and safe retry/reconcile state. Preserve the existing generation/version commands. Pause/cancel notices must state that accepted effects cannot be recalled; unknown outcome presents reconcile, not retry.

- [ ] **Step 5: Implement F26/F33/F35 versioned template and checklist editing**

Use the Task 2 command boundary for named draft versions, task edit/reorder/dependency fields and publish. Client preview is generated from the same task DTO. Show an explicit warning that publishing creates a new version and active journeys retain their version.

- [ ] **Step 6: Run staff component, command and recovery tests**

Run: `node --import tsx --test components/portal/onboarding/staff-journey-overview.test.tsx components/portal/onboarding/staff-journey-builder.test.tsx components/operations/onboarding/journey-preview.test.tsx lib/operations/onboarding/recovery.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit founder welcome experience**

```bash
git add app/'(portal)'/'(studio)'/portal/admin/welcome app/'(portal)'/'(studio)'/portal/admin/clients/[organisationId]/journey components/portal/onboarding components/operations/onboarding
git commit -m "feat: redesign FSS Studio welcome journeys"
```

### Task 7: Add deterministic welcome visual evidence and update the matrix

**Files:**
- Create: `app/visual/fss-studio/[scenario]/welcome-visual-fixtures.tsx`
- Modify: `app/visual/fss-studio/[scenario]/visual-scenarios.tsx`
- Modify: `app/visual/fss-studio/visual-scenarios.test.tsx`
- Modify: `tests/e2e/fss-studio.visual.spec.ts`
- Create: `tests/e2e/fss-studio.visual.spec.ts-snapshots/{c02-client-getting-started,f18-studio-welcome-journeys,f19-studio-welcome-builder,f23-studio-welcome-preflight,f24-studio-welcome-active,f25-studio-welcome-recovery,f26-studio-welcome-templates,f33-studio-checklist-editor,c26-client-profile,c27-client-assets,c28-client-booking,c29-client-onboarding-complete,m02-client-getting-started,m08-studio-welcome-preflight}-*.png`
- Modify: `docs/design/fss-studio-experience/screen-coverage.csv`

**Interfaces:**
- Produces non-production deterministic scenarios for every Phase 4 screen state and explicit desktop/mobile screenshot names.
- Consumes only presentation DTO fixtures, never a live database, provider, token, route command or personal data.

- [ ] **Step 1: Add failing visual registry assertions**

```tsx
assert.ok(visualScenarios["client-getting-started"])
assert.ok(visualScenarios["studio-welcome-preflight"])
assert.ok(visualScenarios["studio-welcome-recovery"])
```

- [ ] **Step 2: Run the registry test to verify it fails**

Run: `node --import tsx --test app/visual/fss-studio/visual-scenarios.test.tsx`

Expected: FAIL because the Phase 4 scenarios are absent.

- [ ] **Step 3: Add desktop/mobile scenarios and update snapshots deliberately**

Register C02, C26–C29, F18–F26, F33, F35, M02 and M08 fixtures. Add screenshot assertions at 1440×1200 and 390×844 as appropriate. Generate macOS baselines locally, promote Linux `actual.png` files only from CI artifacts, and never copy baselines across operating systems.

- [ ] **Step 4: Update screen matrix evidence only for shipped routes**

For each Phase 4 row, record the actual functional test and both viewport visual assertions. Change a row to `verified` only after the real route, command/recovery test and both platform baselines exist. Preserve any unsupported row as `planned`, never mark a fixture-only surface verified.

- [ ] **Step 5: Run visual and matrix checks**

Run: `pnpm test:visual && pnpm verify:fss-studio-coverage`

Expected: PASS.

- [ ] **Step 6: Commit visual evidence**

```bash
git add app/visual/fss-studio tests/e2e/fss-studio.visual.spec.ts* docs/design/fss-studio-experience/screen-coverage.csv
git commit -m "test: cover FSS Studio welcome visuals"
```

### Task 8: Run Phase 4 gates and merge only when green

**Files:**
- Modify only files required to fix a verified gate failure.

- [ ] **Step 1: Inspect the complete branch diff**

Run: `git diff origin/main...HEAD --check && git status --short`

Expected: no whitespace errors or unexpected generated output.

- [ ] **Step 2: Run code, domain and integration gates**

Run: `pnpm typecheck && pnpm lint && node --import tsx --test components/portal/onboarding/*.test.tsx lib/operations/onboarding/*.test.ts && pnpm test:integration:operations && pnpm verify:fss-studio-coverage`

Expected: PASS.

- [ ] **Step 3: Run browser and production gates**

Run: `pnpm test:visual && pnpm build && pnpm perf:budget:homepage && pnpm test:public-redesign`

Expected: PASS.

- [ ] **Step 4: Open and merge the Phase 4 pull request only after every required check is green**

Run: `gh pr create --base main --head feat/fss-studio-redesign-phase-04-welcome --title "feat: redesign FSS Studio welcome journeys" --fill && gh pr checks <pr-number> --watch && gh pr merge <pr-number> --merge`

Expected: the merge is clean, all required checks pass, no production flag is enabled, and the next phase starts from merged remote main.

## Self-Review

- **Spec coverage:** Tasks 1–4 introduce the missing durable template/draft/task evidence required by D1–D5; Tasks 5–6 connect every Phase 4 client/founder screen to that source of truth; Task 7 adds visual/matrix evidence; Task 8 applies complete gates.
- **Security:** all mutable paths remain database functions behind verified portal or FSS-admin context; client input cannot grant access, claim payment/signature completion, bypass document scanning or enter another organisation.
- **Architecture:** templates, drafts, task evidence, client presentation and founder presentation have separate focused modules. Existing durable delivery/schedule effects remain unchanged.
- **Failure states:** stale template/draft/version, blocked prerequisites, template cycles, quarantined documents, unknown provider outcomes, revoked users and mobile narrow layouts have explicit owning tests.

## Execution Handoff

The user has explicitly approved phase-by-phase implementation, pull requests and merges. Execute natively on `feat/fss-studio-redesign-phase-04-welcome`, preserve all production gates and settings, and begin Phase 5 only after the confirmed Phase 4 merge.
