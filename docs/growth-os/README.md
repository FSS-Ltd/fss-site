# FSS Growth OS Planning Pack

Status: Production core verified; provider automations remain founder-gated
Owner: Jean-Fidele Ntagengwa
Planning date: 16 August 2026
Runtime source of truth: Supabase PostgreSQL
Application host: Vercel Pro

## Purpose

This folder is the implementation and operating handoff for FSS Growth OS. It records the approved product decisions, system boundaries, data model, email rules, screen direction, step-by-step implementation sequence, and release audit.

## Fixed Decisions

- The dashboard is founder-only and restricted to `j.ntagengwa@faithfulsoftware.dev`.
- PostgreSQL is the runtime source of truth. Notion is planning and task context only.
- Vercel is the sole application host. Production changes require a reviewed preview and Jean-Fidele's explicit approval.
- A weekday Codex scheduled task performs prospect research, analysis, first-email drafting, and visual preparation at 06:00 Europe/London.
- The MVP does not call an OpenAI or GPT API. Paid AI APIs require a separate decision after FSS reaches GBP 5,000 MRR.
- Gmail sends cold outreach and keeps replies in the founder's Google Workspace mailbox.
- Resend sends requested site emails, opt-in messages, and newsletters. It does not send cold outreach.
- A completed client engagement creates a founder-reviewed Resend thank-you with an optional, separate FSS Field Notes opt-in.
- Every first cold email requires founder approval.
- Follow-ups are versioned templates sent on Days 5, 11, and 20 in the original Gmail thread.
- A reply, opt-out, bounce, rejection, started-talks state, or manual pause stops every remaining follow-up.
- Cold outreach is text-first with one lightweight, prospect-specific generated visual in the first email. Follow-ups remain text-first.
- Resend emails use complete FSS marketing copy and richer generated editorial imagery.

## Documents

- [Approved design specification](../superpowers/specs/2026-08-16-fss-growth-os-design.md)
- [Data model, API, and security contract](data-api-security.md)
- [Email copy and generated-image standard](email-content-and-image-standard.md)
- [Master implementation sequence](../superpowers/plans/2026-08-16-fss-growth-os-00-master.md)
- [Foundation, database, and founder authentication](../superpowers/plans/2026-08-16-fss-growth-os-01-foundation.md)
- [Scheduled Codex research and ingestion](../superpowers/plans/2026-08-16-fss-growth-os-02-research-ingestion.md)
- [Gmail outreach and reply stopping](../superpowers/plans/2026-08-16-fss-growth-os-03-gmail-outreach.md)
- [Resend site emails and newsletter](../superpowers/plans/2026-08-16-fss-growth-os-04-resend-marketing.md)
- [Founder dashboard](../superpowers/plans/2026-08-16-fss-growth-os-05-dashboard.md)
- [Pipeline, deals, clients, and delivery](../superpowers/plans/2026-08-16-fss-growth-os-06-pipeline-delivery.md)
- [Vercel migration, operations, and release](../superpowers/plans/2026-08-16-fss-growth-os-07-release.md)
- [Production implementation and FSS standards audit](audit-2026-08-26.md)

## Approved Mockups

| Screen                                                         | Desktop                                              | Mobile                                             |
| -------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Growth dashboard                                               | [Desktop](mockups/01-growth-dashboard-desktop.png)   | [Mobile](mockups/01-growth-dashboard-mobile.png)   |
| Prospect list                                                  | [Desktop](mockups/02-prospect-list-desktop.png)      | Responsive rules are in the dashboard plan         |
| Prospect detail                                                | [Desktop](mockups/03-prospect-detail-desktop.png)    | Responsive rules are in the dashboard plan         |
| First email review, revised with full copy and generated image | [Desktop](mockups/04-first-email-review-desktop.png) | [Mobile](mockups/04-first-email-review-mobile.png) |
| Outreach timeline                                              | [Desktop](mockups/05-outreach-timeline-desktop.png)  | Responsive rules are in the dashboard plan         |
| Website strategy                                               | [Desktop](mockups/06-website-strategy-desktop.png)   | Responsive rules are in the dashboard plan         |
| 3D hero concept                                                | [Desktop](mockups/07-3d-hero-concept-desktop.png)    | Mobile fallback is specified in the design         |
| Newsletter review                                              | [Desktop](mockups/08-newsletter-review-desktop.png)  | Email output is responsive by template             |
| Site email review                                              | [Desktop](mockups/09-site-email-review-desktop.png)  | Email output is responsive by template             |

Generated review assets are under [`mockups/email-assets/`](mockups/email-assets/). They are visual references, not production-optimised files.

## Execution Order

1. Merge this planning pull request.
2. Switch to the lower-cost execution model.
3. Execute plan 01 and stop for review.
4. Execute plans 02 through 06 one at a time, with a test and review gate after each plan.
5. Execute plan 07 only after all functional plans pass.
6. Verify the Vercel preview and provider health checks.
7. Obtain explicit founder approval before production promotion or a domain change.

## Release Gates

- No secret is committed to Git.
- No database table is exposed to the browser or Supabase Data API.
- No Gmail send occurs without a founder-approved first message or an already-approved follow-up template snapshot.
- No Resend send targets an unconsented cold prospect.
- No generated image fabricates a prospect's staff, premises, reviews, testimonials, or results.
- No production deployment or domain change occurs without explicit human approval.
