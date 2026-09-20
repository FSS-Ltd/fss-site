# FSS Studio Redesign Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Establish the approved FSS Studio visual foundation: a versioned 88-screen handoff and matrix, independent portal route groups, shared responsive shells, real client and founder overviews, and desktop/mobile visual regression coverage.

**Architecture:** Preserve all current portal-host URLs and Operations domain services. Move the current internal portal routes into sibling Next route groups so the shared group layout supplies only Clerk and the client and Studio shells never nest. Add focused presentation DTOs and components above the existing service boundary. A checked screen matrix ties every handoff reference to its eventual route, authorisation, visual assertion and functional test.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, existing Lucide icons, Clerk, Node test runner, and a justified new @playwright/test development dependency.

**Spec:** docs/superpowers/specs/2026-09-20-fss-studio-experience-redesign-design.md

## Global Constraints

- Import the approved handoff from the verified local source into docs/design/fss-studio-experience/ without rewriting its contract or inventing workflow behaviour.
- Preserve portal public paths, proxy rewrites, PortalRole capabilities, FSS Admin checks, Operations services, tenant boundaries and idempotent command paths.
- Do not enable OPERATIONS_FSS_STUDIO_ENABLED, OPERATIONS_PORTAL_PREFIX_FREE_ENABLED, or OPERATIONS_GROWTH_OPERATIONS_CUTOVER_ENABLED in production.
- Do not alter Clerk configuration, send an invitation, run a production migration, use production records, or create provider side effects.
- Use Geist through next/font/google. Use the existing lucide-react package for interface icons; do not add an icon package.
- Use the exact approved tokens and CSS Modules for portal presentation. Do not introduce a parallel utility class system.
- Every production behaviour starts red with a focused Node or component test. Static asset copying and package/configuration setup are verified through the new test commands and are the only non-behavioural setup exceptions.
- Keep pages as data-loading and authorisation boundaries. New overview DTOs resolve scope on the server and do not receive trusted role, organisation or record IDs from the browser.
- Use deterministic, non-production-only visual fixtures. No visual-test route renders in production.
- Stage only Phase 1 files on feat/fss-studio-redesign-phase-01-foundation. Do not include the unrelated fix/auth-invitation-lifecycle commit.
- Update current command references when renaming the public redesign check. Preserve historical planning records as historical evidence.

## Review Focus

1. Portal URL compatibility: test that the route-group move leaves portalPath and proxy mappings unchanged for root, client, admin, login and activation URLs.
2. Persona isolation: test that client navigation is absent from Studio HTML and founder navigation is absent from client HTML at desktop and mobile widths.
3. Overview truthfulness: test that missing records produce an explained next step or zero-state, never example metrics or fabricated status.
4. Coverage completeness: test that the imported manifest and matrix have the same 88 unique screen IDs and that each row supplies phase, permission, visual and functional evidence fields.
5. Fixture safety: test that visual-regression routes return notFound unless FSS_VISUAL_TESTS_ENABLED is true outside production.

---

### Task 1: Import the handoff and create the validated coverage model

**Files:**
- Create: docs/design/fss-studio-experience/README.md
- Create: docs/design/fss-studio-experience/{01-product-and-delivery-spec,02-workflow-contracts,03-screen-contracts,04-design-system,05-handoff-and-validation}.md
- Create: docs/design/fss-studio-experience/{screen-manifest,wireframe-validation}.json
- Create: docs/design/fss-studio-experience/wireframes.html
- Create: docs/design/fss-studio-experience/wireframes/ (88 SVG references)
- Create: docs/design/fss-studio-experience/previews/ (88 PNG references)
- Create: docs/design/fss-studio-experience/contact-sheet-{1,2,3,4,5,6}.jpg
- Create: lib/operations/design/screen-coverage.ts
- Create: lib/operations/design/screen-coverage.test.ts
- Create: scripts/verify-fss-studio-screen-coverage.ts

**Interfaces:**
- Produces ScreenManifestEntry, ScreenCoverageRow, ScreenCoverageViolation, parseCoverageCsv, and validateScreenCoverage.
- Consumes the imported screen-manifest.json and a later CSV matrix.
- The verifier exits non-zero for any violation and writes only safe IDs and field names.

- [ ] **Step 1: Copy the approved handoff assets without modification**

Copy the full verified source tree from:

    /Users/JeanFidele/.codex/.chatgpt-projects/g-p-68b717cf767881918baad0bd29ebaf43/deliverables/fss-studio-spec/

to:

    docs/design/fss-studio-experience/

Preserve the five Markdown contracts, two JSON files, gallery, 88 SVGs, 88 previews and six contact sheets. Do not copy local tooling state, hidden files, credentials or the external directory hierarchy.

- [ ] **Step 2: Write the failing coverage-validation test**

Create lib/operations/design/screen-coverage.test.ts with a fixture manifest containing C01 and F01, a complete matching row set, a duplicate C01 set, and a row missing mobile_visual. Assert the complete set has no violations; assert duplicates and missing evidence identify the screen ID and field.

    test("reports duplicate IDs and missing required coverage evidence", () => {
      const violations = validateScreenCoverage(manifest, rows)
      assert.deepEqual(violations, [])
      assert.match(
        validateScreenCoverage(manifest, duplicateRows).join("\n"),
        /C01.*duplicate/
      )
      assert.match(
        validateScreenCoverage(manifest, missingEvidenceRows).join("\n"),
        /F01.*mobile_visual/
      )
    })

- [ ] **Step 3: Run the focused test to prove RED**

Run:

    node --import tsx --test lib/operations/design/screen-coverage.test.ts

Expected: FAIL because the screen-coverage module does not exist.

- [ ] **Step 4: Implement the smallest typed coverage validator**

Create lib/operations/design/screen-coverage.ts with the exact public types and pure validation boundary:

    export type ScreenManifestEntry = Readonly<{
      id: string
      role: string
      nav: string
      title: string
      route?: string
      primary: string
    }>

    export type ScreenCoverageRow = Readonly<{
      screen_id: string
      role: string
      surface: string
      reference: string
      route: string
      scenario: string
      component: string
      read_model: string
      command_or_event: string
      permission: string
      desktop_visual: string
      mobile_visual: string
      functional_test: string
      phase: string
      status: "planned" | "implemented" | "verified" | "blocked"
    }>

    export function validateScreenCoverage(
      manifest: readonly ScreenManifestEntry[],
      rows: readonly ScreenCoverageRow[],
    ): string[]

The function validates exactly one row per manifest ID, no unknown IDs, no blank required fields, one of the four status values, an in-repository docs/design reference path, and a non-empty phase, permission, visual and functional-test reference. Keep CSV parsing separate and strict: fixed header order, comma-only data without quoted text, and an error for wrong field count.

- [ ] **Step 5: Run the focused test to prove GREEN**

Run:

    node --import tsx --test lib/operations/design/screen-coverage.test.ts

Expected: PASS.

- [ ] **Step 6: Implement the repository verifier**

Create scripts/verify-fss-studio-screen-coverage.ts. It reads the imported manifest and the Phase 1 matrix file, parses the CSV through parseCoverageCsv, passes both into validateScreenCoverage, prints each violation prefixed with a dash, and exits 1 if any violation exists. On success it prints:

    FSS Studio screen coverage verified: 88 screens.

- [ ] **Step 7: Commit the source and validator**

Run the focused test and git diff --check. Stage only the imported design directory, coverage module, its test and verifier. Commit:

    docs: version FSS Studio handoff and coverage contract

### Task 2: Build the explicit 88-row screen coverage matrix

**Files:**
- Create: docs/design/fss-studio-experience/screen-coverage.csv
- Modify: docs/design/fss-studio-experience/README.md
- Modify: package.json

**Interfaces:**
- Consumes ScreenCoverageRow CSV header defined in Task 1.
- Produces one complete, explicit row for every imported manifest ID.
- Adds verify:fss-studio-coverage script running tsx scripts/verify-fss-studio-screen-coverage.ts.

- [ ] **Step 1: Run the verifier before creating the matrix**

Run:

    pnpm exec tsx scripts/verify-fss-studio-screen-coverage.ts

Expected: FAIL because screen-coverage.csv is absent.

- [ ] **Step 2: Create the exact CSV header and all 88 rows**

Use this exact header:

    screen_id,role,surface,reference,route,scenario,component,read_model,command_or_event,permission,desktop_visual,mobile_visual,functional_test,phase,status

Create one row for each imported C00-C30, F01-F37, S01-S10, E01-E02 and M01-M08 entry. Preserve the manifest ID and route where supplied. Assign the Phase 1 rows C00, C01, C25, F01, M01 and M07 to phase 1; assign the remaining IDs to the phase declared in the approved spec. Use current route/component names where they exist and planned exact destinations where they do not.

For every row, set an explicit authorisation source, primary command/event, desktop visual name, mobile visual name and functional-test location. Rows outside Phase 1 may be status planned, but no field may be blank. Phase 1 rows become implemented only after their tests and visual assertions pass.

- [ ] **Step 3: Document the matrix as the implementation index**

Append a short README section stating that screen-coverage.csv is the required implementation index, that all 88 IDs must remain unique, and that final release verification requires status verified for every row.

- [ ] **Step 4: Add the verifier package script**

Add the script:

    "verify:fss-studio-coverage": "tsx scripts/verify-fss-studio-screen-coverage.ts"

Do not modify the Studio production flag or any release environment command.

- [ ] **Step 5: Run matrix verification**

Run:

    pnpm verify:fss-studio-coverage

Expected: PASS and exact output FSS Studio screen coverage verified: 88 screens.

- [ ] **Step 6: Commit the explicit matrix**

Stage only the matrix, README and package script. Commit:

    docs: map all FSS Studio screens to implementation evidence

### Task 3: Rename the public-site-only redesign check

**Files:**
- Rename: scripts/validate-redesign-shell.mjs to scripts/validate-public-redesign-shell.mjs
- Modify: package.json
- Modify: .github/workflows/ci.yml
- Modify: docs/operations/implementation-progress.md
- Modify: docs/seo-aeo-release-checks.md
- Modify: docs/public-cinematic-motion.md

**Interfaces:**
- Produces pnpm test:public-redesign, which runs the unchanged public motion/header/footer validator.
- CI invokes test:public-redesign and no active script invokes test:redesign.
- Historical plan documents retain their original command references.

- [ ] **Step 1: Prove the new command is absent**

Run:

    pnpm test:public-redesign

Expected: FAIL with a missing script error.

- [ ] **Step 2: Rename the validator without changing its public-site scope**

Use git mv for the script rename. In package.json replace:

    "test:redesign": "node scripts/validate-redesign-shell.mjs"

with:

    "test:public-redesign": "node scripts/validate-public-redesign-shell.mjs"

Keep the script logic public-site-specific. Do not add portal assertions to this validator.

- [ ] **Step 3: Update active CI and current documentation**

Change .github/workflows/ci.yml to run pnpm test:public-redesign. Update the three current documentation files listed above to name the new command. Do not rewrite historical plans.

- [ ] **Step 4: Verify the renamed command**

Run:

    pnpm test:public-redesign

Expected: PASS with Redesign shell checks passed.

- [ ] **Step 5: Commit the rename**

Run git diff --check. Stage only the rename and the active command references. Commit:

    chore: name the public redesign check accurately

### Task 4: Separate portal route groups and preserve URL compatibility

**Files:**
- Create: app/(portal)/layout.tsx
- Create: app/(portal)/(auth)/portal/layout.tsx
- Create: app/(portal)/(client)/portal/layout.tsx
- Create: app/(portal)/(studio)/portal/admin/layout.tsx
- Move: app/(portal)/portal/login to app/(portal)/(auth)/portal/login
- Move: app/(portal)/portal/activate to app/(portal)/(auth)/portal/activate
- Move: app/(portal)/portal/admin to app/(portal)/(studio)/portal/admin
- Move: all remaining client portal pages from app/(portal)/portal to app/(portal)/(client)/portal
- Delete: app/(portal)/portal/layout.tsx after its responsibilities are split
- Create: scripts/verify-fss-studio-route-groups.ts
- Create: scripts/verify-fss-studio-route-groups.test.ts

**Interfaces:**
- The common portal layout exports PortalProviderLayout and contains only the Clerk provider and children.
- The client layout exports ClientPortalLayout and owns only client navigation/content landmarks.
- The Studio layout exports AdminLayout and owns only staff navigation/content landmarks plus fssStudioEnabled.
- Public portal URLs and portalPath behaviour remain unchanged.

- [ ] **Step 1: Write the failing route-boundary test**

Create scripts/verify-fss-studio-route-groups.test.ts. Use a temporary fixture tree and assert verifyPortalRouteGroups returns violations when a legacy app/(portal)/portal/layout.tsx exists, when the common layout contains a client shell selector, and when client or Studio group layouts are missing.

    test("requires persona layouts to be siblings below the common portal provider", () => {
      assert.deepEqual(verifyPortalRouteGroups(validTree), [])
      assert.match(
        verifyPortalRouteGroups(legacyTree).join("\n"),
        /legacy portal layout/
      )
    })

- [ ] **Step 2: Run the focused test to prove RED**

Run:

    node --import tsx --test scripts/verify-fss-studio-route-groups.test.ts

Expected: FAIL because the verifier module does not exist.

- [ ] **Step 3: Implement the route-boundary verifier**

Create scripts/verify-fss-studio-route-groups.ts with an exported verifyPortalRouteGroups(root: string): string[] function. It asserts each required layout exists, the legacy layout does not, and the common layout has ClerkProvider but no portal shell class imports. Add a CLI mode that prints violations and exits 1. The verifier reads only the repository file tree and never changes routes.

- [ ] **Step 4: Move routes and split layouts**

Use git mv for the route directories. Move ClerkProvider and the common operations-enabled boundary to app/(portal)/layout.tsx. Make the auth layout render an authentication-specific landmark only. Move the client chrome into app/(portal)/(client)/portal/layout.tsx. Keep fssStudioEnabled and StudioShell in app/(portal)/(studio)/portal/admin/layout.tsx.

Preserve page code, protected server reads, portalPath calls and internal /portal route identities during this task. Do not use redirects to mask a changed path.

- [ ] **Step 5: Run route compatibility tests**

Run:

    node --import tsx --test scripts/verify-fss-studio-route-groups.test.ts
    node --import tsx --test lib/operations/auth/portal-url.test.ts lib/operations/auth/portal-host.test.ts

Expected: PASS.

- [ ] **Step 6: Commit the route-group boundary**

Stage only moved portal files, new group layouts and verifier tests. Commit:

    refactor: isolate client and Studio route layouts

### Task 5: Establish portal tokens and accessible shared primitives

**Files:**
- Modify: app/layout.tsx
- Modify: app/globals.css
- Create: components/portal/ui/portal-ui.module.css
- Create: components/portal/ui/button.tsx
- Create: components/portal/ui/field.tsx
- Create: components/portal/ui/status-badge.tsx
- Create: components/portal/ui/notice.tsx
- Create: components/portal/ui/page-header.tsx
- Create: components/portal/ui/index.ts
- Create: components/portal/ui/primitives.test.tsx

**Interfaces:**
- PortalButton accepts variant primary, secondary, quiet or destructive; loading; disabledReason; and native button props.
- PortalField accepts label, error, hint, required and exactly one labelled native input child.
- StatusBadge accepts a named semantic status and visible text.
- Notice accepts tone info, success, warning or error and an optional action child.
- PageHeader accepts eyebrow, title, description, breadcrumbs and one primary action.

- [ ] **Step 1: Write failing primitive accessibility tests**

Create primitives.test.tsx to assert a disabled primary button renders its disabled reason in text, a field renders a persistent label and linked error text, and a warning status includes a readable label rather than colour-only markup.

    test("keeps disabled reasons, labels and status names available to assistive technology", () => {
      const html = renderToStaticMarkup(
        <PortalButton disabled disabledReason="Select a project first">
          Submit request
        </PortalButton>,
      )
      assert.match(html, /Select a project first/)
    })

- [ ] **Step 2: Run the focused test to prove RED**

Run:

    node --import tsx --test components/portal/ui/primitives.test.tsx

Expected: FAIL because the primitive modules do not exist.

- [ ] **Step 3: Load Geist and declare semantic tokens**

Use next/font/google in app/layout.tsx to load Geist with weights 400, 500, 600 and 700 and bind its variable to the body. Replace portal-facing token values in globals.css with the approved canvas, surface, soft surface, ink, muted, action, tint, navy, border and control-boundary values. Preserve public-site tokens unless their current semantic value already matches.

- [ ] **Step 4: Implement focused primitives and CSS**

Implement the exported primitives using semantic HTML and the shared CSS Module. Include 44 px control targets, 3 px focus outline, explicit disabled reason rendering, pending label stability, token-based surfaces, visible error treatment and reduced-motion behaviour. Use existing lucide-react icons only where a familiar icon adds information beside a visible label.

- [ ] **Step 5: Run the focused test to prove GREEN**

Run:

    node --import tsx --test components/portal/ui/primitives.test.tsx

Expected: PASS.

- [ ] **Step 6: Commit shared primitives**

Run git diff --check and the focused test. Stage only the font, token and primitive files. Commit:

    feat: add FSS Studio visual primitives

### Task 6: Build separate responsive client and Studio shells

**Files:**
- Create: components/portal/shell/client-shell.tsx
- Create: components/portal/shell/studio-shell.tsx
- Create: components/portal/shell/portal-shell.module.css
- Create: components/portal/shell/navigation.ts
- Create: components/portal/shell/navigation.test.tsx
- Modify: app/(portal)/(client)/portal/layout.tsx
- Modify: app/(portal)/(studio)/portal/admin/layout.tsx
- Delete: components/portal/studio-shell.tsx
- Delete: components/portal/studio-shell.module.css

**Interfaces:**
- getClientNavigation(role, pathname) returns only capability-appropriate items with active state.
- getStudioNavigation(pathname) returns Overview, Clients, Delivery, Agreements, Welcome journeys, Projects, Billing, Portal access, Notifications and Settings.
- ClientShell consumes verified membership summaries and children.
- StudioShell consumes children and uses the existing sign-out endpoint.
- Desktop sidebar uses 232 px width; mobile exposes Home, Projects, Requests and More.

- [ ] **Step 1: Write the failing navigation tests**

Create navigation.test.tsx that supplies owner, contributor, billing_contact and viewer fixtures. Assert billing-only navigation does not contain Requests, owner navigation contains Requests, Studio navigation contains no client workspace switcher, and active navigation sets aria-current to page.

    test("keeps client capabilities and Studio navigation isolated", () => {
      assert.doesNotMatch(renderClient("billing_contact"), /Requests/)
      assert.match(renderClient("owner"), /Requests/)
      assert.doesNotMatch(renderStudio(), /Choose your workspace/)
    })

- [ ] **Step 2: Run the focused test to prove RED**

Run:

    node --import tsx --test components/portal/shell/navigation.test.tsx

Expected: FAIL because the new shell modules do not exist.

- [ ] **Step 3: Implement typed navigation and shell landmarks**

Create navigation.ts with typed item definitions and capability filtering through existing hasPortalCapability. Implement ClientShell and StudioShell with skip links, header landmarks, labelled navigation, current-route state, FSS monogram assets from public/redesign/brand, account/sign-out controls and More menu semantics. Do not expose Studio navigation to client pages or client workspace selection to Studio.

- [ ] **Step 4: Implement responsive composition**

Implement portal-shell.module.css using the approved 232 px desktop sidebar, card/surface tokens and mobile bottom navigation. At 760 px and below, switch to bottom navigation and an accessible More sheet/menu. At 320 px, text wraps without page-level horizontal scrolling. Respect prefers-reduced-motion.

- [ ] **Step 5: Wire shells into the new layouts**

Client layout derives authorised membership context before rendering ClientShell. Studio layout retains fssStudioEnabled and staff guard expectations while rendering StudioShell. Authentication pages remain outside both shells.

- [ ] **Step 6: Run focused shell tests**

Run:

    node --import tsx --test components/portal/shell/navigation.test.tsx
    node --import tsx --test scripts/verify-fss-studio-route-groups.test.ts

Expected: PASS.

- [ ] **Step 7: Commit persona shells**

Stage only the new shell modules, group layouts and deleted legacy Studio shell files. Commit:

    feat: add responsive client and Studio shells

### Task 7: Implement the C00 authentication surface

**Files:**
- Modify: app/(portal)/(auth)/portal/login/page.tsx
- Create: components/portal/auth/login-presentation.tsx
- Create: components/portal/auth/login-presentation.module.css
- Create: components/portal/auth/login-presentation.test.tsx
- Modify: components/portal/auth/login-form.tsx
- Modify: docs/design/fss-studio-experience/screen-coverage.csv

**Interfaces:**
- PortalLoginPresentation accepts a labelled authentication form, optional invitation context and safe support content; it does not own sign-in state or submit credentials.
- PortalLoginForm retains the existing Clerk sign-in, pending/error and invitation acceptance flow while rendering through PortalLoginPresentation.
- The login page keeps the existing operations-enabled and portal-auth-configured boundaries.

- [ ] **Step 1: Write the failing authentication presentation test**

Create login-presentation.test.tsx. Render the presentation with a labelled email field, submit action and invitation message. Assert C00's sign-in heading, visible account label, sign-in action, invitation context and support link all render as text rather than image-only decoration.

    test("renders the C00 sign-in surface with persistent labels and invitation context", () => {
      const html = renderToStaticMarkup(
        <PortalLoginPresentation invitationMessage="Your workspace invitation is ready">
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" />
          <button type="submit">Continue</button>
        </PortalLoginPresentation>,
      )
      assert.match(html, /Sign in to FSS/)
      assert.match(html, /Work email/)
      assert.match(html, /Your workspace invitation is ready/)
    })

- [ ] **Step 2: Run the focused test to prove RED**

Run:

    node --import tsx --test components/portal/auth/login-presentation.test.tsx

Expected: FAIL because PortalLoginPresentation does not exist.

- [ ] **Step 3: Implement C00 without changing Clerk behaviour**

Create the semantic login presentation with the approved C00 canvas, surface, typography and visible help affordance. Render the existing PortalLoginForm credential fields, pending labels, inline errors and invitation acceptance message inside it. Keep credential submission, redirects, MFA flow and Clerk errors in PortalLoginForm. Do not turn sign-in state into a visual fixture or introduce a second authentication boundary.

- [ ] **Step 4: Run the focused authentication test to prove GREEN**

Run:

    node --import tsx --test components/portal/auth/login-presentation.test.tsx

Expected: PASS.

- [ ] **Step 5: Update matrix and commit**

Set C00 to implemented only after its focused test passes. Stage only the C00 presentation, login form/page integration and C00 matrix row. Commit:

    feat: implement the FSS portal sign-in surface

### Task 8: Implement the authorised client overview

**Files:**
- Create: lib/operations/overview/client-overview.ts
- Create: lib/operations/overview/client-overview.test.ts
- Create: components/portal/overview/client-overview.tsx
- Create: components/portal/overview/client-overview.test.tsx
- Modify: app/(portal)/(client)/portal/page.tsx
- Modify: docs/design/fss-studio-experience/screen-coverage.csv

**Interfaces:**
- ClientOverview contains attention items, next steps, projects and latest update with safe route destinations.
- selectClientAttention returns the highest-priority authorised attention item or null.
- loadClientOverview accepts OperationsDb, VerifiedPortalIdentity, organisationId and correlationId, and calls existing scoped project, request, notification and checklist reads.
- The page uses a verified organisation context; multiple memberships render C25 selection rather than selecting an organisation implicitly.

- [ ] **Step 1: Write the failing overview selection tests**

Create client-overview.test.ts with ordered fixtures for ready-for-review work, pending setup task, active project and no data. Assert review is selected before setup, setup before generic project, and no-data returns null rather than an invented metric.

    test("prioritises an authorised review over setup and project summaries", () => {
      assert.equal(selectClientAttention(overview)?.kind, "review")
      assert.equal(selectClientAttention(emptyOverview), null)
    })

- [ ] **Step 2: Run the focused test to prove RED**

Run:

    node --import tsx --test lib/operations/overview/client-overview.test.ts

Expected: FAIL because client-overview does not exist.

- [ ] **Step 3: Implement the narrow client overview read model**

Create client-overview.ts. Reuse listPortalProjects, listPortalRequests, listPortalNotifications and the existing client checklist query through verified portal transaction boundaries. Return counts only when the underlying authorised collection has resolved. Map attention actions to portalPath destinations and preserve organisationId query context. Do not issue an N+1 query for every project or request.

- [ ] **Step 4: Write the failing client overview component test**

Create client-overview.test.tsx. Render a real overview fixture and assert it includes one visible New request action, the selected review action, a project link and no static example person, date or money value.

- [ ] **Step 5: Run the component test to prove RED**

Run:

    node --import tsx --test components/portal/overview/client-overview.test.tsx

Expected: FAIL because ClientOverview is absent.

- [ ] **Step 6: Implement C01, M01 and C25**

Implement ClientOverview with PortalButton, PageHeader, attention card, stat rows, next-step list, project summary and latest update. Rework the client portal home page so authenticated single-membership users see C01, multi-membership users see the C25 workspace chooser, and clients with no authorised membership retain the existing safe no-access response. Use the client shell and mobile layout, not legacy portal.module.css.

- [ ] **Step 7: Run focused client checks**

Run:

    node --import tsx --test lib/operations/overview/client-overview.test.ts components/portal/overview/client-overview.test.tsx

Expected: PASS.

- [ ] **Step 8: Update matrix and commit**

Set C01, C25 and M01 to implemented only after their focused tests pass. Stage only Task 8 files and the three matrix rows. Commit:

    feat: implement the client workspace overview

### Task 9: Implement the authorised Studio overview

**Files:**
- Create: lib/operations/overview/studio-overview.ts
- Create: lib/operations/overview/studio-overview.test.ts
- Create: components/portal/overview/studio-overview.tsx
- Create: components/portal/overview/studio-overview.test.tsx
- Modify: app/(portal)/(studio)/portal/admin/page.tsx
- Modify: docs/design/fss-studio-experience/screen-coverage.csv

**Interfaces:**
- StudioOverview contains attention queue, delivery summary, agreement/journey summary and links to real Studio routes.
- selectStudioAttention orders urgent request, blocked journey, signing readiness and billing exception without inventing totals.
- loadStudioOverview accepts OperationsDb and FssAdminContext and uses current staff repositories or one narrow staff-scoped aggregate query.
- The Studio page remains unavailable to clients and revoked staff.

- [ ] **Step 1: Write the failing Studio selection test**

Create studio-overview.test.ts with fixtures for an overdue review, a blocked journey, a signing readiness item and no actionable data. Assert exact priority ordering and assert empty data creates an explanatory empty overview.

    test("orders founder actions without manufacturing queue counts", () => {
      assert.deepEqual(
        selectStudioAttention(fixture).map((item) => item.kind),
        ["review", "journey", "signing"],
      )
    })

- [ ] **Step 2: Run the focused test to prove RED**

Run:

    node --import tsx --test lib/operations/overview/studio-overview.test.ts

Expected: FAIL because studio-overview does not exist.

- [ ] **Step 3: Implement the staff-scoped overview model**

Create studio-overview.ts. Reuse requireFssAdmin context and staff repositories for journeys, delivery, agreements, projects, billing exceptions and notifications. Use a single dedicated staff-scoped aggregate only if existing repository calls cannot express the required summary without excessive queries. Return real action URLs under /admin and safe zero-state copy when no action exists.

- [ ] **Step 4: Write the failing Studio component test**

Create studio-overview.test.tsx. Assert the rendered overview contains the priority card, queue link, action labels and no client navigation/workspace control.

- [ ] **Step 5: Run the component test to prove RED**

Run:

    node --import tsx --test components/portal/overview/studio-overview.test.tsx

Expected: FAIL because StudioOverview is absent.

- [ ] **Step 6: Implement F01 and M07**

Replace the static FSS Studio page with StudioOverview, retaining operationsEnabled, portal auth and requireFssAdmin checks. Use the Studio shell, approved navy action card, responsive metric grid, action queue and empty state. Never swallow a database failure as a successful empty workspace.

- [ ] **Step 7: Run focused Studio checks**

Run:

    node --import tsx --test lib/operations/overview/studio-overview.test.ts components/portal/overview/studio-overview.test.tsx
    node --import tsx --test lib/operations/auth/release-flags.test.ts

Expected: PASS.

- [ ] **Step 8: Update matrix and commit**

Set F01 and M07 to implemented only after focused checks pass. Stage only Task 9 files and the two matrix rows. Commit:

    feat: implement the FSS Studio overview

### Task 10: Add deterministic desktop and mobile visual comparison coverage

**Files:**
- Modify: package.json
- Modify: pnpm-lock.yaml
- Create: playwright.config.ts
- Create: app/__visual/fss-studio/[scenario]/page.tsx
- Create: app/__visual/fss-studio/[scenario]/visual-scenarios.tsx
- Create: app/__visual/fss-studio/[scenario]/visual-scenarios.test.tsx
- Create: tests/e2e/fss-studio.visual.spec.ts
- Create: tests/e2e/fss-studio.visual.spec.ts-snapshots/
- Modify: .gitignore
- Modify: docs/design/fss-studio-experience/screen-coverage.csv

**Interfaces:**
- resolveVisualScenario(name, enabled, nodeEnvironment) returns one of client-overview, client-workspace-switcher, studio-overview, client-shell or studio-shell, or null.
- The visual route calls notFound unless FSS_VISUAL_TESTS_ENABLED is true and NODE_ENV is not production.
- Playwright projects fss-studio-desktop and fss-studio-mobile use 1440x1200 and 390x844 viewports.
- pnpm test:visual runs playwright test.

- [ ] **Step 1: Install the narrowly justified visual test dependency**

Add @playwright/test as a development dependency using pnpm. It is required because the user explicitly requested checked desktop/mobile screenshot comparison tests and the repository has no browser-test runner.

- [ ] **Step 2: Write the failing visual-route safety test**

Create visual-scenarios.test.tsx. Assert resolveVisualScenario returns null when disabled or production and returns a client overview fixture only when enabled in development.

    test("never exposes visual fixtures unless the non-production test gate is enabled", () => {
      assert.equal(resolveVisualScenario("client-overview", false, "development"), null)
      assert.equal(resolveVisualScenario("client-overview", true, "production"), null)
      assert.ok(resolveVisualScenario("client-overview", true, "development"))
    })

- [ ] **Step 3: Run the focused test to prove RED**

Run:

    node --import tsx --test app/__visual/fss-studio/[scenario]/visual-scenarios.test.tsx

Expected: FAIL because visual-scenarios does not exist.

- [ ] **Step 4: Implement the fixture boundary and route**

Create visual-scenarios.tsx with deterministic fixtures built from the Phase 1 overview and shell component props. Create the route page which reads only FSS_VISUAL_TESTS_ENABLED and NODE_ENV on the server, returns notFound outside non-production test execution, and renders no customer/provider data. Do not add an API route or bypass normal authorisation in portal pages.

- [ ] **Step 5: Run the fixture safety test to prove GREEN**

Run:

    node --import tsx --test app/__visual/fss-studio/[scenario]/visual-scenarios.test.tsx

Expected: PASS.

- [ ] **Step 6: Configure Playwright and write screenshot assertions**

Create playwright.config.ts with a local webServer command that sets FSS_VISUAL_TESTS_ENABLED=true and starts the existing Next dev server on a fixed non-public test port. Set testDir to tests/e2e, outputDir to output/playwright, and screenshots to retain only on failure. Add tests/e2e/fss-studio.visual.spec.ts with one named scenario per Phase 1 desktop and mobile row. Each test navigates to the test-only route, checks the page heading and uses expect(page).toHaveScreenshot with a stable name.

Use the exact test titles:

    client sign-in desktop matches C00
    client sign-in mobile reflows C00
    client overview desktop matches C01
    client overview mobile matches M01
    client workspace selection desktop matches C25
    Studio overview desktop matches F01
    Studio overview mobile matches M07

- [ ] **Step 7: Generate and inspect the first baselines**

Install the Playwright Chromium browser in the local development environment. Run:

    pnpm test:visual --update-snapshots

Open the seven generated screenshots at their matching viewports, compare them with the imported references, correct P0-P2 differences, then rerun:

    pnpm test:visual

Expected: PASS with all seven screenshot comparisons.

- [ ] **Step 8: Update matrix and commit visual coverage**

Set C00, C01, C25, F01, M01 and M07 desktop_visual and mobile_visual fields to the exact test names and mark them verified only after screenshot and focused functional tests pass. Stage only Task 10 files, baselines, matrix rows, package files and .gitignore output exclusion. Commit:

    test: add FSS Studio desktop and mobile visual coverage

### Task 11: Run Phase 1 quality gates and open the phase PR

**Files:**
- Modify: .github/workflows/ci.yml
- Modify: docs/design/fss-studio-experience/screen-coverage.csv
- Modify: docs/runbooks/operations-studio-cutover.md only if a Phase 1 check prerequisite needs clarification

**Interfaces:**
- CI installs the Playwright browser cache and runs pnpm test:visual after the existing public redesign check.
- Matrix records verified for C01, C25, F01, M01 and M07 only when all Phase 1 checks pass.
- The Phase 1 PR has no production environment change.

- [ ] **Step 1: Write the failing CI command expectation**

Before changing CI, run the complete Phase 1 local command sequence. If pnpm test:visual is absent from CI, record the expected missing CI invocation in the PR checklist and add it in the next step. This is configuration verification, not a replacement for the browser tests written in Task 10.

- [ ] **Step 2: Update CI for browser screenshots**

Add a dedicated visual-test CI step after dependencies are installed. Cache the Playwright browser directory by lockfile hash, install Chromium when the cache misses, and run pnpm test:visual. Upload output/playwright and screenshot diffs on failure. Do not upload visual fixtures or screenshots containing customer data.

- [ ] **Step 3: Run all Phase 1 checks**

Run:

    pnpm verify:fss-studio-coverage
    pnpm test:public-redesign
    pnpm typecheck
    pnpm lint
    pnpm test:unit
    pnpm test:integration:operations
    pnpm test:visual
    pnpm build

If an Operations database integration environment is unavailable, run its preflight, record its precise missing requirement in the PR, and do not label that check green.

- [ ] **Step 4: Perform the Phase 1 visual and security review**

Inspect C01, C25, F01, M01 and M07 at desktop/mobile reference sizes. Verify client and Studio shells do not nest, staff/client routing is still guarded, keyboard focus is visible, 320 px reflow works, reduced motion removes nonessential motion, and production fssStudioEnabled stays false without its explicit environment flag.

- [ ] **Step 5: Commit CI and evidence updates**

Stage only CI, matrix and directly related Phase 1 runbook evidence. Commit:

    ci: verify FSS Studio visual regression coverage

- [ ] **Step 6: Open and merge the PR only after required checks are green**

Push feat/fss-studio-redesign-phase-01-foundation, open a PR into main with the Phase 1 matrix rows and completed check evidence, and wait for all required GitHub checks. Do not merge while any required check is pending, failed or skipped. If GitHub network access or repository policy prevents PR creation or merge, preserve the committed branch, report the exact external blocker and do not use a bypass.

After required checks are green and normal review policy allows it, merge using the protected GitHub workflow. Confirm main contains the merge commit before creating Phase 2 from updated remote main.

## Plan self-review

- **Spec coverage:** Tasks 1-2 satisfy handoff provenance and the exact 88-row matrix. Task 4 removes client/Studio nesting. Tasks 5-6 create approved tokens and responsive navigation. Task 7 delivers the C00 authentication surface without changing Clerk flow. Tasks 8-9 deliver the first real client and founder overviews. Tasks 3 and 10-11 rename the public-only validator and add portal screenshot coverage. Tasks 10-11 retain the production-disabled Studio gate and require authenticated evidence later in Phase 8.
- **Placeholder scan:** No task contains unresolved placeholders. The external requirements that depend on CI, test fixtures and GitHub policy have concrete checks and a fail-closed handling rule.
- **Type consistency:** The validator types flow from Tasks 1-2. Persona shell navigation types flow from Task 6 into the client and Studio layouts. The Task 7 presentation boundary keeps Clerk state in the existing form. Overview DTOs remain separate client and staff interfaces in Tasks 8-9. Visual fixtures consume only component props from Tasks 6-9.
- **Review focus coverage:** Task 4 owns public route compatibility and persona isolation. Tasks 8-9 own no-invented-data checks. Tasks 1-2 own complete matrix validation. Task 10 owns production-inaccessible fixture tests.
