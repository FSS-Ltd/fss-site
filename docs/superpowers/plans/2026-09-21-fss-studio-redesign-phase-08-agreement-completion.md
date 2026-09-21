# FSS Studio Redesign Phase 8 Agreement Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy all-in-one agreement form with a secure, persisted FSS Studio builder and complete every remaining Phase 3 screen contract (C14–C16, C30, F09–F17, F32, F34 and F37) with functional routes and paired desktop/mobile visual evidence.

**Architecture:** Keep the immutable `operations.agreements` and signing records as the only source of signed/commercial truth. Add a staff-only, versioned builder-draft record for incomplete form state, validate each saved step at the service boundary, and materialise an authoritative agreement only from a complete builder draft linked to an existing reviewed engagement. Compose the Studio UI from the existing Portal shadcn-style primitives and Lucide icons, never the legacy Operations form or shell.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, PostgreSQL/Supabase migrations, Zod, existing Operations agreement/signing services, Portal UI primitives, CSS Modules, Node test runner and Playwright.

**Spec:** `docs/design/fss-studio-experience/03-screen-contracts.md` sections C14–C16, C30, F09–F17, F32, F34 and F37; the corresponding SVG mockups under `docs/design/fss-studio-experience/wireframes/`.

## Global Constraints

- Preserve `OPERATIONS_FSS_STUDIO_ENABLED`, `OPERATIONS_SIGNING_ENABLED` and all production environment settings. Do not enable any release flag.
- A builder draft is editable staff working state, not a signed agreement, an approved request, a document fingerprint, a signature or a client-visible record.
- Final agreement creation validates the complete existing `draftSchema`, requires an organisation-scoped reviewed engagement and invokes `runAgreementCommand` within the same staff transaction, preserving the existing revision/signing/evidence constraints.
- Use `PortalButton`, `PortalCard`, `PortalField`, `PortalSelect`, `PortalTextarea`, `Notice`, `StatusBadge` and Lucide icons. Do not introduce a second UI system or bespoke SVG menu icons.
- The browser never supplies trusted organisation, staff identity, agreement status, document hashes, source references, signer identity, version or signing evidence.
- F32 may only attach work already reviewed in the Growth system. The UI must direct users to that source of truth rather than creating an unreviewed replacement engagement.
- Keep all visual fixtures deterministic, synthetic and guarded by `FSS_VISUAL_TESTS_ENABLED`.
- Every changed behavior begins with a focused failing test and is verified by the full unit suite before the phase is claimed complete.

## Review Focus

1. A staff member must not read, save or finalise a builder draft for another organisation; test route-selected organisation binding and stale-version conflicts in Task 1.
2. Incomplete builder data must never reach `operations.agreements`; test that only the finalise command invokes the complete draft validator in Task 1.
3. A route such as `/agreements/new?draftId=...` must retain the saved builder draft after refresh and must reject an unknown or foreign draft in Task 2.
4. The F37 presentation must distinguish prepared, queued/delivered and signed evidence states without claiming that email delivery or approval is a signature in Task 4.
5. Mobile agreement screens must stack summary, controls and evidence without horizontal overflow; test every remaining matrix row at phone width in Task 5.

### Task 1: Add a staff-only persistent agreement builder-draft boundary

**Files:**
- Create: `supabase/migrations/20260921190000_operations_agreement_builder_drafts.sql`
- Create: `lib/operations/agreements/builder-draft-schema.ts`
- Create: `lib/operations/agreements/builder-draft-service.ts`
- Create: `lib/operations/agreements/builder-draft-service.test.ts`
- Create: `lib/operations/http/staff-agreement-draft-route.ts`
- Create: `lib/operations/http/staff-agreement-draft-route.test.ts`
- Create: `app/api/portal/admin/clients/[organisationId]/agreement-drafts/route.ts`
- Modify: `lib/operations/agreements/types.ts`
- Modify: `lib/operations/agreements/repository.ts`

**Interfaces:**
- Produces `AgreementBuilderDraft`, containing `id`, `organisationId`, `version`, `step`, `engagementId`, `content`, `createdAt` and `updatedAt`.
- Produces `saveStaffAgreementBuilderDraft(db, admin, organisationId, command, correlationId)` and `loadStaffAgreementBuilderDraft(db, admin, organisationId, draftId)`.
- The command union is exact: `{ action: "save"; draftId; expectedVersion; step; content }` and `{ action: "finalise"; draftId; expectedVersion }`.
- `finalise` derives the complete `AgreementDraft` server-side, invokes `runAgreementCommand` inside the same staff transaction and marks the builder draft finalised atomically. It does not prepare or approve signing.

- [ ] **Step 1: Write failing domain and HTTP tests**

```tsx
test("staff builder drafts retain a partial scope but finalisation requires a complete agreement", async () => {
  const saved = await saveStaffAgreementBuilderDraft(db, staff, organisationId, {
    action: "save", content: { title: "Website & booking", engagementId },
    draftId, expectedVersion: 0, step: "scope",
  }, correlationId);
  assert.equal(saved.version, 1);
  await assert.rejects(() => saveStaffAgreementBuilderDraft(db, staff, organisationId, {
    action: "finalise", draftId, expectedVersion: 1,
  }), /Check the agreement details/);
});

test("staff draft route binds the organisation selected by the URL", async () => {
  const response = await route(requestFor({ action: "save", draftId, expectedVersion: 0, step: "link", content: {} }), organisationId);
  assert.equal(response.status, 200);
  assert.equal(executedOrganisationId, organisationId);
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail because the draft boundary does not exist**

Run: `node --import tsx --test lib/operations/agreements/builder-draft-service.test.ts lib/operations/http/staff-agreement-draft-route.test.ts`

Expected: FAIL with missing module/export errors.

- [ ] **Step 3: Create the private, revision-checked migration and typed service**

```sql
create table operations.agreement_builder_drafts (
  id uuid primary key,
  organisation_id uuid not null references operations.organisations(id) on delete restrict,
  engagement_id uuid references growth.delivery_engagements(id) on delete restrict,
  step text not null check (step in ('link','scope','fees','people','document','review')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  version integer not null check (version > 0),
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  finalised_at timestamptz,
  finalised_agreement_id uuid references operations.agreements(id) on delete restrict,
  unique (organisation_id, id)
);
```

Use one `operations_founder`-only security-definer function for compare-and-swap save/finalise. It must call `operations.assert_active_staff_membership()`, verify that an `engagement_id` is already linked to `organisation_id`, reject a stale `expectedVersion`, and expose neither table nor function to browser-facing roles. The service must use `withFssAdminTransaction`, Zod schemas for per-step content and `runAgreementCommand` directly within that transaction for finalisation.

- [ ] **Step 4: Run focused domain, HTTP and migration policy checks**

Run: `node --import tsx --test lib/operations/agreements/builder-draft-service.test.ts lib/operations/http/staff-agreement-draft-route.test.ts && pnpm verify:migrations`

Expected: PASS.

- [ ] **Step 5: Commit the secure builder-draft boundary**

```bash
git add supabase/migrations lib/operations/agreements lib/operations/http app/api/portal/admin/clients
git commit -m "feat: persist FSS Studio agreement builder drafts"
```

### Task 2: Implement the actual F10–F16 builder routes and controls

**Files:**
- Create: `components/portal/agreements/staff-agreement-builder.tsx`
- Create: `components/portal/agreements/staff-agreement-builder.test.tsx`
- Create: `components/portal/agreements/use-agreement-builder-draft.ts`
- Create: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/agreements/new/page.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/agreements/page.tsx`
- Modify: `components/portal/agreements/agreement-builder.tsx`
- Modify: `components/portal/agreements/founder-agreement-fields.tsx`
- Modify: `components/portal/agreements/agreements.module.css`

**Interfaces:**
- `StaffAgreementBuilder` receives only server-projected `organisation`, `engagementChoices`, `initialDraft` and `baseHref` values.
- `useAgreementBuilderDraft` submits the route-selected organisation endpoint, updates the server-returned `draftId` and `version`, then pushes `?draftId=<id>&step=<step>` without trusting local state as persistence.
- `/portal/admin/clients/:organisationId/agreements/new` becomes the canonical new-builder route. The legacy collection route lists records and links to it.

- [ ] **Step 1: Write failing builder rendering tests**

```tsx
test("the link step presents reviewed work and a saved-draft continuation", () => {
  const html = render(<StaffAgreementBuilder draft={draft("link")} engagements={[engagement]} />);
  assert.match(html, /Link the right work/);
  assert.match(html, /Discovery complete/);
  assert.match(html, /Continue to scope/);
  assert.doesNotMatch(html, /New agreement<\/legend>/);
});

test("the no-engagement state preserves the draft and directs users to reviewed work", () => {
  const html = render(<StaffAgreementBuilder draft={draft("link")} engagements={[]} />);
  assert.match(html, /No engagement is linked/);
  assert.match(html, /Your draft stays saved/);
  assert.doesNotMatch(html, /<option value="[0-9a-f-]{36}/);
});
```

- [ ] **Step 2: Run the focused component test and confirm it fails**

Run: `node --import tsx --test components/portal/agreements/staff-agreement-builder.test.tsx`

Expected: FAIL because `StaffAgreementBuilder` does not exist.

- [ ] **Step 3: Implement each mockup step as a focused Portal section**

Render exactly one step at a time:

```tsx
switch (draft.step) {
  case "link": return <AgreementLinkStep ... />;      // F10 / F16
  case "scope": return <AgreementScopeStep ... />;    // F11
  case "fees": return <AgreementFeesStep ... />;      // F12
  case "people": return <AgreementPeopleStep ... />;  // F13
  case "document": return <AgreementDocumentStep ... />; // F14
  case "review": return <AgreementReviewStep ... />;  // F15
}
```

Each step saves before changing its URL state. The review step finalises a complete authoritative agreement and routes to the agreement record; it must say “Prepare signing” rather than “Signed” until the existing signing workflow returns evidence. The document step must state that the server generates the fingerprint from final immutable bytes; it must never accept a browser-supplied hash. Use `PortalField`, `PortalSelect`, `PortalTextarea`, `PortalButton`, `PortalCard`, `Notice` and `StatusBadge` only.

- [ ] **Step 4: Run builder and adjacent agreement tests**

Run: `node --import tsx --test components/portal/agreements/staff-agreement-builder.test.tsx components/portal/agreements/agreement-builder.test.tsx lib/operations/agreements/builder-draft-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the actual six-step builder**

```bash
git add app/'(portal)'/'(studio)'/portal/admin/clients/'[organisationId]'/agreements components/portal/agreements
git commit -m "feat: implement the FSS Studio agreement builder"
```

### Task 3: Finish client agreement list, detail, signing and signed-record states

**Files:**
- Modify: `components/portal/agreements/client-agreement-list.tsx`
- Modify: `components/portal/agreements/client-agreement-detail.tsx`
- Modify: `components/portal/agreements/client-signing-review.tsx`
- Modify: `components/portal/agreements/client-agreement-detail.test.tsx`
- Modify: `components/portal/agreements/client-signing-review.test.tsx`
- Modify: `components/portal/agreements/presentation.tsx`
- Modify: `components/portal/agreements/agreements.module.css`

**Interfaces:**
- Client cards use safe `SigningApproval` projections only.
- `ClientAgreementDetail` derives C30 only from complete retained signing evidence and otherwise preserves the precise partial-signature state.

- [ ] **Step 1: Write failing tests for the signed record and named signing review**

```tsx
assert.match(signedHtml, /Your signed agreement is ready/);
assert.match(signedHtml, /All required parties have signed/);
assert.match(partialHtml, /Your signature is recorded, awaiting the remaining signers/);
assert.doesNotMatch(partialHtml, /All required parties have signed/);
assert.match(signingHtml, /Confirm your agreement/);
assert.match(signingHtml, /Full legal name/);
assert.match(signingHtml, /Role \/ position/);
```

- [ ] **Step 2: Run focused tests and confirm C30/consent assertions fail**

Run: `node --import tsx --test components/portal/agreements/client-agreement-detail.test.tsx components/portal/agreements/client-signing-review.test.tsx`

Expected: FAIL until the visible completion record and signing fields match the contracts.

- [ ] **Step 3: Implement the C14/C15/C16/C30 projection and layout gaps**

Add title, exact revision, parties, financial summary, clear sign-or-view actions, version/evidence context and the C30 retained-copy record. Keep the existing `SigningForm` command and its consent behavior, but put it inside the C16 Portal layout. Do not invent a client-visible signature timestamp or signer identity that is not contained in verified signing data.

- [ ] **Step 4: Run focused client, signing and authorization tests**

Run: `node --import tsx --test components/portal/agreements/client-agreement-detail.test.tsx components/portal/agreements/client-signing-review.test.tsx lib/operations/agreements/signing-http.test.ts lib/operations/agreements/signing-render.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit client agreement completion**

```bash
git add components/portal/agreements lib/operations/agreements
git commit -m "feat: complete client agreement states"
```

### Task 4: Replace legacy staff agreement and signing presentation

**Files:**
- Create: `components/portal/agreements/staff-signing-status.tsx`
- Create: `components/portal/agreements/staff-signing-status.test.tsx`
- Modify: `components/portal/agreements/staff-agreement-overview.tsx`
- Modify: `components/portal/agreements/staff-agreement-detail.tsx`
- Modify: `components/portal/agreements/engagement-form.tsx`
- Modify: `components/portal/agreements/signature-evidence-form.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/signing/page.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/agreements/[agreementId]/page.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/engagements/new/page.tsx`

**Interfaces:**
- `StaffSigningStatus` consumes `SigningApproval` and presents F37 without assuming provider delivery success.
- `EngagementForm` presents links to already reviewed Growth work or the authoritative Growth workflow; it has no write endpoint in Studio.

- [ ] **Step 1: Write failing staff-state tests**

```tsx
test("prepared signing shows approval and delivery as separate facts", () => {
  const html = render(<StaffSigningStatus approval={preparedApproval} />);
  assert.match(html, /Ready for the named signers/);
  assert.match(html, /Signature pending/);
  assert.match(html, /Approval is not signature/);
  assert.doesNotMatch(html, /Signed and recorded/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --import tsx --test components/portal/agreements/staff-signing-status.test.tsx`

Expected: FAIL because the Portal-native F37 component is absent.

- [ ] **Step 3: Implement F09/F17/F32/F34/F37 using only safe existing commands**

Replace the legacy staff signing page with `PageHeader`, `PortalCard`, `Notice`, `StatusBadge` and Portal action links. F09 lists draft, prepared, awaiting signature and signed status separately. F17 shows retained evidence and names manual provenance. F34 remains the only manual evidence mutation and must explain that fingerprints are checked server-side. F32 must offer an authoritative reviewed-work handoff with the preserved builder draft ID, not an imitation engagement creator.

- [ ] **Step 4: Run focused staff and signing tests**

Run: `node --import tsx --test components/portal/agreements/staff-agreement-overview.test.tsx components/portal/agreements/engagement-form.test.tsx components/portal/agreements/staff-signing-status.test.tsx lib/operations/agreements/signing-growth.test.ts lib/operations/agreements/signing-http.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Studio agreement status workspaces**

```bash
git add app/'(portal)'/'(studio)'/portal/admin/clients components/portal/agreements
git commit -m "feat: complete Studio agreement status workspaces"
```

### Task 5: Add the missing visual evidence and promote only completed matrix rows

**Files:**
- Modify: `app/visual/fss-studio/[scenario]/agreement-visual-fixtures.tsx`
- Modify: `app/visual/fss-studio/[scenario]/visual-scenarios.tsx`
- Modify: `app/visual/fss-studio/visual-scenarios.test.tsx`
- Modify: `tests/e2e/fss-studio.visual.spec.ts`
- Create: paired Darwin/Linux snapshot files under `tests/e2e/fss-studio.visual.spec.ts-snapshots/`
- Modify: `docs/design/fss-studio-experience/screen-coverage.csv`

**Interfaces:**
- One deterministic scenario per missing state: C30, F11–F16, F32, F34 and F37, plus mobile coverage for every agreement screen.
- Matrix rows move from `planned` to `verified` only when the route/function and both screenshot baselines are committed.

- [ ] **Step 1: Write failing visual scenario registration tests**

```tsx
for (const name of [
  "client-agreement-signed", "studio-agreement-builder-scope",
  "studio-agreement-builder-fees", "studio-agreement-builder-people",
  "studio-agreement-builder-document", "studio-agreement-builder-review",
  "studio-agreement-no-engagement", "studio-engagement-provenance",
  "studio-signature-evidence", "studio-signing-status",
]) assert.ok(resolveVisualScenario(name, true, "test"));
```

- [ ] **Step 2: Run the fixture test and confirm it fails**

Run: `node --import tsx --test app/visual/fss-studio/visual-scenarios.test.tsx`

Expected: FAIL because the complete agreement fixture set is not registered.

- [ ] **Step 3: Add desktop and mobile screenshot assertions for all 16 matrix rows**

Use fixed UUIDs, names and dates. Capture C14, C15, C16, C30, F09–F17, F32, F34 and F37 at both viewports. Keep C30 complete evidence and F37 prepared approval as separate fixtures. Update only the corresponding 16 CSV rows to `verified` after artifacts exist.

- [ ] **Step 4: Generate local baselines and run the visual suite**

Run: `FSS_VISUAL_TESTS_ENABLED=true pnpm test:visual --update-snapshots && FSS_VISUAL_TESTS_ENABLED=true pnpm test:visual && pnpm verify:fss-studio-coverage`

Expected: current-platform screenshots pass and the coverage verifier reports all 88 screens.

- [ ] **Step 5: Collect CI Linux baselines, then commit evidence**

Run the Phase 8 PR visual job. Copy only its generated Linux `-actual` screenshots to matching Linux baseline filenames and rerun the visual job before committing.

```bash
git add app/visual tests/e2e docs/design/fss-studio-experience/screen-coverage.csv
git commit -m "test: verify complete FSS Studio agreement journeys"
```

### Task 6: Run all Phase 8 quality gates and raise its PR

- [ ] **Step 1: Review the phase diff and migration policy**

Run: `git diff origin/main...HEAD --check && git status --short && pnpm verify:migrations`

Expected: no whitespace errors, no unexpected files and all migrations pass policy.

- [ ] **Step 2: Run application and behavior gates**

Run: `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm verify:fss-studio-coverage`

Expected: PASS.

- [ ] **Step 3: Run browser and build gates**

Run: `FSS_VISUAL_TESTS_ENABLED=true pnpm test:visual && pnpm build && pnpm perf:budget:homepage`

Expected: PASS.

- [ ] **Step 4: Rebase after Phase 7 merges, raise Phase 8 PR and merge only when all required checks are green**

Run: `git fetch origin && git rebase origin/main && git push --set-upstream origin feat/fss-studio-redesign-phase-08-agreement-completion && gh pr create --base main --head feat/fss-studio-redesign-phase-08-agreement-completion --title "feat: complete FSS Studio agreement journeys" --fill && gh pr checks <pr-number> --watch && gh pr merge <pr-number> --merge`

Expected: all required checks are green before merge. The production Studio feature flag remains disabled.

## Pre-flight Interfaces

- Task 1 produces `AgreementBuilderDraft`; Task 2 consumes its ID, version, step, content and organisation-scoped query. Ruling: finalisation remains in Task 1 so Task 2 cannot accidentally create an incomplete domain agreement.
- Task 2 produces the canonical builder route and state-specific Portal composition; Task 5 consumes those components through synthetic fixtures, not live database state.
- Task 3 preserves the existing client `SigningApproval` and Task 4 preserves staff signing commands; Task 5 uses separate complete/prepared approvals so visual tests cannot blur completion semantics.

## Self-Review

- **Spec coverage:** Task 2 owns F10–F16. Task 3 owns C14–C16/C30. Task 4 owns F09/F17/F32/F34/F37. Task 5 captures every remaining matrix row at both required widths.
- **Scope:** The plan does not change public routes, legacy Growth authority, agreement evidence rules, Clerk setup or production flags.
- **Failure states:** foreign/stale drafts, incomplete finalisation, no engagement, unauthorised record access, partial signatures, provider/manual provenance, mobile layout and visual-route release gating each have an owning test.
- **Architecture:** immutable agreement/signing records remain separate from builder working state; Portal UI remains separate from legacy Operations components.
- **Placeholder scan:** no deferred behavior or generic error-handling placeholders remain; every planned command names its behavior and test gate.

## Execution Handoff

The user explicitly requested native phased implementation, PRs and green-only merges. Execute this plan natively from `feat/fss-studio-redesign-phase-08-agreement-completion`, keep Phase 7 unmodified, and do not merge or enable the production Studio flag until every required check is green.
