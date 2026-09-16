# FSS Studio — interactive design review

**Status: design approved by Jean-Fidele on 16 September 2026 for the local project handoff. Production implementation is a separate step.**

Open **index.html** in a browser. It is self-contained: no installation, account, internet connection or server is required to view it. The preview also runs in the open Codex browser tab.

## What changed

Real HTML, CSS and React replace the full-screen SVG drawings. Text can reflow, forms can receive focus, menus open, and the board supports interaction. Lucide supplies consistent vector icons; SVG is used for individual icons only.

The revised direction uses your FSS logo, navy and teal palette, cool neutral lanes, white cards and navy navigation. Geist is the main typeface, with Sora for selected headings and IBM Plex Mono for supporting labels and references. This is an FSS responsive web interpretation informed by the Apple design skill, rather than an imitation of a native Apple application.

## Start here

| View | Screen | What to review |
| --- | --- | --- |
| Client home | C01 | Priorities, project progress, review preview and next steps |
| Welcome checklist | C02 | Concrete tasks, progress and clear next action |
| Client request board | C05 | Card hierarchy, filters, list view, creation and review |
| Deliverable review | C09 | Version-specific confirmation and change requests |
| Founder delivery | F05 | Drag the grip on a movable card, then confirm the next stage |
| Agreement builder | F10–F15 | Named engagement choices, guided steps and document verification |
| Welcome builder | F19–F23 | Content, people, schedule and activation review |

Use **Client / Founder**, **Mobile preview**, or **Screen library** in the review toolbar. The library includes **86 screen references**. Login and expired-login/invite screens are excluded, as requested.

## Interactive scope

- Create a request or bug report in memory; required fields validate before submission.
- Search, filter, sort and switch board/list view.
- Drag the grip on a movable card into an allowed lane, or click **Move to**. Both open the same confirmation flow.
- Publish a review as the founder; accept a version or request changes as the client.
- Generate an in-app notification and inspect an email preview after review/completion events. **No email is sent.**
- Open request details, add local comments, navigate the screen library and open mobile navigation.
- Edit wizard text/select fields; values remain while navigating during this page session.

Request changes reset on reload. File selection shows names locally; files are not uploaded or retained. Signature, billing, invitation, agreement generation and journey activation screens are visual handoff references, not connected production services. Actions without a simulated flow explicitly identify themselves as visual references. Example deliverable previews are illustrative, not uploaded project assets.

## Files in this handoff

- `index.html`: approved standalone prototype. Open directly in a browser.
- `BRAND-GUIDE.md`: colours, typography, logo treatment and verification.
- `REVIEW-NOTES.md`: interactions, coverage and limitations.
- `APPROVAL.md`: approval record, implementation authority and next steps.
- `specification/`: product plan, workflow contracts and screen contracts.
- `assets/` and `licenses/`: supplied branding, embedded fonts and licences.
- `prototype-source.zip`: complete editable source, build configuration and workflow tests.
- `handoff-manifest.json`: file hashes for checking package integrity.

Extract the source archive outside the application checkout when editing the prototype. Then install its dependencies and run `npm run typecheck`, `npm test`, `npm run format:check` and `npm run build`. This isolates the prototype from the application's TypeScript and test discovery. No application dependencies have been changed.

## Approved handoff

The approved design belongs in:

`/Users/JeanFidele/The Nexus Ecosystem/Projects/fss-site/docs/design/studio-experience/`

The `specification/` folder includes the existing product specification and workflow/screen contracts. The new visual rules supersede the old SVG layout/colour guidance; the domain and security contracts still apply. Do not treat prototype state or role switching as production authentication or storage.

The application source has not been changed as part of this review package.
