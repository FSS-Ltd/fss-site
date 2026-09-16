# FSS identity — 16 September 2026

## Direction

The supplied FSS artwork now defines the interface. Navy provides structure, teal highlights action and review, and cool white surfaces give the work room to breathe. This responsive web adaptation follows the Apple design skill’s principles of restrained branding, legible typography and familiar controls. The tokens below are FSS choices, not claimed native Apple specifications.

## Colours

| Token | Value | Purpose |
| --- | --- | --- |
| Brand navy | `#000F28` | Navigation rail, selected project tab, strong actions and hero surface |
| Brand teal | `#008498` | Sampled logo accent |
| Action teal | `#007B8E` | Darker UI derivative for readable white button text |
| Deep teal | `#005E70` | Hover states and links |
| Ink | `#10223B` | Main text |
| Secondary | `#526477` | Supporting text |
| Canvas | `#F7F9FC` | Workspace |
| Surface | `#FFFFFF` | Cards and documents |
| Border | `#E1E7EE` | Separators and boundaries |

Navy and brand teal are approximate dominant pixel samples from the supplied colour wordmark. The PNG includes neighbouring shades and antialiasing; these are not verified vector-master colour values.

To do uses slate, In progress uses blue-grey, In review uses a teal tint and Completed uses neutral teal-grey. Exact workflow labels remain visible. Error and warning colours remain semantic feedback rather than decoration.

## Typography

| Typeface | Role | Weights |
| --- | --- | --- |
| Geist | Body, forms, buttons, cards, navigation and ordinary headings | 400–700 |
| Sora | Page titles and selected feature/welcome headings | 600 |
| IBM Plex Mono | Eyebrows, request IDs, counts, document labels and review references | 400–500 |

Use Geist by default. Sora marks the hierarchy; Mono is for short supporting details rather than paragraphs or form labels. Four font files are embedded in the HTML: two variable families and two Mono weights. Opening the prototype makes no external font requests.

Source fonts and SIL Open Font licences are included, downloaded from the official Google Fonts repository:

- [Geist](https://github.com/google/fonts/tree/main/ofl/geist)
- [IBM Plex Mono](https://github.com/google/fonts/tree/main/ofl/ibmplexmono)
- [Sora](https://github.com/google/fonts/tree/main/ofl/sora)

## Logo and components

The original PNGs are unmodified in `assets/brand/`. The compact icon appears in desktop navigation and the mobile header. The colour wordmark replaces the improvised text logo in document and email previews. The full company lockup is retained as a handoff asset. CSS frames remove surrounding whitespace without changing source artwork or logo proportions.

- Navigation: navy with a teal selected state and visible side marker.
- Primary actions: navy or teal with white text, 44 px minimum height and 12 px corners.
- Cards: white, cool borders, restrained shadows and 13–18 px corners.
- Board: subtle cool tints with stronger teal emphasis for review.
- Focus: visible outlines; Move to remains an alternative to dragging.
- Mobile: compact branded header, stacked content and bottom navigation.
- Hero panels: navy, white headings and light supporting copy.

## Contrast checks

| Pair | Text | Background | Contrast |
| --- | --- | --- | --- |
| Body | `#10223b` | `#f7f9fc` | 15.15:1 |
| Secondary | `#526477` | `#f7f9fc` | 5.77:1 |
| Action | `#ffffff` | `#007b8e` | 4.97:1 |
| Navy button | `#ffffff` | `#000f28` | 19.11:1 |
| Rail active | `#70d9e3` | `#163a4e` | 7.27:1 |
| Hero supporting text | `#b4c5d8` | `#000f28` | 10.85:1 |

These principal pairings passed 4.5:1. This is not a full accessibility certification; production must check all controls, focus states, semantic colours, zoom and devices.

## Verification and status

TypeScript, build, formatting and four workflow tests passed. All 86 screen references passed the 320 px page-width and named-button checks. Desktop inspection covered the board, client home, billing and agreement document; the agreement builder was also inspected at 390 px. The browser’s computed styles show Geist, Sora and IBM Plex Mono in their intended roles. Embedded font headers and logo loading were checked. No browser warnings or errors were reported.

Asset hashes are retained in `assets/manifest.json` for file verification; they do not belong in client-facing text inputs. Login screens remain excluded. This is a design-artifact update; the production application remains unchanged. Jean-Fidele approved this visual direction on 16 September 2026 for copying into the requested FSS project.
