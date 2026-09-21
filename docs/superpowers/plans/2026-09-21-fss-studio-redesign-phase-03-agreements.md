# FSS Studio Redesign Phase 3 Agreements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy agreement and signing presentation with FSS Studio agreement screens while preserving the reviewed agreement, signing, tenant and evidence services.

**Architecture:** Keep agreement revisions, signing approvals, signatures and service activation behind the existing Operations service boundary. Add portal-scoped agreement presentation components that consume safe client or FSS-admin projections and compose the Phase 2 Portal shadcn-style controls. New routes may resolve records only through authenticated, organisation-scoped services; the browser never supplies trusted organisation, agreement, signer or revision state.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, existing Operations agreement/signing services, Portal UI primitives, Lucide, CSS Modules, Node test runner and Playwright.

**Spec:** `docs/design/fss-studio-experience/03-screen-contracts.md` (C14–C16, C30, F09–F17, F32, F34, F37 and M06).

## Global Constraints

- Retain `OPERATIONS_FSS_STUDIO_ENABLED`, `OPERATIONS_SIGNING_ENABLED` and all production enablement settings unchanged.
- Preserve existing agreement revision, signing approval, signed-evidence, idempotency and tenant-authorisation rules. Never expose an unsigned document as signed.
- Use PortalButton, PortalCard, PortalField, PortalSelect, PortalTextarea, Notice and StatusBadge for new or redesigned FSS Studio controls; use Lucide only for interface icons.
- A signer remains distinct from portal ownership, billing access and delivery-review access.
- Do not add a free-form engagement or signature shortcut that bypasses reviewed-work provenance or retained evidence.
- Static visual fixtures stay synthetic, non-production-only and behind the existing `FSS_VISUAL_TESTS_ENABLED` guard.
- Write a focused failing test before each behaviour change. Keep raw provider failures and unauthorised records behind the existing unavailable/not-found boundary.

## Review Focus

1. Client and founder data projections must never cross organisation boundaries; Task 1 adds scoped-service tests.
2. A document can be marked fully signed only when every required signature has verified retained evidence; Task 3 preserves and tests the existing signing result states.
3. Builder navigation must retain a saved draft and a valid engagement reference; Task 5 tests invalid/missing linkage and stale-version recovery.
4. Fee totals must remain server-validated pence values, not browser-calculated currency strings; Task 5 tests reconciliation errors.
5. Mobile agreement detail must retain exact-version signing affordances without horizontal overflow; Task 7 adds M06 visual coverage.

### Task 1: Add agreement presentation projections and shared UI primitives

**Files:**
- Create: `components/portal/agreements/presentation.ts`
- Create: `components/portal/agreements/presentation.test.ts`
- Create: `components/portal/agreements/agreements.module.css`
- Modify: `lib/operations/agreements/signing-service.ts`
- Test: `lib/operations/agreements/signing-growth.test.ts`

**Interfaces:**
- Produces `PortalAgreementSummary`, `PortalAgreementDetail` and `toPortalAgreementStatus` from existing agreement/signing records.
- Consumes only authenticated signing approvals and staff agreement records already scoped by the service layer.

- [ ] **Step 1: Write failing projection tests**

```tsx
assert.equal(toPortalAgreementStatus({ allRequiredSignaturesRecorded: false, status: "approved" }), "awaiting_signature")
assert.equal(toPortalAgreementStatus({ allRequiredSignaturesRecorded: true, status: "completed" }), "signed")
assert.doesNotMatch(renderToStaticMarkup(<AgreementStatusCard status="awaiting_signature" />), /Signed and complete/)
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --import tsx --test components/portal/agreements/presentation.test.ts`

Expected: FAIL because the Portal agreement projection has not been defined.

- [ ] **Step 3: Implement typed status mapping and shared presentation styles**

```ts
export type PortalAgreementStatus = "draft" | "awaiting_signature" | "signed" | "superseded" | "voided";
export function toPortalAgreementStatus(input: SigningStatusInput): PortalAgreementStatus { /* exact existing approval/evidence state mapping */ }
```

Use PortalCard, StatusBadge and Notice instead of new bespoke controls. Map provider-verified and manually reviewed evidence to explicit labels without conflating their provenance.

- [ ] **Step 4: Run focused projection and signing service tests**

Run: `node --import tsx --test components/portal/agreements/presentation.test.ts lib/operations/agreements/signing-growth.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the shared agreement presentation**

```bash
git add components/portal/agreements lib/operations/agreements/signing-service.ts
git commit -m "feat: add FSS Studio agreement presentation"
```

### Task 2: Redesign client agreement list and exact-version detail

**Files:**
- Create: `components/portal/agreements/client-agreement-list.tsx`
- Create: `components/portal/agreements/client-agreement-detail.tsx`
- Create: `components/portal/agreements/client-agreement-detail.test.tsx`
- Modify: `app/(portal)/(client)/portal/agreements/page.tsx`
- Create: `app/(portal)/(client)/portal/agreements/[approvalId]/page.tsx`

**Interfaces:**
- Consumes safe portal signing approvals from `listPortalSigning` and a new service lookup that requires the active member’s organisation and signer identity.
- Produces C14, C15 and C30 without treating an approval or document view as a signature.

- [ ] **Step 1: Write failing client list/detail assertions**

```tsx
assert.match(html, /Action needed/)
assert.match(html, /Signed agreements/)
assert.match(html, /Continue to signing/)
assert.doesNotMatch(html, /all signatures complete.*awaiting your signature/i)
```

- [ ] **Step 2: Run the focused component test and confirm it fails**

Run: `node --import tsx --test components/portal/agreements/client-agreement-detail.test.tsx`

Expected: FAIL because the client list and detail components do not exist.

- [ ] **Step 3: Implement C14/C15/C30 with the Portal UI primitives**

Use PageHeader, PortalCard, StatusBadge, Notice and PortalButton-style links. C15 shows scope, responsibilities, payment schedule, support/changes, immutable document links and revision context. C30 only renders its all-parties-signed hero when the service reports complete verified signing evidence; otherwise it names the client’s recorded signature and remaining state.

- [ ] **Step 4: Run client component and signing HTTP tests**

Run: `node --import tsx --test components/portal/agreements/client-agreement-detail.test.tsx lib/operations/agreements/signing-http.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the client agreement experience**

```bash
git add app/'(portal)'/'(client)'/portal/agreements components/portal/agreements
git commit -m "feat: redesign client agreement workspace"
```

### Task 3: Redesign the client signing review without changing the signing command

**Files:**
- Create: `app/(portal)/(client)/portal/agreements/[approvalId]/sign/page.tsx`
- Modify: `components/operations/signing/signing-form.tsx`
- Create: `components/portal/agreements/client-signing-review.tsx`
- Create: `components/portal/agreements/client-signing-review.test.tsx`

**Interfaces:**
- Consumes an identity-checked signing approval and the existing signing command endpoint.
- Produces C16’s named-signer consent/form state while preserving provider cancellation and failure behaviour.

- [ ] **Step 1: Write a failing exact-version signing test**

```tsx
assert.match(html, /Signing as Alex Morgan/)
assert.match(html, /Agreement revision 2/)
assert.match(html, /Confirm your agreement/)
assert.doesNotMatch(html, /Sign agreement.*Revision 1/)
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test components/portal/agreements/client-signing-review.test.tsx`

Expected: FAIL because the client signing review component does not exist.

- [ ] **Step 3: Implement the C16 wrapper around the existing SigningForm**

Show identity, immutable revision, document/download route, typed name/role fields and explicit consent using Portal controls. Do not change the signing command payload or claim a signature was recorded until the existing command returns verified evidence.

- [ ] **Step 4: Run signing-focused tests**

Run: `node --import tsx --test components/portal/agreements/client-signing-review.test.tsx lib/operations/agreements/signing-http.test.ts lib/operations/agreements/signing-render.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the signing review redesign**

```bash
git add app/'(portal)'/'(client)'/portal/agreements components/operations/signing components/portal/agreements
git commit -m "feat: redesign client agreement signing"
```

### Task 4: Redesign the founder agreement register and signed status views

**Files:**
- Modify: `components/portal/agreements/staff-agreement-overview.tsx`
- Modify: `components/portal/agreements/staff-agreement-overview.module.css`
- Create: `components/portal/agreements/staff-agreement-overview.test.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/agreements/page.tsx`
- Create: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/agreements/[agreementId]/page.tsx`

**Interfaces:**
- Consumes FSS-admin-scoped overview/detail queries and existing `AgreementRecord` evidence.
- Produces F09, F17 and F37 with real draft/signing/evidence status.

- [ ] **Step 1: Write failing founder list/status tests**

```tsx
assert.match(html, /Draft & awaiting signature/)
assert.match(html, /Signed/)
assert.match(html, /Continue draft/)
assert.match(signedHtml, /Both signatures are complete/)
assert.match(awaitingHtml, /Approval is not signature/)
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --import tsx --test components/portal/agreements/staff-agreement-overview.test.tsx`

Expected: FAIL until the register has the named status sections.

- [ ] **Step 3: Implement F09/F17/F37 as staff-only Portal screens**

Use status grouping from Task 1, PageHeader, PortalCard, Notice and direct workspace links. Retain a distinct evidence-provenance label. Show “approved and queued” separately from email delivery and signature completion.

- [ ] **Step 4: Run focused founder tests**

Run: `node --import tsx --test components/portal/agreements/staff-agreement-overview.test.tsx lib/operations/agreements/signing-growth.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit founder agreement views**

```bash
git add app/'(portal)'/'(studio)'/portal/admin/agreements app/'(portal)'/'(studio)'/portal/admin/clients/'[organisationId]'/agreements components/portal/agreements
git commit -m "feat: redesign FSS Studio agreement register"
```

### Task 5: Compose the saved founder agreement builder from existing commands

**Files:**
- Create: `components/portal/agreements/agreement-builder.tsx`
- Create: `components/portal/agreements/agreement-builder.test.tsx`
- Create: `components/portal/agreements/founder-agreement-fields.tsx`
- Modify: `components/operations/agreements/agreement-form.tsx`
- Modify: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/agreements/page.tsx`

**Interfaces:**
- Consumes existing `AgreementDraft`, `AgreementForm` submission path, linked engagement choices and server-validated money inputs.
- Produces F10–F16’s saved-draft, scope, fees, people, document and review steps without creating a bypass command.

- [ ] **Step 1: Write failing builder state and validation assertions**

```tsx
assert.match(html, /Link the right work/)
assert.match(scopeHtml, /Define the work/)
assert.match(feesHtml, /Payment amounts must reconcile/)
assert.match(noEngagementHtml, /No engagement is linked/)
assert.doesNotMatch(noEngagementHtml, /<option value="[0-9a-f-]{36}"/)
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --import tsx --test components/portal/agreements/agreement-builder.test.tsx`

Expected: FAIL because the step-aware builder does not exist.

- [ ] **Step 3: Implement F10–F16 around the existing authoritative form action**

Represent steps as `link`, `scope`, `fees`, `people`, `document` and `review`; retain the draft record/version returned by the server after every saved step. Use human-readable engagement choices, rendered scope/fee/person fields, server-provided money validation, document revision/fingerprint state and readiness checks. A missing eligible engagement routes to F16 and preserves the saved draft; it never renders a UUID-only selector.

- [ ] **Step 4: Run builder, money and service tests**

Run: `node --import tsx --test components/portal/agreements/agreement-builder.test.tsx lib/operations/agreements/money-input.test.ts lib/operations/agreements/service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the agreement builder**

```bash
git add app/'(portal)'/'(studio)'/portal/admin/clients/'[organisationId]'/agreements components/portal/agreements components/operations/agreements
git commit -m "feat: add FSS Studio agreement builder"
```

### Task 6: Surface existing engagement and manual-evidence workflows safely

**Files:**
- Create: `components/portal/agreements/engagement-form.tsx`
- Create: `components/portal/agreements/signature-evidence-form.tsx`
- Create: `components/portal/agreements/engagement-form.test.tsx`
- Create: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/engagements/new/page.tsx`
- Create: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/agreements/[agreementId]/record-signature/page.tsx`

**Interfaces:**
- Consumes reviewed-work provenance and existing signature evidence command handlers.
- Produces F32 and F34 without creating unauthorised free-form records or declaring manual evidence cryptographically verified.

- [ ] **Step 1: Write failing provenance/evidence tests**

```tsx
assert.match(engagementHtml, /Review status/)
assert.match(evidenceHtml, /Fingerprints are automatic/)
assert.doesNotMatch(evidenceHtml, /cryptographic signature verified/i)
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --import tsx --test components/portal/agreements/engagement-form.test.tsx`

Expected: FAIL because the portal-scoped wrappers do not exist.

- [ ] **Step 3: Implement F32/F34 with existing validated actions only**

Expose client/project/reviewed-source fields from the actual eligible choices. The evidence screen requires retained signed-document selection, signer evidence and completed date; its notice says manual review is distinct from provider verification.

- [ ] **Step 4: Run source and signing tests**

Run: `node --import tsx --test components/portal/agreements/engagement-form.test.tsx lib/operations/organisations/link-engagement.test.ts lib/operations/agreements/signing-http.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit provenance and evidence screens**

```bash
git add app/'(portal)'/'(studio)'/portal/admin/clients/'[organisationId]' components/portal/agreements
git commit -m "feat: add agreement provenance and evidence views"
```

### Task 7: Add Phase 3 visual fixtures, evidence and coverage updates

**Files:**
- Modify: `app/visual/fss-studio/[scenario]/visual-scenarios.tsx`
- Create: `app/visual/fss-studio/[scenario]/agreement-visual-fixtures.tsx`
- Modify: `app/visual/fss-studio/visual-scenarios.test.tsx`
- Modify: `tests/e2e/fss-studio.visual.spec.ts`
- Create: paired Darwin/Linux snapshots
- Modify: `docs/design/fss-studio-experience/screen-coverage.csv`

**Interfaces:**
- Produces deterministic, production-gated coverage for C14/C15/C16/C30/F09/F10/F15/F17/F37/M06 and only promotes evidenced matrix rows.

- [ ] **Step 1: Add failing fixture-registration tests**

```tsx
for (const name of ["client-agreement-list", "client-agreement-detail", "client-agreement-signing", "studio-agreement-list", "studio-agreement-builder", "studio-agreement-signed"]) assert.ok(resolveVisualScenario(name, true, "test"));
```

- [ ] **Step 2: Run fixture tests and confirm they fail**

Run: `node --import tsx --test app/visual/fss-studio/visual-scenarios.test.tsx`

Expected: FAIL because Phase 3 scenarios are absent.

- [ ] **Step 3: Implement fixtures, browser assertions and paired baselines**

Use fixed synthetic names, valid UUIDs and no provider calls. Capture desktop C14/C15/C16/C30/F09/F10/F15/F17/F37 and M06. Preserve the existing non-production visual-route guard and snapshot platform template.

- [ ] **Step 4: Run visual and coverage checks**

Run: `pnpm test:visual --update-snapshots && pnpm verify:fss-studio-coverage`

Expected: current-platform assertions pass and the coverage verifier reports 88 screens.

- [ ] **Step 5: Collect exact Linux baselines and commit evidence**

Run the visual suite on the CI Linux runner when local Linux execution is unavailable; promote only its generated actual images to Linux baseline names. Commit the fixtures, snapshots and only matrix rows with both functional and visual evidence.

### Task 8: Run Phase 3 gates and merge only when green

- [ ] **Step 1: Inspect the complete branch diff**

Run: `git diff origin/main...HEAD --check && git status --short`

Expected: no whitespace errors or unexpected generated output.

- [ ] **Step 2: Run code and behaviour gates**

Run: `pnpm typecheck && pnpm lint && node --import tsx --test components/portal/agreements/*.test.tsx lib/operations/agreements/*.test.ts && pnpm verify:fss-studio-coverage`

Expected: PASS.

- [ ] **Step 3: Run browser and production gates**

Run: `pnpm test:visual && pnpm build && pnpm perf:budget:homepage`

Expected: PASS.

- [ ] **Step 4: Open and merge the Phase 3 pull request only after every required check is green**

Run: `gh pr create --base main --head feat/fss-studio-redesign-phase-03-agreements --title "feat: redesign FSS Studio agreement workflow" --fill && gh pr checks <pr-number> --watch && gh pr merge <pr-number> --merge`

Expected: the merge is clean, all required checks pass, and no production feature flag is enabled.

## Self-Review

- **Spec coverage:** Tasks 2–6 map the listed Phase 3 contracts to real client/staff paths and retained command boundaries; Task 7 only promotes screenshots whose UI and functional evidence exist.
- **Scope:** The plan does not alter public-site presentation, Clerk configuration, provider settings, production flags or agreement domain rules.
- **Failure states:** unscoped records, partial signatures, provider/manual provenance, missing engagements, invalid money and mobile reflow each have an owning test task.
- **Architecture:** agreement domain services remain the only record/permission authority; presentation is split by client, staff, builder and evidence responsibilities.

## Execution Handoff

The user has explicitly approved phase-by-phase implementation, pull requests and merges. Execute natively from `feat/fss-studio-redesign-phase-03-agreements`, preserve all existing production gates, and begin Phase 4 only after the confirmed Phase 3 merge.
