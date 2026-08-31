# Kemsing Motor Company prospect concept

**Owner:** Technical Agent  
**Status:** Implemented and locally verified  
**Created:** 2026-08-30  
**Last updated:** 2026-08-31  
**Related:** `lib/growth/prospect-previews/compositions/generated/kemsing-motor-company.ts`

## Problem

Kemsing Motor Company has broad workshop capability, but its public site makes a visitor work to discover the right service and does not begin an enquiry with the vehicle context the team needs. The prospect preview should demonstrate a more focused first action without representing itself as a live booking system.

## Goals

- Build a private, no-index bespoke prospect page at `/preview/kemsing-motor-company`.
- Present the company as the public trading brand for London Road Service Station Limited.
- Make the lead visual a scroll-linked cinematic assembly of a single vehicle.
- Start the demonstration enquiry with vehicle registration, service, timing and contact details.
- Ground claims in the researcher composition and the company’s public service pages.
- Use the public logo source when it can be recovered at production quality, with an accessible text mark as the safe fallback.

## Non-goals

- No live booking, registration lookup, payment, CRM integration, or customer-data submission.
- No invented reviews, performance figures, warranty terms, or unsupported claims.
- No attempt to publish or alter the company’s public website.

## Experience

### Visual direction: Precision, reassembled

The page uses a deep royal blue derived from the researcher’s brand-colour evidence (`#243A7A`), near-black workshop space, brushed-metal neutrals, and a restrained amber task-light accent. It should feel engineered and calm rather than like a performance-car campaign.

The hero begins with the same graphite-blue contemporary vehicle separated into cleanly spaced mechanical and body components. As the visitor scrolls, the image sequence resolves into the complete car from the identical camera position in the same workshop. Copy shifts through three beats:

1. `Every detail has a place.`
2. `MOT, diagnostics, service or repair.`
3. `Start with the vehicle. Finish with confidence.`

The hero is a native muted `<video>` with poster. It is scroll-linked only for people who have not requested reduced motion. The delivered scroll asset is all-intra H.264, so every 24 fps frame is directly seekable. A static, complete-car poster remains usable if video metadata or playback is unavailable.

### Page sections

1. Hero and a clear `Prepare your vehicle request` action.
2. Four capability routes: MOT and servicing, diagnostics, precision care (alignment, air conditioning, tyres), and modern systems (EV/hybrid and ADAS calibration).
3. A short proof section: independent Kemsing workshop, continued investment in equipment and staff training, named Master Tech capability. Claims will remain constrained to public evidence.
4. The private demonstration enquiry, collecting only registration, selected service, timing, and contact details.
5. Location, opening-hours and direct contact details from the official site.
6. FSS concept invitation, explicitly labelled as private and non-operational.

## Media and Higgsfield handoff

Two project-bound source images will be generated with a locked visual contract: same graphite-blue five-door hatchback, camera position, focal length, vehicle pose, workshop bay, lighting, floor markings and no people or text.

- **Frame A:** exploded view with recognisable exterior and mechanical components floating in organised layers; complete chassis retained at centre.
- **Frame B:** exact same scene and car, fully assembled, clean and road-ready.

The Higgsfield handoff prompt will instruct a 6–8 second 16:9 cinematic morph from Frame A to Frame B: components draw inward and lock into place in physically plausible order, restrained blue workshop light, no cuts, no camera change, no text, no logos and no extra objects. The generated MP4 is expected at `public/prospect-previews/bespoke/kemsing-motor-company/vehicle-reassembly-scroll-scrub-v1.mp4`, with Frame B as its poster. Higgsfield is not connected to this workspace, so submission is a user handoff; the page will tolerate the asset being absent during development and use the complete-car poster.

## Architecture

- Add a dedicated `KemsingMotorCompanyPage` prospect component and a focused client hero component responsible only for scroll/video synchronisation.
- Add the page to the bespoke registry and adjust its static-page test count.
- Use local public assets only. Do not permit new remote image domains.
- Keep shared components (`ConceptBar`, `DemoEnquiry`, `RevealOnScroll`) unchanged unless an actual gap blocks this page.
- Add rendering tests that prove the private-page marker, video/poster fallback, no autoplay, primary service routes, and vehicle-registration first step.

## Accessibility and failure handling

- Use a semantic heading, navigable link/button targets, visual focus styles and a text description of the visual story.
- Do not autoplay audio. The hero video is muted and `playsInline`.
- Reduced-motion users receive the poster and readable hero copy without scroll-scrub effects.
- If no Higgsfield output has been supplied, frame B remains the hero poster and the page should not display a broken media control.

## Source evidence

- Research composition: `kemsing-motor-company.ts` establishes the vehicle-request goal and royal-blue colour evidence.
- The official site states MOT, servicing, diagnostics and repairs for all makes, as well as Master Tech expertise: <https://www.kemsingmotorco.co.uk/>.
- The official general-services page supports Class 4 MOT, all-makes servicing, tyres and mechanical repairs: <https://www.kemsingmotorco.co.uk/general-services>.
- The specialist-services page supports diagnostics, alignment, air conditioning, EV/hybrid repair and calibration capability: <https://www.kemsingmotorco.co.uk/specialised-services>.
- The official company page provides the location, contact details and opening hours: <https://www.kemsingmotorco.co.uk/about-us>.

## Success criteria

- Two source images are present under the Kemsing public asset directory and visibly match.
- A Higgsfield-ready prompt and expected video path are documented.
- The bespoke route renders the brand, service evidence, private demo flow and complete fallback poster.
- Supplying the MP4 at the documented path enables the scroll-linked hero without code changes.
- Focused unit tests, lint, typecheck and the production build pass.
