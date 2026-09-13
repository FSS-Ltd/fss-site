# Operations dashboard implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Give every founder-facing Growth Operations screen a coherent, accessible enterprise dashboard treatment and make portal invitations visibly actionable with a database-assigned role.

**Architecture:** Keep data loading, founder authorisation, mutation endpoints, and route contracts unchanged. Add a small shared Operations presentation layer for hierarchy, panels, status chips, and responsive tables. Make the permissions module the authoritative source for founder-facing role descriptions, then consume it from metrics, the access register, and a radio-based invitation picker.

**Tech Stack:** Next.js App Router, React, TypeScript strict mode, CSS Modules, Lucide, node:test, react-dom/server.

**Spec:** docs/superpowers/specs/2026-09-13-operations-dashboard-design.md

## Global Constraints

- Retain POST /api/growth/operations/portal-access with action "grant_access"; do not move invitation business rules from lib/operations/auth/operator.ts.
- Clerk remains responsible only for account activation delivery and authentication. The Operations database remains the role and invite-system authority.
- Do not alter permissions, database schema, invite expiry, webhook acceptance, founder authorisation, route contracts, or production deployment settings.
- Use established navy #07182e, teal #0f7a83, slate #526078, existing surface tokens, and semantic status colours. Do not add a dependency.
- Do not display invented analytics. Every metric, bar, chart, and summary must derive from props already supplied to its screen.
- Every interactive target is at least 44px high with visible focus. Tables retain a labelled horizontal-scroll region on narrow displays.
- Chart values need visible labels and a text summary. Colour, hover, animation, and tooltips are supplemental only.
- Keep client JavaScript local to the invitation picker and existing interactive workflows. Pages remain Server Components.
- Respect prefers-reduced-motion.

---

## File structure

| File | Responsibility |
| --- | --- |
| lib/operations/auth/permissions.ts | Capability matrix and reviewed founder-facing role labels/descriptions. |
| lib/operations/auth/access-dashboard-metrics.ts | Role metric data derived from the authoritative presentation. |
| components/operations/shared/operations-ui.module.css | Reusable visual tokens and Operations layout primitives. |
| components/operations/shared/operations-page-header.tsx | Server-safe context, title, outcome and action-slot header. |
| components/operations/clients/portal-role-picker.tsx | Client radio chooser, supplemental help tooltips, persistent role explanation. |
| components/operations/clients/portal-access-form.ts | Typed FormData-to-grant-access request mapper. |
| Existing components/operations modules | Workflow-specific presentation changes; routes stay authorisation/data boundaries. |

### Task 1: Centralise portal-role presentation with the permission matrix

**Files:**
- Modify: lib/operations/auth/permissions.ts
- Modify: lib/operations/auth/access-dashboard-metrics.ts
- Modify: lib/operations/auth/permissions.test.ts
- Modify: lib/operations/auth/access-dashboard-metrics.test.ts

**Interfaces:**
- Produces PortalRolePresentation and portalRolePresentation: Record<PortalRole, PortalRolePresentation>.
- Produces getPortalRolePresentation(role: PortalRole): PortalRolePresentation.
- Preserves portalRoleOptions as readonly { value, label, detail } entries for metric consumers.

- [ ] **Step 1: Write the failing role-description proof**

    test("role descriptions state only capabilities granted by the permission matrix", () => {
      assert.match(getPortalRolePresentation("owner").detail, /Projects, requests, agreements, billing/);
      assert.equal(hasPortalCapability("owner", "invites.request"), true);
      assert.match(getPortalRolePresentation("contributor").detail, /creating or commenting on requests/);
      assert.equal(hasPortalCapability("contributor", "billing.read"), false);
      assert.match(getPortalRolePresentation("billing_contact").detail, /Billing records and payment management only/);
      assert.equal(hasPortalCapability("billing_contact", "projects.read"), false);
      assert.match(getPortalRolePresentation("viewer").detail, /Read-only projects, documents, and services/);
      assert.equal(hasPortalCapability("viewer", "requests.create"), false);
    });

- [ ] **Step 2: Run the test and verify it fails**

    Run: pnpm exec tsx --test lib/operations/auth/permissions.test.ts
    Expected: FAIL because getPortalRolePresentation does not exist.

- [ ] **Step 3: Implement the authoritative mapping**

    export type PortalRolePresentation = { label: string; detail: string };

    export const portalRolePresentation: Record<PortalRole, PortalRolePresentation> = {
      owner: { label: "Owner", detail: "Projects, requests, agreements, billing, and invitation requests for the organisation." },
      contributor: { label: "Contributor", detail: "Projects, shared documents, and creating or commenting on requests." },
      billing_contact: { label: "Billing contact", detail: "Billing records and payment management only." },
      viewer: { label: "Viewer", detail: "Read-only projects, documents, and services." },
    };

    export function getPortalRolePresentation(role: PortalRole): PortalRolePresentation {
      return portalRolePresentation[role];
    }

  In access-dashboard-metrics.ts, map the existing portalRoles order through getPortalRolePresentation. Update exact expected details in access-dashboard-metrics.test.ts.

- [ ] **Step 4: Verify and commit**

    Run: pnpm exec tsx --test lib/operations/auth/permissions.test.ts lib/operations/auth/access-dashboard-metrics.test.ts
    Expected: PASS.

    git add lib/operations/auth/permissions.ts lib/operations/auth/access-dashboard-metrics.ts lib/operations/auth/permissions.test.ts lib/operations/auth/access-dashboard-metrics.test.ts
    git commit -m "feat: centralise portal role presentation"

### Task 2: Build accessible role selection and request-payload boundary

**Files:**
- Create: components/operations/clients/portal-role-picker.tsx
- Create: components/operations/clients/portal-role-picker.module.css
- Create: components/operations/clients/portal-access-form.ts
- Create: components/operations/clients/portal-role-picker.test.tsx
- Create: components/operations/clients/portal-access-form.test.ts

**Interfaces:**
- Consumes readonly PortalRoleOption[].
- Produces PortalRolePicker({ name, options, defaultValue, disabled }): React.JSX.Element.
- Produces createGrantAccessPayload(form: FormData): { action: "grant_access"; organisationId: string; name: string; email: string; role: PortalRole; reviewReference: string }.

- [ ] **Step 1: Add failing radio/help/payload tests**

    test("role picker exposes native radios, help buttons and persistent selection description", () => {
      const html = renderToStaticMarkup(
        <PortalRolePicker name="role" defaultValue="viewer" disabled={false} options={portalRoleOptions} />,
      );
      assert.match(html, /type="radio"/);
      assert.match(html, /name="role"/);
      assert.match(html, /aria-describedby="portal-role-description"/);
      assert.match(html, /aria-label="More about Owner"/);
      assert.match(html, /Read-only projects, documents, and services/);
    });

    test("request payload preserves selected database role", () => {
      const form = new FormData();
      form.set("organisationId", "organisation-1");
      form.set("name", "Taylor Example");
      form.set("email", "taylor@example.test");
      form.set("role", "billing_contact");
      form.set("reviewReference", "Finance contact approved by founder");
      assert.deepEqual(createGrantAccessPayload(form), {
        action: "grant_access", organisationId: "organisation-1", name: "Taylor Example",
        email: "taylor@example.test", role: "billing_contact",
        reviewReference: "Finance contact approved by founder",
      });
    });

- [ ] **Step 2: Run the tests and verify they fail**

    Run: pnpm exec tsx --test components/operations/clients/portal-role-picker.test.tsx components/operations/clients/portal-access-form.test.ts
    Expected: FAIL because both modules are absent.

- [ ] **Step 3: Implement the picker**

  Make the file a Client Component. Use a native fieldset, legend, four input type="radio" controls, labels, and selected state. Render the selected role in a persistent paragraph with id portal-role-description. Add one button per option with aria-label "More about [role]", aria-expanded, and aria-describedby pointing to a role="tooltip" span. Open its tooltip on focus, hover, and click/tap; close it on blur/mouse leave; do not put essential text only inside it.

  Use a typed selected role state, default viewer, minimum 44px radio cards/help buttons, explicit focus-visible styling, a responsive one/two-column grid, and a reduced-motion media rule. Do not reimplement radio keyboard semantics with ARIA.

- [ ] **Step 4: Implement the pure FormData mapper**

  Add a private readString(form, name) helper that throws on missing non-string values. Add a private isPortalRole(value: string): value is PortalRole predicate using portalRoles. Map exactly action, organisationId, name, email, role, and reviewReference. Reject an unknown role before returning. Do not validate or duplicate server rules here.

- [ ] **Step 5: Verify and commit**

    Run: pnpm exec tsx --test components/operations/clients/portal-role-picker.test.tsx components/operations/clients/portal-access-form.test.ts
    Expected: PASS.

    git add components/operations/clients/portal-role-picker.tsx components/operations/clients/portal-role-picker.module.css components/operations/clients/portal-role-picker.test.tsx components/operations/clients/portal-access-form.ts components/operations/clients/portal-access-form.test.ts
    git commit -m "feat: add accessible portal role picker"

### Task 3: Integrate the primary portal invitation workflow

**Files:**
- Modify: components/operations/clients/portal-access-dashboard.tsx
- Modify: components/operations/clients/portal-access-dashboard.module.css
- Create: components/operations/clients/portal-access-dashboard.test.tsx

**Interfaces:**
- Consumes PortalRolePicker and createGrantAccessPayload from Task 2.
- Preserves POST /api/growth/operations/portal-access and action "grant_access".
- Produces an Invite portal user button which focuses the organisation select in the invitation form.

- [ ] **Step 1: Write the failing dashboard contract test**

    test("portal access makes invitation primary and explains the activation sequence", () => {
      const html = renderToStaticMarkup(<PortalAccessDashboard data={oneOrganisationRegister} />);
      assert.match(html, /Invite portal user/);
      assert.match(html, /Choose a client, assign the database role, then send the activation email/);
      assert.match(html, /Clerk sends the activation email/);
      assert.match(html, /Portal role/);
      assert.match(html, /More about Owner/);
    });

  Define oneOrganisationRegister in the test with a single organisation and no entries, matching PortalAccessRegister exactly.

- [ ] **Step 2: Run and verify failure**

    Run: pnpm exec tsx --test components/operations/clients/portal-access-dashboard.test.tsx
    Expected: FAIL because the explicit primary invitation control and picker are absent.

- [ ] **Step 3: Implement the integration**

  Add a primary header button labelled Invite portal user. It calls focusInvitationForm(), which scrolls the section with id portal-invitation into view and focuses an organisation select ref. Choose "auto" scrolling when prefers-reduced-motion matches and "smooth" otherwise.

  Give the form section id portal-invitation and title it Invite portal user. Place the persistent explanation directly above it: "Choose a client, assign the database role, then send the activation email. The role is written to Operations records before Clerk delivers the activation email."

  Replace the existing role select with PortalRolePicker defaulting to viewer. Replace the inline request object with JSON.stringify(createGrantAccessPayload(form)). Retain the pending disable state, generic failure message, success message, router.refresh(), existing revoke operation, organisation-empty prerequisite, and no secrets in browser code. After a success reset, reset picker state to viewer using a form-version key.

- [ ] **Step 4: Complete source-backed dashboard presentation**

  Retain the existing source-backed metrics and role-distribution bars. Add a compact "How access starts" sequence: founder approval, Operations role record, Clerk activation email. Labels and counts stay visible beside every role bar. Apply the existing navy/teal surface hierarchy to the new primary action, sequence, role picker, form and register. Preserve text status labels for active/pending states.

- [ ] **Step 5: Verify and commit**

    Run: pnpm exec tsx --test components/operations/clients/portal-access-dashboard.test.tsx components/operations/clients/portal-role-picker.test.tsx components/operations/clients/portal-access-form.test.ts lib/operations/auth/access-dashboard-metrics.test.ts
    Expected: PASS.

    git add components/operations/clients/portal-access-dashboard.tsx components/operations/clients/portal-access-dashboard.module.css components/operations/clients/portal-access-dashboard.test.tsx
    git commit -m "feat: make portal invitation and role assignment explicit"

### Task 4: Add shared Operations dashboard primitives

**Files:**
- Create: components/operations/shared/operations-page-header.tsx
- Create: components/operations/shared/operations-page-header.test.tsx
- Create: components/operations/shared/operations-ui.module.css

**Interfaces:**
- Produces OperationsPageHeader({ context, title, description, children, action }): React.JSX.Element.
- CSS exposes page, header, eyebrow, description, headerActions, panel, statusChip, metricGrid, metricCard, scrollRegion, emptyState and errorState.
- The header is server-safe and has no client directive or event handler.

- [ ] **Step 1: Write the failing header test**

    test("operations header provides context, outcome and optional action", () => {
      const html = renderToStaticMarkup(
        <OperationsPageHeader context="Operations · Billing" title="Needs your attention"
          description="Payment exceptions and collection decisions, ready for review."
          action={<Link href="/growth/operations/clients">Client register</Link>} />,
      );
      assert.match(html, /Operations · Billing/);
      assert.match(html, /Needs your attention/);
      assert.match(html, /Payment exceptions/);
      assert.match(html, /Client register/);
    });

- [ ] **Step 2: Run and verify failure**

    Run: pnpm exec tsx --test components/operations/shared/operations-page-header.test.tsx
    Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement component and CSS primitives**

  Render context in an eyebrow, title as h1, description as a paragraph, optional children below it, and optional action in a header action area. Define Operations CSS custom properties on page using the approved navy, teal, slate and existing surfaces. Give panel and metricCard shared borders/elevation; give statusChip data-status variants; give scrollRegion overflow-x:auto plus focusability; keep controls at 44px and focus-visible outline. Provide 900px and 640px breakpoints and reduced-motion transition removal. Do not globally alter client-portal styles.

- [ ] **Step 4: Verify and commit**

    Run: pnpm exec tsx --test components/operations/shared/operations-page-header.test.tsx && pnpm typecheck
    Expected: PASS.

    git add components/operations/shared/operations-page-header.tsx components/operations/shared/operations-page-header.test.tsx components/operations/shared/operations-ui.module.css
    git commit -m "feat: add shared operations dashboard primitives"

### Task 5: Refresh the overview with source-backed reporting visuals

**Files:**
- Modify: components/operations/overview/overview.tsx
- Modify: components/operations/overview/metric-cards.tsx
- Modify: components/operations/overview/revenue-movements.tsx
- Modify: components/operations/overview/exception-queue.tsx
- Modify: components/operations/overview/overview.module.css
- Create: components/operations/overview/revenue-movements.test.tsx

**Interfaces:**
- Consumes shared presentation styles from Task 4.
- Preserves MetricsSnapshot, URL filter fields, export controls, tables, anchors and drill-down links.
- Produces a labelled MRR movement visual derived solely from RevenueSummary.

- [ ] **Step 1: Write the failing MRR visual test**

    test("MRR movement visual exposes arithmetic and labelled values", () => {
      const html = renderToStaticMarkup(<RevenueMovements data={revenueSummary} />);
      assert.match(html, /MRR movements/);
      assert.match(html, /Start \+ new \+ expansion/);
      assert.match(html, /aria-label="MRR movement visual"/);
      assert.match(html, /New/);
      assert.match(html, /End/);
    });

  Use a complete RevenueSummary fixture copied from its type, never a cast or partial object.

- [ ] **Step 2: Run and verify failure**

    Run: pnpm exec tsx --test components/operations/overview/revenue-movements.test.tsx
    Expected: FAIL because no visual region exists.

- [ ] **Step 3: Implement the visual hierarchy**

  Use OperationsPageHeader while retaining Client register and Portal access navigation as action links. Render filters and provider-freshness notices as panels. Keep all filters and form field names unchanged.

  In RevenueMovements, retain the exact table and add a preceding figure aria-label="MRR movement visual". Calculate each bar width as abs(value) divided by the largest abs item, with 1 as the zero-safe denominator. Render each label and formatMoney result in text beside its decorative aria-hidden fill, retain the arithmetic in the caption, and use a reduction class plus the signed text for contraction/churn. Style existing metric cards and exception rows with shared visual hierarchy without altering report definitions, ordering, links or table captions.

- [ ] **Step 4: Verify and commit**

    Run: pnpm exec tsx --test components/operations/overview/revenue-movements.test.tsx && pnpm typecheck
    Expected: PASS.

    git add components/operations/overview
    git commit -m "feat: refresh operations reporting dashboard"

### Task 6: Refresh the client register and billing exception queue

**Files:**
- Modify: components/operations/clients/client-list.tsx
- Modify: components/operations/clients/client-list.module.css
- Modify: components/operations/clients/client-list.test.tsx
- Modify: components/operations/billing/exception-list.tsx
- Modify: components/operations/billing/exception-list.module.css
- Modify: components/operations/billing/exception-list.test.tsx

**Interfaces:**
- Consumes OperationsPageHeader and shared page/panel/metric/status styles.
- Preserves ClientListState, BillingExceptionList state union, existing links, billing-enabled condition, pagination and safety copy.

- [ ] **Step 1: Add failing source-backed count assertions**

  In client-list.test.tsx's existing one-row fixture, assert "1 client organisation on this page" and "2 reviewed engagement links". In exception-list.test.tsx's existing one-row fixture, assert "1 open billing exception on this page" and retain its assertion for "Live" or "Test" as supplied.

- [ ] **Step 2: Run and verify failure**

    Run: pnpm exec tsx --test components/operations/clients/client-list.test.tsx components/operations/billing/exception-list.test.tsx
    Expected: FAIL for the new count summaries.

- [ ] **Step 3: Implement both screens**

  Replace each ad-hoc header with OperationsPageHeader, preserving all current navigation links as actions. In ready ClientList state add exactly two summary cards: rows.length client organisations and sum(row.engagementCount) reviewed engagement links. Keep every fact/link and render readable textual status chips for tradingStatus/lifecycle.

  In ready BillingExceptionList state add one card from state.rows.length labelled open billing exceptions on this page. Keep test/live as text plus a chip. Retain the safety statement that review does not message, suspend services or start legal action, and preserve recovery links for error/empty state.

- [ ] **Step 4: Verify and commit**

    Run: pnpm exec tsx --test components/operations/clients/client-list.test.tsx components/operations/billing/exception-list.test.tsx && pnpm typecheck
    Expected: PASS.

    git add components/operations/clients/client-list.tsx components/operations/clients/client-list.module.css components/operations/clients/client-list.test.tsx components/operations/billing/exception-list.tsx components/operations/billing/exception-list.module.css components/operations/billing/exception-list.test.tsx
    git commit -m "feat: refresh client and billing operations screens"

### Task 7: Refresh agreement, signing and onboarding screens

**Files:**
- Modify: components/operations/agreements/agreement-register.tsx
- Modify: components/operations/agreements/agreements.module.css
- Modify: components/operations/signing/signing-review.tsx
- Modify: components/operations/signing/signing.module.css
- Modify: app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/signing/page.tsx
- Modify: app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/journey/page.tsx
- Modify: components/operations/onboarding/journey-preview.tsx
- Modify: components/operations/onboarding/journey-timeline.tsx
- Modify: components/operations/onboarding/journey-preview.test.tsx

**Interfaces:**
- Consumes OperationsPageHeader and shared styles.
- Preserves all AgreementRegister, SigningReview, journey command props, feature flags, form controls, exact-recipient confirmation and mutation contracts.
- Shows counts only from register.agreements.length, approvals.length and journeys.length.

- [ ] **Step 1: Strengthen onboarding regression proof**

  In journey-preview.test.tsx assert both "Welcome and proposal have separate approvals" and "I reviewed these exact recipients, content, documents and access".

- [ ] **Step 2: Establish the baseline**

    Run: pnpm exec tsx --test components/operations/onboarding/journey-preview.test.tsx
    Expected: PASS; this test protects existing approval behaviour before styling changes.

- [ ] **Step 3: Implement shared hierarchy**

  Use OperationsPageHeader for agreements, signing and journey pages, retaining back links and all feature-flagged links/actions. Add source-backed count cards for agreements, signing approvals and journeys only where arrays already exist. Turn textual workflow statuses into chip styling while keeping every label visible. Treat agreement/signer/journey items as panels, preserving terms, activation, signature, document download, hash, preview, retry and exact confirmation controls.

- [ ] **Step 4: Verify and commit**

    Run: pnpm exec tsx --test components/operations/agreements/form-fields.test.tsx components/operations/onboarding/journey-preview.test.tsx && pnpm typecheck
    Expected: PASS.

    git add components/operations/agreements components/operations/signing components/operations/onboarding app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/signing/page.tsx app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/journey/page.tsx
    git commit -m "feat: refresh agreement signing and journey workflows"

### Task 8: Refresh request list and request-detail screens

**Files:**
- Modify: components/operations/requests/requests.module.css
- Modify: app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/requests/page.tsx
- Modify: app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/requests/[requestId]/page.tsx

**Interfaces:**
- Consumes shared Operations hierarchy while retaining RequestDetail and FounderRequestActions at their existing portal component boundary.
- Preserves UUID validation, founder scoping, request ordering, private-note visibility and all action props.

- [ ] **Step 1: Record invariants before changing markup**

  Inspect source and list these in the commit body: list limit is 100; new/review reminders only display when overdue; detail passes canComment={false} and hidePortalActions; notes remain FSS-only; only signed agreements are passed as action choices.

- [ ] **Step 2: Implement visual hierarchy**

  On the list page add OperationsPageHeader, a source-backed requests.length summary card, full-width request action panels, textual status chips, and a persistent next-action line. Keep status labels and overdue copy.

  On detail add shared page/header with the All requests back link. Wrap RequestDetail, FounderRequestActions, register pagination notice and internal notes in distinct panels. Keep "Visible only to FSS" directly beside private notes. Do not import a client component into either route page merely for styling.

- [ ] **Step 3: Verify and commit**

    Run: pnpm typecheck && pnpm lint
    Expected: PASS. Manually confirm UUID validation, catch/alert recovery, founder action props, private-note boundary and signed-agreement filter are unchanged.

    git add components/operations/requests/requests.module.css app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/requests/page.tsx app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/requests/[requestId]/page.tsx
    git commit -m "feat: refresh operations request workflow"

### Task 9: Complete quality gate and visual verification

**Files:**
- Modify only files where these checks demonstrate a defect.

**Interfaces:**
- Verifies Tasks 1-8 without changing API contracts, deployment configuration, or production state.

- [ ] **Step 1: Inspect the full diff**

    Run: git diff origin/main...HEAD --check && git diff --check && git status --short
    Expected: no whitespace errors and no untracked temporary artefacts. Re-open every changed TypeScript/CSS file for imports, focus, disabled, escaped-output and responsive checks.

- [ ] **Step 2: Run the Operations and repository unit suite**

    Run: pnpm test:unit
    Expected: PASS. Fix the source of a failure; do not weaken a test.

- [ ] **Step 3: Run static and production compilation gates**

    Run: pnpm typecheck && pnpm lint && pnpm build
    Expected: all PASS.

- [ ] **Step 4: Verify every visual route at desktop and 390px**

  Use a local production build or PR preview. Inspect /growth/operations, /growth/operations/clients, /growth/operations/billing, /growth/operations/portal-access, and each agreement, journey, signing, request-list and request-detail route.

  Confirm context/title/outcome hierarchy, labelled source-backed values, focus indicators, no page-level horizontal overflow, tables in labelled scroll regions, preserved empty/error states, and no invented data. On Portal access tab through every radio/help button; check focus opens help, tap toggles help, selected-role detail persists, and the request mapper sends the selected role.

- [ ] **Step 5: Commit only validation fixes and prepare review**

  If a check finds defects, stage just the files changed to correct them, use a conventional fix commit explaining the verified defect, then repeat Steps 1-4. Do not create an empty commit. Push a new review branch and open a new pull request because PR #224 is merged. Do not deploy Production.

## Self-review

**Spec coverage:** Tasks 4-8 apply the common dashboard hierarchy to overview, clients, billing, portal access, agreement, journey, signing, request list and request detail. Tasks 3 and 5 deliver charts whose input already exists: role distribution and MRR movements. Tasks 1-3 make invitation/DB-role selection explicit and explain every role through a persistent description plus accessible tooltip. Global constraints and Task 9 preserve all backend, security and deployment boundaries.

**Placeholder scan:** Every file, type, component contract, test assertion, command, data source, accessibility behaviour and verification route is named. No later task relies on an unnamed API or undefined interface.

**Type consistency:** Task 1 produces PortalRolePresentation and preserves PortalRoleOption. Task 2 consumes PortalRoleOption and produces a PortalRole in the grant-access payload. Task 3 sends that payload to the unchanged operation. The header is introduced before every route/component that consumes it.
