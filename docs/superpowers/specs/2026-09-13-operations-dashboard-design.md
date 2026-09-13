# Operations dashboard visual system and portal invitation design

**Owner:** Technical Agent
**Status:** Approved for planning
**Created:** 2026-09-13
**Related:** [PR #224](https://github.com/FSS-Ltd/fss-site/pull/224)

## Problem statement

Growth Operations contains the working founder workflows for client records,
agreements, onboarding, signing, requests, billing, and portal access. The
screens use several independent visual treatments, making the workflow feel
fragmented and leaving the portal invitation action easy to miss. Portal roles
are already assigned in the Operations database, but their meaning is not
explained at the point a founder selects one.

## Goals

- Give every Growth Operations route a consistent enterprise dashboard
  hierarchy using the existing navy, teal, slate, and status colours.
- Preserve each existing operation, authorisation check, database boundary, and
  route contract.
- Make the founder's portal invitation path clearly actionable: choose a
  client, contact details, database role, approval note, then send the Clerk
  activation email.
- Explain every portal role in context without requiring hover, colour, or
  outside documentation.
- Use charts only where source data supports a clear operational question.
- Keep all layouts responsive, keyboard-operable, and usable with assistive
  technology.

## Non-goals

- Changing portal permissions, database schema, invitation expiry, Clerk
  delivery, or the acceptance/webhook flow.
- Inventing analytics for workflows that do not expose source data.
- Replacing the founder authentication model or client portal layout.
- Deploying to Production.

## Scope

The visual system applies to all existing Growth Operations screens:

1. Operations overview and report drill-downs.
2. Client register and billing exception queue.
3. Portal access register and invitation workflow.
4. Per-client agreement, onboarding journey, signing, request list, and
   request-detail screens.

## Interaction and visual design

### Shared Operations shell

Each screen receives a common header treatment: Operations context, page title,
plain-language outcome, relevant back/breadcrumb links, and one primary action
where the workflow has a next step. Reusable cards, compact KPI rows, status
chips, tables, action controls, empty states, errors, and mobile breakpoints
use existing dashboard colours and spacing.

Overview retains the existing metrics, revenue movements, receivables, and
exceptions. Charts have a title, a direct textual summary, visible labels and
counts, and no essential information that is available only by colour or
interaction. Other pages show data-derived counts or summaries only where their
existing inputs support them.

### Portal invitation workflow

Portal access receives a visible “Invite portal user” primary action. It opens
or focuses the access form rather than concealing the action in the register.
The form posts the existing `grant_access` operation to
`/api/growth/operations/portal-access`; no invitation business rules move to the
client.

The action creates an approved contact, writes the selected role to Operations
database records, issues the auditable portal invite, then asks Clerk to deliver
the activation email. The UI explains this sequence before submission and shows
pending, success, and failure states.

### Role chooser and help

The native select becomes a labelled, keyboard-accessible group of four role
choices: Owner, Contributor, Billing contact, and Viewer. Each choice has an
adjacent help control which exposes a tooltip on focus, hover, and tap. The
selected role also has persistent explanatory text, so the permission boundary
is available to keyboard, touch, and screen-reader users without relying on a
tooltip.

Role explanations are:

| Role | Access boundary |
| --- | --- |
| Owner | Projects, requests, agreements, billing, and invitation requests for the organisation. |
| Contributor | Projects, shared documents, and creating or commenting on requests. |
| Billing contact | Billing records and payment management only. |
| Viewer | Read-only projects, documents, and services. |

These descriptions must be checked against `lib/operations/auth/permissions.ts`
and stay beside the role source of truth rather than becoming duplicated,
unreviewed copy.

## Architecture

Visual primitives live under `components/operations` and are composable rather
than being embedded in individual route pages. Route pages remain data-loading
and authorisation boundaries. Existing component modules remain responsible for
their workflow-specific forms and mutations.

A single typed role-presentation source feeds the invitation chooser, access
register, onboarding previews, and tooltip content. It consumes the existing
`PortalRole` union and must not alter permissions.

## States and failure modes

- All cards maintain present, empty, loading, error, pending, disabled, and
  success states already required by the underlying workflow.
- A missing organisation prevents invitation submission and explains the
  prerequisite.
- An invite request failure remains generic to the founder while retaining the
  server correlation boundary.
- Charts display a textual zero-data state when their source has no rows.
- Tooltips are supplemental; their content remains visible in the selected
  role’s description.

## Accessibility

- Primary actions and form controls retain a minimum 44 px target.
- Role controls use native radio semantics, visible labels, focus states, and
  `aria-describedby` for the selected-role explanation.
- Help controls use buttons, can be reached by keyboard, and expose their
  relationship to the tooltip with ARIA.
- Charts provide titles, text summaries, labelled values, and status/icon
  distinctions in addition to colour.
- Respect `prefers-reduced-motion`; no workflow state relies on animation.
- Tables preserve captions, headings, and horizontal-scroll regions on narrow
  screens.

## Security and privacy

The UI never receives Clerk secrets, portal invite tokens, or direct database
credentials. Founder-only API validation, registered-origin checks,
organisation scoping, database role assignment, and Clerk webhook verification
remain unchanged.

## Rollout and rollback

This is a visual and interaction-layer change. It requires no migration. A
revert restores the prior components without altering contacts, memberships, or
invites. Production deployment remains subject to explicit founder approval.

## Verification

- Unit tests cover role selection, tooltip keyboard accessibility, and the
  invitation payload with the selected database role.
- Existing Operations component tests are updated for the common visual
  primitives where applicable.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, and `pnpm build`.
- Inspect responsive desktop and mobile rendering for the overview, portal
  access, client, billing, agreement, journey, signing, request-list, and
  request-detail pages.
- Check PR preview visual state and CI before handoff.
