# FSS Growth OS Founder Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved founder-only Growth OS dashboard for research review, personalised first-email approval, outreach control, website strategy, and newsletter operations.

**Architecture:** Authenticated App Router pages use Server Components for read models and small Client Components only for interactive forms. Page modules remain thin. Typed query services shape database records into UI-specific view models, and server actions delegate every mutation to the audited domain services from earlier plans.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 4, existing FSS UI primitives, Auth.js, Node test runner.

## Global Constraints

- Every `/growth` page and mutation is founder-only.
- The authorised email is exactly `j.ntagengwa@faithfulsoftware.dev`.
- Server Components may call read-model services, not provider SDKs or raw SQL.
- Client Components receive the minimum data needed for interaction and never receive provider tokens, source payloads, or private notes they do not render.
- Existing FSS design tokens and reusable primitives come before new component patterns.
- Desktop and mobile layouts follow the approved mockups in `docs/growth-os/mockups/`.
- The user has asked not to use browser automation for this work. Verify component logic, accessibility contracts, types, lint, and build without Playwright or browser-control tooling. Founder visual review remains a manual approval gate.
- Every mutation uses origin validation, Zod validation, optimistic concurrency, fresh `requireFounder()` authorization, and an audit event.
- Loading, empty, error, stale integration, conflict, success, and disabled-automation states are part of the feature.

---

### Task 1: Define Dashboard Navigation And Read-Model Contracts

**Files:**

- Create: `lib/growth/dashboard/navigation.ts`
- Create: `lib/growth/dashboard/navigation.test.ts`
- Create: `lib/growth/dashboard/view-models.ts`
- Create: `lib/growth/dashboard/formatters.ts`
- Create: `lib/growth/dashboard/formatters.test.ts`

**Interfaces:**

- Consumes: domain records from previous plans
- Produces: serialisable, UI-specific `Growth*ViewModel` types

- [ ] **Step 1: Write failing navigation tests**

Assert exact links and active-route resolution for Overview, Prospects, Outreach, Pipeline, Deals, Clients, Analytics, Newsletter, and Settings. Test nested routes and keyboard-readable labels.

- [ ] **Step 2: Define discriminated view states**

```ts
export type ViewState<T> =
  | { status: "ready"; data: T }
  | { status: "empty"; reason: string }
  | { status: "error"; message: string; correlationId: string };

export type IntegrationHealth = {
  provider: "database" | "gmail" | "resend" | "codex" | "cron";
  status: "healthy" | "attention" | "disconnected" | "disabled";
  checkedAt: string;
  message: string;
};
```

Use strings for serialised dates and integer pence for money. Do not pass database decimals, `Date`, `BigInt`, or provider payloads to Client Components.

- [ ] **Step 3: Implement pure formatters**

Add UK date, time, currency, percentage, status-label, and evidence-count formatters. Set the locale explicitly to `en-GB` and timezone to `Europe/London` where calendar meaning matters.

- [ ] **Step 4: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/navigation.test.ts lib/growth/dashboard/formatters.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -- lib/growth/dashboard
git commit -m "feat: define Growth OS dashboard contracts"
```

### Task 2: Build The Founder Shell And Access Boundary

**Files:**

- Move: `app/(growth)/growth/login/` to `app/(growth)/(auth)/growth/login/`
- Create: `app/(growth)/(dashboard)/growth/layout.tsx`
- Create: `app/(growth)/(dashboard)/growth/loading.tsx`
- Create: `app/(growth)/(dashboard)/growth/error.tsx`
- Create: `components/growth/shell/growth-shell.tsx`
- Create: `components/growth/shell/top-navigation.tsx`
- Create: `components/growth/shell/side-navigation.tsx`
- Create: `components/growth/shell/mobile-navigation.tsx`
- Create: `components/growth/shell/integration-status-menu.tsx`
- Create: `components/growth/shell/growth-shell.test.tsx`
- Create: `lib/growth/dashboard/integration-health.ts`
- Create: `lib/growth/db/repositories/integration-connections.ts`

**Interfaces:**

- Consumes: founder session, active route, integration health summary
- Produces: protected responsive dashboard frame

- [ ] **Step 1: Write failing shell tests**

Assert the page has one skip link, labelled navigation, current-page state, visible founder identity, keyboard-operable mobile menu, sign-out action, and an accessible integration status summary.

- [ ] **Step 2: Protect the route group in the layout**

Keep the unchanged `/growth/login` URL in an unauthenticated sibling route group, then call `requireFounder()` in the dashboard server layout. Do not rely only on middleware or hidden navigation. Fetch a bounded integration summary and pass no secrets into the shell.

- [ ] **Step 3: Implement the desktop shell**

Match the horizontal and vertical navigation, white canvas, navy text, teal active state, and restrained border treatment from the approved dashboard mockup. Reuse the existing `Button`, `Card`, and layout primitives where their API fits.

- [ ] **Step 4: Implement the mobile shell**

Use a semantic dialog or disclosure for navigation, restore focus on close, lock background scroll, and keep the current section and primary action visible without horizontal overflow.

- [ ] **Step 5: Add loading and error boundaries**

Skeletons use fixed dimensions and respect reduced motion. The error view displays a safe message and correlation ID, never provider details or SQL errors.

- [ ] **Step 6: Run tests and type checking**

```bash
node --import tsx --test components/growth/shell/growth-shell.test.tsx
pnpm exec tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -- 'app/(growth)/(auth)/growth/login' 'app/(growth)/(dashboard)/growth' components/growth/shell lib/growth/dashboard/integration-health.ts lib/growth/db/repositories/integration-connections.ts
git commit -m "feat: add the founder dashboard shell"
```

### Task 3: Build The Overview Work Queue

**Reference mockups:**

- `docs/growth-os/mockups/01-growth-dashboard-desktop.png`
- `docs/growth-os/mockups/01-growth-dashboard-mobile.png`

**Files:**

- Create: `app/(growth)/(dashboard)/growth/page.tsx`
- Create: `lib/growth/dashboard/overview.ts`
- Create: `lib/growth/dashboard/overview.test.ts`
- Create: `components/growth/overview/overview-page.tsx`
- Create: `components/growth/overview/summary-strip.tsx`
- Create: `components/growth/overview/work-queue.tsx`
- Create: `components/growth/overview/pipeline-summary.tsx`
- Create: `components/growth/overview/upcoming-actions.tsx`
- Create: `components/growth/overview/sequence-health.tsx`
- Create: `components/growth/overview/overview-page.test.tsx`

**Interfaces:**

- Consumes: bounded overview aggregate query
- Produces: prioritised review queue, pipeline summary, upcoming actions, sequence health

- [ ] **Step 1: Write failing read-model tests**

Assert counts reconcile with the returned queue, first emails sort before follow-ups unless overdue, all money totals use integer pence, the next research run is London-time aware, and queries remain bounded.

- [ ] **Step 2: Implement one overview query service**

Run independent aggregates concurrently on the server. Return at most six work-queue rows and five upcoming actions. Avoid N+1 contact, business, source, or message queries.

- [ ] **Step 3: Write component tests**

Cover ready, empty, database error, disconnected Gmail, disabled automation, and mobile card rendering. Assert tables have captions or accessible names and that status is not communicated by colour alone.

- [ ] **Step 4: Implement the desktop composition**

Match the approved two-column layout, queue tabs, review actions, score display, pipeline totals, and sequence summary. Use real read-model fields, not placeholder numbers.

- [ ] **Step 5: Implement responsive priority**

On narrow screens show summary cards, primary review action, and queue cards first. Collapse secondary analytics below the action list. Preserve all actions without a horizontally scrolling desktop table.

- [ ] **Step 6: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/overview.test.ts components/growth/overview/overview-page.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add -- 'app/(growth)/(dashboard)/growth/page.tsx' lib/growth/dashboard/overview.ts lib/growth/dashboard/overview.test.ts components/growth/overview
git commit -m "feat: add the Growth OS overview queue"
```

### Task 4: Build Prospect List And Filtering

**Reference mockup:** `docs/growth-os/mockups/02-prospect-list-desktop.png`

**Files:**

- Create: `app/(growth)/(dashboard)/growth/prospects/page.tsx`
- Create: `lib/growth/dashboard/prospects.ts`
- Create: `lib/growth/dashboard/prospects.test.ts`
- Create: `components/growth/prospects/prospect-list.tsx`
- Create: `components/growth/prospects/prospect-filters.tsx`
- Create: `components/growth/prospects/prospect-row.tsx`
- Create: `components/growth/prospects/prospect-list.test.tsx`

**Interfaces:**

- Consumes: validated URL search parameters
- Produces: paginated prospect list and stable filter facets

- [ ] **Step 1: Write failing query tests**

Cover search, Kent town, service category, fit-score band, research state, outreach state, suppression state, stable sorting, cursor pagination, and invalid search parameters.

- [ ] **Step 2: Implement a Zod URL-query boundary**

Allow only known filter and sort values. Canonicalise invalid or duplicate parameters. Keep filters in the URL so views are shareable within the founder account and browser navigation behaves normally.

- [ ] **Step 3: Implement the bounded read model**

Join the current business, primary contact, prospect, latest research run, and latest sequence summary in one bounded query or a small fixed query set. Never return raw evidence content in the list.

- [ ] **Step 4: Implement accessible filtering and results**

Use labelled controls, an explicit Apply action when needed, visible active-filter chips, a Clear action, result count, empty state, and pagination. Announce result changes through normal navigation, not an intrusive live region.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/prospects.test.ts components/growth/prospects/prospect-list.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add -- 'app/(growth)/(dashboard)/growth/prospects/page.tsx' lib/growth/dashboard/prospects.ts lib/growth/dashboard/prospects.test.ts components/growth/prospects
git commit -m "feat: add searchable prospect review"
```

### Task 5: Build Prospect Detail And Research Evidence

**Reference mockup:** `docs/growth-os/mockups/03-prospect-detail-desktop.png`

**Files:**

- Create: `app/(growth)/(dashboard)/growth/prospects/[prospectId]/page.tsx`
- Create: `app/(growth)/(dashboard)/growth/prospects/[prospectId]/not-found.tsx`
- Create: `lib/growth/dashboard/prospect-detail.ts`
- Create: `lib/growth/dashboard/prospect-detail.test.ts`
- Create: `components/growth/prospects/prospect-detail.tsx`
- Create: `components/growth/prospects/evidence-list.tsx`
- Create: `components/growth/prospects/website-assessment.tsx`
- Create: `components/growth/prospects/prospect-actions.tsx`
- Create: `components/growth/prospects/prospect-actions.test.tsx`

**Interfaces:**

- Consumes: prospect ID and current record version
- Produces: reviewed evidence, contact decision, research and sequence actions

- [ ] **Step 1: Write failing detail-query tests**

Assert one prospect returns business data, corporate verification, contact provenance, fit rationale, website observations, cited sources, visual metadata, sequence state, and audit summary. Reject missing, malformed, or deleted IDs.

- [ ] **Step 2: Render evidence with provenance**

Each evidence item shows source title, publisher or domain, captured date, evidence type, and a safe external link. Do not render copied Google review, rating, photo, or listing text. Use Google Place ID and Maps reference URL only as discovery references.

- [ ] **Step 3: Implement founder actions as small forms**

Support request-research, reject, do-not-contact, started-talks, and pause. Every form submits current entity version, shows pending state, preserves keyboard focus, and gives clear conflict feedback when another action changed the row.

- [ ] **Step 4: Test sensitive-state rendering**

Suppressed, uncertain corporate status, missing contact evidence, stale research, failed visual validation, and disconnected Gmail must disable approval and explain why.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/prospect-detail.test.ts components/growth/prospects/prospect-actions.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add -- 'app/(growth)/(dashboard)/growth/prospects/[prospectId]' lib/growth/dashboard/prospect-detail.ts lib/growth/dashboard/prospect-detail.test.ts components/growth/prospects
git commit -m "feat: add prospect evidence review"
```

### Task 6: Build The First-Email Review And Approval Flow

**Reference mockups:**

- `docs/growth-os/mockups/04-first-email-review-desktop.png`
- `docs/growth-os/mockups/04-first-email-review-mobile.png`

**Files:**

- Create: `app/(growth)/(dashboard)/growth/outreach/messages/[messageId]/page.tsx`
- Create: `lib/growth/dashboard/message-review.ts`
- Create: `lib/growth/dashboard/message-review.test.ts`
- Create: `components/growth/outreach/message-review.tsx`
- Create: `components/growth/outreach/email-preview.tsx`
- Create: `components/growth/outreach/review-evidence.tsx`
- Create: `components/growth/outreach/message-actions.tsx`
- Create: `components/growth/outreach/message-actions.test.tsx`

**Interfaces:**

- Consumes: immutable first-email draft snapshot, citations, visual metadata, message version
- Produces: manual edit, approve-send, create-Gmail-draft, or needs-redraft action

- [ ] **Step 1: Write failing read-model and component tests**

Cover complete 140 to 220 word copy, subject, visible recipient and sender, plain-text preview, generated image and alt text, concept disclaimer, citation panel, legal basis, suppression state, and missing-asset failure.

- [ ] **Step 2: Implement a safe email preview**

Render the stored approved HTML in an isolated preview boundary or reconstruct it from the typed snapshot. Never pass unchecked HTML to `dangerouslySetInnerHTML`. Provide an explicit HTML/plain-text toggle.

- [ ] **Step 3: Implement the decision panel**

The founder can:

- manually edit the subject and structured copy, creating a new reviewed revision
- approve and queue the exact snapshot
- create a Gmail draft for a final mailbox review
- send back to the scheduled Codex task with a required redraft reason
- reject or suppress the prospect

Manual edits render through the safe server template and retain revision history. No inline AI rewrite or paid API call exists in the MVP.

- [ ] **Step 4: Add confirmation for sending**

The send action repeats recipient, subject, sequence timing, and visual presence. It requires the current version and uses a focused confirmation dialog. `edit-draft` creates a new version; `needs-redraft` does not mutate the reviewed version.

- [ ] **Step 5: Implement mobile priority**

On mobile place prospect identity, risk/status blockers, copy, image, and the decision bar in that order. Keep actions reachable without a fixed overlay obscuring content.

- [ ] **Step 6: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/message-review.test.ts components/growth/outreach/message-actions.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add -- 'app/(growth)/(dashboard)/growth/outreach/messages/[messageId]' lib/growth/dashboard/message-review.ts lib/growth/dashboard/message-review.test.ts components/growth/outreach
git commit -m "feat: add founder email approval"
```

### Task 7: Build Outreach Timeline And Sequence Controls

**Reference mockup:** `docs/growth-os/mockups/05-outreach-timeline-desktop.png`

**Files:**

- Create: `app/(growth)/(dashboard)/growth/outreach/page.tsx`
- Create: `app/(growth)/(dashboard)/growth/outreach/sequences/[sequenceId]/page.tsx`
- Create: `lib/growth/dashboard/outreach.ts`
- Create: `lib/growth/dashboard/outreach.test.ts`
- Create: `components/growth/outreach/outreach-list.tsx`
- Create: `components/growth/outreach/sequence-timeline.tsx`
- Create: `components/growth/outreach/sequence-controls.tsx`
- Create: `components/growth/outreach/sequence-controls.test.tsx`

**Interfaces:**

- Consumes: message events, Gmail thread metadata, sequence state
- Produces: chronological timeline and safe manual controls

- [ ] **Step 1: Write failing timeline tests**

Assert deterministic ordering for scheduled, sent, delivered metadata, reply, paused, stopped, and provider error events. Distinguish provider observation time from local receipt time.

- [ ] **Step 2: Implement list and detail read models**

Show current step, next action, last Gmail sync, reason for stop, and provider health without returning reply bodies. Link to Gmail through a safe constructed mailbox URL only when a thread ID exists.

- [ ] **Step 3: Implement controls**

Support pause, resume only from reversible states, started-talks, reject, and do-not-contact. Permanent stop states cannot expose a resume action.

- [ ] **Step 4: Test stale and race states**

Display a conflict when the reply synchroniser stops a sequence while the founder is viewing it. Refresh the server view after every mutation.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/outreach.test.ts components/growth/outreach/sequence-controls.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add -- 'app/(growth)/(dashboard)/growth/outreach' lib/growth/dashboard/outreach.ts lib/growth/dashboard/outreach.test.ts components/growth/outreach
git commit -m "feat: add outreach timeline controls"
```

### Task 8: Build Website Strategy And 3D Concept Views

**Reference mockups:**

- `docs/growth-os/mockups/06-website-strategy-desktop.png`
- `docs/growth-os/mockups/07-3d-hero-concept-desktop.png`

**Files:**

- Create: `app/(growth)/(dashboard)/growth/prospects/[prospectId]/website-strategy/page.tsx`
- Create: `app/(growth)/(dashboard)/growth/prospects/[prospectId]/visual/page.tsx`
- Create: `lib/growth/dashboard/website-strategy.ts`
- Create: `lib/growth/dashboard/website-strategy.test.ts`
- Create: `components/growth/strategy/strategy-review.tsx`
- Create: `components/growth/strategy/visual-concept.tsx`
- Create: `components/growth/strategy/strategy-review.test.tsx`

**Interfaces:**

- Consumes: website assessment, evidence, proposed scope, email asset
- Produces: founder-readable strategy and concept review

- [ ] **Step 1: Write failing content tests**

Assert every observation has evidence, every recommendation ties to an observed problem, commercial scope remains labelled as a proposal, and the generated visual includes alt text and a concept disclaimer.

- [ ] **Step 2: Implement strategy sections**

Render current-site observations, commercial impact, recommended first phase, potential later phase, proof sources, and assumptions. Do not present generated analysis as a verified client fact.

- [ ] **Step 3: Implement concept inspection**

Provide the full visual, dimensions, checksum, generated-at time, model-free provenance label, alt text, and validation status. Do not add image generation controls in the MVP.

- [ ] **Step 4: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/website-strategy.test.ts components/growth/strategy/strategy-review.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add -- 'app/(growth)/(dashboard)/growth/prospects/[prospectId]/website-strategy' 'app/(growth)/(dashboard)/growth/prospects/[prospectId]/visual' lib/growth/dashboard/website-strategy.ts lib/growth/dashboard/website-strategy.test.ts components/growth/strategy
git commit -m "feat: add website strategy review"
```

### Task 9: Build Newsletter And Site-Email Review Views

**Reference mockups:**

- `docs/growth-os/mockups/08-newsletter-review-desktop.png`
- `docs/growth-os/mockups/09-site-email-review-desktop.png`

**Files:**

- Create: `app/(growth)/(dashboard)/growth/newsletter/page.tsx`
- Create: `app/(growth)/(dashboard)/growth/newsletter/[issueId]/page.tsx`
- Create: `app/(growth)/(dashboard)/growth/settings/email-templates/page.tsx`
- Create: `lib/growth/dashboard/newsletter.ts`
- Create: `lib/growth/dashboard/newsletter.test.ts`
- Create: `components/growth/newsletter/issue-list.tsx`
- Create: `components/growth/newsletter/issue-review.tsx`
- Create: `components/growth/newsletter/site-email-review.tsx`
- Create: `components/growth/newsletter/newsletter-actions.tsx`
- Create: `components/growth/newsletter/newsletter-actions.test.tsx`

**Interfaces:**

- Consumes: versioned Resend render snapshots and subscriber counts
- Produces: test-send, approval, scheduling, and read-only template review actions

- [ ] **Step 1: Write failing view tests**

Cover full HTML and plain-text previews, subject, preheader, issue checksum, recipient eligibility counts, suppressed count, image alt text, unsubscribe marker, reply-to, previous founder test, schedule timezone, and immutable approved state.

- [ ] **Step 2: Implement newsletter review**

Show rendered content beside operational metadata. The founder can send a test, approve the exact checksum, schedule, or return the issue to draft before approval. Do not add a rich text editor or arbitrary HTML field.

- [ ] **Step 3: Implement site-email template review**

Display the complete thank-you and resource-delivery templates with representative safe fixture data. Template publishing requires a version increment and a successful HTML/plain-text validation result.

- [ ] **Step 4: Add schedule confirmation**

Repeat local and UTC send times, eligible recipient count, excluded count, issue checksum, and the fact that consent will be rechecked at dispatch.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/newsletter.test.ts components/growth/newsletter/newsletter-actions.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add -- 'app/(growth)/(dashboard)/growth/newsletter' 'app/(growth)/(dashboard)/growth/settings/email-templates' lib/growth/dashboard/newsletter.ts lib/growth/dashboard/newsletter.test.ts components/growth/newsletter
git commit -m "feat: add marketing email review views"
```

### Task 10: Build Settings And Integration Health

**Files:**

- Create: `app/(growth)/(dashboard)/growth/settings/page.tsx`
- Create: `lib/growth/dashboard/settings.ts`
- Create: `lib/growth/dashboard/settings.test.ts`
- Create: `components/growth/settings/integration-health.tsx`
- Create: `components/growth/settings/automation-controls.tsx`
- Create: `components/growth/settings/settings-page.test.tsx`

**Interfaces:**

- Consumes: redacted configuration and provider health
- Produces: founder-safe health view and pause controls

- [ ] **Step 1: Write failing redaction tests**

Assert no token, secret, connection string, raw provider error, or recipient data appears. Display only configured/not-configured, account identity, granted scopes, last success, last error category, and next scheduled operation.

- [ ] **Step 2: Implement integration health**

Show database, Gmail, Resend, Codex ingestion, and cron separately. Provide Gmail connect/disconnect actions from Plan 03 and guidance for externally configured Resend and Vercel settings.

- [ ] **Step 3: Implement automation pause**

The dashboard may pause database-controlled sequences and newsletters. It cannot mutate Vercel environment variables. Explain when an operator must also disable the Vercel flag.

- [ ] **Step 4: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/settings.test.ts components/growth/settings/settings-page.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add -- 'app/(growth)/(dashboard)/growth/settings' lib/growth/dashboard/settings.ts lib/growth/dashboard/settings.test.ts components/growth/settings
git commit -m "feat: add Growth OS integration settings"
```

### Task 11: Verify The Complete Founder Dashboard

**Files:**

- Create: `tests/integration/growth/dashboard-actions.test.ts`
- Create: `docs/runbooks/founder-dashboard.md`
- Update: `README.md`

- [ ] **Step 1: Add route and action integration tests**

Cover unauthenticated access, wrong-account access, founder access, stale record version, CSRF origin mismatch, redraft, approve, pause, suppress, newsletter test, and schedule using fake providers.

- [ ] **Step 2: Run a browser-free accessibility review**

Inspect rendered component trees and test:

- landmark and heading hierarchy
- form labels and descriptions
- button names and pending states
- table captions and card alternatives
- focus management contracts
- colour-independent status text
- reduced-motion support
- no horizontal overflow in the designed mobile component structure

Do not introduce Playwright, browser-control, or screenshot automation.

- [ ] **Step 3: Compare implementation against the mockup inventory**

Complete a manual checklist for every visible region and state in mockups 01 through 09. Record deliberate differences in `docs/runbooks/founder-dashboard.md`. Founder visual sign-off is required before release.

- [ ] **Step 4: Run the full project checks**

```bash
node --import tsx --test tests/integration/growth/dashboard-actions.test.ts
pnpm test
pnpm test:redesign
pnpm lint
pnpm build
```

- [ ] **Step 5: Inspect every changed file and the final diff**

Confirm pages are thin, components are focused, provider imports are absent, all states are rendered, client props contain no sensitive data, and no temporary copy or console logging remains.

- [ ] **Step 6: Commit**

```bash
git add -- tests/integration/growth/dashboard-actions.test.ts docs/runbooks/founder-dashboard.md README.md
git commit -m "docs: add founder dashboard operations"
```

## Plan 05 Exit Gate

- [ ] Founder authorization is enforced on every page and mutation.
- [ ] Overview, prospects, outreach, strategy, email review, newsletter, and settings match the approved information architecture.
- [ ] Desktop and mobile priorities follow the approved static mockups.
- [ ] Every operational state and conflict state is visible and actionable.
- [ ] No browser, provider, database, or secret boundary is crossed from Client Components.
- [ ] Founder completes manual visual sign-off.
- [ ] Full project checks pass before review.
