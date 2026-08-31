# Kemsing Motor Company Concept Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private Kemsing Motor Company prospect preview with matched cinematic vehicle frames and a scroll-linked video hero that remains usable without the Higgsfield MP4.

**Architecture:** Add a dedicated page and a client-only vehicle hero. The page composes existing prospect-preview primitives and evidence-backed copy; the hero owns video progress and copy-beat animation. Generated media and any recovered public logo live locally in the Kemsing public asset directory.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS v4, native HTML video, Node test runner with TSX.

**Spec:** `docs/superpowers/specs/2026-08-30-kemsing-motor-company-concept-design.md`

## Global Constraints

- The preview must use the existing private/no-index `/preview/[slug]` mechanism.
- Do not add dependencies or remote image domains.
- Use only claims established by the researcher composition or public Kemsing pages.
- Both frames use one graphite-blue five-door hatchback, exact camera, pose, workshop, lighting and floor markings.
- The hero is muted, `playsInline`, has no `autoPlay`, and falls back to the complete-car poster.
- Reduced-motion users must receive the poster and readable copy without scroll-driven updates.
- The demo form is non-operational and must not submit customer data.

---

## File structure

- `public/prospect-previews/bespoke/kemsing-motor-company/vehicle-exploded-v1.png`: Higgsfield start frame.
- `public/prospect-previews/bespoke/kemsing-motor-company/vehicle-assembled-v1.png`: Higgsfield end frame and hero poster.
- `public/prospect-previews/bespoke/kemsing-motor-company/higgsfield-reassembly-prompt.md`: upload instructions and output contract.
- `public/prospect-previews/bespoke/kemsing-motor-company/kemsing-motor-company-logo-v1.*`: recovered official logo when its source is usable.
- `components/prospect-previews/bespoke/prospects/kemsing-motor-company-hero.tsx`: isolated client scroll/video behaviour.
- `components/prospect-previews/bespoke/prospects/kemsing-motor-company.tsx`: service, evidence and form composition.
- `components/prospect-previews/bespoke/prospects/kemsing-motor-company.test.tsx`: focused page render contract.
- `components/prospect-previews/bespoke/registry.ts`, `registry.test.tsx`, `app/preview/bespoke-pages.test.tsx`: route registration and route contracts.
- `app/preview/preview.css`: scoped Kemsing hero and reduced-motion layout.

## Task 1: Generate and validate the media package

**Files:**
- Create the four public asset paths listed above.

**Interfaces:**
- Produces `vehicle-assembled-v1.png`, consumed as the hero poster.
- Documents future `vehicle-reassembly-scroll-scrub-v1.mp4`, consumed as the hero video source.

- [ ] **Step 1: Generate the exploded start frame**

Use the built-in image tool with this exact prompt:

```text
Use case: stylized-concept
Asset type: paired start frame for a cinematic automotive website hero
Primary request: A graphite-blue contemporary British five-door hatchback, no identifiable manufacturer badge, as a precise exploded view. Body panels, wheels, seats, engine, suspension, steering wheel, lights, wiring loom and dashboard float in orderly, physically plausible layers around an intact central chassis.
Scene/backdrop: clean independent vehicle workshop in Kemsing, Kent; dark graphite floor; subtle royal-blue wall light; brushed-metal workbenches in soft focus; no people or readable signs.
Style/medium: photorealistic cinematic automotive photography, premium and restrained.
Composition/framing: 16:9 landscape; fixed eye-level three-quarter front view from the driver side; 35 mm lens; car centred slightly right; left-side negative space for copy.
Lighting/mood: deep royal-blue practical light with warm amber task-light rim and soft haze.
Color palette: graphite, Kemsing royal blue #243A7A, steel, black and a small warm amber accent.
Constraints: clean floor; no text, logos, watermarks, people, impossible parts or racing livery.
```

- [ ] **Step 2: Generate the assembled end frame**

Use the same prompt, changing only `Primary request` to: “The exact same graphite-blue contemporary British five-door hatchback from the same fixed camera, fully assembled, clean and road-ready. There are no floating components.”

- [ ] **Step 3: Inspect and persist the selected frames**

Visually compare car position, lens perspective, workshop geometry, lighting and palette. Copy the selected files to `vehicle-exploded-v1.png` and `vehicle-assembled-v1.png`.

Run:

```bash
file public/prospect-previews/bespoke/kemsing-motor-company/vehicle-exploded-v1.png public/prospect-previews/bespoke/kemsing-motor-company/vehicle-assembled-v1.png
```

Expected: two non-empty PNG images.

- [ ] **Step 4: Write the Higgsfield handoff**

Write this content to `higgsfield-reassembly-prompt.md`:

```markdown
# Kemsing vehicle reassembly

Upload `vehicle-exploded-v1.png` as the first frame and `vehicle-assembled-v1.png` as the final frame.

Generate a 7-second 16:9 cinematic transition. Components draw inward and lock in a physically plausible order: chassis and suspension, engine and wiring, cabin, exterior panels, wheels, then lights. Keep the exact camera, 35 mm eye-level three-quarter front view, car scale, workshop and lighting from the two source images. Use calm, precise motion with a slight blue practical-light pulse. No cuts, no camera moves, people, text, logos, badges, new objects or racing effects.

Export MP4 as `vehicle-reassembly-scroll-scrub-v1.mp4` and place it beside the source frames.
```

- [ ] **Step 5: Recover and validate the official logo**

Locate the original image used by the public Kemsing site. Retain it only when it is clearly the company mark and can be saved as a web-safe local asset. Do not redraw an uncertain mark; the page will use an accessible text mark instead.

- [ ] **Step 6: Commit the media package**

```bash
git add public/prospect-previews/bespoke/kemsing-motor-company
git commit -m "feat: add Kemsing vehicle assembly media"
```

## Task 2: Define the failing route and render contracts

**Files:**
- Create: `components/prospect-previews/bespoke/prospects/kemsing-motor-company.test.tsx`
- Modify: `components/prospect-previews/bespoke/registry.test.tsx`
- Modify: `app/preview/bespoke-pages.test.tsx`

**Interfaces:**
- Consumes the future `KemsingMotorCompanyPage`.
- Produces contracts for private route registration, safe video fallback, evidence routes and registration-first form order.

- [ ] **Step 1: Write the focused page test**

```tsx
test("renders Kemsing's scroll-linked vehicle assembly with a complete-car fallback", () => {
  const html = renderToStaticMarkup(<KemsingMotorCompanyPage />);

  assert.match(html, /data-bespoke-prospect="kemsing-motor-company"/);
  assert.match(html, /data-kemsing-vehicle-journey="true"/);
  assert.match(html, /vehicle-reassembly-scroll-scrub-v1\.mp4/);
  assert.match(html, /vehicle-assembled-v1\.png/);
  assert.doesNotMatch(html, /<video[^>]*autoPlay/);
  assert.match(html, /Vehicle registration/);
  assert.match(html, /ADAS calibration/i);
  assert.match(html, /Demonstration only/i);
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
node --import tsx --test components/prospect-previews/bespoke/prospects/kemsing-motor-company.test.tsx
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Extend cross-page contracts**

Add `kemsing-motor-company` to the expected registry slugs and the garage registration-order list. Change the static bespoke total from 14 to 15. Add a route-resolution assertion for the Kemsing page and its royal-blue evidence-led description.

- [ ] **Step 4: Run changed tests to keep the red state explicit**

```bash
node --import tsx --test components/prospect-previews/bespoke/registry.test.tsx components/prospect-previews/bespoke/prospects/kemsing-motor-company.test.tsx app/preview/bespoke-pages.test.tsx
```

Expected: the Kemsing assertions fail until Task 3 is finished.

## Task 3: Implement the Kemsing page and scroll hero

**Files:**
- Create: `components/prospect-previews/bespoke/prospects/kemsing-motor-company-hero.tsx`
- Create: `components/prospect-previews/bespoke/prospects/kemsing-motor-company.tsx`
- Modify: `components/prospect-previews/bespoke/registry.ts`

**Interfaces:**
- `KemsingMotorCompanyHero(): JSX.Element` renders `data-kemsing-vehicle-journey="true"`, the muted video and poster.
- `KemsingMotorCompanyPage(): JSX.Element` renders evidenced service routes and the disclosed demo form.

- [ ] **Step 1: Build the client hero**

Use these exact assets:

```tsx
const videoSource = "/prospect-previews/bespoke/kemsing-motor-company/vehicle-reassembly-scroll-scrub-v1.mp4";
const posterSource = "/prospect-previews/bespoke/kemsing-motor-company/vehicle-assembled-v1.png";

<video
  aria-hidden="true"
  data-kemsing-vehicle-journey-video="true"
  muted
  playsInline
  poster={posterSource}
  preload="metadata"
  ref={videoRef}
  src={videoSource}
/>
```

Use the existing Jaguar scroll hero only for clamped scroll progress, `requestAnimationFrame`, passive events, `loadedmetadata` and cleanup. Exit before event setup for `prefers-reduced-motion`; never attempt playback before video metadata exists.

- [ ] **Step 2: Build the page**

Compose `ConceptBar`, `RevealOnScroll` and `DemoEnquiry`. Use the following exact field order:

```tsx
const fields = [
  { id: "registration", label: "Vehicle registration", type: "registration", placeholder: "AB12 CDE" },
  { id: "service", label: "What does your vehicle need?", type: "select", options: ["MOT", "Service", "Diagnostics", "Repair", "Tyres, alignment or air conditioning", "EV, hybrid or ADAS calibration"] },
  { id: "timing", label: "When would you like us to help?", type: "select", options: ["As soon as possible", "This week", "Planning ahead"] },
  { id: "contact", label: "Best contact details", type: "text", placeholder: "Name and telephone or email" },
] as const;
```

Render only evidenced service content: Class 4 MOT and servicing, diagnostics, tyres/alignment/air conditioning, EV/hybrid repair and ADAS calibration. Display a private, non-operational disclosure around the demonstration form.

- [ ] **Step 3: Register the page**

```ts
"kemsing-motor-company": {
  Page: KemsingMotorCompanyPage,
  businessName: "Kemsing Motor Company",
  title: "MOT, diagnostics and vehicle servicing in Kemsing",
  description: "Prepare an MOT, service, diagnostic or repair request with the vehicle details Kemsing Motor Company needs.",
  layoutSignature: "precision-vehicle-assembly",
  heroSignature: "scroll-linked-exploded-hatchback",
},
```

- [ ] **Step 4: Run focused tests**

```bash
node --import tsx --test components/prospect-previews/bespoke/registry.test.tsx components/prospect-previews/bespoke/prospects/kemsing-motor-company.test.tsx app/preview/bespoke-pages.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the page**

```bash
git add components/prospect-previews/bespoke/prospects/kemsing-motor-company*.tsx components/prospect-previews/bespoke/registry.ts components/prospect-previews/bespoke/registry.test.tsx app/preview/bespoke-pages.test.tsx
git commit -m "feat: add Kemsing vehicle assembly prospect preview"
```

## Task 4: Add scoped hero styling and finish verification

**Files:**
- Modify: `app/preview/preview.css`
- Test: all files changed in Tasks 2–4.

**Interfaces:**
- Consumes the hero `data-kemsing-vehicle-journey*` attributes.
- Produces a full-height hero, sticky desktop scroll frame, readable overlay and still-image reduced-motion state.

- [ ] **Step 1: Add scoped CSS**

Add `data-kemsing-vehicle-journey` rules analogous to the existing hero’s layout but with no shared selectors. Require this base behaviour:

```css
[data-kemsing-vehicle-journey] { min-height: 100svh; }
[data-kemsing-vehicle-journey-frame] { isolation: isolate; min-height: 100svh; position: relative; }
[data-kemsing-vehicle-journey-video] { height: 100%; inset: 0; object-fit: cover; position: absolute; width: 100%; z-index: -2; }
```

Use a sticky `100svh` desktop frame inside a `600svh` scroll container. In `prefers-reduced-motion: reduce`, unset sticky geometry, display only the first copy beat and leave it static and visible.

- [ ] **Step 2: Format and run verification**

```bash
pnpm exec prettier --write components/prospect-previews/bespoke/prospects/kemsing-motor-company-hero.tsx components/prospect-previews/bespoke/prospects/kemsing-motor-company.tsx components/prospect-previews/bespoke/prospects/kemsing-motor-company.test.tsx components/prospect-previews/bespoke/registry.ts components/prospect-previews/bespoke/registry.test.tsx app/preview/bespoke-pages.test.tsx app/preview/preview.css
pnpm typecheck
pnpm lint
node --import tsx --test components/prospect-previews/bespoke/registry.test.tsx components/prospect-previews/bespoke/prospects/kemsing-motor-company.test.tsx app/preview/bespoke-pages.test.tsx
pnpm build
```

Expected: every command passes.

- [ ] **Step 3: Inspect the route**

Start the development server and inspect `/preview/kemsing-motor-company` at desktop and mobile widths. Verify no broken-media glyph appears while the Higgsfield MP4 is absent, controls do not intrude, copy is readable, keyboard focus is visible and the form remains a disclosed demonstration.

- [ ] **Step 4: Commit styles and documentation**

```bash
git add app/preview/preview.css docs/superpowers/specs/2026-08-30-kemsing-motor-company-concept-design.md docs/superpowers/plans/2026-08-30-kemsing-motor-company-concept.md
git commit -m "docs: record Kemsing concept implementation"
```

## Self-review

- **Spec coverage:** Task 1 covers source frames, logo recovery and Higgsfield handoff. Tasks 2–4 cover the bespoke route, scroll hero, form, service evidence, fallback, accessibility and checks.
- **Placeholder scan:** No undefined interfaces, unspecified tests or generic implementation steps remain.
- **Type consistency:** Task 2 imports the Task 3 page export. Task 3 uses the same media paths produced by Task 1 and the same route name used by the registry tests.
