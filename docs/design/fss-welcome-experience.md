# FSS welcome experience and operations redesign

Status: Approved for implementation. Owner: Technical Agent. Date: 2026-10-01.

## Approved outcome

Replace the form-dominated welcome, access, and settings pages with purposeful responsive web workspaces. Create image-led, predesigned welcome packets and matching welcome, proposal, activation, and thank-you emails using FSS branding. Apply the Apple design and Apple-inspired product design skills: hierarchy, progressive disclosure, familiar controls, accessible states, restrained motion.

## Welcome materials

Three editions: Website Build, Website + SEO, Systems Portal. Each edition generates ten A4 pages: cover; welcome and contents; project summary; service overview; process; milestone timeline; client responsibilities; deliverables; communication; next steps. Use FSS navy/teal, editorial imagery already owned by the project, numbered sections, process diagrams, and alternating image/text compositions. The supplied watermarked example is a composition reference only.

Populate client facts from selected contacts and agreements. Unconfirmed dates read “To be agreed.” No invented commitments, testimonials, or results. Pack selection applies complete published content and the checklist together. Preserve edited drafts and immutable published versions.

Template area opens as a cover-card library. Selected packet opens an editing workspace with Email, Packet, and Checklist previews; desktop editor and preview sit together; mobile has Edit/Preview controls. Journey stages are Setup, Content, Access, Schedule, Review. Drafts restore entered values. Final review uses the actual generated PDF. Client Getting Started includes authenticated packet reading/download and verified progress.

Version content and rendering. Freeze resolved client facts, settings revision, renderer version, and PDF hash. Preserve legacy five-section packs and legacy approved HTML/PDF validation. PDFs contain searchable text, equivalent semantic HTML, and stay under 2 MB. Overflow errors identify the section. Emails use compatible table/inline styles, readable fallbacks with images blocked, plain text, and exact approval snapshots.

## Access

Dashboard cards: active client users, active FSS staff, pending invitations, invitations needing attention. Totals are authorised dataset aggregates independent of filters/pagination. Views: Clients, FSS staff, Invitations. Compact identities show organisation, role, status, and dates. Invitations/removals use scoped dialogs with review reference, target/permissions, pending/error/success states, keyboard focus restoration.

Reuse founder invitation and counting services. Founder administration in Studio requires active staff membership plus verified identity matching configured founder; ordinary admins keep existing organisation-scoped client privileges. Never infer elevated roles or bypass checks. Preserve provider acceptance versus invitation acceptance, audits, and tenant boundaries. Refresh results without timed reloads.

## Settings

Summary cards: Identity, Communication, Timezone, Delivery. Contextual Edit and explicit Save and apply. Configuration availability is separate from live provider health; credentials/provider flags remain deployment-owned.

Separate revisioned active settings and audit history from existing draft history. Section updates have typed boundary validation and revision conflicts. Display name affects Studio identity and newly prepared welcome materials; approved reply-to affects new welcome envelopes; timezone affects Studio displays and new client defaults; response expectation affects communication guidance/new packet defaults; capacity affects operational Studio status. Existing contractual terms/approved content remain frozen. Post-signature scheduling remains 09:00 Europe/London.

## Acceptance and rollout

Check desktop/mobile, supported appearances, 200% zoom, keyboard navigation, focus restoration, contrast, reduced motion, empty/loading/error/conflict states. Test draft restoration through packet approval/download, stale versions, overflow, cross-organisation access, founder-only staff changes, dashboard totals, and real settings consumers. Inspect all ten pages of all three editions and four email types including blocked images. Run typecheck, lint, formatting on changed files, unit/integration tests, relevant Playwright tests, build, and screen coverage.

Use existing dependencies and primitives. Preserve unrelated work. Additive migrations only; no production migration, deployment, external send, credential change, or feature activation without explicit approval. Update workflow/screen/runbook documentation and preserve rollback-compatible legacy paths.
