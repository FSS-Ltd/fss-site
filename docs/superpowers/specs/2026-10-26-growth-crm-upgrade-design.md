# Growth CRM and pipeline upgrade

Owner: Technical Agent

Status: Approved by founder on 2026-10-26

Created: 2026-10-26

## Intent and confirmed direction

Upgrade Growth into a usable daily lead and opportunity workspace. The founder confirmed that Growth's database remains authoritative and Twenty-style workflows should be adopted. Use the installed Twenty development references for record relationships, compact record views, clear field types, and narrow services. This is an existing Next.js application, not a Twenty SDK application. Keep its components, tokens, authentication, SQL access, and deployment model. Apply Design Craft to every changed interface.

## Current implementation

- `/growth/prospects` provides a paginated, fit-score-ordered list with search, sector, location, status, outreach, and suppression filters.
- Prospect detail contains evidence, contact information, website assessment, preview approval, status actions, and one dated next action.
- `/growth/pipeline` provides four open-stage columns with 20 records per stage and audited forward transitions. It lacks search, business filters, an alternate list, and editable opportunity properties.
- `/growth/deals` includes closed deals and detail with evidence, scope, correspondence metadata, commercial history, and a next-action editor.
- Businesses, contacts, prospects, and engagements already form the identity chain. Company-number and contact-email uniqueness and one-open-prospect constraints protect identity.
- Won/lost are terminal commercial states. Delivery is a separate lifecycle. Qualification and subsequent commercial moves stop automated outreach transactionally.
- Public enquiries are stored separately in `growth.inbound_leads`; they are not automatically qualified or enrolled in outreach.
- The current checkout is detached and has unrelated work, including unresolved index merges in dependency files. Implementation will use an isolated managed worktree from the inspected HEAD. Do not resolve or incorporate unrelated local work.

## Approaches

1. **Extend Growth with Twenty-style workflows, selected by the founder.** Reuse existing records and services. This keeps research, previews, outreach, and delivery connected, but requires native CRM UI and domain work.
2. Connect Growth to Twenty. This introduces another authoritative system, identity mapping, credentials, and synchronization. The founder chose to keep Growth instead.
3. Restyle the board alone. Smaller, but leaves lead capture, editable records, follow-up management, and daily operating views incomplete. Not proposed.

## Deliverable

### Leads and record management

- Keep existing prospect URLs. Present a compact CRM table with a clear create action, business/contact identity, qualification, offer, value, and next step.
- Add founder-only manual lead creation and editing through validated forms. Reuse an existing business by normalized company number and an existing compatible contact by normalized email. Report duplicates with a link; never silently overwrite another record.
- Preserve Kent and corporate eligibility rules. Require source evidence for verified business/contact fields. A manual record must not fabricate verification, newsletter consent, lawful basis, or outreach eligibility. Contacts are optional until evidence is available.
- Edit ordinary business/contact and prospect commercial fields through explicit commands with separate expected versions. Evidence-controlled identity, verification, and suppression fields remain under their existing verification flows.
- Allow another opportunity for a closed business without rewriting the closed prospect or engagement. Do not allow a second open prospect for the same business.
- Surface existing inbound enquiries for founder review and explicit conversion using the same identity checks. Retain the original enquiry and an idempotent link to the resulting prospect. Conversion does not subscribe, email, or qualify a lead automatically.

### Pipeline workspace

- Board and semantic table views share the same server-side filters: search, stage, sector, location, and next-action state. URL state survives navigation, pagination, and switching views.
- Provide named built-in views: all open opportunities, overdue follow-ups, and missing next steps. Allow the founder to save, rename, and remove private filter views. Store structured validated filters, never SQL or arbitrary URLs.
- Show per-stage counts and separate one-off and monthly forecast values. Show probability-weighted forecasts separately, with an explicit definition. Won/lost stay in Deals and never inflate open totals.
- Keep pagination bounded for every stage and list. Counts and forecasts use the same filters as the visible dataset, independently of cursors.
- Cards show business, offer, contact, next action, and due date. Stage actions reuse the existing transition service and confirmations. Drag and drop is not required; every move works through keyboard-accessible controls.
- Add opportunity editing for offer name, one-off/monthly value, probability, and expected close date. Closed opportunities retain agreed terms and cannot be edited through the open-opportunity command.

### Record workspace, tasks, and activity

- Give prospect and deal detail consistent overview, activity, and tasks sections, plus a compact properties area. Reuse evidence, correspondence links, and commercial history.
- Add plain-text notes and manual activity entries for calls and meetings. Link each to the existing prospect; render escaped text and never record email bodies or credentials.
- Add dated follow-up tasks with create, edit, complete, and reopen actions. The existing prospect next action remains the single primary next step; creating a task does not silently replace it. Provide an explicit action to make a task the next step, committed in one transaction.
- Use typed activity entries for notes, calls, meetings, task changes, and commercial stage changes. Preserve existing append-only audit and stage history. Paginate activity and tasks; do not fetch an unbounded lifetime history.
- Show overdue, upcoming, completed, and empty task states. No outbound reminders, calendar integration, or automatic email sends are added.

## Architecture and data

- Keep route components thin. Put validation and commands in focused `lib/growth/crm/` modules, SQL in repositories, and read models under `lib/growth/dashboard/`.
- Reuse founder session and same-origin mutation protection from current Growth HTTP handlers. Every write checks authority again, validates IDs and body limits, uses a transaction, compares expected versions, and appends a content-free audit event.
- Extend existing rows only where necessary. Add narrowly scoped tables for CRM activities, tasks, saved views, and enquiry conversion linkage. Use UUID foreign keys, UTC timestamps, versions, bounded text, useful indexes, and the repository's least-privilege role/RLS patterns.
- Prefer additive migrations generated through the existing migration workflow. Provide rollback instructions that preserve captured notes/tasks and converted enquiry links. Do not run migrations against Production without explicit approval.
- Keep one-off and monthly money as integer pence. Never present their sum as a recurring total, annual contract value, or recognised revenue. Aggregate definitions must state precisely what they contain.
- Identity creation is transactional and idempotent. Database uniqueness is the final concurrency guard. A duplicate request returns the existing result or a useful conflict; it never creates duplicate businesses or opportunities.
- No new dependency is currently justified. Reuse React, Zod, postgres.js, existing CSS modules/tokens, icons, and accessible interaction primitives.

## Updates and reconnect behavior

- No interval-based database or API polling. Successful commands refresh the relevant server-rendered data only after commit.
- Use committed database change notifications for the CRM surfaces if cross-session live updates are introduced. Notifications contain only a change topic and record identifier; they never grant access. The authenticated consumer rechecks founder authority before loading data.
- A subscription must reconcile authoritative reads at startup/reconnect, tolerate duplicates, release listeners on disconnect, and stop on session revocation. Stream lifetime and reconnect backoff must fit the existing Vercel runtime. If these constraints cannot be satisfied with existing infrastructure, retain explicit refresh/navigation reconciliation and document the limitation rather than adding a paid event service or disguised polling.
- Builder decision: use existing event infrastructure if present. Otherwise prefer command-triggered refresh and browser event notification between founder tabs for this release, with authoritative refresh on focus/reconnect. Do not claim externally triggered live delivery in that mode.

## UI direction

- Preserve Growth's shell, typography, brand colors, spacing, and light/dark behavior where supported.
- Prioritize work: view name and count, search/filter toolbar, board/list switch, then records. Use compact dividers and restrained stage accents rather than decorative dashboard cards.
- Keep record navigation separate from menus and form controls. Provide visible focus, labelled fields, semantic tables/lists, reachable actions, and text for due-state and stage meaning.
- Use existing inline forms or accessible dialogs for commands. Include pending/disabled, validation, success, stale-version recovery, failed-load/retry, and useful empty states.
- Narrow screens use stacked records and reachable filter/action controls. Verify long names, long emails, enlarged text, and overflow. Respect reduced motion; add no ambient animation.

## Boundaries and failure recovery

- This work does not replace authentication, research rules, outreach approval, suppression, newsletter consent, agreement/billing, or delivery state machines.
- No generalized object builder, arbitrary workflow engine, bulk messaging, CSV import/export, third-party CRM sync, or automatic contact enrichment.
- Stale writes return a conflict with a refresh path. Missing records return a scoped not-found response. Failed writes roll back record changes and history together.
- Inbound conversion retains provenance and does not treat an enquiry as verified evidence. Existing client/delivery records continue to use the shared business.
- Keep user-facing failures safe and attach correlation IDs. Avoid sensitive note/contact content in logs and notification payloads.

## Build order

1. Capture baseline checks and isolate work; define command/read contracts and additive migrations.
2. Implement and test record capture/editing and idempotent enquiry conversion.
3. Implement and test notes, tasks, activity, and private saved views.
4. Build filtered pipeline board/table and editable opportunity properties.
5. Apply shared record-workspace UI and complete loading, empty, error, mobile, and keyboard flows.
6. Verify integration, browser journeys, types, lint, formatting, build, migration policy, dependency security, and diff quality. Document rollout and rollback. Preserve work in a commit; deployment requires separate founder approval.

## Acceptance checks

- Create a lead, detect duplicates, edit it with version protection, qualify it, manage a deal, and reach won without duplicate identities.
- Convert one inbound enquiry twice and obtain one linked prospect without triggering email or consent changes.
- Filters, private saved views, pagination, and board/table switching describe the same records and reconcile counts/values.
- One-off/monthly and weighted forecasts reconcile; won/lost are excluded from open totals.
- Create a note/call/meeting and task; complete/reopen a task; explicitly promote a task to next step; verify chronological history and stale-write protection.
- Existing qualification, stage history, suppression, approval, delivery, and thank-you gates still pass their tests.
- Unauthorized and cross-record writes fail; invalid inputs never reach unsafe SQL; history remains auditable.
- Inspect the actual UI on desktop and mobile, keyboard navigation, pending/error/empty states, and enlarged text. Use synthetic fixtures rather than exposing real contacts in screenshots.
- Verify no idle polling, post-commit refresh, duplicate-event handling, focus/reconnect reconciliation, and listener cleanup for the selected update mechanism.
- Run relevant unit/integration/browser tests, typecheck, lint, formatting, build, migration checks, and security checks. Record exact environmental limitations instead of claiming unrun checks passed.

## Approval required

Founder approved this design and instructed implementation on 2026-10-26. Builder decisions remain implementation choices within this scope.
