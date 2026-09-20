# FSS Studio Experience Redesign

**Owner:** Technical Agent
**Status:** Approved design, awaiting implementation-plan review
**Created:** 2026-09-20
**Related:** FSS Studio Experience handoff and Operations Studio cutover runbook

## Problem statement

The Operations implementation delivered durable services, permission checks,
routes and background workflows, but its portal presentation remained the
legacy header/main/footer shell. The approved FSS Studio handoff defines 88
screen contracts with client and founder journeys. The current UI does not use
those contracts: the client portal is an organisation directory, Studio is
wrapped by the client layout, the founder overview is a placeholder, and the
existing redesign check examines public-site motion rather than portal screens.

This project makes the approved handoff the versioned implementation source and
replaces the portal experience incrementally, without replacing secure
Operations services.

## Goals

1. Commit the complete approved handoff and a checked 88-screen coverage matrix.
2. Give client, authentication and Studio surfaces independent layouts while
   preserving current portal URLs and host rewrites.
3. Build the approved tokens, responsive navigation, fields, buttons, statuses,
   surfaces and accessibility states as shared primitives.
4. Deliver every client, founder, shared, email and mobile screen with an
   authorised read, command, server acknowledgement, or explicit unavailable state.
5. Add desktop and mobile visual comparison tests for every matrix row, plus
   focused functional and permission checks.
6. Keep OPERATIONS_FSS_STUDIO_ENABLED disabled in production until reviewed
   authenticated visual and workflow evidence exists.
7. Ship one independently reviewable PR per phase and merge only through the
   protected GitHub workflow after the phase checks are green.

## Non-goals

- Changing PortalRole, the staff-admin guard, Clerk provisioning, billing,
  signing evidence, notification deduplication or journey scheduling merely to
  match an illustration.
- Enabling Studio, prefix-free routing or Growth cutover in production.
- Adding client-side data stores, raw record-ID selectors, mocked success states
  or dead links.
- Replacing current URLs without a compatibility redirect and verification.

## Design source and coverage contract

Phase 1 imports the approved local handoff unchanged into
docs/design/fss-studio-experience/. It includes its screen manifest,
behavioural contracts, workflow contracts, design system, handoff guidance, 88
editable SVGs and PNG previews. The checked-in copy becomes the implementation
source of truth and does not depend on a developer-local attachments directory.

docs/design/fss-studio-experience/screen-coverage.csv contains exactly 88 rows,
one for each reference ID in the imported manifest. Its schema is:

| Column | Meaning |
| --- | --- |
| screen_id | Stable reference ID, such as C01, F01, or M07. |
| surface / role | Client, founder, shared, email or mobile surface and intended user. |
| reference | Repository-relative editable SVG and preview paths. |
| route / scenario | Public URL and authorised data/state needed to render it. |
| component | Page or focused component that owns the surface. |
| read_model | Existing authorised server read or a narrow presentation DTO. |
| command_or_event | Command, route handler or notification event making the primary action real. |
| permission | Required portal capability or staff guard. |
| desktop_visual / mobile_visual | Named screenshot assertion at the required viewport and state. |
| functional_test | Test proving the primary action is not decorative. |
| phase / status | Owning phase and planned, implemented, verified, or blocked. |

The matrix verifier fails for missing or duplicate IDs, missing references,
routes, ownership, visual assertions or functional assertions. The final release
phase fails unless all 88 rows are verified. A row may use an unavailable state
only when its contract permits it and it provides a safe next action.

## Architecture

### Route boundaries

app/(portal)/portal/layout.tsx currently owns a client header, constrained main
column and footer. /portal/admin is nested below it, so Studio inherits client
chrome. The new structure separates those responsibilities without changing
internal paths used by the portal-host proxy:

    app/(portal)/layout.tsx
      Clerk provider and common portal entry only
    app/(portal)/(auth)/portal/{login,activate}/...
      authentication and invitation surfaces
    app/(portal)/(client)/portal/layout.tsx
      client shell only
    app/(portal)/(client)/portal/...
      client workspace routes
    app/(portal)/(studio)/portal/admin/layout.tsx
      Studio shell only
    app/(portal)/(studio)/portal/admin/...
      staff routes

Route groups do not add public URL segments. portalPath and proxy.ts retain
prefix-free portal-host URLs, while Next internal routes remain /portal/* and
/portal/admin/*. The common route-group layout may provide Clerk but must not
render client or staff navigation, width constraints or chrome. Each persona
layout retains its existing operations-enabled and authorised-user boundary.

### Presentation layer

Focused modules under components/portal/ui/ and components/portal/shell/ own
tokens, buttons, fields, status badges, alerts, empty states, page headers,
responsive navigation, workspace switcher, account menu and dialog primitives.
Route pages remain server-authorised data boundaries. Existing request,
agreement, onboarding, billing, document and notification components keep their
workflow-specific responsibility and consume shared primitives rather than
duplicating business logic.

An overview needing data not exposed by an existing page query receives a narrow
read model in the owning Operations domain. It uses verified server context,
resolves tenant scope server-side and returns display-safe DTOs. The browser
never supplies role, organisation or record IDs as authority.

### Visual system

The handoff tokens are binding: canvas #F2F3F5, surface #FFFFFF, soft surface
#F7F8F9, ink #0A1A2E, muted text #46566C, action teal #0F7078, accent tint
#E3F2F1, navy #07182E, border #D9DFE5 and control boundary #788696. Geist is
loaded through the supported Next font integration with the existing system
fallback retained.

Desktop client navigation is a 232 px sidebar with a workspace switcher and
role-aware modules. Studio navigation exposes founder modules from the handoff.
At narrow widths both shells use labelled bottom navigation for Home, Projects,
Requests and More. More exposes remaining authorised modules. Dense boards
become deliberate lists, never compressed six-column grids.

Every primitive has default, hover when applicable, focus-visible, pressed,
disabled, pending, error and success behaviour as applicable. Controls have a
44 px target, persistent labels, visible focus, reduced-motion treatment and
semantic status text. Read-only, loading, empty, error, unavailable and
recovery states are first-class screen states.

## Functional mapping

The handoff is a UX contract, not permission to bypass current domain rules.

| Journey | Existing source of truth | Required UI result |
| --- | --- | --- |
| Client and Studio overview | memberships, projects, requests, journeys, billing and metrics queries | Authorised next actions and counts only, with no invented metrics. |
| Requests and review | validation, transitions, reviews, idempotency and notifications | Creation, triage, exact-version review, conflict recovery and notification destinations. |
| Agreements and signing | revisions, retained documents, signing and staff handlers | Named client/engagement choices, server-calculated evidence, readiness checks and real signing state. |
| Welcome journeys | durable scheduler, worker, recovery and task evidence | Draft, preflight, activation, monitoring, pause/resume/reconcile and client checklist states. |
| Supporting workspaces | scoped projects, documents, billing, services, notifications, team and preferences | Real lists, downloads, enquiries, preferences and authorised settings. |

No phase may turn a backend failure into an empty state, call founder closure a
client acceptance, fabricate a sent or delivered notification, or treat an
illustrated success state as a server acknowledgement.

## Delivery phases and PR gates

| Phase | Branch | Deliverable | Required screen groups |
| --- | --- | --- | --- |
| 1 | feat/fss-studio-redesign-phase-01-foundation | Versioned handoff, 88-row matrix and verifier; route groups; shared primitives; responsive shells; real C01/F01 overviews; visual harness; public validator renamed test:public-redesign. | C00, C01, C25, F01, M01, M07 and shared shell states. |
| 2 | feat/fss-studio-redesign-phase-02-requests | Client and Studio request boards, create/detail/review/complete flows and request notifications. | C05-C11, F05-F08, F36, S01-S03, S08-S09, M03-M05, E01-E02. |
| 3 | feat/fss-studio-redesign-phase-03-agreements | Agreement list, guided builder, retained-document review, signing and manual evidence exception. | C14-C16, C30, F09-F17, F32, F34, F37, M06. |
| 4 | feat/fss-studio-redesign-phase-04-welcome | Founder journey builder, preflight, activation and recovery plus client checklist. | C02, C26-C29, F18-F26, F33, F35, M02, M08. |
| 5 | feat/fss-studio-redesign-phase-05-client-workspace | Projects, documents, billing, services, notifications, help, settings, team and workspace selection. | C03-C04, C12-C13, C17-C24, S04-S05, S07, S10. |
| 6 | feat/fss-studio-redesign-phase-06-studio-workspace | Client register/detail, delivery, projects, billing, portal access, notifications and settings. | F02-F04, F27-F31, S06 and remaining founder detail states. |
| 7 | feat/fss-studio-redesign-phase-07-state-parity | Remaining shared, error, mobile and accessibility recovery variants. | Any matrix row not already verified. |
| 8 | feat/fss-studio-redesign-phase-08-release-evidence | Full visual suite, authenticated non-production workflow evidence, release checklist and rollback validation. | All 88 rows verified. |

Each phase begins from remote main containing the previous merged phase. A PR
contains only its declared scope, maps its rows in the matrix and runs all
relevant checks. It merges only when GitHub required checks are green and the
protected merge workflow accepts it. Failed checks are fixed at cause; no bypass
or temporary production flag is permitted.

## Verification strategy

Each phase begins with a failing focused test for production behaviour, then
runs its affected test and these repository checks as applicable:

- pnpm typecheck
- pnpm lint
- pnpm test:unit
- pnpm test:integration:operations for Operations reads, commands,
  authorisation or persistence
- pnpm build
- the matrix verifier and renamed pnpm test:public-redesign

Phase 1 adds Playwright visual testing rather than pretending the public
marketing validator covers portal work. Deterministic non-production fixtures
and supported Clerk test authentication capture named matrix scenarios at 1440
px desktop and 390 px mobile, with 320 px, 375 px and 768 px reflow checks where
the handoff requires them. Baselines are committed with the test names and never
use production accounts, customer data, provider effects or secrets.

Functional browser tests cover request submit and exact-version decision,
agreement readiness/signing, journey activation/recovery, scoped document
access, billing/service actions, notification preference update and client/staff
access denial. Screenshot tests do not substitute for service-level tests.

For each PR, compare desktop and mobile captures with the imported reference in
the same state. Inspect keyboard navigation, 200% zoom, reduced motion, form
errors, accessible names, focus restoration and server failure handling. The
final phase runs an authenticated non-production flow with an FSS Admin, client
owner, read-only client and revoked user, using safe fixtures only.

## Security, rollout and rollback

Production remains gated by fssStudioEnabled. This work must not set
OPERATIONS_FSS_STUDIO_ENABLED=true, relax its production default, enable the
Growth cutover flag, change Clerk settings, run production migrations or send
real invitations. Phase 8 updates the cutover runbook with completed
authenticated checks. Only an explicit founder release decision may then enable
Studio according to the runbook's ordered flag rollout.

Each visual phase is additive or reversible by reverting its merged PR. The
existing flag remains the operational rollback for Studio exposure; Growth
routes and durable Operations records remain intact until separately approved
cutover completion.

## Success evidence

- The design directory contains the entire approved handoff and a verifier
  proves 88 references and 88 matrix rows are present.
- No client shell wraps Studio and no Studio navigation appears on client routes;
  public portal URL compatibility tests pass.
- Every matrix row is verified with an authorised data source, real primary
  action or explained unavailable state, desktop/mobile assertion and
  functional-test reference.
- All phase PRs merge through green required checks with no invitation-branch
  commit included.
- Full application checks and authenticated non-production visual/workflow
  evidence exist before Studio is considered for enablement.
- Studio production remains disabled through implementation and until a
  separate release decision.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| The source handoff is outside the repository. | Phase 1 checks in the source and rejects external-only references. |
| UI work bypasses permission rules. | Pages use verified server context and existing domain services; integration tests exercise client, staff and revoked access. |
| A screenshot baseline hides a dead action. | Every matrix row requires a functional-test reference as well as visual assertions. |
| Large visual changes obscure regressions. | One screen family per phase, fresh baseline checks and protected PR gates. |
| Production is exposed prematurely. | Preserve the production-default-off flag and require Phase 8 evidence plus founder approval. |
| A phase uses a stale base. | Start each phase from merged remote main; do not stack unmerged feature branches. |

## Open implementation decisions

- Select the smallest icon source already available in the dependency graph;
  add a dependency only when no suitable accessible icon set exists.
- Establish deterministic non-production fixture/reset ownership before visual
  tests. Credentials and test identities stay in the secure environment.
- Confirm GitHub Actions visual-test browser caching and artifact retention when
  Phase 1 adds Playwright configuration.
