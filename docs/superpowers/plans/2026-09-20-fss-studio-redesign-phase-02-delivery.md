# FSS Studio Phase 2 Delivery Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy request and delivery presentation with the approved FSS Studio screens C05–C11, F05–F08/F36, S01–S03/S08/S09, E01–E02 and M03–M05 while preserving the existing server-authoritative workflow.

**Architecture:** Existing pages continue to load authorised request projections in Server Components; small Client Components retain form state, command pending/error/retry behavior, visual view preferences, and accessible board controls. The phase makes the FSS Studio-specific component family shadcn-compatible, uses Lucide (the icon set used by shadcn) for every portal navigation item, and composes reusable delivery-specific cards, empty states, notices, fields and controls over the current request services.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, CSS Modules, Tailwind 4/CVA shadcn-compatible primitives, Lucide React, Zod, Node test runner, Playwright.

**Spec:** `docs/design/fss-studio-experience/02-workflow-contracts.md`, `docs/design/fss-studio-experience/03-screen-contracts.md`, `docs/design/fss-studio-experience/04-design-system.md`, `docs/design/fss-studio-experience/05-handoff-and-validation.md`, and `docs/design/fss-studio-experience/screen-coverage.csv`.

## Global Constraints

- Preserve `OPERATIONS_FSS_STUDIO_ENABLED === "true"` as the only production enablement gate; no environment values or production deployment change in this phase.
- Retain current server-side authentication, membership checks, role checks, request validation, expected-version conflict handling, audit behavior and notification intents.
- Use existing `lucide-react` icons for FSS Studio navigation and button affordances; do not introduce a second icon package.
- Use FSS Studio shadcn-compatible primitives for portal controls in this phase. Do not alter unrelated public-site or Growth UI primitives.
- Do not add a drag-and-drop dependency. The existing native drag path and the accessible Move to fallback must continue to route through server validation.
- Keep client commands idempotent and preserve form drafts after timeout, validation failure and conflict; no browser persistence of confidential content.
- Desktop board is available at wide viewports; narrow viewports default to explicit list/filter controls and never compress six lanes into the viewport.
- Verify visual fixtures only under `FSS_VISUAL_TESTS_ENABLED=true` and only outside production.

## Review Focus

- A contributor who can comment but cannot accept a review sees no action that can record client acceptance; covered by Task 5 accessibility tests.
- A request without an authorised shared project shows S02 with a real support route and cannot submit; covered by Task 4 component test.
- A stale review command retains drafted feedback and provides the exact latest-version recovery route; covered by Task 5 command and rendering tests.
- A founder move to review requires the review package rather than changing state from the board alone; covered by Task 6 component test.
- Navigation remains labelled and keyboard reachable when icon-only visual affordances are introduced; covered by Task 2 shell test.

---

### Task 1: Establish FSS Studio shadcn-compatible control primitives

**Files:**
- Modify: `components/portal/ui/button.tsx`
- Modify: `components/portal/ui/field.tsx`
- Create: `components/portal/ui/card.tsx`
- Create: `components/portal/ui/select.tsx`
- Modify: `components/portal/ui/index.ts`
- Modify: `components/portal/ui/portal-ui.module.css`
- Modify: `components/portal/ui/primitives.test.tsx`

**Interfaces:**
- Consumes: existing `PortalButton` public props and FSS Studio CSS variables.
- Produces: `PortalCard`, `PortalSelect`, improved `PortalButton` and `PortalField` controls for request screens; all remain semantic native controls.

- [ ] **Step 1: Add failing primitive rendering assertions**

```tsx
const html = renderToStaticMarkup(
  <PortalCard title="Your request"><PortalSelect label="Project" name="project" /></PortalCard>,
)
assert.match(html, /Your request/)
assert.match(html, /<select[^>]*name="project"/)
```

- [ ] **Step 2: Run the focused primitive test to verify the imports fail**

Run: `node --import tsx --test components/portal/ui/primitives.test.tsx`

Expected: FAIL because `PortalCard` and `PortalSelect` are not exported.

- [ ] **Step 3: Implement source-owned shadcn-compatible primitives**

```tsx
export function PortalCard({ title, children }: PortalCardProps) {
  return <section className={styles.card}>{title ? <h2>{title}</h2> : null}{children}</section>
}
```

Use CVA-equivalent variants already established in the portal primitive family. Keep labels associated with native controls, retain 44 px targets, and add an inline Lucide `LoaderCircle` only for pending button feedback.

- [ ] **Step 4: Run the focused primitive test to verify it passes**

Run: `node --import tsx --test components/portal/ui/primitives.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the isolated primitive change**

```bash
git add components/portal/ui
git commit -m "feat: add FSS Studio control primitives"
```

### Task 2: Add Lucide menu icons to the responsive Studio shells

**Files:**
- Create: `components/portal/shell/navigation-icon.tsx`
- Modify: `components/portal/shell/client-shell.tsx`
- Modify: `components/portal/shell/studio-shell.tsx`
- Modify: `components/portal/shell/portal-shell.module.css`
- Create: `components/portal/shell/navigation-icon.test.tsx`

**Interfaces:**
- Consumes: `PortalNavigationItem.id` from `components/portal/shell/navigation.ts`.
- Produces: `PortalNavigationIcon({ itemId, label })`, used by desktop and mobile client/Studio navigation links.

- [ ] **Step 1: Write a failing shell test for named Lucide navigation icons**

```tsx
const html = renderToStaticMarkup(<PortalNavigationIcon itemId="requests" label="Requests" />)
assert.match(html, /aria-hidden="true"/)
assert.match(html, /svg/)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test components/portal/shell/navigation-icon.test.tsx`

Expected: FAIL because the icon component does not exist.

- [ ] **Step 3: Implement the stable nav-ID to Lucide icon map**

```tsx
const navigationIcons = { requests: ClipboardList, delivery: KanbanSquare } satisfies Record<string, LucideIcon>
```

Use a documented fallback icon for future IDs, preserve textual labels, and replace the decorative square spans in both shells. Size and align icons through the shared shell stylesheet.

- [ ] **Step 4: Run the focused shell tests**

Run: `node --import tsx --test components/portal/shell/navigation-icon.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the shell change**

```bash
git add components/portal/shell
git commit -m "feat: add Lucide navigation icons to FSS Studio"
```

### Task 3: Rebuild the client request collection as C05/M03 with S01 and S09

**Files:**
- Modify: `app/(portal)/(client)/portal/requests/page.tsx`
- Modify: `components/portal/requests/board.tsx`
- Modify: `components/portal/requests/list.tsx`
- Modify: `components/portal/requests/presentation.ts`
- Modify: `components/portal/requests/requests.module.css`
- Modify: `components/portal/requests/accessibility.test.tsx`

**Interfaces:**
- Consumes: authorised `ClientRequest[]`, URL filters and `requestHref`.
- Produces: desktop six-lane board, narrow explicit list, truthful filtered count, visual empty state and structural loading fixture.

- [ ] **Step 1: Extend the request collection test for approved states**

```tsx
assert.match(board, /How your board works/)
assert.match(board, /Nothing in your board yet/)
assert.match(board, /Create first request/)
assert.match(board, /Ready for review/)
```

- [ ] **Step 2: Run the focused request UI test to verify it fails**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx`

Expected: FAIL until the C05/S01 text and controls exist.

- [ ] **Step 3: Implement request collection composition**

```tsx
<RequestBoard filters={filters} requests={requests.items} organisationId={context.organisationId} />
```

Make Board the wide-screen default, retain a labelled List alternative, use all six visual lanes, show each card's exact state, next action, owner/date and review affordance, and render S01 when `requests.length === 0`. The S09 fixture is structural skeleton markup only and is never shown as real records.

- [ ] **Step 4: Run the focused request UI test to verify it passes**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the client request collection change**

```bash
git add app/'(portal)'/'(client)'/portal/requests/page.tsx components/portal/requests
git commit -m "feat: redesign client request collection"
```

### Task 4: Rebuild client request creation as C06/C07/M04 with S02 recovery

**Files:**
- Modify: `app/(portal)/(client)/portal/requests/new/page.tsx`
- Modify: `components/portal/requests/request-form.tsx`
- Modify: `components/portal/requests/form-field.tsx`
- Modify: `components/portal/requests/requests.module.css`
- Modify: `components/portal/requests/accessibility.test.tsx`

**Interfaces:**
- Consumes: authorised project options and existing `CreateRequestAction`/Zod schema.
- Produces: type-selector buttons, labelled request/bug form sections, S02 no-project recovery and existing idempotent command behavior.

- [ ] **Step 1: Add failing tests for the no-project recovery and bug fields**

```tsx
assert.match(noProjectHtml, /A project is needed for this request/)
assert.match(noProjectHtml, /Ask FSS to set up your project/)
assert.match(bugHtml, /Steps to reproduce/)
assert.match(bugHtml, /What happened instead/)
```

- [ ] **Step 2: Run the focused request UI test to verify it fails**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx`

Expected: FAIL until S02 carries an actionable support link and the type controls render the bug form.

- [ ] **Step 3: Implement the C06/C07 layout over current command behavior**

```tsx
<fieldset aria-label="Request type"><button type="button">New work</button></fieldset>
```

Style the type selector using FSS Studio `PortalButton` variants, preserve all field validation, use native labels and inputs, retain the stable idempotency key, and show the secure attachment guidance as an informational notice. S02 routes to existing Help with organisation context and does not claim the founder request was sent.

- [ ] **Step 4: Run focused request UI and transport tests**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx components/portal/requests/actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the request form change**

```bash
git add app/'(portal)'/'(client)'/portal/requests/new/page.tsx components/portal/requests
git commit -m "feat: redesign client request creation"
```

### Task 5: Rebuild client request detail, review and completion as C08–C11/M05/S03

**Files:**
- Modify: `app/(portal)/(client)/portal/requests/[requestId]/page.tsx`
- Modify: `components/portal/requests/request-detail.tsx`
- Modify: `components/portal/requests/review-actions.tsx`
- Modify: `components/portal/requests/conversation.tsx`
- Modify: `components/portal/requests/review-history.tsx`
- Modify: `components/portal/requests/requests.module.css`
- Modify: `components/portal/requests/accessibility.test.tsx`

**Interfaces:**
- Consumes: `ClientRequestDetail`, existing review action API and expected-version/review-cycle identifiers.
- Produces: C08 detail, C09 exact-version review, C10 feedback state, C11 completion state and S03 conflict-recovery presentation.

- [ ] **Step 1: Write failing assertions for the version-specific decision UI**

```tsx
assert.match(html, /Does this meet the agreed outcome\?/) 
assert.match(html, /Accept v1/)
assert.match(html, /Request changes/)
assert.match(doneHtml, /Version v1 accepted/) 
```

- [ ] **Step 2: Run the focused request UI test to verify it fails**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx`

Expected: FAIL until the C09/C11 hierarchy and version-named actions exist.

- [ ] **Step 3: Implement the client detail states**

```tsx
<PortalCard tone="navy" title="Does this meet the agreed outcome?">...</PortalCard>
```

Move current status, next action, outcome, deliverable and public conversation into clear C08 sections. Make C09 foreground what changed and what to check before decisions; acceptance retains the required checkbox and names the exact deliverable version. Preserve feedback after conflict, show S03 only for supplied conflict state, and distinguish client acceptance from an FSS closure in C11.

- [ ] **Step 4: Run focused request UI and command tests**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx components/portal/requests/actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the request detail change**

```bash
git add app/'(portal)'/'(client)'/portal/requests/'[requestId]'/page.tsx components/portal/requests
git commit -m "feat: redesign client request review workflow"
```

### Task 6: Rebuild founder delivery as F05–F08/F36/S08

**Files:**
- Modify: `app/(portal)/(studio)/portal/admin/delivery/page.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/requests/[requestId]/page.tsx`
- Modify: `components/portal/requests/staff-delivery-board.tsx`
- Modify: `components/portal/requests/staff-request-actions.tsx`
- Modify: `components/portal/requests/founder-action-fields.tsx`
- Modify: `components/portal/requests/requests.module.css`
- Modify: `components/portal/requests/accessibility.test.tsx`

**Interfaces:**
- Consumes: staff request projections and existing staff command endpoint.
- Produces: cross-client founder board, contextual request action workspace, review-package and scope-assessment fields, truthful transition pending/error feedback.

- [ ] **Step 1: Write a failing test for founder move-to behavior**

```tsx
assert.match(boardHtml, /Move to/) 
assert.match(actionsHtml, /Review package/) 
assert.match(actionsHtml, /Public update/) 
assert.doesNotMatch(actionsHtml, /Accept this version/)
```

- [ ] **Step 2: Run the focused request UI test to verify it fails**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx`

Expected: FAIL until the F05–F08/S08 labels and controls are present.

- [ ] **Step 3: Implement founder delivery presentation**

```tsx
<button type="button" onClick={() => openMoveSheet(request)}>Move to</button>
```

Retain native drag only as a convenience. Every actionable move exposes an explicit labelled Move to control; evidence-requiring moves route to the existing request workspace. Style founder cards with client/priority/state context. Make public and internal notes separate, visually named composer choices. The review package uses the existing `review` command inputs, while scope applies existing classification fields. Do not create a founder request command until the authorised client/project creation endpoint exists.

- [ ] **Step 4: Run focused request UI tests**

Run: `node --import tsx --test components/portal/requests/accessibility.test.tsx components/portal/requests/actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the founder delivery change**

```bash
git add app/'(portal)'/'(studio)'/portal/admin/delivery/page.tsx app/'(portal)'/'(studio)'/portal/admin/clients/'[organisationId]'/requests/'[requestId]'/page.tsx components/portal/requests
git commit -m "feat: redesign FSS Studio delivery workflow"
```

### Task 7: Add Phase 2 visual fixtures, browser assertions and verified coverage

**Files:**
- Modify: `app/visual/fss-studio/[scenario]/visual-scenarios.tsx`
- Modify: `app/visual/fss-studio/[scenario]/page.tsx`
- Modify: `app/visual/fss-studio/visual-scenarios.test.tsx`
- Modify: `tests/e2e/fss-studio.visual.spec.ts`
- Create: `tests/e2e/fss-studio.visual.spec.ts-snapshots/*-darwin.png`
- Create: `tests/e2e/fss-studio.visual.spec.ts-snapshots/*-linux.png`
- Modify: `docs/design/fss-studio-experience/screen-coverage.csv`

**Interfaces:**
- Consumes: synthetic visual fixtures, development-only visual route gate, platform-scoped snapshot template.
- Produces: C05/M03, C06/C07/M04, C09/M05, F05 and F07 render coverage with matching darwin/Linux approved snapshots.

- [ ] **Step 1: Add failing fixture resolution tests for every Phase 2 visual scenario**

```tsx
for (const name of ["client-request-board", "client-request-form", "client-request-review", "studio-delivery-board", "studio-review-package"]) {
  assert.ok(resolveVisualScenario(name, true, "test"))
}
```

- [ ] **Step 2: Run fixture tests to verify they fail**

Run: `node --import tsx --test app/visual/fss-studio/visual-scenarios.test.tsx`

Expected: FAIL because the named Phase 2 scenarios are not registered.

- [ ] **Step 3: Implement synthetic fixtures and snapshot assertions**

```tsx
test("client request board desktop matches C05", async ({ page }) => {
  await openScenario(page, "client-request-board", "Requests & feedback")
  await expect(page).toHaveScreenshot("c05-client-request-board-desktop.png")
})
```

Use only static synthetic data. Add paired macOS and exact CI Linux snapshot baselines; never disable production guarding to make fixtures available.

- [ ] **Step 4: Run fixture and visual tests**

Run: `pnpm test:visual`

Expected: Phase 2 assertions PASS for the current platform and skip the other platform project.

- [ ] **Step 5: Mark only Phase 2 matrix rows verified after functional and visual evidence exists**

```csv
C05,...,2,verified
```

Keep rows that still lack a real route/action (notably F36 and E01/E02 where no present UI route/template is wired) as `planned`; coverage validation is a release index, not a claim of completion.

- [ ] **Step 6: Verify coverage and commit visual evidence**

Run: `pnpm verify:fss-studio-coverage && git add app/visual tests/e2e docs/design/fss-studio-experience/screen-coverage.csv && git commit -m "test: cover FSS Studio delivery visuals"`

Expected: coverage validation reports 88 unique screens; visual assertions are committed with both platform baselines.

### Task 8: Run Phase 2 quality gates and open its pull request

**Files:**
- Modify: `docs/superpowers/plans/2026-09-20-fss-studio-redesign-phase-02-delivery.md` (checkboxes only)

**Interfaces:**
- Consumes: Phase 2 implementation and verified snapshot baselines.
- Produces: an approved-review PR without production enablement or deployment.

- [ ] **Step 1: Inspect the complete diff and changed modules**

Run: `git diff origin/main...HEAD --check && git status --short`

Expected: no whitespace error and no unexpected generated files.

- [ ] **Step 2: Run code and targeted behavior checks**

Run: `pnpm typecheck && pnpm lint && node --import tsx --test components/portal/ui/primitives.test.tsx components/portal/shell/navigation-icon.test.tsx components/portal/requests/accessibility.test.tsx components/portal/requests/actions.test.ts && pnpm verify:fss-studio-coverage`

Expected: PASS.

- [ ] **Step 3: Run browser and production checks**

Run: `pnpm test:visual && pnpm build && pnpm perf:budget:homepage`

Expected: PASS; homepage remains within its established budget.

- [ ] **Step 4: Open Phase 2 PR and wait for required checks**

Run: `gh pr create --base main --head feat/fss-studio-redesign-phase-02-delivery --title "feat: redesign FSS Studio delivery workflow" --fill`

Expected: PR exists and documents the verified rows, static fixture-only evidence, local environment limitations and unchanged production gate.

- [ ] **Step 5: Merge only after every required check is green and normal review policy permits**

Run: `gh pr checks <pr-number> --watch && gh pr merge <pr-number> --merge`

Expected: main contains the merge commit. Begin Phase 3 from the refreshed remote main branch.

## Self-Review

- **Spec coverage:** Tasks 3–6 cover Phase 2 request surfaces C05–C11, F05–F08 and states S01–S03/S08/S09; Task 7 creates visual evidence for the highest-risk desktop/mobile request and founder screens. E01/E02 and F36 remain explicitly planned unless existing real workflows can be demonstrated, avoiding false matrix verification.
- **Placeholder scan:** No implementation task contains TODO/TBD or unscoped validation language; each adds a named test and outcome.
- **Type consistency:** Each component consumes existing request types and server command schemas. No public command names or DTOs change.
- **Review focus:** Every listed failure mode maps to a test in Tasks 2, 4, 5 or 6.

## Execution Handoff

The user has explicitly approved execution and required a phase-by-phase PR/merge workflow. Implement natively in this isolated checkout, retain the review gate before merge, and begin the following phase only from confirmed `origin/main`.
