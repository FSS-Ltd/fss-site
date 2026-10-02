# AI Prompts for Plumbers landing page

Status: Implemented locally on 2026-10-02. Production release pending review.

## Purpose

Give plumbing business owners a clear way to inspect and download the six-page prompt kit while recording a resource lead. The form requests first name, last name, business name and email. Newsletter consent is separate, optional and unchecked by default.

## Design and implementation

- The new resource uses the existing MDX resource catalog, public PDF delivery, SEO metadata and thank-you route.
- Its resource slug selects a focused landing and thank-you presentation. Other resource pages keep their current presentation.
- The compact lead form uses the existing `/api/lead` contract, lead persistence, audit event and consent recording. No database or provider change is needed.
- The PDF is copied without modification. The cover preview is rendered from its first page. The page pairs FSS colours with restrained rust accents from the guide.
- Successful persistence leads to the thank-you route and immediate PDF download. A failed submission keeps the entered values for retry. The public PDF URL follows the site's existing resource model; it is not an access-controlled file.

## Verification and release

- TypeScript, scoped lint and formatting, lead and consent unit tests, desktop/mobile browser flows, and the production build pass.
- The local public-site crawl passed the new resource checks, then stopped at `/growth` because the local production server lacked Growth OS credentials. Direct production-build requests confirmed both new routes and the PDF bytes.
- Browser requests to `/api/lead` are mocked in tests. No live lead, newsletter subscription or provider message was created.
- Release through the existing site deployment process after review. Rollback removes this resource's content and assets and its two slug-specific render branches; existing lead storage needs no migration.
