# Evidence-backed prospect previews

**Owner:** Technical Agent  
**Status:** Review requested  
**Created:** 2026-08-27  
**Related work:** Review-first prospect-preview workflow, generated source packages, weekday discovery

## Problem statement

Generated prospect concepts preserve broad assessment text, but the renderer reduces
the conversion journey to a generic one-field form and the hero to a sector-level
headline. This discards the specific value proposition identified in research. For
example, Marden Garage's vehicle-service concept needs a vehicle-registration step
before an MOT, service, or repair request, yet the current generated renderer shows
only `Your first detail`.

The system must translate verified first-party evidence into a private, reviewable
concept without reusing third-party imagery, inventing claims, publishing a preview,
or creating outreach.

## Goals

1. Gather and persist first-party brand evidence only: logo, colour cues, real service
   language, and eligible on-site imagery, each with provenance.
2. Compile an evidence-backed hero statement and conversion journey for every generated
   prospect package.
3. Render the researched conversion journey as the interactive demonstration. A generic
   form may not replace a specific researched requirement.
4. Use a verified logo with an accessible typographic fallback.
5. Render a polished art-directed hero and Apple-style, in-context scroll reveals with
   reduced-motion support.
6. Treat 3D or other hero media as an explicit approved asset. Do not call an AI image
   API or use third-party image sources.
7. Refresh the current thirteen private concepts through a source-only review pull
   request. Do not publish previews or send outreach.

## Non-goals

- No Google Maps photos, reviews, brand data, or any other Google-derived content.
- No scraping or copying third-party imagery.
- No automatic image generation, stock-image acquisition, vehicle lookup, appointment
  booking, data storage, email creation, or email sending.
- No public preview route until the existing founder approval gate succeeds.
- No video or parallax implementation. A future founder-supplied and approved hero
  video may use a separately reviewed scroll treatment.

## Source-of-truth and provenance policy

The researcher may use only a prospect's first-party website and first-party public
brand channels that are explicitly linked from that website. Each candidate item must
record:

- `kind`: `logo`, `colour`, `service-language`, or `on-site-image`
- `sourceUrl`: the first-party page or asset URL
- `observedAt`: ISO timestamp
- `sourceHost`: normalized hostname
- `evidenceText` or an asset digest, as appropriate
- `usage`: `private-review-only` or `approved-hero-media`

The production database may retain provenance for audit and review. Generated source
packages must contain no raw source URL, email address, contact detail, or remote
asset URL. A reviewed local asset reference is the only image reference a package may
render.

An eligible image must be served from an approved first-party host, have a supported
image MIME type, be bounded by size and dimensions, and resolve to the same approved
host after redirects. SVGs must be rejected when they contain executable content. A
logo or image that cannot pass validation is omitted and the typographic fallback is
used.

## Generated contract

The research assessment gains a versioned `experienceBrief`. The compiler carries its
safe display fields into the versioned composition package and rejects a package whose
brief is incomplete or cannot be represented safely.

`experienceBrief` contains:

- `hero`: a verified service statement, supporting service language, and optional
  brand evidence references
- `journey`: the user outcome, ordered steps, labels, supported controls, required
  fields, CTA, and local-only confirmation message
- `visual`: approved colour cues, optional reviewed logo reference, optional reviewed
  first-party image reference, and optional approved 3D or hero-media reference

Journey controls are a small allowlist, not free-form JSX: vehicle registration,
single-select service, multi-choice preference, date or time preference, short note,
and contact-detail demonstration where research supports it. Each step carries a
semantic label and accessible validation. The typed contract makes the following
journey explicit for the Marden Garage concept:

1. Vehicle registration
2. Service required: MOT, service, or repair
3. Preferred timing and relevant notes
4. Review of the local-only request

All interaction state stays in the browser and is discarded when the preview closes
or reloads. No form submission endpoint exists.

## Compiler behaviour

The compiler must:

1. Derive the hero statement from first-party service language, not a sector template.
2. Map every permitted research journey requirement to an explicit renderable step.
3. Reject unsupported or ambiguous journey requirements instead of emitting a generic
   `Your first detail` input.
4. Include the safe hero, journey, and visual selections in the composition digest.
5. Use a typographic logo fallback when no validated logo is available.
6. Permit 3D or hero media only when its approved local asset record is present.

This changes generated composition schema version rather than silently reinterpreting
existing packages. Existing drafts are refreshed in a source-only update run so their
stored composition digest and source package remain bound.

## Rendering behaviour

The generated preview renderer will have focused modules for:

- `CompositionBrandMark`: reviewed local logo or typographic fallback
- `CompositionHero`: evidence-backed service statement and art-directed media stage
- `CompositionJourney`: typed, labelled steps instead of a generic field
- `RevealOnScroll`: in-context opacity, transform, and media-mask reveal treatment

Reveals are deliberate product-stage reveals rather than randomly floating elements.
They start only when a relevant section enters view, preserve keyboard and touch
interaction, and fully disable movement for `prefers-reduced-motion: reduce`. Hero
media may subtly reveal or scale in context; it does not autoplay video, use random
motion, or become a page-wide parallax effect.

The existing review banner and noindex behavior remain. In production, a generated
slug resolves only when the database record and source-package digest are both marked
published by the existing founder approval flow.

## Existing thirteen concepts

All thirteen current drafts remain private. The refresh will:

1. Revisit their first-party research and create an evidence and experience brief.
2. Regenerate each source package, including its digest and typed journey.
3. Open a new generated-source pull request for review.
4. Reconcile the merged source package to `merged_draft` only.

The refresh will not publish previews, change approval status to published, create
Gmail drafts, send outreach, or invoke an AI image service.

## Testing and verification

The implementation must add coverage for:

- first-party provenance validation and rejection of remote or unsafe asset references
- evidence-backed hero compilation and typographic fallback
- every supported journey field, including a registration-first MOT flow
- rejection of a generic fallback where research requires a concrete field
- renderer output containing the labels and steps declared in the composition
- reduced-motion output and keyboard-accessible controls
- digest changes when the experience brief changes
- current review and publication gates, including no public rendering, email creation,
  or sending during generation and reconciliation

Before the new source pull request is offered for review, the focused preview tests,
TypeScript check, lint, and production build must pass. Production inventory must show
only private draft states until founder approval.

## Rollout and rollback

The change ships in a source-only pull request. It is safe to roll back by reverting
that pull request because no public preview state or outreach state changes as part of
generation. If a source image or logo later fails validation, the composition falls
back to its text brand mark and no remote media loads.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| First-party evidence is too weak to support a specific claim | Reject or flag the package for founder review; never invent copy. |
| A logo or image is technically unsafe or unsuitable | Validate, store provenance, and use the typographic fallback. |
| A researched conversion path cannot be represented by the allowlist | Mark the composition unavailable for manual design rather than fabricate a generic interaction. |
| Current source and draft digest diverge during refresh | Reconcile only matching source packages; fail closed on a mismatch. |
| Motion hurts usability | Use reduced-motion support, brief in-context reveals, and no autoplay or random movement. |

## Success criteria

- Each generated concept visibly reflects the prospect's evidence-backed service
  statement and conversion journey.
- Marden Garage presents vehicle registration before its MOT-service request details.
- Every logo or image used has first-party provenance or is an approved local asset.
- Missing visual evidence produces an intentional typographic fallback.
- All thirteen refreshed concepts remain private and reviewable, with zero automated
  image-generation calls, publications, Gmail drafts, or sent outreach.
