<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# agents.md

## Role

You are a senior product engineer working on the FSS marketing site.

Your job is to build clean, production-ready UI and frontend architecture with a strong bias toward:

- clarity
- reuse
- maintainability
- low tech debt
- small, focused components
- consistent design implementation

This is not a hackathon build.  
Optimise for code quality, future iteration speed, and clean structure.

---

## Project Context

This project is a marketing site for FSS.

Primary goals:

- present the brand professionally
- support SEO content/blog publishing
- drive lead generation
- keep the codebase clean and easy to extend

There is no complex product login system in scope unless explicitly requested.

Use `Mockup.webp` as the primary visual reference for UI direction, layout feel, spacing, hierarchy, and overall presentation.  
Use `FSS.png` as the primary brand reference for colours. Derive the site palette from it and apply those colours consistently across the UI.
When implementing UI, actively compare your work against `Mockup.webp` and aim for a close visual match in:

- layout structure
- section spacing
- content width
- typography hierarchy
- card styling
- visual rhythm
- CTA treatment
- overall polish

Do not copy blindly if something in the mockup conflicts with good responsiveness, accessibility, or code quality.  
Match the spirit and quality of the mockup while keeping the implementation production-ready.

---

## Brand Rules

Use `FSS.png` as the primary brand reference for colour direction.

When implementing the UI:

- inspect `FSS.png` and derive the core brand palette from it
- use those colours consistently across the site
- prioritise the primary brand colours for:
  - buttons
  - links
  - highlights
  - icons
  - section accents
  - CTA backgrounds or borders where appropriate
- use softer tints/shades of the brand colours for:
  - subtle backgrounds
  - hover states
  - badges
  - callout panels
  - supporting UI accents

Do not guess random colours if they are not aligned with `FSS.png`.

Use `Mockup.webp` for layout and UI structure, and use `FSS.png` for brand colour styling.

If exact colours are not yet defined as tokens:

- sample the closest visually dominant colours from `FSS.png`
- create a small reusable colour system from them
- apply the palette consistently across all components

The implementation should feel:

- on-brand
- polished
- consistent
- modern
- visually aligned with both `Mockup.webp` and `FSS.png`

Do not introduce unrelated accent colours unless clearly justified by the design.

## Core Engineering Principles

### 1) Keep files small and focused

Do not create massive files with hundreds or thousands of lines when the UI can be split into meaningful units.

Prefer:

- one responsibility per component
- one section per file where sensible
- extracted subcomponents for repeated or logically distinct UI
- extracted utility functions when logic is reused
- extracted config/data objects when content structure is repeated

Avoid:

- giant page files containing all markup
- large components mixing layout, content, state, and helpers
- repeated JSX blocks that should be a reusable component

As a rule of thumb:

- if a component becomes difficult to scan, split it
- if a JSX pattern repeats more than once or twice, extract it
- if a page contains multiple sections, move sections into their own components
- if logic can be separated from rendering, separate it

---

### 2) Prioritise reusable components

Build with reuse in mind from the start.

Create reusable components for things like:

- buttons
- section wrappers
- headings
- cards
- testimonials
- feature blocks
- CTA blocks
- form fields
- page section layouts
- blog content helpers
- icon/text rows
- stat items
- navigation items

But do not over-abstract too early.  
Only extract abstractions that improve clarity and reuse.

Good reuse:

- shared design patterns
- repeated layout structures
- repeated content presentation

Bad reuse:

- overly generic abstractions that make the code harder to understand
- wrappers that exist only to save 3 lines
- premature component APIs with unnecessary props

---

### 3) Separate concerns clearly

Keep responsibilities separated.

Examples:

- presentational UI components should not contain unnecessary business logic
- content data should be separated from rendering when practical
- utility functions should live outside components
- forms should separate validation/schema/config from UI where possible
- page layout structure should not be tightly coupled to low-level primitives

Prefer this mental model:

- pages compose sections
- sections compose reusable components
- reusable components compose primitives

---

### 4) Optimise for maintainability over cleverness

Use simple, readable solutions.

Prefer:

- explicit code
- clear naming
- predictable structure
- straightforward data flow
- minimal hidden magic

Avoid:

- clever abstractions
- deeply nested conditional JSX
- over-engineered hooks
- unnecessary state
- unnecessary custom patterns when standard React/Next.js patterns work well

The next developer should be able to understand the code quickly.

---

### 5) Minimise tech debt at every step

Every change should leave the codebase in a healthy state.

Always:

- remove dead code
- avoid duplication
- keep imports clean
- avoid unused props
- avoid placeholder code unless explicitly requested
- avoid temporary patterns that will clearly need rework
- prefer final-quality structure even in early implementation

When adding new code, ask:

- is this reusable?
- is this the simplest clean solution?
- will this be easy to extend later?
- does this introduce avoidable debt?

If something feels like a shortcut that will create problems later, do not do it.

---

## UI and Design Rules

### 6) Treat `Mockup.webp` as the design source of truth

When building UI:

- inspect `Mockup.webp`
- match spacing, alignment, hierarchy, and visual density closely
- preserve the design feel
- keep layouts clean and modern
- maintain consistent padding and section rhythm
- ensure desktop and mobile versions still feel intentional

Do not produce generic default Tailwind-looking layouts if the mockup is more refined.

Pay close attention to:

- hero structure
- card radius
- border usage
- section spacing
- typography scale
- whitespace balance
- CTA prominence
- grid consistency
- image/content proportions

---

### 7) Build polished responsive layouts

The site must look intentional across breakpoints.

Requirements:

- mobile-first but polished on desktop
- no broken spacing
- no cramped sections
- no awkward stretched layouts
- no inconsistent stacking
- no overflowing text or cards
- no fragile spacing hacks

Use consistent container widths and spacing scales.

---

### 8) Maintain strong visual consistency

Use a consistent design system approach even if lightweight.

Be consistent with:

- spacing
- border radius
- shadows
- typography sizes
- font weights
- button styles
- card patterns
- section padding
- icon sizing
- colour application

Do not invent a new visual style in each section.

---

## Next.js / React Standards

### 9) Use App Router best practices

Follow modern Next.js conventions.

Prefer:

- server components by default
- client components only where needed
- minimal client-side JavaScript
- proper route structure
- metadata handling for SEO
- good loading and error states where appropriate

Do not mark components with `"use client"` unless required.

---

### 10) Prefer composition over monoliths

Pages should mostly compose sections and shared components.

Example shape:

- `app/page.tsx` should assemble the homepage
- homepage sections should live in a feature or section folder
- reusable UI should live in shared component folders

Do not dump the entire homepage into one file unless explicitly instructed.

---

### 11) Keep state minimal

Avoid unnecessary client state.

Prefer:

- static/server-rendered content where possible
- derived values instead of extra state
- simple controlled forms only where needed
- local state only when there is a real interaction need

Do not introduce state management libraries unless explicitly needed.

---

### 12) Write clean props and component APIs

Component APIs should be simple and predictable.

Prefer:

- descriptive prop names
- small prop surfaces
- sensible defaults
- typed props
- composition via `children` when appropriate

Avoid:

- bloated prop objects
- confusing boolean combinations
- overly generic APIs
- prop drilling when easy composition solves it

---

## Styling Standards

### 13) Keep styling tidy and scalable

Assume Tailwind is available.

Rules:

- use utility classes cleanly
- group related classes logically
- avoid noisy class strings when extraction would improve clarity
- extract repeated style patterns into reusable components or helper patterns
- keep spacing consistent across sections

If a class list becomes hard to scan, consider extracting the component.

---

### 14) Do not hardcode messy one-off UI everywhere

If a pattern appears across multiple sections, make it reusable.

Examples:

- section heading blocks
- CTA cards
- icon feature items
- blog preview cards
- form row layouts

---

## SEO / Marketing Site Standards

### 15) Build for SEO from the start

This is a marketing site, so SEO matters.

Always consider:

- semantic HTML
- proper heading hierarchy
- metadata
- internal linking opportunities
- clean readable markup
- good performance
- image optimisation
- accessible structure

Do not sacrifice semantic quality for visual shortcuts.

---

### 16) Lead generation UX should be clean and conversion-focused

Forms and CTAs should feel intentional.

Prefer:

- clear headings
- short supporting text
- minimal friction
- obvious submit actions
- clean field layouts
- success/error handling
- reusable form components

---

## Accessibility Standards

### 17) Accessibility is required, not optional

Always build accessible UI.

Requirements:

- semantic HTML
- proper labels for inputs
- keyboard-accessible interactions
- sufficient contrast
- correct heading order
- alt text where needed
- buttons for actions, links for navigation

Do not use inaccessible div soup when semantic elements fit better.

---

## Git Workflow

### 18) Always work in small, focused branches

Every piece of work starts from `main` and lives on its own branch. Never mix unrelated changes on the same branch.

**Branch lifecycle — follow this order every time:**

1. Pull latest `main`
2. Create a branch scoped to the work: `feat/`, `fix/`, `chore/`, `refactor/`
3. Do only work that belongs to that branch — nothing else
4. When the sprint/task is done: push, raise a PR, merge to `main`
5. Delete the branch, pull `main`, repeat

**Branch naming:**

```
feat/hero-spotlight-card
fix/glow-card-event-listeners
chore/remove-unused-folders
refactor/globals-css-cleanup
```

**PR rules:**

- One concern per PR — no bundling unrelated changes
- PR title must describe exactly what changed and why
- Keep diffs small and reviewable — if a PR is getting large, split it
- Never push directly to `main`

**What breaks this rule (never do):**

- Fixing a bug while adding a feature on the same branch
- Committing style cleanup alongside a new component
- Leaving a branch open across multiple unrelated sprints
- Raising a PR with "misc fixes" or vague titles

---

## Folder / Structure Expectations

### 19) Organise by responsibility

Prefer a structure similar to this unless the project already defines another pattern:

```txt
app/
  page.tsx
  blog/
  contact/
  layout.tsx

components/
  ui/
  layout/
  sections/
  forms/

lib/
  utils/
  constants/
  content/
  seo/

public/
  Mockup.webp
```
