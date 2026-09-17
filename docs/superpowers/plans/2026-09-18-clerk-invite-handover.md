# Clerk invitation handover — 2026-09-18

## Current-state note

- **Repository:** FSS Marketing Site (Next.js App Router).
- **Branch/checkpoint:** `fix/reconcile-clerk-staff-invitations`, `47b64a6f4`.
- **Package/runtime:** pnpm 9.7.0, Node 24, `@clerk/nextjs` 7.9.2, Node test runner with `tsx`.
- **Invitation classification:** Clerk application invitations with application-owned Operations membership. Staff/Admin invitations are a separate `realm: "staff"` boundary; this is not a Clerk Organization flow.
- **Existing tracked changes preserved:** `app/api/portal/access/claim/handler.test.ts`, `app/api/portal/access/claim/handler.ts`, `app/api/portal/access/claim/route.ts`, `lib/operations/auth/clerk-invitation.ts`, `lib/operations/auth/provision.test.ts`, and `lib/operations/auth/provision.ts`.
- **Untracked workspace metadata:** `.freebuff/`; not inspected or modified.
- **Reported failure:** no independent issue text or staging logs were available. The current diff identifies an existing-session staff invitation path where a database claim can succeed while the pending Clerk invitation remains active.
- **Owner:** takeover of the existing uncommitted patch in this checkout.

## Evidence limits

The root cause is inferred from the current patch and tests, not from a live reproduction. No staging Clerk credentials, disposable accounts, provider logs, invitation links, or production data were available. Worktree enumeration and repository agent-instruction files were not accessible through the read-only handover interface. The real email/link-to-access journey therefore remains unverified.

## Implementation and verification record

The existing patch was preserved. It now reconciles matching pending staff invitations after either a verified-email staff claim or an already active staff membership, while keeping the Operations database as the access source of truth. Reconciliation validates the normalized email, filters to pending invitations with version-3 staff metadata, and never revokes client invitations or invitations for another email.

Focused verification:

```text
node --import tsx --test app/api/portal/access/claim/handler.test.ts lib/operations/auth/provision.test.ts lib/operations/auth/clerk-invitation.test.ts lib/operations/auth/staff-invitations.test.ts
```

Result after the added regression cases: 30 tests passed, 0 failed. The related portal/auth/operator suite also passed: 43 tests passed, 0 failed.

Broader verification:

- `pnpm test:unit`: passed, 1,853 tests, 0 failures.
- `pnpm typecheck`: passed.
- `pnpm exec eslint app/api/portal/access/claim/handler.test.ts app/api/portal/access/claim/handler.ts app/api/portal/access/claim/route.ts lib/operations/auth/clerk-invitation.ts lib/operations/auth/provision.test.ts lib/operations/auth/provision.ts`: passed.
- `pnpm lint:covers`: passed.
- `pnpm build`: passed; Next.js compiled, typechecked, and generated all 271 static pages.
- `pnpm lint`: did not complete within 300 seconds; the relevant changed-file ESLint check passed.
- `pnpm test:integration:operations`: blocked before tests because `OPERATIONS_TEST_DATABASE_URL` was not configured for an approved local test database.

Browser verification against Clerk is blocked until controlled staging credentials and disposable invitations are available. No real invitation creation, email delivery, acceptance, or production access claim was performed.

No production configuration, dependency, migration, deployment, or provider data changes are part of this handover.
