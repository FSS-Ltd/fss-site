# Staff Admin access

FSS staff Admin access is an independent realm. `FssStaffRole` contains only `admin`; `PortalRole` continues to contain only client roles. A staff grant creates no organisation, contact, or client membership.

## Server boundary

Use `issueStaffInvitation` with verified founder context to record the reviewed invitation before calling the provider. `createStaffInvitationMetadata` produces Clerk metadata version 3 with `realm: "staff"` and `role: "admin"`. Versions 1 and 2 remain client invitations. Record a failed provider attempt through `failStaffInvitation`.

Use `readPortalInvitationClaim` only with authenticated Clerk server results or verified Clerk webhook payloads. Pass its result to `claimClerkStaffInvitation`, which uses the existing portal database transaction identity boundary. Never build identity or founder context from request JSON. Clerk metadata is only an invitation pointer: the database invitation must match the verified email and remain eligible before a grant is created.

Use `requireFssAdmin` for staff access. It returns `FssAdminContext` only after checking the current active staff membership. Client membership and metadata alone do not authorize staff access. No staff routes or UI are included in this domain change.

## Grant lifecycle

Invitations expire after 72 hours. Claims lock the invitation and create the membership, completion record, and audit event in one transaction. Repeated claims return only the same active grant. Founder revocation changes both the invitation and its grant atomically; replaying old metadata cannot restore access. A new founder-approved invitation is required after revocation.

Issue serializes on normalized email, revokes any prior pending invitation, and refuses to issue over an active grant for that email. A unique index allows at most one active staff membership per user. Revocation and provider failure retain their timestamps; completed invitation history retains the claimed user after revocation.

All three staff tables have forced RLS with no direct runtime table grants. Only the founder role can issue, record provider failure, or revoke. Only the portal server role can claim and look up its active staff grant. Functions use an empty search path and fully qualified relations. Staff audit records are separate from organisation audit records.

## Verification and rollout

The additive migration is `20260916134734_operations_staff_admin_boundary.sql`. It is not applied by the tests or by this change. Validate on an approved local Operations test database with that migration installed before deployment:

```sh
node --import tsx --test lib/operations/auth/staff-invitations.test.ts lib/operations/auth/clerk-invitation.test.ts lib/operations/auth/pending-invitations.test.ts
node --import tsx --test tests/integration/operations/staff-invitations.test.ts
pnpm verify:migrations
```

The integration command requires `OPERATIONS_TEST_DATABASE_URL` targeting the existing local test database allowlist. Tests use random synthetic identities and remove only their own fixtures. Do not point it at production. Production migration, provider settings, invitation sending, and staff route wiring require their separate rollout steps.
