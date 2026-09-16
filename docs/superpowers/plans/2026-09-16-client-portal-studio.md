# Client Portal and FSS Studio Implementation

## Global constraints

- Preserve client `PortalRole` values. FSS `admin` is a separate staff role.
- Only the Growth founder surface may issue or revoke portal access.
- Do not deploy, apply production migrations, alter Clerk settings, or send invitations.
- Keep `/portal` as an internal route namespace only; visible portal-subdomain URLs are prefix-free.
- Use the approved Studio Experience handoff for visual and workflow contracts.

## Task 1: Prefix-free portal host routing

- Extend portal host route mapping to rewrite prefix-free portal-subdomain UI routes to the internal `/portal` routes.
- Redirect visible legacy `/portal/*` routes to their prefix-free equivalent and preserve query strings.
- Exclude API, webhook, static, and Next asset paths; keep the public site and Growth OS unchanged.
- Add behavior tests for root, nested portal routes, legacy routes, and non-portal hosts.

## Task 2: Staff Admin domain boundary

- Add additive Operations migration for staff memberships, pending staff invitations, and audit evidence.
- Add narrow typed adapters for founder-issued Admin invitations, verified claims, active membership checks, and revocation.
- Extend Clerk invitation metadata compatibly with an Admin invitation variant.
- Add integration and unit tests for mismatch, expiry, idempotency, revocation, and client-role isolation.

## Task 3: Founder portal-access console

- Replace the Growth Operations overview with the portal access console.
- Add Admin invitation and revocation commands while retaining client invitation onboarding.
- Return deduplicated active and pending totals with client and Admin role distribution.
- Update the invitation dialog and access register for client versus FSS Admin access.

## Task 4: Portal workspace shell and Admin foundation

- Add a role-gated prefix-free client shell and FSS Studio Admin shell using approved tokens and navigation.
- Add `/admin`, `/admin/clients`, and client context routing backed by a verified Admin guard.
- Reuse existing Operations domain services and components; do not duplicate business logic.
- Add route, authorization, component, and responsive tests.

## Task 5: Operations workflow migration

- Move the existing client, requests, agreements, signing, journeys, projects, billing, documents, services, notifications, team, and settings workflows into their approved client and Admin destinations.
- Implement remaining prototype-only workflows in vertical slices with durable domain contracts and end-to-end tests.
- Redirect old Growth Operations routes only after each matching Admin workflow has parity.

## Task 6: Release verification and documentation

- Verify typecheck, lint, unit tests, Operations integration tests, migration verification, build, and authenticated browser paths.
- Update Operations routing, Clerk redirect, recovery, and release runbooks without exposing credentials.
- Do not deploy or apply production changes.
