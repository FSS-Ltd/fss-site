# Outreach draft publication restoration

Status: Implemented locally; release blocked by existing dependency audit findings.
Updated: 2026-10-26

## Problem and repair

The Outreach page loaded sequence enrollments and SEO audit follow-ups. First
email drafts exist before enrollment, so the page gave no route to their existing
publication controls.

The page now includes an Email drafts queue above sequences. Each desktop or
mobile row links to the existing message review screen through **Review & publish**.
That screen retains **Create Gmail draft**, **Approve & send**, eligibility checks,
version checks, and explicit send confirmation.

The queue makes one bounded query per page render, with no polling or provider
calls. It selects the latest completed first-email task per prospect, includes
legacy snapshots without a review state, and excludes published snapshots,
prospects outside email review, and prospects with an existing enrollment. It
returns at most 50 drafts, ordered by fit score and completion time. Each queue
handles its own empty and error states. The page heading stays visible even when
there are no sequences.

## Verification and release

Unit tests cover query boundaries, safe errors, desktop and mobile review links,
and empty states. A transaction-backed PostgreSQL integration verifies legacy
drafts, replacement drafts, publication, rejection, and enrollment exclusions.
Completed tasks without a completion timestamp use their creation timestamp.
Its fixtures are rolled back. Existing message approval endpoints are unchanged.

Final local checks passed with Node 24.21.0:

- `npm test`: 2,145 unit tests and 40 Growth database integrations passed against
  disposable PostgreSQL with all repository migrations. Nine preview-contract
  checks skipped because no configured running preview was supplied.
- `npm run typecheck`, `npm run lint`, `npm run build`, changed-file Prettier checks,
  and `git diff --check` passed.
- Desktop (1440px) and mobile (390px) browser inspection of the rendered component
  confirmed visible review links before enrollment. This was a static fixture,
  not an authenticated live send. No Gmail operation was performed.
- Independent code review found the nullable completion timestamp edge case;
  the fix has regression coverage.

`pnpm audit --prod --audit-level high` failed on existing dependencies: 16 findings
(2 critical, 7 high, 6 moderate, 1 low). The critical findings are reported against
Next.js 16.3.8 (GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr). No dependency or lockfile
was changed in this repair. A separate dependency remediation and security review
are required before the repository release gate can pass.

No new dependency, migration, provider permission, or configuration is needed.
Release requires the normal reviewed application deployment. No production
deployment or external send was performed. Reverting this application change
restores the previous list without changing stored drafts or enrollments.
