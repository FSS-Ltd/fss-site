# Design approval and handoff

Approved by: Jean-Fidele
Date: 16 September 2026
Evidence: “approved” in this task, following review of the FSS-branded prototype.

## Approved scope

86 client, founder, mobile and shared-state screen references; FSS navy/teal branding; Geist, Sora and IBM Plex Mono; interactive request-board demonstration; agreement and welcome-journey designs; accompanying product, workflow and screen contracts. Login screens are excluded.

## Implementation authority

Use `index.html` and `BRAND-GUIDE.md` for the approved appearance. Use the workflow and screen contracts in `specification/` for intended behaviour. Older SVG and visual-system instructions are historical where they conflict with this approved revision.

The prototype uses example data and simulated actions. This approval authorises the design handoff into the local repository. It does not mean backend integration, production notifications, deployment or live transactions have been implemented.

## Package arrangement

The repository contains the standalone HTML, guides, specifications, original artwork, font assets and licences. `prototype-source.zip` contains the full editable React/TypeScript authoring project. Extract that archive outside the application checkout to edit or rebuild it; this keeps prototype source and tests out of the main application's TypeScript and test discovery.
