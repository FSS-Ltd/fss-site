# FSS Studio Experience: product and delivery specification

**15 September 2026 · Proposed implementation brief**

## 1. Executive summary

FSS needs a client workspace that answers four questions immediately: **What are we building? Where are we now? What needs me? What happens next?** The founder workspace must make the matching operational work equally clear.

The current local repository contains meaningful domain logic, but several interfaces expose technical record structures or prerequisites without guiding the user. This work specifies a complete experience over those foundations. It is a design and build handoff, not a claim that the live defects have been repaired.

### Evidence from the repository

Source inspected: FSS-Ltd/fss-site, local HEAD `65a49852` (not verified against the latest remote HEAD).

| Finding | Evidence | Required improvement |
|---|---|---|
| Portal home is primarily an organisation/access directory | `app/(portal)/portal/page.tsx` | Route single-membership users into a useful dashboard; retain a separate workspace switcher. |
| Portal shell is header/main/footer with no persistent workspace navigation | `app/(portal)/portal/layout.tsx` | Add a responsive client shell with navigation, organisation context, notifications and account menu. |
| New request is styled as a breadcrumb | `app/(portal)/portal/requests/page.tsx` | Use a prominent, correctly wired action with loading and failure behaviour. |
| Board defaults to list and renders columns without drag handlers | `components/portal/requests/board.tsx` | Desktop board default; role-aware drag and Move to menu; mobile list. |
| New request route and form exist | `app/(portal)/portal/requests/new/page.tsx`, `request-form.tsx` | Reproduce the reported no-op in authenticated staging. An empty project list currently produces only an explanatory paragraph. Do not assume the route is missing. |
| Agreement picker receives only linked engagement IDs | `lib/operations/agreements/repository.ts`, `agreement-form.tsx` | Named engagement summaries, explicit empty/loading/error states, link/create and return-to-draft flow. An empty live list's cause still needs a data/access check. |
| User must type a document hash and private reference | `agreement-form.tsx` | Generate or select a retained document; calculate its fingerprint on the server. |
| Welcome UI and durable worker already exist | `components/operations/onboarding/*`, `lib/operations/onboarding/*` | Guided setup, saved drafts, prerequisite resolution, exact previews, clear activation and recovery. |
| Existing request rules distinguish exact-version acceptance from administrative closure | `docs/operations/requests.md` | Preserve this distinction throughout cards, history, notifications and metrics. |

### Success criteria

1. An authorised client creates a request or bug report, receives a reference, and sees it in the board after refresh.
2. FSS can progress permitted work with drag or keyboard/menu controls. Failed moves restore the original state.
3. Publishing a review creates an in-app notification and an email for the designated reviewer. Acceptance or recorded completion creates the appropriate completion notification.
4. A founder can create an agreement from a client record without looking up a UUID, calculating a hash, or typing a storage path.
5. A founder can create, preview, activate, pause, resume and recover a welcome journey through the UI.
6. Every shipped route and action matches a named wireframe and acceptance contract, including empty, error, pending and restricted-access states.

### Scope and assumptions

UK B2B studio; initially one founder delivery owner; clients can have several projects and memberships. Retain existing FSS branding and commercial rules. Scope covers the client portal and founder operations related to delivery, agreements, welcome journeys, billing and access. Growth prospecting, marketing campaign creation and public marketing pages retain their existing workflows.

## 2. Stack recommendation and rationale

**Default: evolve the existing application.** Next.js App Router, React and strict TypeScript; existing CSS modules and Tailwind tokens; Zod boundary validation; existing Postgres SQL repositories and restricted database roles; Clerk portal identity; existing founder auth; Resend email; Stripe billing; current in-house signing and durable job patterns.

The repository already has these services. Replacing them with NestJS, Prisma or a new auth provider would add migration work without solving the reported user journeys.

| Option | Use when | Trade-off |
|---|---|---|
| Existing Next.js + domain services | Recommended for this redesign | Fastest route; requires disciplined server/client boundaries and focused components. |
| Dedicated Node worker beside Next.js | Job volume or runtime limits justify it | Better isolation for delivery workers; extra deployment and monitoring. |
| NestJS API + separate frontend | Multiple clients, teams or independently deployed integrations make the boundary valuable | Strong service boundary but premature for this UI completion phase. |

A drag library may be justified for reliable keyboard and pointer behaviour. Select one only after reviewing the installed ecosystem and current documentation. Do not add a large UI kit to reproduce a handful of controls.

## 3. System architecture

```text
Client browser                       Founder browser
  │ Clerk + verified membership        │ Existing founder session
  ▼                                    ▼
Portal routes / public projections   Operations routes / founder projections
  └───────────────┬────────────────────┘
                  ▼
        Validated domain commands
     membership + role + organisation
     expected version + transition rules
                  │
                  ▼
       Postgres transaction boundary
    record + revision + audit + outbox
                  │
         ┌────────┴─────────┐
         ▼                  ▼
   Portal notification   Durable worker
      read model            │
                       Resend / Stripe /
                       signing / private files
                            │
                  Verified webhook → reconcile
```

Trust zones: browser input is untrusted; server identity must be independently verified; portal projections contain only authorised public data; external provider events require signature verification and deduplication; restricted database roles remain authoritative. Never let a client supply arbitrary email recipients, storage keys, organisation privileges or a trusted document hash.

## 4. Cloud and infrastructure plan

Keep existing hosting and accounts. Confirm production and preview regions before implementation. Prefer London application execution and UK/EU primary data placement, co-located where supported. Vercel documents London as `lhr1`; selecting it does not establish UK-only processing across authentication, email, telemetry and backups. [Vercel regions](https://vercel.com/docs/regions).

- Environments: local synthetic fixtures, isolated staging with provider test accounts, production.
- Database: reuse managed Postgres; additive migrations staged through existing operations release gates.
- Jobs: durable database-backed queue with leases, attempts, due times and idempotency; existing cron entry points.
- Files: private storage with short-lived authorised downloads. Production upload UI depends on the scanner/quarantine capability being live.
- Secrets: platform secret store, separate environments and service credentials; never frontend configuration or preview artifacts.
- IaC: preserve the current configuration approach. Document region and retention explicitly; add Terraform only where ownership and existing setup warrant it.

**Planning allowances, not vendor quotations:** roughly £75–£200/month total lean hosting/data/email/monitoring at low volume, rising to £200–£600/month for early scale, better backups and heavier jobs. Existing shared subscriptions may reduce incremental cost. These are budget envelopes to validate against actual accounts, seats, usage, taxes and retention requirements; exclude payment fees, engineering and third-party client services.

Proposed recovery targets: RPO ≤24 hours with daily backups for MVP; RTO ≤8 business hours from a verified restore. Early-scale target: RPO ≤1 hour and RTO ≤4 hours where the selected paid backup setup supports it. Do not advertise these until restoration is tested.

## 5. Security and compliance engineering

- Check verified identity, active membership, role, organisation and resource ownership for every read and command. Client-supplied organisation IDs select context; they do not establish authority.
- Preserve founder/client session separation. Do not implement founder access as a client-side toggle.
- Preserve existing owner, contributor, viewer and billing-contact capabilities. Reviewer designation and signing authority remain separate grants.
- Use encrypted transport, provider encryption at rest, scoped secrets, short-lived file links and least-privilege database roles.
- Validate payloads with Zod, bounded lengths, safe content rendering, rate limits and existing cross-origin/CSRF protections.
- Public comments, internal notes, provider errors and commercial estimates need separate DTOs. Hiding a field in CSS is not isolation.
- Compute SHA-256 over the exact retained file bytes; retain size, media type, storage version and revision binding. This supports document integrity but does not independently prove legal validity.
- Log actor, organisation, resource, command, version, timestamp, correlation ID and result without logging message bodies, tokens or payment details.
- Classify personal data and document processing purposes, retention, subprocessors and deletion/export procedures. Apply the organisation's reviewed GDPR/UK DPA policy; obtain appropriate review of contractual and retention decisions.
- Account/profile data, operational notifications, marketing choices and signed evidence need separate retention rules. Proposed UI notification retention: 90 days; final policy must align with operational needs. Signed commercial evidence follows the existing approved policy and legal holds.
- Maintain a technical control checklist against relevant OWASP ASVS controls: session handling, access control, input validation, safe file processing and audit protection.

## 6. Data model and storage

Extend existing tables, not a parallel second operations schema. The following is a logical target; confirm existing column names before migration.

| Entity | Required relationships and fields | Index/invariant |
|---|---|---|
| Organisation / membership / contact | Existing identities, roles, status and approved contacts | Organisation + user uniqueness; revoked access checked at request time |
| Engagement link | Organisation + reviewed growth engagement, display name and review metadata projection | Unique authorised relationship; paginate search |
| Project / milestone | Organisation, agreement context, title, outcome, public/internal visibility, order, target | Organisation + project; public milestone queries scoped |
| Request | Project, organisation, type, title, description, desired outcome, state, owner, next action, scope, version | Organisation + state + updated_at; cursor index |
| Request blocker | Preserves base state; reason, owner, blocked_since, next_check_at | One active blocker per request |
| Deliverable version / review cycle | Immutable document/version reference, reviewer, public summary and instructions | Request + cycle + deliverable version; acceptance unique for current cycle |
| Agreement draft workspace | Partial wizard payload, last step, owner, version, completion status | Separate from a fully validated agreement revision |
| Agreement revision / evidence | Existing immutable snapshot, retained source bytes and server-generated fingerprint | Agreement + revision uniqueness; signed revisions immutable |
| Journey draft / template version | Selected client, agreement, tasks, content and reviewed dependencies | Draft can be incomplete; published templates immutable |
| Journey approval / step / attempt | Existing snapshots, generation, lease, idempotency and provider references | Job uniqueness per approved effect; due-state lease index |
| Client setup task | Journey/project, task kind, owner role, required flag, dependencies, status, completed_by | Server derives evidence-backed completion; reorder cannot bypass dependencies |
| Notification / delivery | Event, recipient, channel, status, read_at, idempotency key, attempts and provider outcome | Event + recipient + channel uniqueness |
| Notification preference | User + organisation + event group; channel settings and digest mode | Preference changes auditable; no marketing consent inference |

Illustrative notification constraint:

```sql
-- Adapt to existing operations relations; this is not a runnable migration.
UNIQUE (event_id, recipient_user_id, channel)
-- Cursor queries use an organisation-scoped compound index.
CREATE INDEX ... ON ... (organisation_id, recipient_user_id, created_at DESC, id DESC);
```

Keep money as integer pence with GBP currency; never binary floating-point for totals. Persist UTC instants plus the IANA timezone and local scheduling policy. Do not store HTML as an unrestricted executable template.

## 7. API design

Preserve current command routes:

- `POST /api/portal/requests`: create request or bug with idempotency key.
- `POST /api/portal/requests/:requestId/actions`: public comments and authorised review actions.
- `POST /api/growth/operations/clients/:organisationId/requests/:requestId`: founder transitions and assessments.
- Existing agreement, signing, journey, portal-access and billing routes remain the mutation boundary.

Add focused endpoints only where absent:

| Proposed endpoint | Purpose |
|---|---|
| `GET /api/portal/dashboard` | Role-filtered next actions, project summary, real counts and activity |
| `GET /api/portal/requests?cursor=&status=&type=&project=&q=` | Server search/filter/pagination across the entire authorised collection |
| `GET /api/portal/notifications?cursor=&unread=` | Durable in-app inbox |
| `PATCH /api/portal/notifications/:id` | Mark owned notification read/unread |
| `PATCH /api/portal/preferences` | Update notification preferences |
| `GET /api/growth/operations/clients/:org/engagement-options` | Named eligible engagements plus prerequisite status |
| `POST /api/growth/operations/clients/:org/engagement-links` | Validated founder link and return-to-draft |
| `POST/PATCH .../agreement-drafts/:draft` | Save partial wizard state without weakening final revision validation |
| `POST .../agreement-drafts/:draft/prepare-document` | Render/retain exact bytes and server-side integrity metadata |
| `POST/PATCH .../journey-drafts/:draft` | Save incomplete setup and ordered client tasks |
| `POST .../journey-drafts/:draft/preflight` | Return exact approval snapshot and actionable readiness failures |

Illustrative response contract:

```ts
type CommandResult<T> =
  | { ok: true; data: T; correlationId: string }
  | { ok: false; error: {
      code: "VALIDATION" | "FORBIDDEN" | "CONFLICT" | "PRECONDITION" |
        "RATE_LIMITED" | "UNAVAILABLE";
      message: string;
      fieldErrors?: Record<string, string>;
      currentVersion?: number;
    }; correlationId: string };
```

Use 201 for creation, 400/422 for invalid input consistent with current API conventions, 401 for expired sessions, 403/404 according to existing disclosure policy, 409 for stale versions, 429 for throttling and 503 for unavailable dependencies. A 200 response with a false success label is prohibited. Never expose SQL errors or provider secrets.

## 8. Frontend plan

- Shared client and founder shells using existing tokens plus the approved FSS experience tokens.
- Routes own data loading and permission gates; focused components own presentation; domain hooks coordinate commands.
- URL-backed filters and selected organisation. Cursor pagination replaces the first-100-only search.
- Desktop ≥1280 px: full board with horizontal scrolling where needed; tablet 768–1279: compact navigation and list option; mobile <768: list default and one-column forms.
- Six visible board columns: Inbox, Planned, In progress, Ready for review, Changes requested, Done. Inbox groups New and Acknowledged but cards retain their exact substatus. Cancelled is in an archive/filter.
- Use semantic buttons for actions and anchors styled as buttons for navigation. Labels remain visible. Icon-only controls require accessible names and tooltips.
- Form drafts survive failed commands and prerequisite detours. Server-side wizard drafts survive refresh; avoid storing confidential content in persistent browser storage.
- Optimistic movement is allowed only with rollback and server validation. Acceptance/signing and sends show pending until acknowledged.
- No route should require the user to infer why its primary action is disabled. Show the reason and resolution action beside it.

## 9. Backend plan

Keep current `lib/operations` domains. Extend request projections, notifications, draft workspaces, engagement choices and checklist tasks. Reuse signing evidence, billing obligation, onboarding approval and job recovery logic.

Notification flow: one domain event → authorised recipients → one in-app record and one email-delivery record per recipient → independent retries. Permanent application deduplication is necessary: Resend's provider idempotency retention is 24 hours. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

Set a delivery target: in-app record visible after the transaction and refreshed within 30 seconds in another open client tab; email worker attempts dispatch within five minutes under healthy conditions. These are operational targets, not guaranteed inbox delivery. Mark accepted, delivered, bounced and unknown separately.

## 10. Project folder structure, explained

Preserve this repository's existing structure rather than introducing a monorepo migration:

```text
app/(portal)/portal/                  Client pages, loading and route-level error states
app/(growth)/(dashboard)/growth/operations/
                                     Founder pages and role-gated navigation
app/api/portal/                       Thin client command/query routes
app/api/growth/operations/            Thin founder command/query routes
components/portal/shell/              Client navigation and workspace switcher
components/portal/dashboard/          Next-action, project and activity sections
components/portal/requests/           Board, list, card, form and versioned review
components/operations/agreements/     Guided agreement editor and readiness views
components/operations/onboarding/     Journey builder, previews, timeline and recovery
components/operations/shared/         Shared fields, buttons, notices and action bars
lib/operations/requests/              Transitions, scope, reviews and projections
lib/operations/agreements/            Drafts, revisions, documents and signing
lib/operations/onboarding/            Templates, approvals, steps and durable effects
lib/operations/notifications/         Event-to-recipient policy, inbox and delivery
lib/operations/documents/             Private storage, scan status and access
supabase/operations/migrations/       Reviewed additive database migrations
tests/integration/operations/         Real restricted-role database scenarios
docs/operations/                      Operational policies and runbooks
```

New folders above are proposals, not a statement that they already exist. Avoid one `PortalDashboard.tsx` containing every screen or a single service that owns signing, billing and notifications.

## 11. DevEx and CI/CD

Use existing pnpm commands and current Next.js documentation from the installed version. Short-lived feature branches; small PRs per vertical workflow; synthetic preview data; isolated provider test credentials. Preserve existing staged migration and production enablement gates.

CI: formatting → typecheck → lint → domain unit tests → real database integration → production build → authenticated browser smoke tests. Attach desktop/mobile screenshots for changed states and link each to its screen ID. Release behind role-specific experience flags where practical. Roll back UI independently; do not downgrade immutable signed records or delete delivered events.

## 12. Testing strategy

Critical paths first:

1. Sign in → choose authorised organisation → dashboard → new request → persisted card.
2. Bug-specific fields appear and validate; failure retains values; duplicate submit yields one request.
3. Keyboard/pointer transition → gate validation → saved status → refreshed second session.
4. Review v3 → in-app + email → client acceptance; stale v2 is rejected without recording acceptance.
5. Empty engagement → create/link → resume draft → named option → generate document → approve signing.
6. Editing approved terms invalidates stale approval; no old document can be signed as the current revision.
7. Welcome draft → exact preview → activate → delay → signatures → invoice/access/thank-you once.
8. Worker timeout, provider acceptance with DB failure, stale lease, pause race, bounce and unknown outcome.
9. Client A cannot read Client B through routes, APIs, files, notifications, search or guessed IDs.
10. Billing-only, viewer, contributor, owner and designated reviewer scenarios match capability rules.
11. Keyboard-only, VoiceOver, 200% zoom, narrow viewport, reduced motion and contrast checks.

Relevant existing commands for implementation: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration:operations`, `pnpm build`. Add browser tests using the repository-approved setup; hosted auth-to-completion tests must run in staging. Mocked component tests alone are insufficient.

## 13. Observability and SRE-lite

Monitor: request create failures; transition conflicts; review age; empty engagement-choice reasons; agreement preflight failures; journey step lateness; email delivery/bounce rates; unknown outcomes; invitation claim failures; upload quarantine age.

Health views separate configuration missing, provider unavailable, authentication rejected and worker delayed. Safe correlation IDs link UI errors to internal logs.

Top three runbooks:

1. **Email outcome unknown:** hold downstream effect; reconcile saved provider reference; record evidence; retry only confirmed failure.
2. **Cannot access portal:** check identity, invitation expiry, verified email, organisation membership, role and environment; repair the specific record through approved controls.
3. **Signing complete but welcome stuck:** confirm revision/evidence and due time; inspect individual invoice/access/email steps; resume only unmet effects.

Perform a restore drill before launch and quarterly thereafter. Exercise recovery with synthetic jobs and no live recipients.

## 14. Milestones and step-by-step delivery

| Milestone | Work | Acceptance |
|---|---|---|
| M1: Foundation and access | Shared controls, shells, route guards, workspace selection, actionable empty states | Every route navigable for the right role; visible focus and real button states; no bare organisation directory as the dashboard |
| M2: Request vertical slice | Creation, bug forms, board/list, drag/menu transitions, details, scope and review | A real staging client creates work; founder advances it; client reviews exact version; notifications reach both channels once |
| M3: Agreements | Draft workspace, engagement recovery, scope/fees/people steps, retained documents and approval | No manual hash/path entry; empty relationship repaired in UI; revision changes invalidate approval |
| M4: Complete welcome | Templates, guided setup, ordered checklist, preview, preflight, activation, monitoring and recovery | Full synthetic lifecycle runs with durable timing; pause/retry cannot duplicate invoices, invitations or emails |
| M5: Supporting workspace | Documents, project editor, billing, notification inbox/preferences, help, services and access | Every displayed action has a working destination or command and appropriate failure path |
| M6: Release readiness | Cross-tenant testing, provider sandbox, accessibility, visual comparison, restore drill, rollout/rollback | All critical paths pass in staging; founder approves concrete release evidence under existing release rules |

Suggested planning allowance: 4–6 weeks for one engineer with prompt founder decisions and working environments; treat this as an estimate to refine after staging reproduction and schema review. Prioritise complete M2 and M3 workflows before widening M5.

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Cosmetic redesign hides missing effects | Each primary action requires a command contract and end-to-end acceptance test |
| Over-generalised drag bypasses scope or review authority | Server transition policy; drop opens required-input sheet; client limited to permitted review actions |
| Empty engagement list gets “fixed” with arbitrary ID entry | Trace organisation link and auth; named selection with create/link recovery |
| UI changes weaken document evidence | Server-computed fingerprint tied to retained bytes and immutable revision |
| Email retry duplicates sends or bills | Permanent effect ledger, provider keys, reconciliation and separate channel outcomes |
| Welcome settings contradict existing timing | Preserve +2 elapsed hours and next-calendar-day 09:00 London until policy explicitly changes |
| UI promises uploads before scanner is live | Capability-aware explanatory state and agreed secure alternative |
| Long lists hide important work | Server pagination, filtering and search; overdue/action-needed ordering |
| “Premium” becomes low contrast or decorative noise | Solid reading surfaces, restrained accent, clear typography and tested focus/contrast |

## 16. Post-MVP roadmap

Near-term: digest controls, richer milestone updates, structured feedback annotations, client approval reminders, signed change orders, accessible document export and scoped search.

Scale: multiple delivery owners with explicit assignment permissions, capacity views, worker isolation if needed, enhanced backups, retention automation and client audit exports.

Commercial: carefully approved service catalogue, renewal reminders and usage against contracted allowances. Enquiries must remain distinct from activating subscriptions.

No new AI assistant, chat platform, gamification, arbitrary workflow builder or native mobile app is required to complete this scope.
