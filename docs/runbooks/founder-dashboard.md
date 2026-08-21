# Founder dashboard runbook

Operating notes and the Plan 05 verification record for the FSS Growth OS
founder dashboard (`/growth/*`). This is the founder's own reference, not
end-user documentation — there are no end users other than the founder.

## What this system does and does not do

The dashboard is a founder-only internal tool. Every page and mutation
requires a signed-in session whose email matches
`GROWTH_OS_OWNER_EMAIL` (`requireFounder()`,
`lib/growth/auth/require-founder.ts`) — there is no multi-user, multi-role,
or client-facing surface anywhere under `/growth`. Server Components call
read-model services in `lib/growth/dashboard/*.ts`; they never call a
provider SDK or write raw SQL themselves. Client Components receive only
the redacted view models those read models return — never a provider
token, a raw source payload, or a private note.

| Area | Route | Read model | Mutations |
| --- | --- | --- | --- |
| Overview | `/growth` | `lib/growth/dashboard/overview.ts` | none (read-only queue) |
| Prospects | `/growth/prospects` | `lib/growth/dashboard/prospects.ts` | none (filters only) |
| Prospect detail | `/growth/prospects/[id]` | `lib/growth/dashboard/prospect-detail.ts` | reject, do-not-contact, started-talks, request-research (`lib/growth/prospects/`), pause (`lib/growth/sequences/stop.ts`) |
| Message review | `/growth/outreach/messages/[id]` | `lib/growth/dashboard/message-review.ts` | edit-draft, needs-redraft, create-gmail-draft, approve-send (`lib/growth/sequences/`) |
| Outreach list/detail | `/growth/outreach`, `/growth/outreach/sequences/[id]` | `lib/growth/dashboard/outreach.ts` | pause, resume, started-talks, reject, do-not-contact (`lib/growth/sequences/stop.ts`, `resume.ts`) |
| Website strategy / 3D hero | `/growth/prospects/[id]/website-strategy`, `/visual` | `lib/growth/dashboard/website-strategy.ts` | none (read-only) |
| Newsletter | `/growth/newsletter`, `/growth/newsletter/[id]` | `lib/growth/dashboard/newsletter.ts` | send-test, approve-schedule (`lib/growth/newsletter/issues.ts`) |
| Site-email templates | `/growth/settings/email-templates` | `lib/growth/dashboard/newsletter.ts` | none (read-only, per Task 9's own interface contract) |
| Settings | `/growth/settings` | `lib/growth/dashboard/settings.ts` | Gmail connect/disconnect (Plan 03 routes), pause-all-active-sequences (`lib/growth/settings/pause-automations.ts`) |

Every mutation validates its request origin, requires a fresh
`requireFounder()` call, validates its body with Zod, uses optimistic
concurrency (an explicit `version` column, or row-locked idempotent status
transitions), and appends a `growth.audit_log` row. None of that is
optional per-route — it is the same shape everywhere, following the
pattern in `lib/growth/sequences/stop.ts` and
`lib/growth/sequences/message-action-route.ts`.

## Operating the dashboard

### Gmail connect / disconnect

`/growth/settings` shows the founder's Gmail connection: account identity,
granted OAuth scopes, last successful sync, and the last error *category*
(never a raw provider error). Connect redirects through Google's OAuth
consent screen (`/api/integrations/gmail/connect`, a plain link — no
client JS). Disconnect (`/api/integrations/gmail/disconnect`, a plain HTML
form POST) revokes the token, clears the stored credential, and pauses
every active sequence that was mid-send over Gmail.

### Resend and Vercel Blob

Resend (newsletter and site-email sending) and Vercel Blob (generated
visual storage) are both configured entirely outside this codebase, via
Vercel project environment variables (`RESEND_API_KEY`,
`RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`,
`NEWSLETTER_UNSUBSCRIBE_TOKEN_SECRET`, and Vercel's own
`BLOB_READ_WRITE_TOKEN` when Blob storage is attached to the project). The
dashboard can only report configured/not-configured for these — see
`docs/runbooks/resend-marketing.md` for full Resend setup steps.

### Pausing automation

`/growth/settings` → **Pause all active sequences** pauses every
currently active outreach sequence in the database — the same effect as
pausing one sequence from Outreach, applied to all of them at once
(`lib/growth/settings/pause-automations.ts`, calling the existing
`stopSequence(reason: "pause")` once per active enrollment). It cannot
disable the three scheduled cron jobs (`gmail-sync` every 10 minutes,
`outreach-dispatch` and `resend-dispatch` every 5 minutes — see
`vercel.json`); those are gated on the `GROWTH_OS_AUTOMATIONS_ENABLED`
Vercel environment variable. **To fully stop new automated work, an
operator must also disable that flag in the Vercel project settings** —
the dashboard has no code path that can reach it.

## Mockup comparison (Plan 05 Task 11, Step 3)

Reviewed against every file in `docs/growth-os/mockups/` (01 through 09).
"Deliberate" differences were called out and reasoned through in the PR
that shipped that screen; a few further small gaps surfaced during this
final pass are called out separately below each table as **found in
review** — real, but small, and left for founder triage rather than
fixed unilaterally at this stage.

### 01 — Growth dashboard (Overview)

| Region | Status | Note |
| --- | --- | --- |
| Header greeting, work-queue tabs, review link | Matches | |
| Work queue table (First emails / Replies / Follow-ups) | Matches | |
| Pipeline overview stage totals | Matches | |
| Upcoming actions list | Matches | |
| Sequence health stats | Matches | |
| Revenue (this month) chart | **Omitted** | No revenue/billing data model exists anywhere in this schema; showing one would be fabricated. |
| Delivery/open/reply/meeting-rate percentages | **Partially omitted** | Delivery rate is real; open/reply/meeting rates would require tracking-pixel or reply-classification data this project deliberately does not collect (see message review, below). |

### 02 — Prospect list

| Region | Status | Note |
| --- | --- | --- |
| Search, sector/location/fit/status filters | Matches | Filters are a plain GET form; sector/town options are real queried facets. |
| Results table + mobile card fallback | Matches | |
| Top stat strip (Total / Ready for review / In sequence / Potential value) | **Omitted** | Not part of this task's read-model; would be a placeholder if added without new aggregate queries. |
| "Add prospect" button | **Omitted** | Prospect creation isn't in this plan's scope — prospects arrive via research ingestion, not manual entry. |
| Numbered pagination (1 2 3 4 5 … 22) | **Different** | Cursor/keyset pagination (Next/Back) per the plan's explicit requirement, not OFFSET-based numbered pages. |

### 03 — Prospect detail

| Region | Status | Note |
| --- | --- | --- |
| Header (score ring, sector/locality, verified badge, fit score) | Matches | |
| Why this prospect fits | **Found in review** | Mockup shows a 4-item checked list; the implementation renders one plain paragraph (`opportunitySummary`). Same information, different presentation — worth a quick founder check on whether the checklist format is worth adding. |
| Recommended offer | Matches | |
| Research evidence | Matches | |
| Website assessment summary | Matches | |
| Contact card | **Different** | No phone number — `growth.contacts` has no phone column in the schema. Email only. |
| Next action / potential value / corporate verification | Matches | |
| Tab bar (Research/Outreach/Website Brief/3D Hero/AI Opportunities/Activity) | **Omitted** | No task in this plan added a persistent tab bar; these pages are reached via breadcrumb and cross-links (see prospect list → website strategy → 3D hero). |
| Agent notes panel (Research complete / Website strategy ready / 3D hero suitable / last agent run) | **Found in review, omitted** | No backing read for this exists in `prospect-detail.ts`; nothing here is fabricated, but it also isn't surfaced. |

### 04 — First-email review

| Region | Status | Note |
| --- | --- | --- |
| Email draft envelope, visual, body, word count | Matches | |
| "1 of 6" prev/next navigation between pending drafts | **Found in review, omitted** | The review page shows one draft at a time with no queue navigation control; the founder returns to the Outreach work queue between reviews instead. |
| Research used + "verify every claim" warning | Matches | |
| Offer and fit | Matches | |
| Sequence preview (Day 1/5/11/20) | Matches | |
| Visual checks (alt text, size, no fabricated claims) | Matches | |
| Draft status | Matches | |
| Action bar (Edit draft, Mark needs redraft, Create Gmail draft, Approve & send) | Matches, plus more | Also exposes Reject and Do-not-contact, which the mockup doesn't show here — consistent with Task 5's prospect-level actions being available wherever a founder is reviewing a prospect. |

### 05 — Outreach timeline

| Region | Status | Note |
| --- | --- | --- |
| Sequence activity timeline | Matches | |
| Sequence rules box | Matches | |
| Conversation controls (Pause/Resume, Started talks, Reject, Do not contact) | Matches | Styled as a plain button group rather than the mockup's colour-coded pill buttons. |
| Thread health | **Partially omitted** | Delivered, Replied, and Last Gmail sync are real; "Opened N times" is omitted — no open-tracking pixel exists anywhere in this codebase (deliberately, per the no-tracking-pixel policy in message review). |
| Contact and offer | Matches | |
| Next action card with automatic/manual toggle | **Found in review, omitted** | No per-step automatic/manual override exists; every step in an active sequence dispatches automatically, gated only by the sequence's own status and the safety checks already covered elsewhere. |
| Audit panel (Approved by / Gmail message ID stored / consent basis) | **Found in review, omitted** | The underlying `growth.audit_log` rows exist and are queried for the timeline; a dedicated summary card was not built. |

### 06 — Website strategy

Documented in full in PR #98: no persistent tab bar, no "Success measures"
stat row (no backing field), 8 of 11 assessment sections shown here (the
remaining 3 belong to the 3D hero page).

### 07 — 3D hero concept

Documented in full in PR #98: one real generated image with real metadata
(dimensions, checksum, alt text, validation status), not three device
thumbnails or ranked A/B/C options — the schema stores exactly one
`hero_concept` section and one `cold_first_email` asset per prospect.

### 08 — Newsletter review

Documented in full in PR #99: no rich-text/image-replace editing controls
(explicitly out of scope per the task), no "Return to draft" (no such
transition exists in the domain layer), content checks only show what's
verifiably true from data.

### 09 — Site-email template review

Documented in full in PR #99: strictly read-only per the task's own
interface contract — no Send test or Publish version action, no Trigger
field (no backing column), no image preview (templates have no asset
reference in the schema).

### Settings (no mockup)

Task 10 had no reference mockup. `docs/superpowers/plans/2026-08-16-fss-growth-os-05-dashboard.md`
Task 10 describes the required content directly; PR #100 documents the
one deliberate scope decision (no bulk newsletter-pause action, agreed
with the founder before building).

## Accessibility review (Plan 05 Task 11, Step 2)

Browser-free review of the rendered component trees — no Playwright,
browser automation, or screenshots were used, per the plan's explicit
constraint.

| # | Item | Verdict | Notes |
| --- | --- | --- | --- |
| 1 | Landmark and heading hierarchy | Pass | One `<main id="growth-main">`, distinctly labelled `<nav aria-label>`s, and a single correctly-nested `<h1>` per page. The Overview page (`overview-page.tsx`) had no `<h1>` anywhere in its tree — its large styled date text was a `<p>` — found and fixed as part of this review (now `<h1 className={styles.headerDate}>`, no visual change). |
| 2 | Form labels and descriptions | Pass | Every `<input>`/`<textarea>`/`<select>` across the dashboard (prospect filters, message edit/redraft, newsletter schedule) has a matching `<label htmlFor>`. |
| 3 | Button names and pending states | Pass | Busy buttons consistently swap to a present-participle label ("Sending…", "Pausing…", "Scheduling…") and disable themselves and their siblings while in flight. Gmail connect/disconnect are a plain link and native form submit (full-page navigation, not an async fetch), so they have no JS busy state — acceptable given what they do, but worth a visual once-over. |
| 4 | Table captions and card alternatives | Pass | Every data table (work queue, prospect list, outreach list, newsletter list) has a visually-hidden `<caption>` and a mobile card-list alternative gated below the 767px breakpoint. |
| 5 | Focus management contracts | Pass | Both confirmation dialogs (message approve-send, newsletter approve-schedule) use `role="alertdialog"` with `aria-labelledby` pointing at the dialog's own heading. The mobile navigation menu does the same with a native `<dialog>`. |
| 6 | Colour-independent status text | Pass | Every status pill and feedback banner pairs its colour (`data-tone`/`data-status`) with visible text — status labels, feedback messages, or an adjacent provider name — never colour alone. |
| 7 | Reduced-motion support | Pass | `app/globals.css` has a global `prefers-reduced-motion: reduce` block. The one CSS transition in the whole growth component tree (`overview.module.css`) is already gated behind `prefers-reduced-motion: no-preference`, so it never applies for reduced-motion users. |
| 8 | No horizontal overflow | Pass | Every wide table collapses to a mobile card list below 767px; fixed-width grid columns are always paired with a flexible `minmax(0, 1fr)` sibling; the desktop side rail is hidden (not scrolled) below the mobile breakpoint; long checksums/hashes use `word-break`. |

Only one real gap surfaced: the missing Overview `<h1>`, fixed directly as part of this task since it was small, unambiguous, and covered by the existing `overview-page.test.tsx` suite. Everything else passed on inspection of the rendered component trees — no Playwright, browser automation, or screenshots were used, per the plan's explicit constraint.

## File and diff quality review (Plan 05 Task 11, Step 5)

Inspected every route under `app/(growth)`, every component under
`components/growth`, and every read model under `lib/growth/dashboard`.

- **No provider imports in Client Components.** No `"use client"` file
  imports `postgres`, `@vercel/blob`, `googleapis`, `resend`, or
  `next-auth` — confirmed by grep across the whole `components/growth`
  tree, not just spot-checked.
- **No sensitive data in client props.** No component receives a prop
  named (or shaped like) `actorId`, `encryptedRefreshToken`,
  `encryption_key_version`, `refreshToken`, `accessToken`, or `apiKey` —
  confirmed by grep. Every read model returns only the redacted view
  shape its tests assert on.
- **No stray debugging.** No `console.log`/`console.debug` and no
  `TODO`/`FIXME`/`XXX` anywhere in `app/(growth)`, `components/growth`, or
  `lib/growth`.
- **Pages are thin — with one exception.** Most `page.tsx` files are
  15–70 lines: fetch, branch on `not_found`/`error`/`ready`, render one
  component. `app/(growth)/(dashboard)/growth/outreach/sequences/[sequenceId]/page.tsx`
  is the outlier at 151 lines — it composes several stat rows and cards
  directly in the page rather than delegating to focused sub-components,
  the way `prospect-detail.tsx` or `issue-review.tsx` do. It was built,
  tested, and shipped in Task 7; refactoring it now would touch working,
  merged code outside this task's stated scope, so it's recorded here
  rather than changed unilaterally.
- **All states are rendered.** Every read model's `ready`/`not_found`/
  `error` (and, where relevant, `empty`/`unavailable`) union is handled
  in its page or list component — verified against each read model's own
  `*Result` type and the corresponding component test file.

## Founder visual sign-off

The items marked **Found in review** above are real, but small, and were
not fixed unilaterally as part of this task — they're listed here for the
founder to triage. Everything else in the mockup comparison and
accessibility sections above should be spot-checked by the founder against
a live deployment before this plan is considered released, per the Plan 05
exit gate:

- [ ] Founder has opened each of the nine dashboard areas on desktop and
      confirmed no result feels wrong compared to the approved mockups.
- [ ] Founder has opened the dashboard on a phone-width viewport and
      confirmed no page scrolls horizontally.
- [ ] Founder has triaged the **Found in review** items above (fix now,
      backlog, or accept as-is).
- [ ] Founder has confirmed Gmail connect/disconnect and the Pause all
      active sequences control behave as expected against a real (or
      staging) Google account and database.
