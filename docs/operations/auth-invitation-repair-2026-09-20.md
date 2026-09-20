# Authentication and invitation repair

Owner: Technical Agent  
Status: Implemented locally, production approval pending  
Date: 2026-09-20  
Branch: `fix/auth-invitation-lifecycle`

## Problem and evidence

Staff invitation acceptance could be bypassed by client claims or default Clerk navigation. Existing sessions were offered another account-creation form. An unrelated unverified secondary email invalidated an otherwise verified primary identity. New client invitation procedures contained ambiguous PL/pgSQL identifiers (`id` when issuing a scoped invitation, `contact_id` when claiming it). These database failures were reproduced against PostgreSQL 17 with the repository migrations.

A read-only check of the production schema confirmed the user-profile and invitation-scope migration was already applied. At inspection there were two unexpired pending staff invitations, no active staff membership, and previous failed client deliveries. No pending staff email matched an active client membership. This does not identify which account produced the reported FSS client organisation. No production records were changed.

## Resulting behaviour

- Server-verified staff invitations and active staff membership take precedence over client claims. Staff eligibility blocks first-owner organisation onboarding at the database boundary as well as the page boundary.
- Account creation submits the invitation ticket, password, and name together, and performs the Operations access claim inside Clerk's navigation callback. An existing session accepts its approved access directly; a visibly different recipient is asked to switch accounts.
- The invitation URL retains its ticket after personal query fields are removed, so refresh does not destroy the activation journey.
- New and legacy `grant_access` commands record approved scoped invitations before contacting Clerk. Existing accounts can claim current database invitations using their verified primary email without relying on copied signup metadata.
- Clerk creation permits existing recipients and uses a three-day validity window. Cleanup is paginated, separated by staff/client realm, and restricted to database invitation IDs already consumed by this identity or revoked. Current pending invitations take precedence over stale metadata. A cleanup failure is logged with a correlation ID without undoing committed access and is retried on later claims.
- New signup invitations accepted through Clerk appear as accepted there. Invitations consumed using an already verified session are revoked as obsolete; the database holds the accepted grant. Revocation of an obsolete provider invitation does not revoke the Operations membership.
- Scoped client claims are idempotent, reject inactive organisations and identity takeover, and cannot restore revoked access from completed invitations or old Clerk metadata. A concurrent legacy claim cannot replace the membership's principal. Revocation cancels previously issued pending grants for that contact.
- An organisation owner cannot supersede another organisation's pending invitation. Founder issue and client claim procedures serialize changes for the same email.
- Successful invitations initialize missing application profiles. Clerk webhook synchronization preserves names already confirmed in the app. An unverified secondary email does not invalidate a verified primary email.
- The claim endpoint enforces the registered origin, JSON content type, a bounded body, and a strict optional display-name field. Sign-out now runs through Clerk middleware.

## Migration and release

Forward migration: `supabase/migrations/20260920155054_operations_invitation_claim_repairs.sql`.

It replaces invitation procedures and adds narrow helper/profile procedures. It does not delete users, organisations, invitations, or business records. Existing one-argument profile saving remains available for older application versions. New functions have explicit execute grants only for the relevant server roles; no browser table access is added.

After explicit production approval:

1. Review the final diff and CI results.
2. Apply the forward migration through the existing approved migration process before promoting the application deployment.
3. Deploy the matching application revision. Preserve Clerk configuration and existing release flags.
4. Verify with approved disposable recipients: a new staff account, an existing staff account, a new client owner, and an existing client team member. Confirm the expected destination, profile, membership, and provider invitation state.
5. For the reported accidental client organisation, first identify the exact account and inspect its business records. Use reviewed staff invitation/revocation operations; do not infer staff privileges from the organisation name or automatically delete that organisation.

Rollback: revert the application deployment if necessary, retain the compatible forward migration, and diagnose with correlation IDs. Reverting the database security repairs would reopen the defects. Existing revoked grants require a fresh approved database invitation.

## Verification

Regression tests cover the actual PostgreSQL functions, concurrent claims, revocation, metadata boundaries, signup navigation and recovery, secondary-email verification, and sign-out middleware. A second code review found no remaining important defects after its four initial findings were corrected.

Validation used Node 24.21.0 and an isolated local PostgreSQL 17 database:

- All 47 migrations applied successfully to an empty database and passed `pnpm verify:migrations`.
- `pnpm test`: 1,887 unit tests and 39 Growth database tests passed. Nine preview tests were skipped because `GROWTH_OS_PREVIEW_URL` was not configured.
- `pnpm test:coverage:operations`: 405 tests passed against the fresh database. Coverage: 96.03% lines, 89.68% branches, 95.56% functions.
- Root middleware tests: 7 passed with `node --import tsx --test proxy.test.ts`.
- `pnpm typecheck`, `pnpm build`, `pnpm lint:covers`, changed-file Prettier checks, and `git diff --check` passed.
- ESLint passed over the source tree with `.worktrees/**` and the pre-existing `.freebuff/**` excluded. The unqualified lint command traversed unrelated nested checkout build output and was stopped.
- `pnpm audit --prod --audit-level high` reported no known vulnerabilities.

Live email delivery, real Clerk acceptance, CI, and production account repair were not performed. The deployed application and existing production records remain unchanged until the release above is approved.

## Changed areas

- `app/api/portal/access/claim/`: verified claim order, validation, and provider reconciliation.
- `components/portal/auth/`: invitation signup, existing-session acceptance, and recovery.
- `lib/operations/auth/`: provider creation and cleanup, invitation persistence, profile saving, and identity validation.
- `app/(portal)/portal/`, `proxy.ts`, and `app/api/auth/sign-out/route.ts`: staff routing and sign-out middleware.
- `app/api/webhooks/clerk/route.ts`: profile synchronization that preserves confirmed names.
- The forward migration and regression tests under `tests/integration/operations/`, alongside focused unit tests.
- This release record and `docs/operations/clerk-portal-auth.md`.

Provider references: [Clerk invitation creation](https://clerk.com/docs/reference/backend/invitations/create-invitation), [custom application invitations](https://clerk.com/docs/guides/development/custom-flows/authentication/application-invitations).
