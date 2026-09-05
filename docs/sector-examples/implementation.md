# Fictional sector examples

Status: 40 examples implemented and verified locally. Production release and live draft refresh pending approval.

## Scope and design

The scheduled research records in Supabase identify ten business types: roofing,
real estate, accountancy, consumer automotive, plumbing/heating/drainage,
electrical, hospitality, landscape design, business supplies and workshop
equipment. Broad database labels are resolved against the researched business
name where necessary. Hill-Wood is landscape design, Paperstone is supplies and
Kent Garage Equipment is workshop equipment.

Each sector has four independent compositions: cinematic experience, search and
authority, editorial brand, and booking first. These are design directions, not
quality tiers. Each has service information and a useful enquiry journey.
`lib/sector-examples/catalogs/` records all 40 names, slugs and descriptions.
The collection at `/examples` is grouped by sector with direct navigation.

Only Ridge & Vale and Hearth & Acre reuse the existing roof-build and property
walkthrough scroll video components. The other 38 sites use CSS/JavaScript
reveals, scroll progress or illustrated motion. Examples include layered finance
papers, electrical system diagrams and a workshop lift. Each page has its own
composition rather than selecting a shared sector homepage by theme.

## Useful content and conversion

Each site links to three statically generated service guides: 120 routes in total.
The guides explain what to expect, what to prepare and a useful sector-specific
question. Metadata, canonical routes, semantic headings, breadcrumbs and internal
links provide an SEO-ready structure. Fictional demonstrations intentionally
remain noindex; no fabricated local business, review or accreditation schema is
published. Search ranking and business outcomes are not claimed.

The shared enquiry has four stages: needs, brief, sample day/time selection and
a demonstration appointment summary. It validates required slot choices and
moves focus to each new step. No personal details, network submissions or real
bookings occur. Genuine enquiries route to FSS `/contact`.

Estate search includes sale/rental and bedroom filters with an empty state.
Folio includes an explicitly illustrative cash-flow scenario tool. No invented
client results, testimonials, awards or professional credentials are presented.

## Architecture and accessibility

Server-rendered routes use a slug-to-component registry and typed sector data.
Pages, shared chrome, booking controls, service guides and motion are separate
modules. Styles are split by collection, brand and responsibility. No dependencies
were added. Existing neutral imagery is reused; one new generated restaurant
interior is in `public/sector-examples/restaurant-interior.png`.

Reduced-motion CSS removes decorative movement. Video heroes have static mobile
and reduced-motion fallbacks. Main content is visible without JavaScript; reveal
animation progressively enhances it. Native controls, labels, skip links and
focus management support keyboard use.

Existing untracked cinematic components and media are required by this work.
A release must include those dependencies without losing unrelated work already
present in the shared worktree.

## First-email policy

`examplesForSector(sector, businessName)` returns all four matching links. Unknown
sectors receive an honestly described collection link. New research drafts use
this renderer at ingestion; preview approval keeps any private concept URL and
adds the four examples. HTML escaping, URL validation, opt-out/disclaimer text
and the 140–220 word policy remain enforced.

The refresh helper only accepts completed first-email tasks in draft review state.
Any sequence enrollment, approved/provider draft, terminal prospect or exhausted
revision history is excluded. Prospect and task locks plus a second enrollment
check protect the apply path. Revisions and audit events are preserved; repeated
runs are idempotent. Historical drafts without an email narrative can derive one
only from their stored assessment and verified first-party evidence.

`pnpm growth:emails:refresh-pending` defaults to a dry run. `--apply` first verifies
all 40 public example pages and their expected slug marker. The CLI needs the
configured DATABASE_URL and NEXT_PUBLIC_SITE_URL. Direct Supabase connector
reads were used here as requested; no database credentials were copied locally.
A read-only snapshot was passed through the actual renderer locally: 14 of 14
current eligible drafts validate, all have four relevant links, and the one
published private concept remains. These records can change before release.

## Release and rollback

1. Obtain production release approval under the repository's AGENTS.md.
2. Review the scoped release and its existing media/component dependencies.
3. Publish and verify all 40 public URLs before changing stored email drafts.
4. Re-read eligible drafts through Supabase, validate current state, and apply
   the prepared revision with concurrency checks and audit records. Never apply
   a stale snapshot if a draft or enrollment changed in the meantime.
5. Confirm counts and inspect representative drafts. Do not create or send mail.

No production deployment, database mutation, Gmail draft or email send occurred.
The stale Gmail-sync test expectation was corrected to the existing Day 5 and
Day 14 automatic follow-up policy; the full unit suite passes. See verification.md
for evidence and integration-test limitations.

Code rollback reverts this scoped change. Draft history preserves the previous
email revision. Do not remove published example routes while sent emails link
to them. Extensive unrelated working-tree changes were preserved.
