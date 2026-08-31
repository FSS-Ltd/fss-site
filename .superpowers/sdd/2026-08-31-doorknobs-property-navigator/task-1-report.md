# Task 1 Report: Doorknobs route and render contracts

Date: 2026-08-31
Worktree: `/Users/JeanFidele/The Nexus Ecosystem/Projects/fss-site/.worktrees/doorknobs-property-navigator`

## Scope completed

- Added red contract coverage in `app/preview/bespoke-pages.test.tsx` for:
  - the post-feature 14-page bespoke static route baseline
  - `doorknobs` private metadata
  - bespoke `/preview/doorknobs` rendering expectations
  - local logo and bespoke image references
  - four property routes
  - landlord service options
  - disclosed demo form markup
- Updated bespoke registry test fixtures in `components/prospect-previews/bespoke/registry.test.tsx` to reflect the expected 14-page baseline and reserved `doorknobs` signatures.

## Focused RED verification

Command run:

```bash
node --import tsx --test app/preview/bespoke-pages.test.tsx components/prospect-previews/bespoke/registry.test.tsx
```

Result: expected RED.

Observed failing assertions:

1. `generateStaticParams()` still returns `13`, not the expected `14`.
2. `generateMetadata({ slug: "doorknobs" })` still returns title `"Doorknobs"` instead of page-specific Tunbridge Wells metadata.
3. `/preview/doorknobs` still renders the generated composition, so the bespoke marker `data-bespoke-prospect="doorknobs"` and local asset references are absent.
4. `getBespokeProspectSlugs()` still omits `doorknobs`.
5. The bespoke registry still exposes only `13` unique layout and hero signatures.
6. `getBespokeProspectPage("doorknobs")` is still `undefined`, so the reserved metadata and signatures are not yet present.

These failures are assertion failures against current behavior, not module-resolution errors.

## Files changed

- `app/preview/bespoke-pages.test.tsx`
- `components/prospect-previews/bespoke/registry.test.tsx`

## Self-review

- Scope stayed inside Task 1: tests and fixtures only, no component, stylesheet, asset, route implementation, or shared-checkout changes.
- Failures are anchored to observable behavior in the current route and registry.
- The changed tests establish the intended next green target for the Doorknobs bespoke implementation without importing a nonexistent page module.

## Review-fix follow-up

- Removed the unrelated negative-copy assertion from `app/preview/bespoke-pages.test.tsx`.
- Relaxed the Doorknobs registry test in `components/prospect-previews/bespoke/registry.test.tsx` so it asserts observable registration presence and page-facing metadata, without prescribing exact internal description text or signature string values.

Command re-run:

```bash
node --import tsx --test app/preview/bespoke-pages.test.tsx components/prospect-previews/bespoke/registry.test.tsx
```

Result: still RED as intended.

Relevant output summary:

```text
not ok 1 - prerenders the fourteen public-unlisted bespoke prospect slugs
  Expected values to be strictly equal:
  13 !== 14

not ok 4 - defines Doorknobs private metadata around a Tunbridge Wells property journey
  The input did not match the regular expression /Tunbridge Wells/i.
  Input: 'Doorknobs'

not ok 5 - renders Doorknobs as a bespoke property navigator with local assets and demo disclosure
  The input did not match the regular expression /data-bespoke-prospect="doorknobs"/.

not ok 6 - registers exactly the fourteen active bespoke prospect pages
  actual bespoke slugs still omit 'doorknobs'

not ok 7 - every prospect owns a distinct layout and hero-scene signature
  Expected values to be strictly equal:
  13 !== 14

not ok 8 - every page renders its evidence-backed statement and a disclosed demo form
  getBespokeProspectPage('doorknobs') is still undefined

not ok 10 - reserves the Doorknobs bespoke registry slot and future signatures
  getBespokeProspectPage('doorknobs') is still undefined
```
