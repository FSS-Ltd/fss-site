# FSS Studio Phase 7 Request Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the 13 remaining request-flow rows in the approved FSS Studio coverage matrix: client detail, feedback, completion and recovery states; staff delivery detail, scope, create and move flows; and authenticated review/completion emails.

**Architecture:** Retain server-authoritative request data, transition validation, expected-version concurrency, audit history and notification outbox behavior. Add small route-specific compositions over the existing request components so the detail and dedicated review flows are distinct. A founder-only create endpoint performs an explicit staff recheck and delegates to a narrowly scoped SQL function. Email rendering moves to a pure template builder, preserving delivery dispatch and deduplication while making the HTML and text content directly testable. Static synthetic fixtures demonstrate each approved state but cannot be enabled in production.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, CSS Modules, Portal shadcn-compatible primitives, Lucide React, Zod, PostgreSQL migrations, Node test runner, Playwright.

**Spec:** `docs/design/fss-studio-experience/02-workflow-contracts.md`, `docs/design/fss-studio-experience/03-screen-contracts.md`, `docs/design/fss-studio-experience/04-design-system.md`, `docs/design/fss-studio-experience/05-handoff-and-validation.md`, and `docs/design/fss-studio-experience/screen-coverage.csv`.

## Global Constraints

- Keep `OPERATIONS_FSS_STUDIO_ENABLED === "true"` as the only production Studio enablement gate. Do not change environment values or deploy production.
- Preserve all existing authentication, membership, FSS-admin rechecks, capability checks, expected-version conflicts, transition guards, audit records and notification delivery retries.
- Use the existing Portal shadcn-compatible controls and Lucide icon set. New or touched controls must not introduce bespoke buttons, fields, selects or SVG icons.
- Keep client request drafts only in memory. A failed request or conflict retains local form state, but confidential feedback must not be serialized into URLs or browser storage.
- A staff-created request starts in `new` with `assessment_pending`; it cannot silently mark scope approved, plan work or bypass a client/project relationship.
- Email actions must use regular authenticated portal links. A GET must never record a review decision, and email must not attach private deliverables.
- Fixtures contain only synthetic data, remain gated by `FSS_VISUAL_TESTS_ENABLED=true`, and stay unavailable in production.

## Review Focus

- C08 and C09 remain different client journeys: the detail shows status, activity and the next safe action, while the review route identifies the exact version before acceptance or feedback.
- A stale feedback attempt preserves the typed message, requires the latest version before a retry and never overwrites a newer review decision.
- The staff create form verifies a real active client/project pairing on the server, starts scope assessment pending and retains its draft after an HTTP failure.
- The move sheet provides the keyboard/tap alternative to drag and retains focus on the original card when cancelled.
- A completion email clearly distinguishes client acceptance from FSS closure, has a plain-text alternative, includes no secrets or private attachments and sends the recipient to an authenticated portal page.

---

### Task 1: Add direct client review, feedback, completion and conflict compositions

**Files:**
- Create: `app/(portal)/(client)/portal/requests/[requestId]/review/page.tsx`
- Modify: `app/(portal)/(client)/portal/requests/[requestId]/page.tsx`
- Modify: `components/portal/requests/request-detail.tsx`
- Modify: `components/portal/requests/review-actions.tsx`
- Modify: `components/portal/requests/accessibility.test.tsx`

**Interfaces:**
- Consumes: the existing authorised `ClientRequestDetail`, `portalRequestCommandSchema` and expected version/review cycle fields.
- Produces: C08 at the detail route; C10 when feedback is selected; C11 when the authoritative status is done; S03 after a genuine conflict; and a dedicated C09/M05 review page.

- [ ] **Step 1: Add failing server-render assertions for a detail-only action, the dedicated review page props, changes feedback, a live conflict recovery notice and accepted-versus-closed completion copy.**

```tsx
assert.doesNotMatch(detailHtml, /Accept v1/)
assert.match(reviewHtml, /Accept v1/)
assert.match(changesHtml, /What needs changing\?/)
assert.match(conflictHtml, /Review the latest version/)
```

- [ ] **Step 2: Run the focused request component test and confirm the assertions fail because review controls still render inside the generic detail and cannot receive route state.**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx`

Expected: FAIL for the new route-state and composition assertions.

- [ ] **Step 3: Implement the smallest route-aware composition.**

Keep `RequestDetail` responsible for public request facts, files, history and conversation. Add a named `showReviewActions` composition prop rather than duplicating the detail. Let `ReviewActions` receive an initial decision and an optional displayed conflict state; it keeps the feedback draft in component state after a real 409 response. The detail page links safe reviewable work to `/portal/requests/:requestId/review`; the dedicated route loads the same authorised request and only foregrounds the exact-version decision UI. Completion rendering derives only from the persisted request status/review history and keeps administrative closure distinct.

- [ ] **Step 4: Re-run the focused request component and action tests.**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx components/portal/requests/actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the client request-state implementation.**

```bash
git add app/'(portal)'/'(client)'/portal/requests components/portal/requests
git commit -m "feat: complete client request review states"
```

### Task 2: Make actual empty, no-project and loading request states explicit and shadcn-consistent

**Files:**
- Create: `app/(portal)/(client)/portal/requests/loading.tsx`
- Modify: `app/(portal)/(client)/portal/requests/page.tsx`
- Modify: `components/portal/requests/board.tsx`
- Modify: `components/portal/requests/request-form.tsx`
- Modify: `components/portal/requests/accessibility.test.tsx`

**Interfaces:**
- Consumes: authorised request collections and project choices.
- Produces: real empty S01, zero-project S02, route-level loading S09 and a board/filter interface composed with Portal shadcn-compatible controls.

- [ ] **Step 1: Add failing assertions for S01’s two creation routes, S02’s support recovery and S09’s single accessible structural loading status.**

```tsx
assert.match(emptyHtml, /Create first request/)
assert.match(noProjectHtml, /Ask FSS to set up your project/)
assert.match(loadingHtml, /aria-busy="true"/)
assert.equal((loadingHtml.match(/Loading your requests/g) ?? []).length, 1)
```

- [ ] **Step 2: Run the focused tests and confirm they fail for the route-level loading component and the shadcn control composition.**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement the authoritative states.**

Render empty only from an empty authorised collection and no-project only from an empty authorised project list. Add the App Router loading boundary using `RequestBoardSkeleton`; do not use `state` query parameters to hide live records. Replace board filter controls with `PortalField`, `PortalSelect` and `PortalButton`, preserving native semantic form submission and all filter context. Keep the no-project setup link scoped to the active organisation and make clear that it does not create a request.

- [ ] **Step 4: Re-run the focused test.**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the client recovery and loading states.**

```bash
git add app/'(portal)'/'(client)'/portal/requests components/portal/requests
git commit -m "feat: complete request recovery states"
```

### Task 3: Complete staff request detail, scope and accessible move-sheet state

**Files:**
- Modify: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/requests/[requestId]/page.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/delivery/page.tsx`
- Modify: `components/portal/requests/staff-delivery-board.tsx`
- Modify: `components/portal/requests/staff-request-actions.tsx`
- Modify: `components/portal/requests/founder-action-fields.tsx`
- Modify: `components/portal/requests/accessibility.test.tsx`

**Interfaces:**
- Consumes: staff-authorised request detail/board projections, valid state-transition commands and signed agreement choices.
- Produces: F06 internal/public request workspace, F08 scope assessment, and S08 focus-managed review move sheet without bypassing the existing command endpoint.

- [ ] **Step 1: Add failing assertions for the query-selected scope composer, required scope rationale, move-sheet review evidence and move-sheet cancellation semantics.**

```tsx
assert.match(scopeHtml, /Scope decision/)
assert.match(scopeHtml, /Scope explanation/)
assert.match(moveHtml, /Nothing has moved yet/)
assert.match(moveHtml, /Open request workspace/)
```

- [ ] **Step 2: Run the focused request component test and confirm the selected-mode/move-sheet assertions fail.**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement mode mapping and a reusable controlled move sheet.**

Map only known `mode` values to existing valid staff actions (`scope` to `classify_scope`, `review` to `review`) and ignore unknown values. Extract the board’s move sheet into a focused component controlled by an optional initial request for visual/direct route presentation, retaining drag as convenience only. Its action must route evidence-requiring transitions to the F06 workspace, leave the request unchanged until an existing server command succeeds, and restore focus to its trigger on cancel. Make scope output explicit for included, assessment pending, quote required and declined cases without implying a quote is automatically approved.

- [ ] **Step 4: Re-run staff request UI and command tests.**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx components/portal/requests/actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the staff request workspace states.**

```bash
git add app/'(portal)'/'(studio)'/portal/admin/clients/'[organisationId]'/requests app/'(portal)'/'(studio)'/portal/admin/delivery components/portal/requests
git commit -m "feat: complete Studio request workspace states"
```

### Task 4: Add staff-created client work with scoped server authority

**Files:**
- Create: `app/(portal)/(studio)/portal/admin/delivery/new/page.tsx`
- Create: `app/api/portal/admin/clients/[organisationId]/requests/route.ts`
- Create: `components/portal/requests/staff-request-form.tsx`
- Create: `components/portal/requests/staff-request-form.test.tsx`
- Create: `lib/operations/http/staff-request-create-route.ts`
- Modify: `lib/operations/requests/staff-service.ts`
- Modify: `lib/operations/requests/validation.ts`
- Modify: `lib/operations/requests/staff-repository.ts`
- Create: `lib/operations/requests/staff-service.test.ts`
- Create: `supabase/migrations/20260921180000_operations_staff_request_create.sql`

**Interfaces:**
- Consumes: FSS-admin identity, active client/project choices and a validated new-request payload.
- Produces: F36 UI, a protected staff create endpoint and an auditable `new` request that is visible through existing client/staff list projections.

- [ ] **Step 1: Add failing schema/service/component tests that require a valid client-project pairing, `assessment_pending` initial scope, a stable idempotency key, and no founder-only fields in client-visible output.**

```tsx
assert.match(html, /Assessment pending/)
assert.doesNotMatch(html, /Included scope/)
assert.rejects(() => createStaffRequest(..., { projectId: "not-a-uuid" }, ...))
```

- [ ] **Step 2: Run the focused tests and confirm they fail because staff request creation does not yet exist.**

Run: `node --import tsx --test components/portal/requests/staff-request-form.test.tsx lib/operations/requests/staff-service.test.ts`

Expected: FAIL with missing module/export failures.

- [ ] **Step 3: Implement the vertical slice and migration.**

Introduce a strict staff-create schema reusing the request type/content bounds, but accepting only a single project chosen from the selected active client and operational priority. The SQL function must execute only under the founder role with a valid FSS-admin transaction, prove that the project belongs to an active organisation, insert a `new`/`assessment_pending` request with the staff actor and stable idempotency key, and rely on the existing insert trigger for audit and request-received notification intent. The route performs origin/content-type/size checks and the existing FSS-admin authorization recheck. After success, navigate to the F06 workspace; after failure, preserve the form state.

- [ ] **Step 4: Verify migration policy and focused behavior.**

Run: `pnpm verify:migrations && node --import tsx --test components/portal/requests/staff-request-form.test.tsx lib/operations/requests/staff-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit staff request creation.**

```bash
git add app/'(portal)'/'(studio)'/portal/admin/delivery/new app/api/portal/admin/clients/'[organisationId]'/requests components/portal/requests lib/operations/requests lib/operations/http supabase/migrations
git commit -m "feat: add Studio request creation"
```

### Task 5: Render safe, exact request-review and completion emails

**Files:**
- Modify: `lib/operations/requests/notifications.ts`
- Modify: `lib/operations/requests/notifications.test.ts`
- Modify: `supabase/migrations/20260921180000_operations_staff_request_create.sql` only if notification kind support belongs in that same dependency migration; otherwise create a subsequent revisioned migration.

**Interfaces:**
- Consumes: authorised claimed request-email delivery metadata.
- Produces: E01 review-requested and E02 completion email envelopes with HTML and plain text, authenticated deep links, distinct acceptance/closure copy and existing provider idempotency.

- [ ] **Step 1: Add failing template tests that inspect both transport variants and assert the review/version/action copy, authenticated request URL, no attachment field, and distinct closure wording.**

```ts
assert.match(email.html, /Your update is ready\./)
assert.match(email.text, /Review v3/)
assert.match(email.html, /\/portal\/requests\//)
assert.doesNotMatch(JSON.stringify(email), /attachments/i)
```

- [ ] **Step 2: Run the notification test and confirm it fails because the dispatcher has only generic paragraph construction.**

Run: `node --import tsx --test lib/operations/requests/notifications.test.ts`

Expected: FAIL.

- [ ] **Step 3: Extract a pure request-email template builder and extend only the scoped delivery data it needs.**

Build review content from the public summary, deliverable version, instructions and safe portal review URL. Build completed content from persisted completion context so client acceptance and FSS closure cannot be conflated. Keep subject lines free of sensitive detail, escape all public content, retain existing retry/idempotency behavior, and keep final files in the authenticated portal rather than email attachments. If the existing notification-outbox/claim function cannot represent closure distinctly, add a revisioned migration that changes the event mapping and claim data while retaining existing queued deliveries.

- [ ] **Step 4: Re-run the notification tests.**

Run: `node --import tsx --test lib/operations/requests/notifications.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the request email templates.**

```bash
git add lib/operations/requests/notifications.ts lib/operations/requests/notifications.test.ts supabase/migrations
git commit -m "feat: complete request notification emails"
```

### Task 6: Add visual evidence, mark Phase 7 matrix rows verified, and run the phase quality gate

**Files:**
- Modify: `app/visual/fss-studio/[scenario]/request-visual-fixtures.tsx`
- Modify: `app/visual/fss-studio/[scenario]/visual-scenarios.tsx`
- Modify: `app/visual/fss-studio/visual-scenarios.test.tsx`
- Modify: `tests/e2e/fss-studio.visual.spec.ts`
- Create: `tests/e2e/fss-studio.visual.spec.ts-snapshots/*-darwin.png`
- Create: `tests/e2e/fss-studio.visual.spec.ts-snapshots/*-linux.png`
- Modify: `docs/design/fss-studio-experience/screen-coverage.csv`
- Modify: this plan’s checkboxes only

**Interfaces:**
- Consumes: production-gated synthetic fixtures and real component compositions.
- Produces: desktop/mobile visual evidence for C08, C10, C11, F06, F08, F36, S01, S02, S03, S08 and S09; email template assertions for E01/E02; and a truthful matrix that advances exactly the 13 Phase 7 rows.

- [ ] **Step 1: Add failing fixture resolver assertions and focused Playwright cases for each newly covered visual state.**

```tsx
for (const name of ["client-request-detail", "client-request-feedback", "client-request-complete", "studio-request-detail", "studio-request-scope", "studio-request-create", "client-request-empty", "client-request-no-project", "client-request-conflict", "studio-request-move", "client-request-loading"]) {
  assert.ok(resolveVisualScenario(name, true, "test"))
}
```

- [ ] **Step 2: Run the fixture unit test and confirm it fails for the missing scenario registrations.**

Run: `node --import tsx --test app/visual/fss-studio/visual-scenarios.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement paired desktop/mobile visual scenarios and screenshots.**

Use static synthetic values that demonstrate the real composition. Preserve the production route guard. Capture both macOS and CI Linux baselines under their correct platform snapshot suffixes. Do not replace existing approved baselines unless a changed scenario intentionally requires it.

- [ ] **Step 4: Mark only completed request rows verified and validate the complete coverage index.**

Set `verified` only for C08, C10, C11, F06, F08, F36, S01, S02, S03, S08, S09, E01 and E02 after their tests and screenshots exist. Leave all agreement rows planned for Phase 8.

Run: `pnpm verify:fss-studio-coverage`

Expected: PASS with 88 unique rows and no duplicate IDs.

- [ ] **Step 5: Run all Phase 7 checks, inspect the diff, open the phase PR and wait for required CI.**

Run:

```bash
git diff origin/main...HEAD --check
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm verify:migrations
pnpm verify:fss-studio-coverage
pnpm test:visual
pnpm build
pnpm perf:budget:homepage
gh pr create --base main --head feat/fss-studio-redesign-phase-07-request-completion --title "feat: complete FSS Studio request workflows" --fill
gh pr checks <pr-number> --watch
```

Expected: all local and required remote checks pass before merge. If CI Linux snapshots differ, download the exact artifact, promote only the matching Linux baselines, recommit, and rerun CI.

## Self-Review

- **Spec coverage:** Tasks 1–5 implement the complete request vertical slice for every remaining Phase 7 row. Task 6 supplies desktop/mobile or template verification before changing the coverage state.
- **State safety:** All request mutations remain in the existing server transaction/trigger model; query parameters select safe presentation only and never authorize or persist a decision.
- **Scope discipline:** Agreement flows remain unmodified and planned for Phase 8. Production Studio enablement remains unchanged.
- **TDD:** Every implementation task starts with a named failing test, verifies that failure, implements the smallest passing vertical slice, then reruns its focused suite.

## Execution Handoff

The user explicitly approved phase-by-phase implementation, PR creation, push and merge when checks are green. Execute this plan in the dedicated Phase 7 worktree. Merge only after the required GitHub checks are green, then start Phase 8 from refreshed `origin/main`.
