# Organisation-free portal and founder invitations

**Owner:** Technical Agent  
**Status:** Approved design  
**Created:** 2026-09-13  
**Last updated:** 2026-09-13

## Problem statement

The Portal Access modal opens at the top-left because its author styles replace the browser's default dialog positioning without restoring automatic margins. The same modal requires an existing organisation, even though a new client should supply their organisation during first-run portal onboarding. There is also no invitation action for the founder workspace, although access is already restricted to the configured, verified founder email.

## Goals

- Open the invitation dialog in the visual centre of the viewport on desktop and mobile.
- Invite a new client using name, email, portal role, and approval note only.
- Collect and validate the client's organisation during first-run portal onboarding.
- Create the organisation, contact, and initial membership atomically after the invited user submits onboarding.
- Let the founder send a founder-workspace invitation only to the configured founder email.
- Preserve verified-email enforcement, least-privilege database roles, auditability, and idempotency.

## Non-goals

- Inviting additional founders or making founder access configurable from the browser.
- Changing existing organisation-bound memberships or invitations.
- Enabling billing, signing, or the separate post-signature onboarding worker.
- Deploying or applying a Production migration.

## User and business impact

The founder can invite a client before creating a client record. The client accepts the Clerk invitation, enters the portal, supplies their organisation details, and receives the initial owner membership. Existing invited users remain associated with their current organisations. The founder can also send the configured founder account a direct invitation to the private workspace without broadening who may authenticate.

## Architecture

### Invitation modal

The modal will expose an invitation type with two values:

- **Client:** name, email, portal role, and approval note.
- **Founder:** the configured founder email shown as read-only and an approval note.

The dialog component will submit a discriminated request payload. CSS will use `margin: auto` with the existing width and viewport-height bounds so the native modal remains centred and scrollable.

### Client invitation lifecycle

An organisation-free client invitation cannot use `operations.contacts`, `operations.memberships`, or the existing organisation-bound invitation procedure. A new `operations.portal_account_invitations` table will hold the minimum pending grant:

- normalized recipient email;
- recipient name;
- requested initial role;
- state and expiry;
- founder actor hash and review reference;
- Clerk invitation identifier or another stable provider reference where available;
- timestamps and correlation identifier.

Only the founder runtime may create and inspect pending grants. The portal runtime may claim a grant only when the verified Clerk email matches the normalized recipient email.

Clerk public metadata will contain a versioned, organisation-free invitation claim. Acceptance proves email ownership but does not create portal access. The portal landing route detects the claimed invitation and redirects the user to first-run organisation onboarding.

### Organisation onboarding

The onboarding page will collect the smallest organisation record required by the existing schema: display name and legal name. Any other fields remain at safe schema defaults or are collected only if the current database contract requires them.

A security-definer database function, executable only by `operations_portal`, will:

1. verify the runtime user ID and verified email settings;
2. lock and validate an unexpired pending invitation for that email;
3. create the organisation;
4. create the contact;
5. create the user's initial membership;
6. mark the invitation claimed;
7. append audit records;
8. return the organisation ID.

All writes occur in one transaction. Repeated submissions return the already-created organisation where the same invitation was successfully claimed; conflicting ownership fails closed.

### Founder invitation lifecycle

The founder invitation action accepts no arbitrary recipient address. The server obtains the sole permitted address from validated server configuration and rejects any mismatched payload. It sends an invitation to `/growth/login` using the existing transactional email boundary. Authentication remains Google-based and `requireFounder` continues to require the exact configured email with a verified profile. The invitation email is therefore a secure entry link, not a second authorization mechanism.

## Data flow

1. Founder opens the centred modal and chooses Client or Founder.
2. The founder-only API validates the discriminated request and registered origin.
3. Client flow records the pending grant and sends the Clerk invitation with organisation-free metadata.
4. Founder flow sends the configured founder address a link to the existing Google sign-in page.
5. A client accepts the Clerk invitation and is redirected to portal onboarding.
6. Portal onboarding claims the pending grant and provisions the organisation and membership atomically.

## Failure modes

- Provider invitation failure leaves no usable grant, or records a retryable provider state without granting access.
- Expired, missing, malformed, or email-mismatched metadata does not create an organisation or membership.
- Duplicate requests reuse a pending invitation or return a clear conflict instead of creating parallel grants.
- Organisation creation failures roll back the entire claim.
- Founder email delivery failure returns a generic service error and never changes authorization state.

## Security and privacy

- The founder API keeps its existing authenticated founder and registered-origin checks.
- Founder invitations are server-bound to `GROWTH_OS_OWNER_EMAIL`.
- Client claims require a verified Clerk identity whose normalized email equals the pending invitation email.
- Browser-controlled organisation IDs, founder email overrides, and actor identifiers are never trusted.
- Review references and correlation IDs preserve an audit trail without storing invitation tokens in plaintext.
- Database grants remain scoped to the founder and portal runtime roles.

## Rollout and rollback

The database migration is additive. Existing organisation-bound invitation records and memberships remain readable. The application can be rolled back while leaving the new pending table unused. The migration must not be applied to Production without explicit founder approval.

## Observability

Audit events distinguish invitation creation, provider dispatch, organisation onboarding completion, and claim rejection. API responses retain correlation IDs. Provider errors expose generic user messages while server logs retain error class only, avoiding recipient or credential leakage.

## Trade-offs

This introduces a second invitation version and a small first-run onboarding route. That is more work than merely hiding the organisation field, but it removes the data dependency honestly and prevents clients from being attached to an arbitrary placeholder organisation.

The founder invitation is intentionally a sign-in link rather than a new founder authorization record. This preserves the existing single-founder security model.

## Alternatives considered

- **Create a placeholder organisation at invitation time:** rejected because it creates ambiguous records and makes later renaming or deduplication part of onboarding.
- **Hide the organisation selector and submit a fixed organisation:** rejected because it misrepresents ownership and weakens tenant boundaries.
- **Use Clerk for founder authorization:** rejected because the founder workspace already uses verified Google authentication and mixing providers would widen the access surface.

## Success criteria

- The dialog is centred in supported viewport sizes and remains usable when its content scrolls.
- Client invitation requests and metadata contain no organisation ID.
- An invited client cannot access organisation data before completing onboarding.
- Successful onboarding creates exactly one organisation, contact, membership, and claim audit trail.
- Only the configured verified founder email can receive and use a founder invitation.
- Existing organisation-bound members and portal routes continue to work.
- Relevant unit, component, route, database-contract, type, lint, and build checks pass.

## Open questions

None. The approved behavior is explicit: clients supply their organisation after accepting the invitation, and founder invitations go only to `j.ntagengwa@faithfulsoftware.dev`.
