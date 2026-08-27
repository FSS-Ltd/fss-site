# Prospect previews

Prospect previews are private, prospect-specific sales concepts served by the existing FSS deployment:

```text
/preview/[slug]
```

They are not separate Vercel projects or applications. Each route is excluded
from the public sitemap, marked `noindex, nofollow`, and sends
`X-Robots-Tag: noindex, nofollow`.

Public routes are database-gated. A generated source package must be merged,
then individually approved by the founder before `/preview/[slug]` can render
in production or be added to the stored first-email draft. A source pull
request, its merge, feedback, and reconciliation never publish a preview,
create a provider draft, or send email.

## Current examples

- `/preview/ashford-auto-centre` demonstrates an automotive MOT and vehicle booking journey.
- `/preview/example-plumbing` demonstrates a local-trade quote journey that gathers the issue, postcode, and urgency.

Both use fictional sample data and are available only in local and preview
deployments. Production routes render only source compositions that have passed
the founder approval boundary. Do not replace sample data with prospect
information until the research and source package have been reviewed.

## Hero media

Each bespoke prospect page owns a stable hero-media panel and its image lives at `public/prospect-previews/<slug>/hero-v1.png`. The current 3D images are tailored to the automotive and plumbing examples, are unbranded, and use no prospect-supplied material.

When an approved Higgsfield video is available, retain the same panel and static image fallback, then replace only the media layer. This keeps the content, booking journey, responsive layout, and route boundary unchanged while leaving room for a separately scoped parallax treatment.

## Generated prospect workflow

1. The 06:00 weekday research process creates a draft preview record for every
   accepted prospect.
2. The trusted application process creates one dated pull request containing
   only deterministic source composition packages. It never calls an AI or
   image-generation API.
3. Review the exact source composition in Growth OS at
   `/growth/prospects/<prospect-id>/preview`. Add feedback there if changes are
   needed. The note is tied to that package digest.
4. Merge the source pull request. The protected reconciliation cron marks only
   a digest-matching merged package ready for founder approval.
5. Approve one prospect from Growth OS. This is the only step that publishes
   `/preview/[slug]` and refreshes the first-email review draft with its link.

To create source-only packages for the current ten historical eligible drafts,
run this only from the approved production operator environment after the
migration and feature configuration are live:

```bash
pnpm growth:previews:backfill-pr -- --run-id current-ten-YYYY-MM-DD
```

The command requires exactly ten eligible drafts and exits before GitHub if the
selection differs. It cannot publish previews or modify email.

## Add a bespoke local proof of concept

1. Create `config.ts` and `content.ts` in `lib/prospect-previews/prospects/<slug>/`.
2. Put only licensed, permissioned, or prospect-supplied files in `public/prospect-previews/<slug>/`. Reference them with `/prospect-previews/<slug>/<file>`.
3. Choose the right shared conversion module in `components/prospect-previews/modules/`, or add a focused bespoke page at `components/prospect-previews/prospects/<slug>/`.
4. Add the record to `lib/prospect-previews/registry.ts` and map the bespoke page in `components/prospect-previews/prospect-preview-renderer.tsx`. No router change is required.
5. Define the selling angle, public-facing copy, sections, brand values, and owner CTA in the typed record.
6. Add focused tests for the registry and any form or component behaviour introduced.
7. Run the checks below. The route is review-only outside production. Use the
   generated prospect workflow above for a production prospect.

## Conversion demonstrations

Forms in this feature are demonstrations. They must not call `fetch`, submit to the prospect, or imply a connection to the prospect’s systems. A successful demo submission must explain that a live version could create a team notification or dashboard item.

Use `trackPreviewEvent` from `lib/prospect-previews/analytics.ts` for preview views and interactions. It dispatches `fss:preview-event` locally and forwards events only when a consented analytics client is available. That boundary allows a later Growth OS adapter without coupling this feature to the dashboard or database.

## Checks

```bash
node --import tsx --test lib/prospect-previews/*.test.ts
node --import tsx --test app/preview/page.test.tsx components/prospect-previews/**/*.test.tsx
pnpm lint
pnpm typecheck
pnpm build
```

Check both pages at 375px, 430px, tablet, desktop, and large desktop widths before sending a prospect URL. Verify the simulated form completion, concept disclosure, owner CTA, and noindex response header.
