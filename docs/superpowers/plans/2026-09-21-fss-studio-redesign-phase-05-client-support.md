# FSS Studio Redesign Phase 5 Client Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the remaining client-support surfaces C03, C04, C12, C13, C17–C24 and S04, S05, S07 and S10 as authorised, responsive FSS Studio routes backed by scoped Operations data and commands.

**Architecture:** Keep each live page thin: it obtains a verified portal context, calls an organisation-scoped read or command boundary, and renders a focused Portal presentation component. Extend the existing project, document, billing, offer, notification, profile and membership services instead of duplicating state in React; add a narrow support-ticket boundary because project-bound work requests cannot safely represent no-project access support.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, PostgreSQL/RLS migrations, Zod, existing Operations portal services, Portal shadcn-compatible primitives, Lucide, CSS Modules, Node test runner and Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-fss-studio-experience-redesign-design.md`, `docs/design/fss-studio-experience/02-workflow-contracts.md` sections A, B, C and E, `docs/design/fss-studio-experience/03-screen-contracts.md` C03, C04, C12, C13, C17–C24, S04, S05, S07 and S10, and `docs/design/fss-studio-experience/screen-coverage.csv`.

## Global Constraints

- Preserve `OPERATIONS_FSS_STUDIO_ENABLED`, `OPERATIONS_ONBOARDING_ENABLED`, billing/provider configuration and every production enablement setting. Do not run a production migration, send mail, invoke a payment session, create an invitation or call a provider while implementing this phase.
- Use `PortalButton`, `PortalCard`, `PortalField`, `PortalSelect`, `PortalTextarea`, `PortalCheckbox`, `PortalActionLink`, `Notice` and `StatusBadge` for every new or touched client control. Use existing Lucide icons only.
- Retain the existing verified portal identity, membership capability, RLS and registered-origin checks. Browser-supplied organisation, project, document, invoice, offer, member and notification IDs are parsed and scoped server-side.
- Client document reads never expose object keys, hashes, storage paths, internal notes, scan evidence, revoked records or another organisation’s metadata. A scanner-disabled upload control explains why it is unavailable and must not accept a file.
- Payment state remains derived from stored provider projections. A browser redirect, hosted invoice open or retry action never marks an invoice paid.
- A service enquiry and a support request are conversations, not purchases, invitations, project creation or access changes. Both require idempotency and return a server-created reference only after commit.
- Profile edits change only the current verified user’s display name. They cannot change email, membership, reviewer/signer designation, billing role or organisation timezone.
- Keep visual fixtures deterministic, synthetic, non-production-only and behind `FSS_VISUAL_TESTS_ENABLED`; never use live customer, provider, token or secret data.

## Review Focus

1. A document ID from another organisation, a revoked record or an uncleared file must return the normal no-access outcome without exposing filename, object key or scan state. Task 1 adds direct repository and route tests.
2. When no malware scanner is approved, the document page must not render a working file input or claim an upload succeeded. Task 1 covers the disabled action and safe quarantine presentation.
3. A billing redirect or hosted invoice open cannot be represented as a paid invoice, and viewers cannot open billing actions. Task 2 covers projected payment state and capability rejection.
4. A support request with a forged organisation ID, oversized body or duplicate idempotency key must not create a cross-tenant or duplicate ticket. Task 3 covers each boundary case.
5. A viewer can read settings and team information but cannot update preferences, save profile data, invite a user or mark notifications read. Task 4 covers component affordances and server-side command rejection.

---

### Task 1: Rebuild client project and document workspaces

**Files:**
- Create: `components/portal/projects/client-project-list.tsx`
- Create: `components/portal/projects/client-project-detail.tsx`
- Create: `components/portal/documents/client-document-workspace.tsx`
- Create: `components/portal/documents/client-document-detail.tsx`
- Create: `components/portal/documents/client-document-workspace.test.tsx`
- Create: `app/(portal)/(client)/portal/documents/[documentId]/page.tsx`
- Create: `supabase/migrations/20260921143000_operations_portal_document_detail.sql`
- Modify: `components/portal/project-summary.tsx`
- Modify: `components/portal/milestone-list.tsx`
- Modify: `components/portal/workspace/document-workspace-list.tsx`
- Modify: `components/portal/projects.module.css`
- Modify: `app/(portal)/(client)/portal/projects/page.tsx`
- Modify: `app/(portal)/(client)/portal/projects/[projectId]/page.tsx`
- Modify: `app/(portal)/(client)/portal/documents/page.tsx`
- Modify: `lib/operations/documents/repository.ts`
- Modify: `lib/operations/documents/types.ts`
- Modify: `lib/operations/documents/access.test.ts`

**Interfaces:**
- Produces `getPortalDocumentDetail(db, identity, organisationId, documentId, correlationId): Promise<ClientDocumentDetail | null>` where `ClientDocumentDetail` contains only `id`, `projectId`, `projectTitle`, `title`, `kind`, safe file/link fields, `version`, `createdAt` and `expiresAt`.
- Consumes existing `listPortalProjects`, `getPortalProject`, `listPortalWorkspaceDocuments`, `getAuthorisedDocumentDownload` and `documentUploadConfiguration`; it does not create a second project/document store.
- Produces C03/C04 and C12/C13 presentation components whose actions navigate to existing scoped routes, a safe file download endpoint or an explicitly disabled scanner-gated upload action.

- [ ] **Step 1: Write failing project and document presentation assertions**

```tsx
const projects = renderToStaticMarkup(
  <ClientProjectList projects={[activeProject, completedProject]} organisationId={organisationId} />,
)
assert.match(projects, /Active work/)
assert.match(projects, /Completed work/)
assert.match(projects, /Website & booking experience/)

const documents = renderToStaticMarkup(
  <ClientDocumentWorkspace documents={[document]} uploadConfiguration={disabledUpload} />,
)
assert.match(documents, /Uploads are unavailable until an approved malware scanner is configured/)
assert.doesNotMatch(documents, /type="file"/)
```

- [ ] **Step 2: Run the new presentation test to verify it fails**

Run: `node --import tsx --test components/portal/documents/client-document-workspace.test.tsx`

Expected: FAIL because the Phase 5 project/document presentation components do not exist.

- [ ] **Step 3: Add the safe document-detail projection before rendering it**

```ts
export type ClientDocumentDetail = ClientDocument & Readonly<{
  createdAt: string;
  expiresAt: string | null;
  projectTitle: string;
  version: number;
}>;

export async function getPortalDocumentDetail(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  documentId: string,
  correlationId: string,
): Promise<ClientDocumentDetail | null> {
  z.uuid().parse(documentId);
  return withProjectAccess(db, identity, organisationId, correlationId, "documents.read", async (tx, context) => {
    const [row] = await tx<{ document: ClientDocumentDetail }[]>`
      select case when d.kind = 'link' then jsonb_build_object(
        'id', d.id, 'projectId', d.project_id, 'projectTitle', p.title,
        'title', d.title, 'kind', d.kind, 'url', d.url,
        'version', d.version, 'createdAt', d.created_at::text, 'expiresAt', d.expires_at::text
      ) else jsonb_build_object(
        'id', d.id, 'projectId', d.project_id, 'projectTitle', p.title,
        'title', d.title, 'kind', d.kind, 'filename', d.filename,
        'mimeType', d.mime_type, 'sizeBytes', d.size_bytes,
        'version', d.version, 'createdAt', d.created_at::text, 'expiresAt', d.expires_at::text
      ) end as document
      from operations.documents d
      join operations.projects p
        on p.organisation_id = d.organisation_id and p.id = d.project_id
      where d.organisation_id = ${context.organisationId} and d.id = ${documentId}
    `;
    return row?.document ?? null;
  });
}
```

Add the smallest migration that grants `operations_portal` read access to the existing `documents.version` column. The query must require the current RLS-safe conditions: client visibility, cleared scan, no revocation and no expiry. Do not serialize `object_key`, `content_hash`, `scan_evidence`, `review_reference`, creator identity or internal document fields. Test own-organisation success and cross-tenant, revoked and quarantined `null`/access-denied outcomes.

- [ ] **Step 4: Implement C03, C04, C12 and C13 with Portal primitives**

```tsx
<PageHeader
  eyebrow="Your work with FSS"
  title="Your projects"
  description="Clear outcomes, visible milestones and a named FSS owner."
/>
<PortalCard>
  <StatusBadge status={project.status === "completed" ? "success" : "information"}>
    {projectStatusLabels[project.status]}
  </StatusBadge>
  <PortalActionLink href={projectHref(project.id, organisationId)}>Open project</PortalActionLink>
</PortalCard>
```

Render C03 active, review-waiting and completed grouping from the actual project status. Render C04’s outcome, milestone timeline, named owner, scoped requests link, authorised deliverables and a `New request` link retaining the current project. Render C12 category/filter labels, document metadata and an upload control disabled by `documentUploadConfiguration().reason`; do not render a file input until an approved scanner adapter exists. Render C13 from `ClientDocumentDetail` with project link, current version, publication date and only a safe download/open action. If no preview is supported, say so and retain the authenticated download action.

- [ ] **Step 5: Make routes and access tests pass**

Run: `node --import tsx --test lib/operations/documents/access.test.ts components/portal/documents/client-document-workspace.test.tsx lib/operations/projects/service.test.ts`

Expected: PASS with project/document views readable only by an authorised membership and with no enabled upload path while scanning is unavailable.

- [ ] **Step 6: Commit project and document workspaces**

```bash
git add supabase/migrations/20260921143000_operations_portal_document_detail.sql lib/operations/documents components/portal/projects components/portal/documents components/portal/workspace/document-workspace-list.tsx components/portal/projects.module.css app/'(portal)'/'(client)'/portal/projects app/'(portal)'/'(client)'/portal/documents
git commit -m "feat: redesign client project and document workspaces"
```

### Task 2: Rebuild billing and service enquiry routes

**Files:**
- Create: `components/portal/billing/client-billing-overview.tsx`
- Create: `components/portal/billing/client-invoice-detail.tsx`
- Create: `components/portal/billing/client-billing.test.tsx`
- Create: `components/portal/services/client-service-catalogue.tsx`
- Create: `components/portal/services/client-service-enquiry.tsx`
- Create: `components/portal/services/client-service-enquiry.test.tsx`
- Create: `app/(portal)/(client)/portal/billing/invoices/[invoiceId]/page.tsx`
- Create: `app/(portal)/(client)/portal/services/[offerId]/enquire/page.tsx`
- Modify: `app/(portal)/(client)/portal/billing/page.tsx`
- Modify: `app/(portal)/(client)/portal/services/page.tsx`
- Modify: `components/portal/billing/hosted-action.tsx`
- Modify: `components/portal/billing/invoice-list.tsx`
- Modify: `components/portal/services/offer-list.tsx`
- Modify: `components/portal/services/enquiry-form.tsx`
- Modify: `components/portal/billing/billing.module.css`
- Modify: `components/portal/services/services.module.css`
- Modify: `app/api/portal/services/enquiries/route.ts`
- Modify: `app/api/portal/services/enquiries/route.test.ts`

**Interfaces:**
- Consumes `loadInvoicePage`, `loadInvoice`, `loadBillingCustomer`, `HostedBillingAction`, `listPublishedOffers` and `insertOfferEnquiry` through their existing scoped portal transaction boundaries.
- Produces `ClientBillingOverview`, `ClientInvoiceDetail`, `ClientServiceCatalogue` and `ClientServiceEnquiry` components. Each accepts display DTOs and capability booleans rather than database clients or secrets.
- Changes the enquiry response to `{ enquiry: { id, reference } }`, where `reference` is server-derived from the durable enquiry record and only returned after insertion succeeds.

- [ ] **Step 1: Write failing billing and service component assertions**

```tsx
assert.match(renderToStaticMarkup(<ClientBillingOverview invoices={[openInvoice]} canManage />), /Next payment/)
assert.match(renderToStaticMarkup(<ClientInvoiceDetail invoice={paidInvoice} canOpenHostedInvoice />), /Download receipt/)
assert.doesNotMatch(renderToStaticMarkup(<ClientInvoiceDetail invoice={openInvoice} canOpenHostedInvoice={false} />), /Pay securely/)

assert.match(renderToStaticMarkup(<ClientServiceCatalogue offers={[offer]} canEnquire />), /A conversation first/)
assert.match(renderToStaticMarkup(<ClientServiceEnquiry offer={offer} organisationId={organisationId} />), /Preferred start/)
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --import tsx --test components/portal/billing/client-billing.test.tsx components/portal/services/client-service-enquiry.test.tsx`

Expected: FAIL because the Phase 5 billing/service presentation components and dedicated routes do not exist.

- [ ] **Step 3: Implement C17/C18 from persisted billing projections**

```tsx
<Notice tone={invoice.status === "paid" ? "success" : "information"} title="Payment status">
  {invoice.paymentState === "processing"
    ? "Payment processing. This page updates only after provider confirmation."
    : invoice.status === "paid"
      ? "Payment confirmed. Open the receipt through the secure billing service."
      : "Awaiting payment. If you have just paid, wait for provider confirmation."}
</Notice>
```

The C17 page calculates next payment from issued invoices and records unavailable data as unavailable rather than a zero balance. C18 validates the UUID and billing capability within `withPortalTransaction`, reads exactly one scoped invoice, presents its retained line/total snapshot and lets a permitted user open the existing hosted invoice session. Never convert a hosted session return or `window.location.assign` into a paid state. Replace raw buttons in `HostedBillingAction` and invoice components with `PortalButton` while preserving pending/error behaviour.

- [ ] **Step 4: Implement C19/C20 as a dedicated offer route**

```tsx
<PortalTextarea
  label="What would you like help with?"
  name="interest"
  required
  maxLength={4000}
/>
<PortalField label="Preferred start" hint="Optional">
  <input name="preferredStart" maxLength={1000} />
</PortalField>
<Notice tone="information" title="Next step">
  FSS will review your enquiry and follow up with a proposed scope and price.
</Notice>
```

The catalogue links to `/portal/services/:offerId/enquire` with organisation context. The route re-loads the published offer server-side and renders only the scoped selected offer. Extend the current POST schema and parsed `context` with bounded `preferredStart` and display the returned durable reference after success. Do not display an offer price unless the approved catalogue contains it and do not activate service/billing on submission.

- [ ] **Step 5: Run billing, offer and HTTP tests**

Run: `node --import tsx --test lib/operations/billing/portal-session.test.ts lib/operations/billing/stripe-payment-projections.test.ts app/api/portal/services/enquiries/route.test.ts components/portal/billing/client-billing.test.tsx components/portal/services/client-service-enquiry.test.tsx`

Expected: PASS with provider-derived payment state, portal capability enforcement and one idempotent scoped enquiry reference.

- [ ] **Step 6: Commit billing and service routes**

```bash
git add lib/operations/billing app/'(portal)'/'(client)'/portal/billing app/'(portal)'/'(client)'/portal/services app/api/portal/services/enquiries components/portal/billing components/portal/services
git commit -m "feat: redesign client billing and service routes"
```

### Task 3: Add durable help, profile and team support surfaces

**Files:**
- Create: `supabase/migrations/20260921150000_operations_portal_client_support.sql`
- Create: `lib/operations/support/client-support.ts`
- Create: `lib/operations/support/client-support.test.ts`
- Create: `lib/operations/support/client-support-handler.ts`
- Create: `app/api/portal/support/requests/route.ts`
- Create: `app/api/portal/support/requests/route.test.ts`
- Create: `app/api/portal/profile/route.ts`
- Create: `components/portal/support/client-help.tsx`
- Create: `components/portal/support/client-help.test.tsx`
- Create: `components/portal/workspace/client-profile-preferences.tsx`
- Create: `components/portal/workspace/client-profile-preferences.test.tsx`
- Create: `app/(portal)/(client)/portal/settings/team/page.tsx`
- Modify: `app/(portal)/(client)/portal/help/page.tsx`
- Modify: `app/(portal)/(client)/portal/settings/page.tsx`
- Modify: `app/(portal)/(client)/portal/team/page.tsx`
- Modify: `components/portal/workspace/team-list.tsx`
- Modify: `components/portal/auth/organisation-team-invitation.tsx`
- Modify: `lib/operations/auth/user-profile.ts`
- Modify: `lib/operations/workspaces/portal-repository.ts`
- Modify: `lib/operations/workspaces/types.ts`

**Interfaces:**
- Produces `createPortalSupportRequest(db, identity, organisationId, correlationId, input): Promise<{ id: string; reference: string }>` using a strict `category | subject | message | idempotencyKey` input, with no project, agreement or membership mutation.
- Produces `readPortalProfile` and `saveUserProfile` display DTOs containing the current user’s name/email, current organisation, organisation timezone and current membership role; save accepts only `displayName`.
- Consumes the existing `operations.upsert_user_profile`, notification preference command and team projection. Existing direct owner invitations remain visible only when the current policy grants `team.invite`; all other users get a non-mutating FSS access-change route.

- [ ] **Step 1: Write failing support/profile boundary tests**

```ts
await assert.rejects(
  createPortalSupportRequest(db, identityA, organisationB, correlationId, validSupportRequest),
  /access/i,
)
assert.deepEqual(await saveUserProfile(db, identityA, "Alex Morgan", correlationId), {
  displayName: "Alex Morgan",
})
await assert.rejects(saveUserProfile(db, identityA, { role: "owner" }, correlationId))
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --import tsx --test lib/operations/support/client-support.test.ts components/portal/support/client-help.test.tsx components/portal/workspace/client-profile-preferences.test.tsx`

Expected: FAIL because no durable no-project support request boundary or scoped profile component exists.

- [ ] **Step 3: Add RLS-safe support and profile database boundaries**

```sql
create table operations.portal_support_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references operations.organisations(id),
  user_id uuid not null,
  reference text not null unique,
  category text not null check (category in ('project_question','incident','workspace_access','billing','other')),
  subject text not null check (length(trim(subject)) between 1 and 160),
  message text not null check (length(trim(message)) between 1 and 10000),
  idempotency_key uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (organisation_id, user_id, idempotency_key)
);
```

Enable and force RLS, revoke direct portal access, and expose `operations.create_portal_support_request(target_organisation uuid, target_category text, target_subject text, target_message text, target_idempotency_key uuid)` as a security-definer function. It verifies `operations_portal`, active membership and the current user identity. Its reference is generated server-side and its idempotency key returns the existing same-user/same-organisation record. Add a `operations.portal_current_profile(target_organisation uuid)` function returning only the current profile fields, organisation display name/timezone and current membership role; it must not return another member’s profile or modify a membership.

- [ ] **Step 4: Implement C22/C23/C24 with scoped commands and Portal controls**

```tsx
const supportCategoryOptions = [
  { label: "Project question", value: "project_question" },
  { label: "Urgent incident", value: "incident" },
  { label: "Workspace access", value: "workspace_access" },
  { label: "Billing", value: "billing" },
  { label: "Other", value: "other" },
] as const;

<PortalSelect label="Support topic" name="category" required options={supportCategoryOptions} />
<PortalField label="Subject" required>
  <input name="subject" maxLength={160} />
</PortalField>
<PortalTextarea label="How can we help?" name="message" required maxLength={10000} />
<PortalButton loading={pending} type="submit">Create help request</PortalButton>
```

Render C22 with project question, incident, workspace and billing routes and an acknowledged ticket reference after the new API command commits. Render C23 with profile name, verified read-only email, organisation timezone, saved notification preferences and an explicit essential-account-message notice. Render C24 at `/portal/settings/team`, retain `/portal/team` as a redirect/compatible entry point, explain each role’s existing capabilities, and conditionally expose the already-authorised invitation form. A non-authorised user receives a support-link access-change notice, not a misleading disabled invite form.

- [ ] **Step 5: Run focused client-support and tenant tests**

Run: `node --import tsx --test lib/operations/support/client-support.test.ts app/api/portal/support/requests/route.test.ts components/portal/support/client-help.test.tsx components/portal/workspace/client-profile-preferences.test.tsx lib/operations/auth/user-profile.test.ts`

Expected: PASS with duplicate support requests idempotent, forged organisation IDs denied and no profile/team mutation beyond the current authorised boundary.

- [ ] **Step 6: Commit client support, profile and team surfaces**

```bash
git add supabase/migrations/20260921150000_operations_portal_client_support.sql lib/operations/support lib/operations/auth/user-profile.ts lib/operations/workspaces app/api/portal/support app/api/portal/profile app/'(portal)'/'(client)'/portal/help app/'(portal)'/'(client)'/portal/settings app/'(portal)'/'(client)'/portal/team components/portal/support components/portal/workspace components/portal/auth/organisation-team-invitation.tsx
git commit -m "feat: add client support and profile workspaces"
```

### Task 4: Redesign notifications and explicit client failure states

**Files:**
- Create: `components/portal/workspace/client-notification-inbox.tsx`
- Create: `components/portal/workspace/client-notification-inbox.test.tsx`
- Create: `components/portal/auth/invitation-expired.tsx`
- Modify: `components/portal/requests/mark-notifications-read.tsx`
- Modify: `components/portal/auth/unavailable.tsx`
- Modify: `components/portal/auth/invitation-activation.tsx`
- Modify: `app/(portal)/(auth)/portal/activate/page.tsx`
- Modify: `app/(portal)/(client)/portal/notifications/page.tsx`
- Modify: `app/(portal)/(client)/portal/documents/page.tsx`
- Modify: `app/(portal)/(client)/portal/settings/page.tsx`
- Modify: `lib/operations/workspaces/portal-repository.ts`
- Modify: `lib/operations/workspaces/types.ts`
- Modify: `app/api/portal/notifications/mark-read/route.ts`
- Modify: `app/api/portal/notifications/mark-read/route.test.ts`

**Interfaces:**
- Extends `PortalNotificationFilter` to `"all" | "unread" | "action_needed"`; the repository implements `action_needed` in SQL from the current request/review state, not from a client-side list slice.
- Produces `ClientNotificationInbox` with `all`, `unread` and `action needed` controls, direct authorised destinations and a `PortalButton` mark-read action.
- Produces `PortalUnavailable`, `InvitationExpired`, document quarantine and viewer-access notices that are truthful about the current route and do not grant capability.

- [ ] **Step 1: Write failing notification and failure-state assertions**

```tsx
assert.match(renderToStaticMarkup(<ClientNotificationInbox filter="action_needed" notifications={[review]} />), /Action needed/)
assert.match(renderToStaticMarkup(<PortalUnavailable reference="FSS-DEMO-042" retryHref="/portal" />), /Try again/)
assert.match(renderToStaticMarkup(<InvitationExpired loginHref="/portal/login" />), /A fresh invitation is needed/)
assert.doesNotMatch(renderToStaticMarkup(<ViewerAccessNotice />), /<button[^>]*>Invite/)
```

- [ ] **Step 2: Run the focused presentation test to verify it fails**

Run: `node --import tsx --test components/portal/workspace/client-notification-inbox.test.tsx components/portal/auth/invitation-activation.test.ts`

Expected: FAIL because the inbox and explicit failure-state presentations have not been added.

- [ ] **Step 3: Implement C21 and server-filtered action-needed state**

```ts
type PortalNotificationFilter = "all" | "unread" | "action_needed";

const filter = notificationFilterSchema.parse(rawFilter);
const actionNeededClause = filter === "action_needed"
  ? tx`and n.kind = 'review_requested' and r.status = 'ready_for_review'`
  : tx``;
```

Use a strict URL filter parser, preserve cursor/page state and update only the current user’s requested unread IDs. The endpoint parses a bounded UUID array, verifies the current identity and scopes the update to `user_id`; it never accepts a target user ID. Replace raw inputs, selects and buttons in the touched inbox controls with Portal primitives.

- [ ] **Step 4: Implement S04/S05/S07/S10 without fabricated authority**

```tsx
<Notice tone="information" title="Security check in progress">
  The file will be available after it passes the security check. You can leave and return later.
</Notice>
<PortalButton disabled disabledReason={documentUploadConfiguration().reason} type="button">
  Upload document
</PortalButton>
```

S04 provides a safe retry and correlation/support reference while preserving the page’s organisation context. S05 is selected only from the explicit expired activation state, offers no organisation disclosure and links an existing user to sign-in. S07 is a generic processing notice unless a future scanner-backed, current-user upload record exists; it does not surface an inaccessible quarantined document’s filename. S10 gives a viewer a useful capability explanation and a non-mutating access-help route; server commands still reject mutations independently.

- [ ] **Step 5: Run notification and failure-state tests**

Run: `node --import tsx --test lib/operations/workspaces/pagination.test.ts app/api/portal/notifications/mark-read/route.test.ts components/portal/workspace/client-notification-inbox.test.tsx components/portal/auth/invitation-activation.test.ts`

Expected: PASS with action-needed data filtered server-side, current-user-only read updates and safe unavailable/expired/quarantine/viewer displays.

- [ ] **Step 6: Commit client notification and failure-state work**

```bash
git add lib/operations/workspaces app/api/portal/notifications app/'(portal)'/'(auth)'/portal/activate app/'(portal)'/'(client)'/portal/notifications app/'(portal)'/'(client)'/portal/documents app/'(portal)'/'(client)'/portal/settings components/portal/workspace components/portal/auth components/portal/requests/mark-notifications-read.tsx
git commit -m "feat: redesign client updates and support states"
```

### Task 5: Add Phase 5 visual evidence and complete its matrix rows

**Files:**
- Create: `app/visual/fss-studio/[scenario]/client-support-visual-fixtures.tsx`
- Modify: `app/visual/fss-studio/[scenario]/visual-scenarios.tsx`
- Modify: `app/visual/fss-studio/visual-scenarios.test.tsx`
- Modify: `tests/e2e/fss-studio.visual.spec.ts`
- Create: `tests/e2e/fss-studio.visual.spec.ts-snapshots/{c03-client-projects,c04-client-project-detail,c12-client-documents,c13-client-document-detail,c17-client-billing,c18-client-invoice,c19-client-services,c20-client-service-enquiry,c21-client-notifications,c22-client-help,c23-client-preferences,c24-client-team,s04-client-unavailable,s05-client-invitation-expired,s07-client-document-quarantine,s10-client-viewer-access}-*.png`
- Modify: `docs/design/fss-studio-experience/screen-coverage.csv`

**Interfaces:**
- Produces synthetic deterministic desktop/mobile fixtures for the 16 Phase 5 matrix rows; fixtures consume presentation DTOs only and never load a database or issue a command.
- Registers stable visual scenario names and includes a level-one heading matching each route’s visible title.
- Changes only the corresponding Phase 5 matrix rows from `planned` to `verified` after their component/domain test and both platform screenshot baselines exist.

- [ ] **Step 1: Add failing Phase 5 visual registry assertions**

```tsx
assert.ok(visualScenarios["client-projects"])
assert.ok(visualScenarios["client-document-detail"])
assert.ok(visualScenarios["client-service-enquiry"])
assert.ok(visualScenarios["client-notifications"])
assert.ok(visualScenarios["client-invitation-expired"])
```

- [ ] **Step 2: Run the registry assertion to verify it fails**

Run: `node --import tsx --test app/visual/fss-studio/visual-scenarios.test.tsx`

Expected: FAIL because the Phase 5 scenarios are absent.

- [ ] **Step 3: Register desktop and mobile scenarios, then deliberately generate macOS baselines**

```ts
function ClientProjectsScenario(): React.JSX.Element {
  return <ClientShell memberships={[clientMembership]}><ClientProjectList projects={projectFixtures} organisationId={clientMembership.organisationId} /></ClientShell>;
}

function ClientDocumentDetailScenario(): React.JSX.Element {
  return <ClientShell memberships={[clientMembership]}><ClientDocumentDetail document={documentFixture} organisationId={clientMembership.organisationId} /></ClientShell>;
}

"client-projects": {
  name: "client-projects",
  content: <ClientProjectsScenario />,
},
"client-document-detail": {
  name: "client-document-detail",
  content: <ClientDocumentDetailScenario />,
},
```

Capture 1440×1200 desktop and 390×844 mobile comparisons for each Phase 5 row. Generate macOS baselines locally. On the first Linux CI run, download only the `fss-studio-visual-artifacts` artifact and promote its `*-actual.png` files to the exact `*-fss-studio-*-linux.png` snapshot names; never copy macOS baselines across operating systems.

- [ ] **Step 4: Update coverage only after evidence exists**

For C03, C04, C12, C13, C17–C24, S04, S05, S07 and S10, record the route, actual functional test and exact Phase 5 desktop/mobile assertion. Leave any route without a backed command or required baseline as `planned`; do not use a fixture alone as proof of a shipped screen.

- [ ] **Step 5: Run visual and coverage gates**

Run: `pnpm test:visual && pnpm verify:fss-studio-coverage && pnpm lint:covers`

Expected: PASS with all Phase 5 baselines present for macOS and Linux, and Phase 5 rows verified only when all evidence is recorded.

- [ ] **Step 6: Commit Phase 5 visual evidence**

```bash
git add app/visual/fss-studio tests/e2e/fss-studio.visual.spec.ts* docs/design/fss-studio-experience/screen-coverage.csv
git commit -m "test: cover FSS Studio client support visuals"
```

### Task 6: Run Phase 5 gates and merge only when green

**Files:**
- Modify only files required to fix a verified gate failure.

- [ ] **Step 1: Inspect the complete branch diff**

Run: `git diff origin/main...HEAD --check && git status --short`

Expected: no whitespace errors, generated test output or unrelated changes.

- [ ] **Step 2: Run code, domain and integration gates**

Run: `pnpm typecheck && pnpm lint && node --import tsx --test components/portal/{projects,documents,billing,services,support,workspace}/*.test.tsx lib/operations/{documents,projects,billing,offers,support,workspaces}/*.test.ts && pnpm test:integration:operations && pnpm verify:fss-studio-coverage`

Expected: PASS.

- [ ] **Step 3: Run browser and production gates**

Run: `pnpm test:visual && pnpm build && pnpm perf:budget:homepage && pnpm test:public-redesign`

Expected: PASS.

- [ ] **Step 4: Open and merge the Phase 5 pull request only after every required check is green**

Run: `gh pr create --base main --head feat/fss-studio-redesign-phase-05-client-support --title "feat: redesign FSS Studio client support" --fill && gh pr checks <pr-number> --watch && gh pr merge <pr-number> --merge`

Expected: the merge is clean, all required checks pass, no production flag is enabled, and Phase 6 starts from merged remote main.

## Self-Review

- **Spec coverage:** Task 1 owns C03/C04/C12/C13; Task 2 owns C17–C20; Task 3 owns C22–C24; Task 4 owns C21 and S04/S05/S07/S10; Task 5 records all 16 rows and Task 6 applies complete gates.
- **Security:** every new command is portal-identity and organisation scoped. Client profile, support, notification, invitation and billing affordances cannot create membership, change role, expose private document data or claim provider state.
- **Architecture:** project/document, billing/service, support/profile and notification/failure surfaces have focused modules over established domain boundaries. No component loads a database, holds a secret or manufactures a completed outcome.
- **Failure states:** no scanner, unavailable portal, expired invitation, readonly user, revoked/quarantined document, provider-payment pending and support idempotency all have an owning test.

## Execution Handoff

The user has explicitly approved phased native implementation, pull requests and merges after green checks. Execute on `feat/fss-studio-redesign-phase-05-client-support`; preserve production flags and settings, do not run production migrations or external effects, and start Phase 6 only after the confirmed Phase 5 merge.
