# Stagg Homes Cinematic Preview Design

**Status:** Implemented

## Problem

Stagg Homes has an existing private prospect preview, but its static hero does
not communicate the care, confidence and ease an owner-led estate agency can
offer in the first seconds of a visit.

## Goals

- Upgrade `/preview/stagg-homes` with a 15-second Higgsfield property
  walkthrough at 1080p.
- Use the recovered Stagg Homes logo as an interface asset rather than
  embedding it in generated footage.
- Make the visual story scroll-linked on capable, motion-enabled desktop
  devices.
- Present supported company strengths: independent owner-led service, one
  clear point of contact and Kent market knowledge.
- Retain the existing disclosed, non-operational property-brief demonstration
  and its valuation action.

## Non-goals

- No alteration to the public Stagg Homes site, live enquiries, CRM submission
  or data collection.
- No invented awards, property listings, performance claims or testimonials.
- No Apple branding or imitation. The direction adopts calm hierarchy, clarity,
  craft and restrained feedback.

## Experience

The opening scene is a quiet approach to a refined Kent family home at golden
hour. As the visitor scrolls, the camera progresses through the entrance and
resolves in a warm living space overlooking the garden. The hero uses three
copy beats:

1. `A move deserves more than a transaction.`
2. `One person. Clear advice. Every step.`
3. `A considered way home.`

The original Stagg Homes mark sits in the header alongside the sole primary
action, `Request a valuation`. A secondary in-scene action, `Prepare your next
step`, leads to the existing private property brief.

## Media contract

- Model: MiniMax H3 through Higgsfield.
- Source: 15 seconds, 16:9, 2K, silent.
- Delivery: 15 seconds, 1920 × 1080 H.264, all-intra frames and fast-start
  metadata for responsive scroll seeking.
- Asset:
  `public/prospect-previews/bespoke/stagg-homes/property-walkthrough-scroll-scrub-v1.mp4`.
- Poster: the existing `hero-v1.png` remains a usable fallback if the video
  cannot load or motion is reduced.
- The generated video has no typography, logo, people, dialogue or music. It
  is a non-listing concept visual.

## Architecture

- Extract a focused client `StaggHomesCinematicHero` for scroll-to-video
  synchronisation and cinematic copy.
- Keep the server-rendered page focused on the hero, three supported service
  strengths and the existing disclosed property brief.
- Add a rendering test for the concept marker, MP4 source, static poster, no
  autoplay and the valuation path.
- Use `requestAnimationFrame` to coalesce scroll work. Do not add an animation
  dependency.

## Accessibility and fallback

- The video remains muted and `playsInline`; it never autoplays with sound.
- Users with `prefers-reduced-motion`, and narrow viewports, receive the static
  poster and readable lead copy without scroll seeking.
- The hero retains a semantic heading, focus-visible actions and an assistive
  description of the visual story.
- The static property-brief section remains available if scripting or video
  metadata fails.

## Verification

- The final media asset is verified as 16:9, exactly 15 seconds and 1080p.
- Focused tests prove the video, poster fallback, non-autoplay and primary
  enquiry route.
- Type checking, focused linting, targeted tests and a production Webpack
  build pass.
- Internal-browser scroll checks confirm exact video-time synchronisation at
  seven positions, without console errors.
