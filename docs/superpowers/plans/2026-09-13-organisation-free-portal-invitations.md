# Organisation-free Portal and Founder Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centre the invitation modal, let clients create their organisation after accepting an invitation, and send the sole configured founder a safe founder-workspace invitation.

**Architecture:** Add an organisation-free pending invitation record and two narrow database procedures: one reports whether the verified portal identity needs onboarding, and one atomically creates the organisation, contact, and initial membership. Keep founder authorization unchanged; the founder invitation sends the configured address a transactional link to the existing Google login.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5 strict mode, Zod 4, Clerk, PostgreSQL/Supabase migrations, Resend, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-organisation-free-portal-invitations-design.md`

## Global Constraints

- Do not add dependencies.
- Do not apply a Production migration or deploy.
- Never accept a founder invitation recipient from browser input; use validated `GROWTH_OS_OWNER_EMAIL` server-side.
- Require a verified Clerk identity whose normalized email matches the pending client invitation.
- Preserve existing organisation-bound memberships and invitations.
- Use strict TypeScript without suppression comments or `any`.
- Every behavior change follows red, green, refactor and ends with focused verification.

## File structure

- `supabase/migrations/20260913230000_operations_pending_portal_invitations.sql`: additive pending-invitation table, audit table, and least-privilege procedures.
- `tests/integration/operations/portal-onboarding.test.ts`: database authorization, tenant creation, rollback, expiry, and idempotency contract.
- `lib/operations/auth/pending-invitations.ts`: typed founder and portal repositories for the new procedures.
- `lib/operations/auth/pending-invitations.test.ts`: schema and adapter contract tests.
- `lib/operations/auth/clerk-invitation.ts`: versioned organisation-free Clerk metadata.
- `lib/operations/auth/clerk-invitation.test.ts`: verified-email metadata tests.
- `lib/operations/auth/operator.ts`: discriminated client and founder invitation commands.
- `lib/operations/auth/operator.test.ts`: orchestration tests at provider boundaries.
- `lib/operations/auth/founder-invitation.ts`: founder email rendering and Resend dispatch.
- `lib/operations/auth/founder-invitation.test.ts`: recipient binding and message contract tests.
- `lib/growth/integrations/resend/client.ts`: permit the explicit `founder-access` transactional category.
- `components/operations/clients/portal-invitation-dialog.tsx`: client/founder form and payloads.
- `components/operations/clients/portal-invitation-dialog.test.tsx`: rendered field and fixed-recipient tests.
- `components/operations/clients/portal-access-dashboard.tsx`: expose invitations without requiring an existing organisation.
- `components/operations/clients/portal-access-dashboard.module.css`: centred modal and responsive invitation form.
- `app/api/portal/access/claim/route.ts`: report active membership or required organisation onboarding.
- `app/api/portal/access/onboard/route.ts`: authenticated portal onboarding endpoint.
- `app/(portal)/portal/onboarding/page.tsx`: server gate for invited users without membership.
- `components/portal/auth/organisation-onboarding.tsx`: accessible organisation form.
- `components/portal/auth/organisation-onboarding.test.tsx`: form behavior contract.
- `app/(portal)/portal/page.tsx`: redirect pending invited identities to onboarding.

---

### Task 1: Add the pending invitation database boundary

**Files:**
- Create: `supabase/migrations/20260913230000_operations_pending_portal_invitations.sql`
- Create: `tests/integration/operations/portal-onboarding.test.ts`
- Modify: `tests/integration/operations/portal-fixtures.ts`

**Interfaces:**
- Produces: `operations.issue_pending_portal_invitation(text,text,text,text,uuid) returns table(id uuid, expires_at timestamptz)`.
- Produces: `operations.pending_portal_onboarding() returns boolean`.
- Produces: `operations.complete_portal_onboarding(text,text,text) returns uuid`.

- [ ] **Step 1: Write failing database tests**

Add literal integration cases proving that a founder-issued invitation has no organisation ID; an unrelated verified email cannot discover or claim it; an expired invitation cannot be claimed; the matching identity creates one active organisation, contact, and membership; the role is the invited role; repeated completion returns the same organisation; and a failed insert rolls the transaction back. Query counts and stored values directly rather than asserting SQL source text.

```ts
assert.deepEqual(await countsFor(invitationId), {
  organisations: 1,
  contacts: 1,
  memberships: 1,
  completedInvitations: 1,
});
assert.equal(completedOrganisationId, repeatedOrganisationId);
```

- [ ] **Step 2: Run the focused database test and verify RED**

Run: `pnpm exec tsx scripts/require-operations-database-env.ts && node --import tsx --test --test-concurrency=1 tests/integration/operations/portal-onboarding.test.ts`

Expected: FAIL because the table and procedures do not exist.

- [ ] **Step 3: Add the additive migration**

Create `operations.pending_portal_invitations` with normalized `email`, `name`, portal `role`, `state` (`pending`, `provider_failed`, `completed`, `revoked`), 72-hour expiry, founder actor hash, review reference, correlation UUID, nullable claimed user UUID and resulting organisation UUID. Add a separate `operations.portal_invitation_audit` table because `operations.audit_events.organisation_id` is non-null. Revoke all direct table access, then grant founder read plus only the three procedure executions required by founder and portal roles.

`complete_portal_onboarding` must derive identity exclusively from `operations.user_id` and `operations.verified_email`, lock the newest matching pending row, create UUID-backed organisation defaults (`trading_status = 'unknown'`, `timezone = 'Europe/London'`), contact, and membership, and mark the invitation completed in the same transaction.

- [ ] **Step 4: Verify migration policy and GREEN database behavior**

Run: `pnpm verify:migrations`

Run the focused integration command from Step 2.

Expected: both PASS.

- [ ] **Step 5: Commit the database boundary**

```bash
git add supabase/migrations/20260913230000_operations_pending_portal_invitations.sql tests/integration/operations/portal-onboarding.test.ts tests/integration/operations/portal-fixtures.ts
git commit -m "feat: add organisation-free portal invitation boundary"
```

### Task 2: Add typed pending-invitation adapters

**Files:**
- Create: `lib/operations/auth/pending-invitations.ts`
- Create: `lib/operations/auth/pending-invitations.test.ts`

**Interfaces:**
- Produces: `pendingPortalInvitationSchema` for `{ name, email, role, reviewReference }`.
- Produces: `issuePendingPortalInvitation(db, founder, input, correlationId): Promise<{ invitationId: string; expiresAt: Date }>`.
- Produces: `needsPortalOnboarding(db, identity, correlationId): Promise<boolean>`.
- Produces: `completePortalOnboarding(db, identity, input, correlationId): Promise<{ organisationId: string }>` where input is `{ displayName: string; legalName: string; timezone: string }`.

- [ ] **Step 1: Write failing adapter tests**

Test normalized email, rejected organisation IDs via strict Zod objects, blank organisation names, founder context enforcement, verified-identity transaction settings, and literal SQL result mapping with the existing callable database fixture pattern.

- [ ] **Step 2: Run and verify RED**

Run: `node --import tsx --test lib/operations/auth/pending-invitations.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement the minimal typed adapters**

Use `requireOperationsFounder` for founder calls and `withVerifiedPortalIdentity` for portal calls. Keep Zod schemas strict and exported return types explicit.

- [ ] **Step 4: Run and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/operations/auth/pending-invitations.ts lib/operations/auth/pending-invitations.test.ts
git commit -m "feat: add pending portal invitation adapters"
```

### Task 3: Change Clerk metadata and client invitation orchestration

**Files:**
- Modify: `lib/operations/auth/clerk-invitation.ts`
- Modify: `lib/operations/auth/clerk-invitation.test.ts`
- Modify: `lib/operations/auth/clerk-webhook.ts`
- Modify: `lib/operations/auth/operator.ts`
- Modify: `lib/operations/auth/operator.test.ts`
- Modify: `app/api/webhooks/clerk/route.ts`

**Interfaces:**
- Produces metadata version 2: `{ version: 2, invitationId: string, email: string }`.
- Produces operation: `{ action: "invite_client", name, email, role, reviewReference }`.
- Consumes Task 2 `issuePendingPortalInvitation`.

- [ ] **Step 1: Write failing metadata and operator tests**

Prove metadata contains no `organisationId`; only the verified invited email is accepted; `invite_client` issues a pending record before calling Clerk; Clerk receives `/portal/activate?name=...&email=...`; and provider failure marks or revokes the pending record through a narrow repository function so it cannot be claimed.

- [ ] **Step 2: Run and verify RED**

Run: `node --import tsx --test lib/operations/auth/clerk-invitation.test.ts lib/operations/auth/operator.test.ts`

Expected: FAIL on metadata version and absent operation.

- [ ] **Step 3: Implement versioned metadata and orchestration**

Retain version-1 parsing for already-issued invitations, but route only version 2 into the pending onboarding flow. Remove `grant_access` from new UI use while retaining its parser/handler only if existing tests or compatibility callers require it.

- [ ] **Step 4: Run focused and webhook tests**

Run: `node --import tsx --test lib/operations/auth/clerk-invitation.test.ts lib/operations/auth/operator.test.ts lib/operations/auth/clerk-webhook.test.ts app/api/webhooks/clerk/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/operations/auth/clerk-invitation.ts lib/operations/auth/clerk-invitation.test.ts lib/operations/auth/clerk-webhook.ts lib/operations/auth/operator.ts lib/operations/auth/operator.test.ts app/api/webhooks/clerk/route.ts
git commit -m "feat: issue organisation-free Clerk invitations"
```

### Task 4: Add founder invitation delivery

**Files:**
- Create: `lib/operations/auth/founder-invitation.ts`
- Create: `lib/operations/auth/founder-invitation.test.ts`
- Modify: `lib/growth/integrations/resend/client.ts`
- Modify: `lib/growth/integrations/resend/client.test.ts`
- Modify: `lib/operations/auth/operator.ts`
- Modify: `lib/operations/auth/operator.test.ts`

**Interfaces:**
- Produces operation: `{ action: "invite_founder", reviewReference: string }` with no email property.
- Produces: `sendFounderInvitation(config, loginUrl, reviewReference, gateway): Promise<void>`.

- [ ] **Step 1: Write failing recipient-binding and delivery tests**

Assert that browser payloads containing `email` fail strict parsing, the message recipient equals `config.ownerEmail`, the link is the same-origin absolute `/growth/login` URL, and Resend accepts only the new literal `founder-access` category.

- [ ] **Step 2: Run and verify RED**

Run: `node --import tsx --test lib/operations/auth/founder-invitation.test.ts lib/operations/auth/operator.test.ts lib/growth/integrations/resend/client.test.ts`

- [ ] **Step 3: Implement the founder email boundary**

Render concise HTML and text locally, build a deterministic idempotency key from founder actor and a bounded time window, use `requireResendEnv(readGrowthServerEnv())`, and pass the owner email only from server configuration. Do not alter `isAllowedFounderProfile` or `requireFounder`.

- [ ] **Step 4: Run and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/operations/auth/founder-invitation.ts lib/operations/auth/founder-invitation.test.ts lib/growth/integrations/resend/client.ts lib/growth/integrations/resend/client.test.ts lib/operations/auth/operator.ts lib/operations/auth/operator.test.ts
git commit -m "feat: send verified founder workspace invitations"
```

### Task 5: Update and centre the invitation modal

**Files:**
- Modify: `components/operations/clients/portal-invitation-dialog.tsx`
- Modify: `components/operations/clients/portal-invitation-dialog.test.tsx`
- Modify: `components/operations/clients/portal-access-dashboard.tsx`
- Modify: `components/operations/clients/portal-access-dashboard.test.tsx`
- Modify: `components/operations/clients/portal-access-dashboard.module.css`

**Interfaces:**
- Consumes Task 3 `invite_client` and Task 4 `invite_founder` API payloads.
- Component props become `{ founderEmail: string; onInvitationSent(message: string): void; triggerClassName?: string }`.

- [ ] **Step 1: Write failing rendered-component tests**

Assert the modal renders Client/Founder controls, has no organisation field, displays the read-only founder email, remains available when the organisation register is empty, and retains semantic labels and pending disabled states. The mutation caught is reintroducing `name="organisationId"` or hiding the trigger when no organisation exists.

- [ ] **Step 2: Run and verify RED**

Run: `node --import tsx --test components/operations/clients/portal-invitation-dialog.test.tsx components/operations/clients/portal-access-dashboard.test.tsx`

- [ ] **Step 3: Implement the minimal UI and centring fix**

Use radio buttons or a labelled select for invitation type, conditionally render the client fields, render founder email read-only, and submit the discriminated payload. Add `margin: auto` to `.dialog`; keep width and `max-height` bounds and use the existing single-column mobile media rule.

- [ ] **Step 4: Run focused tests and formatting**

Run the command from Step 2, then `pnpm exec prettier --check components/operations/clients/portal-invitation-dialog.tsx components/operations/clients/portal-access-dashboard.tsx components/operations/clients/portal-access-dashboard.module.css`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/operations/clients/portal-invitation-dialog.tsx components/operations/clients/portal-invitation-dialog.test.tsx components/operations/clients/portal-access-dashboard.tsx components/operations/clients/portal-access-dashboard.test.tsx components/operations/clients/portal-access-dashboard.module.css
git commit -m "fix: centre and simplify the invitation modal"
```

### Task 6: Add first-run organisation onboarding

**Files:**
- Create: `app/api/portal/access/onboard/route.ts`
- Create: `app/api/portal/access/onboard/route.test.ts`
- Create: `app/(portal)/portal/onboarding/page.tsx`
- Create: `components/portal/auth/organisation-onboarding.tsx`
- Create: `components/portal/auth/organisation-onboarding.test.tsx`
- Modify: `app/api/portal/access/claim/route.ts`
- Modify: `app/api/portal/access/claim/route.test.ts`
- Modify: `app/(portal)/portal/page.tsx`
- Modify: `components/portal/auth/invitation-activation.tsx`
- Modify: `components/portal/auth/invitation-activation.test.tsx`

**Interfaces:**
- Consumes Task 2 `needsPortalOnboarding` and `completePortalOnboarding`.
- Claim response becomes `{ active: true } | { active: false, onboardingRequired: true }`.
- Onboard request is `{ displayName: string, legalName: string, timezone: string }`.

- [ ] **Step 1: Read the installed Next.js route and forms documentation**

Read the relevant files under `node_modules/next/dist/docs/` before editing route modules or pages, as required by repository instructions.

- [ ] **Step 2: Write failing route and component tests**

Prove unauthenticated users are rejected; active members bypass onboarding; only matching pending invitees can view and submit onboarding; malformed or cross-origin requests fail; success redirects to `/portal`; and the activation component routes `onboardingRequired` to `/portal/onboarding` instead of reporting failure.

- [ ] **Step 3: Run and verify RED**

Run: `node --import tsx --test app/api/portal/access/claim/route.test.ts app/api/portal/access/onboard/route.test.ts components/portal/auth/invitation-activation.test.tsx components/portal/auth/organisation-onboarding.test.tsx`

- [ ] **Step 4: Implement the route, page gate, form, and redirects**

Reuse `getPortalIdentity`, `getPortalDb`, `requestHasRegisteredOrigin`, and bounded JSON parsing. Return generic denial messages. Make both organisation fields required, length 1–200, and default timezone to `Europe/London` without exposing tenant identifiers.

- [ ] **Step 5: Run and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/portal/access/claim app/api/portal/access/onboard app/'(portal)'/portal components/portal/auth
git commit -m "feat: onboard invited portal organisations"
```

### Task 7: Full verification and documentation closure

**Files:**
- Modify: `docs/superpowers/specs/2026-09-13-organisation-free-portal-invitations-design.md` only if implementation decisions differ.
- Modify: project context pack only with explicit vault-write approval; otherwise report the needed update.

- [ ] **Step 1: Inspect every changed file and diff**

Run: `git diff --check HEAD~6..HEAD` and `git status --short`. Inspect imports, strict schemas, SQL grants, role ownership, and error paths. Remove only debug artifacts introduced by these tasks.

- [ ] **Step 2: Run static and unit verification**

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `pnpm test:unit`

Run: `pnpm verify:migrations`

Expected: all PASS with no new warnings.

- [ ] **Step 3: Run Operations integration verification**

Run: `pnpm test:integration:operations`

Expected: PASS when the isolated Operations test database variables are available. If unavailable, record the exact missing prerequisite and do not claim this check passed.

- [ ] **Step 4: Run the production build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 5: Perform manual browser verification when local auth fixtures are available**

Verify the modal centre position at desktop and narrow viewport sizes, keyboard focus, Client/Founder field switching, founder recipient immutability, client acceptance, onboarding redirect, and organisation creation. Do not use Production data or send a real invitation during verification.

- [ ] **Step 6: Commit any verified documentation correction**

```bash
git add docs/superpowers/specs/2026-09-13-organisation-free-portal-invitations-design.md
git commit -m "docs: record portal invitation implementation"
```
