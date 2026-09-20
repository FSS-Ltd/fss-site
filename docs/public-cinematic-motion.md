# Public cinematic motion

## Design and scope

The homepage uses a five-phrase outcome sequence, a separate three-part desktop-interface story, a horizontal services-to-mobile-concept journey, and a pinned delivery sequence. Scroll position controls the timeline, with stationary reading intervals and overlapping fades rather than timed playback. The Heron reference informed the sequence and pacing, not the visual assets or copy.

The hero canvas initialization contract is unchanged. The outcome scene retains its `data-hero-canvas` but uses a dedicated anchored-network renderer selected by `data-value-particles`. Nodes and permanent connections assemble diagonally from bottom-left to top-right with scroll, without clipping a drifting field. Pointer displacement is bounded to three pixels and never changes the underlying anchors or connectivity. Content and hero parents must never retain animation clipping. The hero image carries the FSS monogram and “For Your Mission”.

The app concept assembles from 3,555 image-coloured circular atoms in a separate canvas, then resolves into its static image. Explicit layers place the wireframe behind the image and atoms. It does not reuse or modify the hero particle renderer.

## Modules

- `home-story.tsx` and `home-story.module.css`: readable server-rendered value and interface chapters.
- `story-progress.ts`, `story-scenes.ts`, `cinematic-motion.css`: chapter timelines and desktop pinning.
- `value-network.ts`, `value-network-canvas.ts`: deterministic connected geometry and event-driven scroll assembly. Reduced motion shows the complete stationary structure; hidden/offscreen canvases skip drawing. There is no continuous animation loop.
- `app-journey.tsx`, `app-journey-scenes.ts`, `app-atoms.ts`: horizontal panels and atom assembly.
- `motion-scenes.ts`: shared masks, bounded parallax, rail travel and delivery progression.
- `delivery-steps.tsx`: optional homepage cinematic treatment; other routes keep the standard layout.
- `page-intro.tsx`: particle canvas outside the content reveal.

Motion-only CSS is loaded with the deferred interaction runtime. Base layouts and reserved desktop scene heights remain in the server-rendered styles. No animation dependency was added. On smaller/shorter viewports, content uses a normal vertical layout. Reduced motion removes pinning and displacement while preserving stationary hero particles and the complete app image. Changing motion or pointer preferences reinitializes the runtime. Keyboard-focused service links keep their horizontal panel in view.

## Generated asset

Built-in image generation produced `public/images/editorial/community-app-concept-v1.webp` (720 × 1260, 50,600 bytes). It was inspected and converted from the original PNG using the existing Sharp dependency. It is labelled an illustrative AI-generated concept, not an existing client product.

Prompt: Generate a premium mobile app screen only, portrait, no phone body or perspective, for UK charity/community operations. FSS navy, teal and off-white, refined Apple-inspired spacing, dimensional cards and abstract interlocking teal loops. Exact UI copy: “Today, together.”, “Your community at a glance”, “More time for people.”, “12 / Volunteers today”, “4 / Upcoming sessions”, “Your next steps”, “Review the rota”, “Prepare your session”, “Team check-in”, “Everything in one place.” Tabs: Today, People, Sessions, Messages. No logos, identifiable people, invented client names, financial or safeguarding claims.

## Verification and constraints

Use `pnpm typecheck`, `pnpm test:unit`, `pnpm test:public-redesign`, `pnpm build`, and `pnpm perf:budget:homepage`. The repository lint command scans unrelated generated `.worktrees` directories; source verification used `pnpm exec eslint --ignore-pattern '.worktrees/**' --ignore-pattern '.playwright-cli/**'` plus `pnpm lint:covers`.

Final verification passed type checking, all 1,787 unit tests, redesign assertions, production build, source lint, cover checks, homepage bundle budgets, and mobile Lighthouse assertions across five runs. Initial homepage CSS is 65.9 KB against a 66 KB budget, so further base styles need budget review. In-app browser checks covered desktop and mobile layouts; native Safari was not available for validation.

The public crawl reaches the private `/growth` contract and fails with 500 instead of 307 because local Growth OS environment configuration is absent. No backend changes were made. Mobile Lighthouse collection/assertion can run locally without the configured public report upload. Native Safari 16.4 remains a manual verification item. Local Node is 22.9.0; the repository requests Node 24.

The development preview is available on http://localhost:3000. No production deployment was made.

### Anchored-network revision, 14 September 2026

Type checking, changed-file ESLint, redesign assertions, all 1,791 unit tests, production build and homepage bundle budgets passed. Unit tests required local socket access for the existing email-client test servers. Desktop browser review confirmed the partial lower-left structure and completed network behind the final phrase. Lighthouse, the environment-blocked public crawl and native Safari were not rerun for this isolated renderer revision.
