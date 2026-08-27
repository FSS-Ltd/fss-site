# Daily Prospect Preview PR Creation Design

**Owner:** Technical Agent

**Status:** Draft for founder review

**Created:** 2026-08-27
**Related docs:** `docs/prospect-previews.md`, `docs/superpowers/specs/2026-08-26-production-prospect-previews-design.md`

## Problem statement

The current Growth OS process stores a distinct website assessment for each
accepted prospect, but renders every stored preview through one generic
assessment-page component. It provides different copy, but not an individual
prospect website. That does not meet the sales purpose of a preview.

The 06:00 Europe/London discovery run must therefore create a private,
prospect-specific site composition for every accepted prospect and place all
compositions from that run in one reviewable GitHub pull request. Founder
approval of an individual site, not PR creation or merge, must make its public
URL live and update its first-email draft.

## Goals

- Every accepted prospect receives a dedicated page definition with its own
  visual treatment, section order, copy, CTA, and conversion journey.
- Reuse only core visual and conversion primitives. Never use one generic page
  template with text substitutions.
- The 06:00 discovery workflow creates one dated branch and pull request for
  all page definitions generated in that run.
- The pull request receives a Vercel preview deployment for visual review.
- A founder can inspect the exact page after merge, approve it individually,
  or save a change request that can be brought back to Codex.
- An individual founder approval publishes only that prospect's page and
  rewrites only that prospect's first-email draft with its canonical link.

## Non-goals

- No AI, image-generation, paid-model, or remote-image API creates a preview.
- Discovery does not publish a preview, create a Gmail draft, queue email, or
  send email.
- Merging the generated PR does not make any preview public.
- The production website does not open, control, or authenticate to the local
  Codex desktop application. It can store feedback and produce a safe,
  ready-to-paste Codex change brief.
- This change does not replace the existing founder email review and send
  controls.

## Recommended architecture

### 1. Prospect composition packages

Each prospect receives a source-controlled package under a generated-preview
directory. The package is a typed composition, not a copied page component.
It contains only public, publishable material:

- stable `prospectId`, private review slug, and composition digest;
- visual direction and colour token selection;
- hero treatment and approved local/fallback asset reference;
- tailored headline, narrative, CTA text, and concept disclaimer;
- ordered page sections and their variant choices;
- one purpose-built conversion journey and its simulated completion state;
- no contact name, email address, company number, raw research URL, private
  assessment note, or unlicensed asset.

The renderer selects shared primitives such as `Hero`, `ProofPanel`,
`JourneyForm`, `LocationPanel`, `OwnerCta`, and `ConceptBanner`. The persisted
composition determines their order, variants, copy, and visual tokens. A
composition validator rejects an unsupported module, duplicate section, absent
conversion journey, or unsafe asset reference.

### 2. Uniqueness contract

The composition compiler assigns a business-specific page shape from stored
sector, locality, business goal, primary CTA, assessment evidence, and a
stable prospect ID. It creates a composition fingerprint from the visual
direction, hero treatment, section order, and journey type.

Within a discovery run, no two prospects in the same sector may share the same
fingerprint. The compiler chooses another supported composition when a
collision occurs. Distinct business-specific copy and data make every package
different even across sectors. If no valid distinct composition remains, the
prospect is recorded as `composition_unavailable`; it is not added to the PR
and cannot be contacted.

Initial composition families cover automotive, emergency/property trades,
hospitality/events, property enquiries, and professional-service discovery.
New families and bespoke modules are ordinary source additions reviewed in a
later PR; they do not weaken the validation contract.

### 3. Daily PR creation

After a 06:00 discovery submission has been validated and ingested, a trusted
orchestrator, not the disposable researcher process, does the following:

1. Reads the sanitized accepted-prospect composition inputs.
2. Creates validated packages and a generated manifest deterministically.
3. Creates branch `generated/prospect-previews/YYYY-MM-DD` from current
   `main`.
4. Commits only that run's generated packages and manifest.
5. Opens or updates one pull request for that date.
6. Stores the branch, PR number, composition digest, and Vercel review URL
   against every associated draft preview record.

The existing researcher remains isolated in a disposable workspace. It still
submits research through the signed ingestion boundary and has no GitHub
credential, repository write access, or permission to issue a pull request.
The trusted orchestrator owns source generation and GitHub API calls.

The orchestrator uses a repository-scoped GitHub App installation token or a
fine-grained token with only `contents: write` and `pull_requests: write` for
this repository. The secret is held only in the trusted execution environment,
never included in a prospect package, browser response, log, or Codex brief.

### 4. Private review and publication gates

The workflow has three independent states:

| State | Page visibility | Email effect |
| --- | --- | --- |
| Generated PR open | Vercel PR deployment only | None |
| PR merged, founder draft | Authenticated Growth OS review only | None |
| Founder approved | Canonical public preview URL | First-email draft is regenerated with the URL |

The PR deployment renders the source composition at a review-only route and
must remain protected by Vercel deployment protection. It is noindexed and is
not linked from the public site.

After merge, the production code contains the composition package but the
canonical `/preview/[slug]` route remains unavailable to public visitors until
the corresponding database row is `published`. Founder dashboard rendering
loads the same composition directly, so the founder reviews exactly the page
that will be published.

Founder approval verifies all of the following atomically:

- the prospect is still contactable and non-terminal;
- its composition package is deployed and its digest matches the stored draft;
- its PR has been merged;
- the preview and prospect versions are current;
- the source composition has passed validation.

Only then does the transaction set the preview to `published`, record the
audit event, and regenerate the first-email revision with the friendly
`/preview/[slug]` URL. Approval still cannot send, queue, or create a Gmail
draft.

### 5. Founder change requests and Codex handoff

Each draft-preview page has **Request changes** beside **Approve**. The founder
can enter concise change notes. The application stores the request with the
prospect ID, composition digest, PR number, and current status, then provides
a copyable Codex brief containing:

- prospect business name and private review URL;
- branch and PR URL;
- composition family and current goal;
- founder feedback;
- the instruction to change only that prospect package and preserve all
  approval and no-send boundaries.

The request does not call an AI API, modify source, publish a page, or update
email. Codex performs the requested code change in the normal reviewed PR
workflow.

## Data model and source contract

Extend the private preview record with:

- `slug`: stable, URL-safe prospect slug, unique among previews;
- `composition_digest`: SHA-256 of canonical composition JSON;
- `generation_status`: `pending_pr`, `pr_open`, `merged_draft`,
  `composition_unavailable`, `published`, or `withdrawn`;
- `generation_pr_number`, `generation_branch`, and `review_deployment_url`;
- optional run ID and generated-at audit fields.

Add a private `prospect_preview_change_requests` table. It stores founder
feedback, source composition digest, lifecycle status, and audit metadata. It
never stores raw research URLs, contact data, generated code, or a Codex token.

The source manifest maps `prospectId` to package slug and digest. Production
approval compares the private database record to this manifest. A missing or
different manifest record fails closed and leaves the preview as a draft.

The former generic snapshot renderer is retired for new records. Existing
generic drafts are retained for audit but cannot be approved until a matching
composition package has been generated and merged.

## Failure modes and recovery

- **Composition validation fails:** mark the prospect `composition_unavailable`,
  record a safe audit event, do not create a PR file or email revision.
- **GitHub branch or PR creation fails:** leave the preview `pending_pr`, record
  a correlated error, and retry idempotently. Never create a duplicate package
  or PR for the same daily run.
- **Vercel preview fails:** surface the failed deployment on the founder review
  list and block merge/publication until a successful deployment exists.
- **PR is closed without merge:** retain the private draft and change request;
  it cannot be approved. A later orchestrator run may create a replacement PR
  with a new branch.
- **Source/DB digest mismatch:** fail approval closed and request a regenerated
  package. Do not publish a stale page or update email.
- **Founder changes requested:** keep the preview private and version the
  request; a later PR revision updates the package digest and review URL.

## Security and privacy

- All generated package content is validated against an allowlisted schema.
- Generated code and source manifests contain only material permitted for a
  preview page. They exclude contacts, email addresses, company numbers,
  private research notes, raw evidence URLs, and provider credentials.
- The GitHub token is server-side only and is never passed to the researcher,
  client, database snapshot, or frontend.
- Review deployments are protected and noindexed. Canonical public pages remain
  noindexed and absent from the sitemap.
- Every transition writes an audit record. The approval boundary remains
  founder-only and optimistic-concurrency controlled.

## Rollout and rollback

1. Introduce the composition schema, renderer, manifest validator, change
   request boundary, and tests without activating daily PR generation.
2. Configure the GitHub automation credential and Vercel deployment protection.
3. Enable the 06:00 orchestrator in dry-run mode and inspect its generated
   branch/PR output without creating public pages or email revisions.
4. Enable PR creation for new prospects.
5. Migrate the ten existing generic drafts only by creating corresponding
   composition packages; do not approve or contact them automatically.

Rollback is immediate: disable the PR-generation feature flag and keep all
unpublished rows private. Any individually published preview can be withdrawn,
which returns its canonical URL to 404 without deleting audit history.

## Success criteria

- Every accepted prospect in a successful 06:00 run either has a unique,
  validated composition package in that day's PR or a recorded safe rejection.
- No two same-sector prospects in one run share a composition fingerprint.
- The founder can view the exact merged draft, request changes, and approve it
  individually.
- A public URL and first-email link exist only after that individual approval.
- No preview creation, review, merge, or change request sends email or calls an
  AI/image-generation API.
- Preview routes remain noindexed, nofollow, and excluded from the sitemap.
