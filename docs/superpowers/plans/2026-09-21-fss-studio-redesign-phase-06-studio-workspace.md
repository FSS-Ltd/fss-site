# FSS Studio Redesign Phase 6 Studio Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the nine approved Studio workspace rows: F02–F04, F27–F31 and S06. Each route must be an authenticated FSS-admin workspace, use the shared Portal primitives and Lucide icons, read real Operations data, and issue only explicitly supported, audited commands.

**Architecture:** Keep Studio pages as thin server route adapters: validate route/query values, obtain a verified FSS-admin context, call a focused Operations read or command boundary, then render a small presentational component. Add a `lib/operations/studio` layer for new Staff projections and commands instead of duplicating SQL in pages. Reuse `withFssAdminTransaction`, the existing founder-role Operations database connection, request/agreement/onboarding services and the existing Portal UI primitives. Preserve immutable provider ownership: billing and notification views are operational projections only, while invitation and project mutations retain existing review, idempotency and audit requirements.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, PostgreSQL/RLS migrations, Zod, CSS Modules, Portal shadcn-compatible UI primitives, Lucide, Node test runner and Playwright.

**Approved source:** `docs/superpowers/specs/2026-09-20-fss-studio-experience-redesign-design.md`, `docs/design/fss-studio-experience/03-screen-contracts.md` F02–F04, F27–F31 and S06, `docs/design/fss-studio-experience/02-workflow-contracts.md`, and `docs/design/fss-studio-experience/screen-coverage.csv`.

## Scope and success criteria

- F02 `/portal/admin/clients`: a searchable, paginated client register with authorised owner, active-work and next-action data. Rows retain the search term and page when navigated.
- F03 `/portal/admin/clients/:organisationId`: a real client hub for projects, agreements, journey, access, billing and public-delivery follow-up. Every action retains the selected organisation.
- F04 `/portal/admin/clients/new`: creates a draft organisation and primary contact only after duplicate validation. It never sends an invitation, email or provider request.
- F27 `/portal/admin/billing`: shows retained invoice figures, provider references, current exceptions and audit observations. It does not mark invoices paid or retry a provider operation.
- F28 `/portal/admin/portal-access`: lists scoped memberships and invitations, and supports review-gated client access issue/revoke actions through the current invitation service. The UI accurately reports provider delivery success, pending or failure; tests do not send mail or create live invitations.
- F29 `/portal/admin/notifications`: shows notification-delivery status and safe diagnostics. It filters failed/unknown outcomes, preserves pagination, and never replays an entire journey.
- F30 `/portal/admin/settings`: persists a validated Studio settings **draft** only. It has no authority to change secrets, enable providers, modify a live sender or rewrite an active approval.
- F31 `/portal/admin/projects/:projectId/edit`: reads and updates one authorised project and its milestones with optimistic concurrency, explicit public/internal separation and existing review-reference auditing.
- S06 `/portal/admin/welcome?state=blocked`: loads the current server-derived journey-preflight failures and repair paths, preserves draft state, and leaves activation unavailable until the existing server command revalidates readiness.
- A direct `/admin` request on localhost, a preview hostname or a non-portal host rewrites to the protected internal Studio route. The existing `fssStudioEnabled()` layout gate and `requireFssAdmin` checks remain authoritative.

## Global constraints

- Do not enable or alter `OPERATIONS_FSS_STUDIO_ENABLED`, `OPERATIONS_PORTAL_PREFIX_FREE_ENABLED`, billing, signing, onboarding or email-delivery flags. Do not run migrations against production, send a message, issue an invitation, create a payment session or call a provider while implementing or testing this phase.
- Use `PageHeader`, `PortalCard`, `PortalActionLink`, `PortalButton`, `PortalField`, `PortalSelect`, `PortalTextarea`, `Notice` and `StatusBadge` for every new/touched control. Use existing Lucide icons only; no bespoke SVG icons or new component dependency.
- Every browser-supplied UUID, page, query, expected version and command body is parsed at the server boundary. `withFssAdminTransaction` must re-check the active staff membership on every data access and mutation.
- Keep client data tenant-scoped. A missing, malformed or unauthorised client/project/invitation record returns the normal no-access/not-found outcome without exposing another client’s information.
- Billing remains projection-only. An invoice payment status is never inferred from a browser return, a retry click or a view action. Reconciliation stays provider-owned and uses retained provider identifiers and evidence.
- Notification recovery remains one-delivery-at-a-time and idempotent. Do not add an action that resends an entire journey, and do not claim a provider delivery was confirmed when it is only queued or unknown.
- Studio settings drafts are intentionally operational notes, not runtime configuration. Sender credentials, provider keys, existing approved content, configuration flags and current approval snapshots remain outside the form and cannot change through this route.
- Visual fixtures must be deterministic, synthetic and guarded by `FSS_VISUAL_TESTS_ENABLED`. Never use real customers, provider data, credentials, URLs or tokens.

## Review focus

1. A client create request with a duplicate legal/display name, malformed email, arbitrary timezone or repeated submission must fail safely and create neither an organisation nor contact. F04 cannot issue an invitation as a side effect.
2. A staff member without an active membership, or a request for another tenant’s client/project, must not see or mutate client detail, project, access, billing, notification or journey data.
3. F28 must preserve the current invitation provider flow, including reuse/expiry/revocation semantics and server-issued review references. Tests use injected provisioners, never Clerk/Resend.
4. F27 and F29 must expose enough retained reference/audit information to guide follow-up, but never payment credentials, bearer URLs, email bodies, tokens or provider secrets.
5. F30 and S06 must not make a draft setting or stale client preflight sufficient to start a journey. Existing command-side `workspaceReadiness`/activation validation stays the final decision.
6. `/admin` fallback routing must only surface the existing protected internal route. It must not bypass the Studio release gate, Clerk verification, staff membership check or host-aware canonical routing.

### Task 0: Record the Phase 6 plan

**Files:**

- Create: `docs/superpowers/plans/2026-09-21-fss-studio-redesign-phase-06-studio-workspace.md`

- [x] **Step 1: Commit the approved bounded plan**

```bash
git add docs/superpowers/plans/2026-09-21-fss-studio-redesign-phase-06-studio-workspace.md
git commit -m "docs: plan phase 6 studio workspace redesign"
```

### Task 1: Make Studio routing resilient and implement client register/create boundaries (F02, F04)

**Files:**

- Create: `lib/operations/studio/clients.ts`
- Create: `lib/operations/studio/clients.test.ts`
- Create: `lib/operations/http/staff-client-route.ts`
- Create: `app/api/portal/admin/clients/route.ts`
- Create: `components/portal/studio/client-register.tsx`
- Create: `components/portal/studio/client-form.tsx`
- Create: `components/portal/studio/client-form.test.tsx`
- Create: `components/portal/studio/studio-workspace.module.css`
- Create: `app/(portal)/(studio)/portal/admin/clients/new/page.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/clients/page.tsx`
- Modify: `proxy.ts`
- Modify: `proxy.test.ts`
- Modify: `components/portal/shell/navigation.ts`

**Interfaces:**

- `listStudioClients(db, admin, { query, page }): Promise<StudioClientPage>` returns only the authorised register projection: organisation identity, primary account owner label, active project/request counts, current next-action label/href and pagination state.
- `createStudioClient(db, admin, input, correlationId): Promise<{ organisationId: string }>` validates display/legal names, IANA timezone, primary-contact name/email/role and a review reference; it detects duplicate candidates in the staff transaction and inserts the organisation/contact atomically. No invitation, membership or provider operation appears in this service.
- `createStaffClientRoute()` uses the existing registered-origin and bounded JSON handling pattern. It authorises with `getPortalIdentity` + `requireFssAdmin`, invokes `createStudioClient`, maps validation/conflict/unauthorised errors safely and returns only an opaque created ID.
- The `/admin` path fallback is a proxy rewrite to `/portal/admin...`, included in the portal-middleware path set. It does not alter the canonical portal-host redirect/rewrite helpers or the Studio release gate.

- [ ] **Step 1: Add failing client boundary and fallback-route tests**

```ts
await assert.rejects(
  createStudioClient(db, admin, duplicateInput, correlationId),
  /duplicate/i,
);
assert.deepEqual(
  await listStudioClients(db, admin, { query: "north", page: 1 }),
  expectedClientPage,
);
assert.match(renderToStaticMarkup(<StudioClientForm />), /Creates the client record only/);
assert.doesNotMatch(renderToStaticMarkup(<StudioClientForm />), /Send invitation/);
```

Add a `proxy.test.ts` case for `https://preview.example.test/admin/clients?query=north` asserting a rewrite to `/portal/admin/clients?query=north`; retain the existing portal-host tests for canonical prefix-free routing.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `node --import tsx --test lib/operations/studio/clients.test.ts components/portal/studio/client-form.test.tsx proxy.test.ts`

Expected: FAIL because the Studio client boundary, form and fallback routing do not yet exist.

- [ ] **Step 3: Implement F02 and F04 with authorised, reusable Portal UI**

Use a server-owned search query, preserve it in pagination and use `PortalActionLink` for client-row/detail navigation. The F02 header action opens `/portal/admin/clients/new` through `portalPath`. Render owner, active work and next action from the server DTO; do not synthesize business facts in the component.

Implement the client form as a client component that submits the strict JSON command to `/api/portal/admin/clients`, presents field/server errors accessibly, disables while pending, and redirects to the returned F03 client URL only after a successful commit. The form contains organisation and primary-contact sections plus the explicit “What saving does” notice from F04. The page itself only verifies the Studio guard/identity before rendering the component.

- [ ] **Step 4: Update Studio navigation and direct-admin fallback safely**

Set the Studio `portal-access` navigation item to `/portal/admin/portal-access` only when its route exists. Extend `isPortalRequest` and the proxy response with the narrow `/admin` fallback rewrite, retaining its query string and never applying it to API/static paths. The rewritten route continues through the existing Admin layout, `fssStudioEnabled()` and page-level `requireFssAdmin` checks.

- [ ] **Step 5: Run focused tests**

Run: `node --import tsx --test lib/operations/studio/clients.test.ts components/portal/studio/client-form.test.tsx components/portal/shell/navigation.test.tsx proxy.test.ts`

Expected: PASS with server-side duplicate rejection, no invitation side effect, resilient protected `/admin` routing and expected navigation.

- [ ] **Step 6: Commit client register/create and routing work**

```bash
git add proxy.ts proxy.test.ts lib/operations/studio lib/operations/http/staff-client-route.ts app/api/portal/admin/clients app/'(portal)'/'(studio)'/portal/admin/clients components/portal/studio components/portal/shell/navigation.ts
git commit -m "feat: add Studio client register and creation workspace"
```

### Task 2: Build the client hub and project editor (F03, F31)

**Files:**

- Create: `lib/operations/projects/staff-service.ts`
- Create: `lib/operations/http/staff-project-route.ts`
- Create: `app/api/portal/admin/projects/[projectId]/route.ts`
- Create: `app/(portal)/(studio)/portal/admin/projects/[projectId]/edit/page.tsx`
- Create: `components/portal/studio/client-detail.tsx`
- Create: `components/portal/studio/project-form.tsx`
- Create: `components/portal/studio/project-form.test.tsx`
- Modify: `lib/operations/studio/clients.ts`
- Modify: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/page.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/projects/page.tsx`
- Modify: `components/portal/studio/studio-workspace.module.css`

**Interfaces:**

- `loadStudioClient(db, admin, organisationId): Promise<StudioClientDetail | null>` is the F03 hub projection. It supplies organisation metadata, owner/contact summaries, active project/request counts, next invoice amount when a retained billing projection exists, agreement/journey/project links and prerequisite repair links. It never exposes unrelated organisations or payment/invitation secrets.
- `loadStaffProjectForEdit(db, admin, projectId): Promise<StaffProjectDetail | null>` loads the project, current version, approved agreement choices, milestones and cleared/retained client-publishable document references under the admin transaction.
- `executeStaffProjectCommand(...)` mirrors the existing staff agreement/request pattern: validate the existing `projectCommandSchema`, re-check staff membership with `withFssAdminTransaction`, use the stable admin audit actor and preserve `ProjectConflict` optimistic concurrency behaviour.
- `staffProjectRoute()` authorises the verified FSS admin and routes the existing `createAgreementRouteHandler`-style bounded JSON command to `executeStaffProjectCommand`; it never accepts a browser organisation ID independent of the loaded project scope.

- [ ] **Step 1: Add failing project/hub presentation and command tests**

```tsx
assert.match(
  renderToStaticMarkup(<StudioClientDetail client={northstar} />),
  /Design is ready for Alex’s review/,
);
assert.match(
  renderToStaticMarkup(<StudioProjectForm project={project} />),
  /Public project details/,
);
assert.doesNotMatch(
  renderToStaticMarkup(<StudioProjectForm project={project} />),
  /Internal notes.*client view/,
);
```

Add service tests for a valid expected-version update, stale-version conflict, forged project ID and an internal/quarantined document excluded from publishable options.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `node --import tsx --test lib/operations/projects/service.test.ts components/portal/studio/project-form.test.tsx`

Expected: FAIL because no Staff project command boundary, project form or client-hub projection exists.

- [ ] **Step 3: Implement F03 as an actual client workspace**

Render F03 through `PageHeader`, metrics, `PortalCard`, `StatusBadge`, notices and `PortalActionLink`. Its agreement, journey, access, billing, project and request actions use `portalPath` and preserve `organisationId`. Render only available metrics with a clear unavailable state; never convert an absent billing projection into £0. Use next-action DTOs based on persisted delivery/status data, with a safe detail link.

- [ ] **Step 4: Implement F31 using the existing project domain command**

Build a form with labelled public title, outcome, owner, next update, public milestones and a distinct internal-notes section. The client presentation preview must contain only client-visible data. Submit update/milestone commands with the current expected version and a required review reference; handle 409 by retaining user input and explaining that a reload is required. Authorised document choices must require cleared scan, non-revoked retention and client visibility. Do not add a document publication mutation in this phase.

- [ ] **Step 5: Run focused project and tenant-scope checks**

Run: `node --import tsx --test lib/operations/projects/service.test.ts lib/operations/requests/staff-client-repository.test.ts components/portal/studio/project-form.test.tsx`

Expected: PASS with FSS-admin-only reads/commands, stale-write protection and explicit public/internal separation.

- [ ] **Step 6: Commit client hub and project editor**

```bash
git add lib/operations/projects/staff-service.ts lib/operations/studio/clients.ts lib/operations/http/staff-project-route.ts app/api/portal/admin/projects app/'(portal)'/'(studio)'/portal/admin/clients/'[organisationId]'/page.tsx app/'(portal)'/'(studio)'/portal/admin/projects components/portal/studio
git commit -m "feat: add Studio client hub and project editor"
```

### Task 3: Add billing, notification and journey-recovery operational views (F27, F29, S06)

**Files:**

- Create: `lib/operations/studio/operations-queues.ts`
- Create: `lib/operations/studio/operations-queues.test.ts`
- Create: `components/portal/studio/billing-operations.tsx`
- Create: `components/portal/studio/notification-delivery.tsx`
- Create: `components/portal/studio/journey-recovery.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/billing/page.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/notifications/page.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/welcome/page.tsx`
- Modify: `components/portal/studio/studio-workspace.module.css`
- Modify: `lib/operations/onboarding/queries.ts`
- Modify: `lib/operations/onboarding/recovery.test.ts`

**Interfaces:**

- `listStudioBillingOperations(db, admin, { organisationId, page })` returns monthly-due/overdue/reconciliation totals plus action rows from retained invoices/exceptions. Each row includes only organisation name, safe provider invoice reference, retained amount/due date, exception category, last observation and matching audit timestamp.
- `listStudioNotifications(db, admin, { status, page })` returns the existing request-email delivery projection with a server-parsed filter for all, pending/retry, succeeded and held/needs-attention. It displays event, client, recipient-safe label, attempt state, next retry/last update and links only to authorised request detail.
- `loadStaffJourneyRecovery(db, admin)` derives current blocked journey-draft checks from persisted workspace, agreements, contacts, templates, journey state and deployment-owned provider availability. It returns explicit `OnboardingReadinessCheck` rows and repair paths; it does not trust a browser preflight result or activate a journey.

- [ ] **Step 1: Add failing queue/recovery tests**

```ts
assert.equal(queue.overdueTotalPence, "240000");
assert.match(queue.items[0].providerReference, /^in_/);
assert.equal(recovery.canStart, false);
assert.deepEqual(recovery.checks.find((check) => check.id === "agreement"), {
  id: "agreement",
  status: "needs_action",
  reason: "Refresh the current agreement before starting this journey.",
  href: "/portal/admin/agreements",
});
```

Test billing/notification filters, pagination and staff scope. Test a stale agreement draft, inactive contact, absent template and provider configuration failure in journey recovery. Test that a passing in-memory UI state never changes `canStart` without the server recovery/command validation.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `node --import tsx --test lib/operations/studio/operations-queues.test.ts lib/operations/onboarding/recovery.test.ts`

Expected: FAIL because Studio billing/notification queue DTOs and global server-derived blocked-journey recovery are not implemented.

- [ ] **Step 3: Implement F27 and F29 as retained operational projections**

Render F27 totals, provider references, due dates, exception statuses, audit/last-observed timestamps and a client-context link using shared cards/badges. Render a clear “provider reconciliation required” notice where appropriate. Do not render a payment-completion control.

Render F29 delivery totals, status filters, independent in-app/email explanation, attempt count and last/next retry. Its “open failed deliveries” action is the server-side held/unknown filter. Any recovery route must be a focused existing worker/service command with durable idempotency; if no such command exists, display the retained recovery status and repair destination rather than a fake retry control.

- [ ] **Step 4: Implement S06 with server-derived readiness and repair destinations**

When `state=blocked`, the welcome route renders `JourneyRecovery` instead of a generic list. Show passed and failed checks, reason and `PortalActionLink` repair actions from the server DTO. Keep start/activation absent or disabled with a reason until the existing journey command returns a newly passing server preflight. Preserve journey drafts and do not persist client-side validation.

- [ ] **Step 5: Run focused queue/recovery tests**

Run: `node --import tsx --test lib/operations/studio/operations-queues.test.ts lib/operations/billing/collections.test.ts lib/operations/requests/notifications.test.ts lib/operations/onboarding/readiness.test.ts lib/operations/onboarding/recovery.test.ts`

Expected: PASS with provider-owned reconciliation, per-delivery status evidence and server-only journey readiness.

- [ ] **Step 6: Commit operations queues and blocked recovery**

```bash
git add lib/operations/studio/operations-queues.ts lib/operations/studio/operations-queues.test.ts lib/operations/onboarding/queries.ts lib/operations/onboarding/recovery.test.ts app/'(portal)'/'(studio)'/portal/admin/billing app/'(portal)'/'(studio)'/portal/admin/notifications app/'(portal)'/'(studio)'/portal/admin/welcome components/portal/studio
git commit -m "feat: add Studio operations queues and journey recovery"
```

### Task 4: Move client portal access into Studio (F28)

**Files:**

- Create: `lib/operations/studio/portal-access.ts`
- Create: `lib/operations/studio/portal-access.test.ts`
- Create: `lib/operations/http/staff-portal-access-route.ts`
- Create: `app/api/portal/admin/portal-access/route.ts`
- Create: `app/(portal)/(studio)/portal/admin/portal-access/page.tsx`
- Create: `components/portal/studio/portal-access-workspace.tsx`
- Create: `components/portal/studio/portal-access-workspace.test.tsx`
- Modify: `components/portal/shell/navigation.ts`
- Modify: `components/portal/studio/studio-workspace.module.css`

**Interfaces:**

- `listStudioPortalAccess(db, admin, input): Promise<StudioPortalAccessOverview>` uses the existing active membership/invitation records to return F28’s contact, organisation, role, state, expiry/last-verification and safe filter/pagination data under an FSS admin transaction.
- `applyStaffPortalAccessOperation(db, admin, operation, origin, provisioner)` shares the validated operation schemas and durable invitation/revocation functions, but runs as an active FSS admin with a stable audit actor. It returns a deliberately narrow outcome (`sent`, `pending`, `failed`, `revoked`) and never exposes activation URLs or provider identifiers.
- `staffPortalAccessRoute()` uses registered-origin, content-type and payload limits, verifies staff identity and maps Zod/conflict/authorisation/provider failures to stable responses. Provider adapters remain injected in tests.

- [ ] **Step 1: Add failing access projection/command/component tests**

```tsx
assert.match(
  renderToStaticMarkup(<PortalAccessWorkspace data={overview} />),
  /People and portal access/,
);
assert.match(html, /Before sending/);
assert.doesNotMatch(html, /activationUrl/);
```

Test expired/pending/active/revoked rows, tenant-scoped client invitations, role validation, active-invitation reuse, exact review-reference handling, provider failure recording and revocation impact. Verify that a forged admin context, invalid origin or oversized command cannot call the provisioner.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `node --import tsx --test lib/operations/studio/portal-access.test.ts components/portal/studio/portal-access-workspace.test.tsx lib/operations/auth/staff-invitations.test.ts`

Expected: FAIL because the Studio access workspace and Staff command route do not exist.

- [ ] **Step 3: Implement F28 with explicit, audited operations**

Use `PageHeader`, `PortalCard`, `PortalSelect`, `PortalField`, `PortalButton`, `Notice` and `StatusBadge`. The access register filters and pagination are server-driven. The invite form needs a selected active client/contact, a permitted role and review reference; it offers only the existing client roles. Review/confirm content explains the implications before an invitation request. Revoke requires a separate explicit review reference and confirms that active membership is removed. Do not silently change a role when a signer/contact is added.

- [ ] **Step 4: Run focused portal-access tests**

Run: `node --import tsx --test lib/operations/studio/portal-access.test.ts components/portal/studio/portal-access-workspace.test.tsx lib/operations/auth/operator.test.ts lib/operations/auth/staff-invitations.test.ts`

Expected: PASS with tenant boundaries, durable/reused invitations, no leaked activation URL and explicit review-gated mutations.

- [ ] **Step 5: Commit Studio portal access**

```bash
git add lib/operations/studio/portal-access.ts lib/operations/studio/portal-access.test.ts lib/operations/http/staff-portal-access-route.ts app/api/portal/admin/portal-access app/'(portal)'/'(studio)'/portal/admin/portal-access components/portal/studio components/portal/shell/navigation.ts
git commit -m "feat: add Studio portal access workspace"
```

### Task 5: Persist safe Studio setting drafts (F30)

**Files:**

- Create: `supabase/migrations/20260921170000_operations_studio_settings_drafts.sql`
- Create: `lib/operations/studio/settings.ts`
- Create: `lib/operations/studio/settings.test.ts`
- Create: `lib/operations/http/staff-settings-route.ts`
- Create: `app/api/portal/admin/settings/route.ts`
- Create: `components/portal/studio/studio-settings.tsx`
- Create: `components/portal/studio/studio-settings.test.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/settings/page.tsx`
- Modify: `components/portal/studio/studio-workspace.module.css`

**Interfaces:**

- The migration introduces an append-only/revisioned `operations.studio_settings_drafts` record protected by the existing founder role/RLS conventions. It holds bounded display identity, approved reply-to selection (or `null`), IANA timezone, response-expectation and delivery-capacity draft data, author/audit correlation and version. It grants no runtime configuration authority.
- `loadStudioSettings(db, admin)` combines the latest draft with deployment-owned integration health and explicit provider availability. `saveStudioSettingsDraft(db, admin, input, correlationId)` parses a strict payload, updates only the draft and records audit evidence; it cannot read/write secrets, feature gates or active template/approval data.
- `staffSettingsRoute()` follows the same verified-staff/registered-origin request pattern and returns only a safe revision/timestamp display DTO.

- [ ] **Step 1: Add failing settings model and presentation tests**

```tsx
assert.match(renderToStaticMarkup(<StudioSettings settings={settings} />), /Studio identity/);
assert.match(html, /Save settings draft/);
assert.match(html, /does not rewrite active approvals/);
```

Test invalid timezone/reply-to input, absent membership, draft version conflict, audit/correlation retention and the guarantee that runtime environment/provider values are not mutable through the settings schema or route.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `node --import tsx --test lib/operations/studio/settings.test.ts components/portal/studio/studio-settings.test.tsx`

Expected: FAIL because no Studio settings-draft model, API or Portal presentation exists.

- [ ] **Step 3: Implement migration, safe draft command and F30 presentation**

Use a clear fieldset structure for identity, response expectation and delivery capacity. Present timezone explicitly and render integration health as read-only status badges. A sender may only be selected from a server-provided approved list; if none is configured, state that deployment configuration is required. Preserve typed invalid/conflict/network feedback, disable the submit action while pending and show a saved draft revision/timestamp after successful commit. The high-impact side-effect notice is required.

- [ ] **Step 4: Run settings migration and focused tests**

Run: `node --import tsx --test lib/operations/studio/settings.test.ts components/portal/studio/studio-settings.test.tsx && pnpm verify:migrations`

Expected: PASS with no provider/secret mutation path and a valid reversible migration definition.

- [ ] **Step 5: Commit Studio settings drafts**

```bash
git add supabase/migrations/20260921170000_operations_studio_settings_drafts.sql lib/operations/studio/settings.ts lib/operations/studio/settings.test.ts lib/operations/http/staff-settings-route.ts app/api/portal/admin/settings app/'(portal)'/'(studio)'/portal/admin/settings components/portal/studio
git commit -m "feat: add Studio settings drafts"
```

### Task 6: Add visual evidence, coverage evidence and Phase 6 validation

**Files:**

- Modify: `app/visual/fss-studio/[scenario]/visual-scenarios.tsx`
- Modify: `app/visual/fss-studio/visual-scenarios.test.tsx`
- Modify: `tests/e2e/fss-studio.visual.spec.ts`
- Modify: `docs/design/fss-studio-experience/screen-coverage.csv`
- Create/modify: `tests/visual/snapshots/fss-studio/*.png`

**Fixtures:**

- `studio-clients` → F02
- `studio-client-detail` → F03
- `studio-client-create` → F04
- `studio-billing-operations` → F27
- `studio-portal-access` → F28
- `studio-notification-delivery` → F29
- `studio-settings` → F30
- `studio-project-edit` → F31
- `studio-journey-blocked` → S06

- [ ] **Step 1: Add failing visual-scenario registry and browser assertions**

Register all nine synthetic scenarios in the test-only resolver. Add desktop and mobile Playwright entries with the exact F02–F04, F27–F31 and S06 filenames/headings. Assert the Studio shell and mobile “More” navigation remain available where applicable.

- [ ] **Step 2: Run the focused visual registry test and confirm it fails**

Run: `node --import tsx --test app/visual/fss-studio/visual-scenarios.test.tsx`

Expected: FAIL until the nine Phase 6 fixtures are registered.

- [ ] **Step 3: Build deterministic fixtures and update baselines**

Use synthetic Northstar/Harbour/Elm-style display values only. Render each new component inside `StudioShell`; no visual route touches Operations, Clerk or a provider. Capture the desktop and mobile visual group locally, inspect changed screenshots, and promote only same-platform baseline files. Keep existing non-Phase-6 snapshots untouched.

- [ ] **Step 4: Mark coverage after evidence exists**

Update only F02, F03, F04, F27, F28, F29, F30, F31 and S06 to `verified` after their component/domain tests and desktop/mobile baseline files pass. Do not change phase allocation or mark any remaining planned matrix row verified.

- [ ] **Step 5: Run the Phase 6 and repository quality gates**

Run, in order:

```bash
pnpm typecheck
pnpm lint
pnpm verify:migrations
pnpm verify:fss-studio-coverage
pnpm test:unit
pnpm test:visual -- --grep "Phase 6|F02|F03|F04|F27|F28|F29|F30|F31|S06"
pnpm build
pnpm perf:budget:homepage
pnpm test:public-redesign
```

Run `pnpm test:coverage:operations` only when a valid non-production `OPERATIONS_TEST_DATABASE_URL` is available; never substitute production credentials. In CI, require the Operations coverage/database job, complete desktop/mobile screenshot comparison, lint/build, Lighthouse and Vercel preview checks before merging.

- [ ] **Step 6: Review, commit and open the Phase 6 PR**

Review every changed file, inspect the diff for raw controls/new SVGs, unauthorised command paths, leaked internal/provider values and stale coverage status. Then commit:

```bash
git add app/visual/fss-studio tests/e2e/fss-studio.visual.spec.ts tests/visual/snapshots/fss-studio docs/design/fss-studio-experience/screen-coverage.csv
git commit -m "test: add Phase 6 Studio workspace visual coverage"
git push -u origin feat/fss-studio-redesign-phase-06-studio-workspace
gh pr create --base main --head feat/fss-studio-redesign-phase-06-studio-workspace --title "feat: deliver Phase 6 Studio workspace" --body "Implements F02-F04, F27-F31 and S06 with authenticated Operations read/command boundaries, shadcn-compatible Portal UI, desktop/mobile evidence, and a guarded /admin fallback rewrite. Studio production flags remain unchanged."
```

Merge only after every required PR check is green. Keep `OPERATIONS_FSS_STUDIO_ENABLED` disabled in production until the user's separate authenticated workflow/visual rollout approval.
