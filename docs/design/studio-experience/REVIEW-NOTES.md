# Design review and implementation notes

**16 September brand update:** [BRAND-GUIDE.md](BRAND-GUIDE.md) defines the current identity and supersedes the original mint/pastel reference direction.

## Design basis

Applied the requested [Apple design skill](/Users/JeanFidele/.codex/skills/apple-design-skill/SKILL.md) and supporting [Apple-inspired product design skill](/Users/JeanFidele/.codex/skills/apple-inspired-product-design/SKILL.md). Local HIG references informed layout, buttons, typography, accessibility, drag and drop, icons, materials, motion and sidebars.

Applied principles: clear hierarchy, recognisable actions, consistent icon weight, calm content surfaces, contextual feedback, labelled controls, visible focus and an alternative to gestures. Solid cards preserve legibility. Translucency is confined to supporting chrome and dialog backdrops. Reduced-motion styling respects the browser preference.

All numeric spacing, colours, radii and web breakpoints are FSS design choices, not claimed Apple requirements. User-supplied screenshots informed the composition; their text was reference content, not task instructions.

## Layout contract

- Geist for the interface, Sora for selected headings and IBM Plex Mono for short supporting labels. All are embedded.
- Navy `#000F28`, logo teal `#008498`, action teal `#007B8E`, ink `#10223B`, secondary `#526477`, canvas `#F7F9FC`.
- White, rounded content cards on a lightly tinted canvas. Coloured lanes group work; exact state text remains visible on each card.
- Desktop icon rail has labels through accessible names/tooltips; mobile has named navigation and a More menu.
- Review chrome (role switch, screen library and phone preview) belongs to this design artifact, not the shipped product.
- The board scrolls horizontally at intermediate widths and stacks lanes on mobile. Forms and content collapse into a single column; the overall page stays within the viewport.

## Four lanes, seven workflow states

| Lane | Exact states | Role rules |
| --- | --- | --- |
| To do | New, Acknowledged, Planned | Founder acknowledges and plans through Move to |
| In progress | In progress, Changes requested | Founder starts/revises work |
| In review | Ready for review | Founder publishes a retained version with reviewer and summary |
| Completed | Done | Client accepts the reviewed version |

The visual grouping must not flatten the underlying workflow. A founder cannot accept on a client’s behalf. A client can decide on a published review, not arbitrarily change internal production stages. Dragging is restricted to allowed transitions and opens confirmation. Invalid drops do nothing; keyboard users use Move to.

Checklist progress uses completed/total items, not invented estimates of implementation completeness. Confirmation records in the production application must identify the actual review cycle, retained deliverable version, actor and timestamp.

## Agreements and welcome journeys

Agreement references use human-readable engagement names and contextual descriptions. Source fingerprints belong to automatically generated document verification metadata, never an unexplained text input. A missing eligible engagement must present a useful empty state and recovery action. Production submission must still enforce the underlying agreement/domain checks.

Welcome content, recipients, schedule and activation each have a defined screen. Activation requires a review summary and validation; production should connect these screens to the existing durable welcome scheduler rather than introduce a second scheduling system.

## Coverage and limits

86 screen references are available through the catalog: client, founder, mobile and shared states. C00 and S05 from the original 88-screen manifest are excluded because authentication already exists. Core screens have specialised layouts; secondary screens use shared semantic card, table, form, document and timeline components. This avoids both screenshot-only wireframes and a separate implementation for every visual variant.

The prototype demonstrates key request interactions. It does not implement backend delivery, agreement generation, signature collection, permission enforcement, real welcome activation, uploads or billing. It is not a production patch. The existing full product/delivery specification, workflow contracts and screen contracts remain the implementation specification; this package replaces the previous visual approach.

## Verification

- Strict TypeScript check.
- Production HTML/CSS/JavaScript bundle build.
- Formatting check for source and build configuration.
- Workflow tests: every state belongs to one lane; client decisions are review-only; founder cannot mark Done; founder progression preserves required stages.
- Browser: new request creation; founder publish review; pointer grip drag to review followed by confirmation; client version acceptance; in-app notification and email preview; agreement builder and welcome checklist; mobile navigation.
- All 86 screen references rendered at 320 px with no page overflow and no unnamed visible buttons. Also inspected desktop and 390 px layouts.

This is a focused interaction/layout review, not a WCAG certification or full browser/device test matrix. Production accessibility, real touch devices, network failures, concurrency, tenant boundaries and notification delivery require application-level testing during implementation.

## Production acceptance gates

1. Completed: Jean-Fidele approved the design direction on 16 September 2026 for the local project handoff.
2. Implement against the repository’s current components, auth and domain services; do not paste the demo state model into production.
3. Cover tenant isolation, version-conflict recovery, failed notification retries, expired review access, empty engagement recovery and durable journey activation.
4. Validate keyboard flow, contrast, zoom, reduced motion and real mobile drag/scroll behaviour.
5. Run repository type, lint, unit, integration and end-to-end checks for the eventual application changes.
