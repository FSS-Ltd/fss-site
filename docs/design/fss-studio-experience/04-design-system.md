# FSS design system and interaction specification

## Platform and intent

Responsive web for desktop browsers, tablets and phones. The design uses Apple HIG principles for clarity, familiarity, hierarchy and feedback while retaining FSS identity. It does not claim native Apple-platform conformance or copy macOS window chrome.

The Figma reference file contains native components and the initial key screens. The full local SVG atlas is the comprehensive visual handoff while Figma connector capacity is exhausted. SVG text references Geist; the local PNG previews use the installed Geist font. Imported SVGs are editable vector artwork, but do not preserve Figma auto-layout or component instances.

## Navigation and composition

**Client desktop:** 232 px persistent sidebar; organisation switcher; Home, Getting started, Projects, Requests, Documents, Agreements, Billing, Services, Notifications, Help, Settings. Role-based navigation hides unavailable modules; the server still enforces permissions. Getting started moves to a secondary position after completion.

**Founder desktop:** Overview, Clients, Delivery, Agreements, Welcome journeys, Projects, Billing, Portal access, Notifications, Settings. Client detail acts as the context hub. The existing Growth workspace remains reachable outside this operations navigation.

**Mobile:** 390 px design reference; test 320/375/390/768 px. Stable Home, Projects, Requests and More navigation; More exposes the other authorised modules. Founder mobile uses equivalent short labels and a More menu. Never shrink a six-column board to fit a phone. Use list cards with state and Move to/Review actions.

Desktop design width is 1440 px, with 1680 px references for the full six-column board. On a 1440 px implementation viewport, board columns keep a usable minimum width and scroll horizontally within the board, not across the page.

## Tokens

These are FSS web design choices, not numeric CSS requirements taken from HIG.

| Token | Value | Use |
|---|---|---|
| Canvas | #F2F3F5 | Page background |
| Surface | #FFFFFF | Cards, documents, fields |
| Soft surface | #F7F8F9 | Sidebar and secondary grouping |
| Ink | #0A1A2E | Primary text |
| Muted text | #46566C | Secondary copy |
| Accent | #0F7078 | Primary controls and selected navigation |
| Accent tint | #E3F2F1 | Selected backgrounds and calm notices |
| Navy | #07182E | Priority/next-action feature card |
| Border | #D9DFE5 | Decorative surface separation |
| Control boundary | #788696 | Input, checkbox and secondary-button outlines |
| Success | #226143 on #EAF5ED | Completed state with text/icon |
| Warning | #805300 on #FFF4DF | Actionable holds |
| Error | #A52D37 | Field and submission errors |

Use the existing brighter brand teal as a brand/accent asset where appropriate; the darker action teal improves white-label contrast. Do not use colour alone for status.

Typography: Geist 400/500/600/700, with existing system fallback. Desktop display 40/48, page title 36/52 (30/44 mobile), section 20/29, body 16/23, label 14/20, metadata 12/17. Allow wrapping rather than fixed-height text clipping. Explicitly load the intended production font; naming it in a fallback stack alone does not guarantee it is available.

Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px. Page padding 40–48 desktop, 24 tablet, 20 mobile. Card padding 24 desktop and 20 mobile. Radii 8 fields, 12 controls, 16 cards, 24 large feature surfaces.

## Component anatomy and states

### Button

Base HIG reference: Buttons. Label names the action; icon may support the label; clear filled or outlined hit region. Primary uses teal/white; secondary uses white/ink/border; destructive uses a specific warning treatment.

States: default, hover, pressed, focus-visible, loading, disabled, success where useful. Minimum FSS target is 44×44 CSS px, an intentional web adaptation of Apple's general 44×44 pt button guidance. Hover darkens subtly; pressed darkens further; focus has a 3 px dark-teal outline with 3 px offset. Disabled has readable text and an adjacent reason. Loading keeps the label/width stable and blocks duplicates.

One dominant action per task section. Avoid giving every card a competing primary button. Navigation uses an anchor with the same visual affordance, not a click handler on text.

### Field and selector

Anatomy: persistent label → input → helper or error. White outlined field, 48 px minimum default height, 12 px padding, 8 px radius. Required status must be explicit in the form guidance. Placeholder is an example, never the only label.

Variants: text, multiline, named relationship selector, date, GBP amount, read-only evidence display, attachment upload. Selectors include loading, empty, unavailable, invalid and populated states. Empty dependency selectors include a resolution action.

Error summary focuses the first failing field and links to all marked fields. All field values survive a failed submit. A successful save message must represent a server acknowledgment.

### Request card

Reference + type → title → next action/status → owner/date → activity indicators → Open/Move to/Review. Whole card opens detail; separate controls do not create nested interactive elements. Drag handles appear for permitted actions. Use stable card IDs, keyboard focus and readable state names.

### Review panel

Exact version, outcome, what changed, what to check, reviewer, target and history. Primary acceptance names the version; request changes is equally discoverable but visually secondary. Confirmation is explicit and cannot be triggered by an accidental board drop.

### Journey timeline

Each row contains state icon and text, step name, prerequisite/due time, actual outcome and contextual action. Waiting is not an error. Unknown outcome is visibly distinct from confirmed failure. Show who must act next.

### Notifications

Unread marker + clear event title + project/reference + time + direct action. An action-needed item remains outstanding after being read. Batch ordinary activity; highlight decisions.

### Surfaces

Solid reading surfaces are the default. Subtle depth may distinguish overlays from content. Do not add glass effects behind long documents, dense forms or status text. Modal sheets have a clear title, close/back action, focus trap and restored focus on dismissal.

## Motion and feedback

Suggested timing: 120–160 ms button feedback; 180–220 ms menu/sheet transitions; card movement tied to pointer position. These values are design choices. Respect reduced motion by removing translations, parallax, bounce and decorative effects. No delayed entrance sequence on operational screens.

Use a persistent inline status for important outcomes and polite live announcements for normal saves. Do not make an ephemeral toast the only record of a failed send or completed action.

## Accessibility

Semantic headings, landmarks, labels and form groups; visible focus on every interactive element; keyboard and single-pointer alternatives to drag; 200% zoom; reflow at narrow widths; text contrast of at least 4.5:1 for normal text and 3:1 for qualifying large text; non-text contrast checks for essential control boundaries and states.

The pale separator border is decorative on already-distinct cards. Inputs and secondary controls use the stronger #788696 boundary; focus adds the specified outline. Never rely on the pale separator alone to identify a control. Final rendered contrast still needs checking across every interaction state.

Disabled actions should expose the cause through nearby text. Do not hide help in hover-only tooltips. Status colours always accompany labels or icons. Read-only states must remain useful and navigable.

## HIG grounding

The following local Apple-design skill articles were used:

- [Buttons](/Users/JeanFidele/.codex/skills/apple-design-skill/references/components/menus-and-actions/buttons.md): clear appearance and purpose; press feedback; prominent actions used sparingly.
- [Sidebars](/Users/JeanFidele/.codex/skills/apple-design-skill/references/components/navigation-and-search/sidebars.md): stable navigation and meaningful organisation.
- [Onboarding](/Users/JeanFidele/.codex/skills/apple-design-skill/references/patterns/onboarding.md): help people begin real work with relevant guidance.
- [Drag and drop](/Users/JeanFidele/.codex/skills/apple-design-skill/references/patterns/drag-and-drop.md): show valid destinations and failed-drop feedback.
- [Managing notifications](/Users/JeanFidele/.codex/skills/apple-design-skill/references/patterns/managing-notifications.md): relevance, truthful urgency and controls.
- [Typography](/Users/JeanFidele/.codex/skills/apple-design-skill/references/foundations/typography.md): hierarchy and legibility.
- [Accessibility](/Users/JeanFidele/.codex/skills/apple-design-skill/references/foundations/accessibility.md): alternatives to gestures, labelled status, keyboard access and adequate contrast.
- [Motion](/Users/JeanFidele/.codex/skills/apple-design-skill/references/foundations/motion.md): brief purposeful feedback and reduced motion.

The skill is a static mirror and not an accessibility certification. Final browser and assistive-technology verification remains required.
