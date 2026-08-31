# DOORKNOBS Limited private property-navigator concept

## Global constraints

- Build only the private, no-index `/preview/doorknobs` concept route. Do not alter the published Doorknobs website, database-backed researcher composition, or lead-submission systems.
- Preserve the official public logo as a local asset. Generate three new local WebP images with the built-in image tool; do not add dependencies or remote image domains.
- Use only first-party-researched service language: Selling, Letting a property, Buying, Renting; Let Only, Rent Collection, and Full Management; independent family-run local service; established local experience; valuation route.
- The route selector starts on Letting a property, uses accessible radio-style buttons, and updates its explanatory panel without navigation. The form is a clearly labelled, non-operational `DemoEnquiry` and sends no data.
- Use scoped styling, responsive `next/image` assets, visible focus states, 44px controls, and reduced-motion-safe static behaviour. Do not imitate Apple branding or layouts.

## Task 1: Define Doorknobs route and render contracts

- Add focused failing tests for the private Doorknobs route, metadata, original logo reference, three bespoke image references, four property routes, landlord service options, and disclosed demo form.
- Register the expected `doorknobs` bespoke slug in registry and preview test fixtures, without implementing the page yet.
- Ruling: this isolated committed baseline contains 13 bespoke pages despite one pre-existing test expecting 12. Update only the tests touched by this feature to expect the post-feature baseline of 14, rather than absorbing uncommitted neighbouring preview work from the shared checkout.
- Run the focused tests and record the expected red failure caused by the missing Doorknobs page/module.

## Task 2: Create the local Doorknobs asset package

- Download the official public logo without alteration to `public/prospect-previews/bespoke/doorknobs/doorknobs-logo-v1.png`.
- Generate and inspect three related assets, then optimise and store them as WebP: `property-threshold-v1.webp`, `landlord-care-v1.webp`, and `local-home-detail-v1.webp`.
- Hero prompt: 16:9 photoreal Tunbridge Wells period-home doorway; a sky-blue front door and restrained brass hardware; warm interior morning light; room for left-aligned copy; no people, text, signage, watermarks, recognisable address, or logo.
- Supporting assets must share the warm, restrained editorial palette, use no readable text or identifiable property addresses, and remain suitable for a private estate-agency concept.
- Validate the final dimensions, formats, and files before continuing.

## Task 3: Implement the bespoke property navigator

- Add `DoorknobsPage` as a server component and an isolated client-side `DoorknobsPropertyNavigator` for route selection.
- Compose the hero, evidence-led trust and landlord sections, property navigator, `DemoEnquiry`, and existing concept banner/invitation patterns.
- Use the generated assets and official logo via local `next/image` paths. Add `app/preview/doorknobs.css`, import it from the preview layout, and register unique `property-threshold-navigator` / `light-through-blue-door` signatures.
- Implement a short one-time light reveal and panel transitions only where motion is enabled. Reduced-motion users receive static, readable content.
- Run focused route tests to green before committing.

## Task 4: Verify the complete concept

- Run focused tests, `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, and `pnpm build`.
- Where the sandbox prevents local-listening tests, repeat the affected verification with approved elevated permissions.
- Inspect `/preview/doorknobs` at desktop and 390px mobile widths, test keyboard route selection and form focus, and verify reduced-motion output.
