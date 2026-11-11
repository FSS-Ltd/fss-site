# Project feature tree

Source-backed baseline, 2026-11-05; public-site section added 2026-11-11. Status describes code present in this checkout, not deployment. This branch starts from `origin/main` at `25da4a2ef`; the original dirty checkout is separate and preserved.

## Coverage and navigation

This is the canonical project inventory. The domain index covers the repository's public site, Growth OS, Operations, and infrastructure. Agreement navigation is mapped in detail below. Other domains are indexed at their entry points; exhaustive subfeature, permission, and test mapping remains **unknown**. Do not treat this baseline as exhaustive.

Graphify: [graph](graphify-out/graph.json), [audit report](graphify-out/GRAPH_REPORT.md). Deterministic extraction covers TypeScript under `components/portal/agreements` and `lib/operations/agreements`, plus the selected notification dispatch, portal auth, routing, and commercial-offer HTTP files in [source-hashes.json](graphify-out/source-hashes.json). On 2026-11-11 a code-only AST update (no LLM, 60 files) merged `lib/seo`, `lib/commercial`, `lib/blog-api`, `lib/blog.ts`, `app/api/blog`, `app/llms.txt`, and `components/seo`, taking the graph from 378 nodes and 471 edges to 524 nodes and 601 edges (126 communities, unlabelled). `source-hashes.json` and `graph.html` were not refreshed by that update. Documentation, styles, `app/sitemap.ts`, `app/robots.ts`, `app/feed.xml`, `lib/server`, `lib/forms`, `components/redesign`, and the rest of the project are outside graph coverage. The installed extractor provides limited TSX symbol extraction; verify component relationships in source.

## Domain index

| ID / purpose                                                                          | Status                                        | Entry points / canonical reuse points                                                                                                                              | Directed connections                                                                                                             | Verification / debugging start                                                                            |
| ------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| SITE: public marketing, services, work, blog, resources                               | implemented                                   | `app/(site)`, `content`, `components/layout/site-header-nav-items.ts`                                                                                              | uses INFRA; used_by public visitors                                                                                              | `tests/integration/public-site-crawl.test.ts`; start at affected route                                    |
| SITE-BLOG-API: token-gated blog publishing API (draft/published rows merged with MDX) | implemented (migration unapplied until merge) | `app/api/blog/route.ts`, `lib/blog-api/*`, `lib/blog.ts` (`getPublishedRows`), `supabase/migrations/20261111120000_growth_blog_posts.sql`                          | uses SITE, INFRA (growth DB client); used_by blog index, post page, sitemap, RSS, `scripts/generate-blog-post.ts` (keyword bank) | `lib/blog-api/*.test.ts`; runbook `docs/runbooks/blog-api.md`                                             |
| PREVIEW: prospect demonstration pages and assets                                      | implemented                                   | `app/preview`, `app/api/prospect-preview-assets`, `lib/growth/prospect-previews`                                                                                   | depends_on GROWTH, INFRA; used_by SITE prospect outreach                                                                         | `lib/growth/prospect-previews`; detailed coverage unknown                                                 |
| GROWTH: founder research, CRM pipeline, outreach, newsletter, analytics, SEO          | implemented                                   | `app/(growth)`, `app/api/growth`, `lib/growth`                                                                                                                     | depends_on INFRA; uses Gmail and Resend integrations in `lib/growth/integrations`; used_by PREVIEW and founder dashboard         | `tests/integration/growth`; permission boundary `lib/growth/auth`                                         |
| OPS: client portal and founder Studio                                                 | implemented                                   | `app/(portal)`, `app/api/portal`, `components/portal`, `lib/operations`                                                                                            | depends_on AUTH, INFRA; uses AGREEMENT, DELIVERY, BILLING                                                                        | `app/(portal)/(studio)/portal/admin`; integration tests `tests/integration/operations`                    |
| AUTH: identity, staff authority, organisation isolation, invitations                  | implemented                                   | `lib/operations/auth`, `app/api/webhooks/clerk`, `app/(portal)/(auth)`                                                                                             | depends_on INFRA; used_by OPS, AGREEMENT, DELIVERY, BILLING                                                                      | `lib/operations/auth/staff-transaction.ts`; detailed revocation evidence unknown                          |
| AGREEMENT: reviewed engagement, draft builder, agreement lifecycle, signing           | implemented                                   | `lib/operations/agreements`, `components/portal/agreements`                                                                                                        | depends_on AUTH, INFRA; uses BUILDER, COMMERCIAL-OFFER, SIGNING; used_by OPS, DELIVERY, BILLING                                  | detailed features below; service and component unit tests                                                 |
| DELIVERY: onboarding journeys, projects, requests, documents, support, services       | implemented                                   | `lib/operations/onboarding`, `lib/operations/projects`, `lib/operations/requests`, `lib/operations/documents`, `lib/operations/support`, `lib/operations/services` | depends_on AUTH, INFRA; uses AGREEMENT; used_by OPS                                                                              | matching `app/(portal)/(client)/portal` routes; per-domain test coverage unknown                          |
| BILLING: payment obligations, provider setup, invoices                                | implemented                                   | `lib/operations/billing`, `app/(portal)/(client)/portal/billing`                                                                                                   | depends_on AUTH, INFRA; uses AGREEMENT; used_by OPS, DELIVERY                                                                    | `tests/integration/operations`; provider activation and deployment unknown                                |
| INFRA: Next.js runtime, PostgreSQL, migrations, jobs, design primitives, CI           | implemented                                   | `package.json`, `supabase/migrations`, `lib/operations/db`, `lib/growth/db`, `components/portal/ui`, `app/api/cron`, `.github/workflows`                           | used_by SITE, PREVIEW, GROWTH, OPS, AUTH, AGREEMENT, DELIVERY, BILLING                                                           | package scripts; migration verification; package scripts and migration checks define release verification |

## Agreement subfeatures

### BUILDER: create and resume client agreement drafts

- Status: implemented; cross-stage back navigation is local, with unfinished stages retained until saved or the engagement changes.
- Entry: `app/(portal)/(studio)/portal/admin/clients/[organisationId]/agreements/new/page.tsx`; wrapper `components/portal/agreements/routed-staff-agreement-builder.tsx#RoutedStaffAgreementBuilder`.
- Canonical UI: `components/portal/agreements/staff-agreement-builder.tsx#StaffAgreementBuilder`; `agreement-builder-step-panel.tsx#AgreementBuilderStepPanel` dispatches to the link, scope, fees, people, document, and review step modules in the same directory. `agreement-builder-groups.tsx#useAgreementBuilderGroups` owns within-stage groups, validation, and focus.
- State/persistence: `use-agreement-builder-draft.ts#useAgreementBuilderDraft`; `lib/operations/agreements/builder-draft-schema.ts`; `lib/operations/agreements/builder-draft-service.ts#saveStaffAgreementBuilderDraft`.
- depends_on AUTH through `withFssAdminTransaction`; depends_on INFRA for scoped PostgreSQL transactions and portal controls; used_by AGREEMENT and OPS.
- Commands enter through `app/api/portal/admin/clients/[organisationId]/agreement-drafts/route.ts`. Server validation, expected draft versions, and organisation permissions remain authoritative. Finalisation uses `runAgreementCommand` in `lib/operations/agreements/service.ts`.
- Debug start: `StaffAgreementBuilder.goBack` changes the active step and retains unfinished stages. The scope/fees/people/document/review back handlers and Review repair actions use that callback without saving. Successful `persist` removes the saved stage from retention; `selectEngagement` clears retained stages after confirmation. Existing within-stage Back uses `flow.show`. Parent navigation focuses the visible group heading. Save/Continue retain existing validation, server success, and version guards.
- Reuse decision: extend the active guided builder and existing group flow. Preserve commercial offer, currency, fee configuration, engagement-prefill, and engagement replacement behavior. No parallel builder.
- Graph nodes: `components_portal_agreements_staff_agreement_builder_tsx`, `components_portal_agreements_agreement_builder_groups_tsx`, `builder_draft_service_savestaffagreementbuilderdraft` in `graphify-out/graph.json`; verify component edges directly in source because TSX symbol extraction is limited.
- Evidence: `components/portal/agreements/staff-agreement-builder.test.tsx`, `lib/operations/agreements/builder-draft-service.test.ts`, `tests/e2e/agreement-builder.spec.ts`, `tests/e2e/agreement-builder-navigation.spec.ts`, and fixtures in `app/visual/fss-studio/[scenario]/agreement-visual-fixtures.tsx`. Verification: all 2,401 units, typecheck, production build, scoped lint, formatting, and the high-severity dependency audit gate passed under Node 24. Desktop invalid-fee round trip and all five mobile backward transitions passed in the Codex browser. Standalone browser runner and database integrations are deferred to CI; see `docs/design/agreement-builder-back-navigation-fix.md`.

### COMMERCIAL-OFFER: review terms and submit a client proposal

- Status: implemented. The email-link and redirect fix is verified locally.
- Entry: `app/(portal)/(client)/portal/agreements/offers/[offerId]/page.tsx` renders `ClientCommercialOffer`. `components/portal/agreements/use-commercial-offer-command.ts#useCommercialOfferCommand` posts to `app/api/portal/organisations/[organisationId]/commercial-offers/route.ts`.
- Canonical command: `lib/operations/http/commercial-offer-route.ts#portalCommercialOfferRoute` calls `lib/operations/agreements/commercial-service.ts#executePortalCommercialOfferCommand`. It depends_on AUTH for portal identity and organisation scope and uses `lib/growth/http/founder-request.ts#requestHasRegisteredOrigin` to require the configured portal origin in the request URL and `Origin` header. Used_by AGREEMENT and OPS; approved terms feed SIGNING.
- Link debugging and reuse: `app/api/cron/operations-dispatch/route.ts` invokes `lib/operations/agreements/agreement-notifications.ts#dispatchAgreementNotifications`. Its email renderer uses `lib/operations/auth/portal-url.ts#portalUrl` and `lib/operations/auth/configuration.ts#resolvePortalOrigin` for proposal, payment-choice, and signing links. `next.config.ts#redirects` sends previously issued public-host `/portal/agreements` URLs to the portal with their query parameters. Both paths respect the portal URL release flag.
- Graph nodes: `agreement_notifications_agreementnotificationemail`, `commercial_offer_route_portalcommercialofferroute`, `founder_request_requesthasregisteredorigin`, `use_commercial_offer_command_usecommercialoffercommand`, and `next_config_ts`.
- Evidence: `lib/operations/agreements/agreement-notifications.test.ts` covers HTML and plain-text destinations; `lib/seo/routing.test.ts` covers public and www redirects and host/path exclusions; `lib/operations/http/commercial-offer-route.test.ts` covers origin rejection and command authentication.

### SIGNING: review, prepare and record agreement signatures

- Status: implemented; live provider state unknown.
- Entry: `app/(portal)/(client)/portal/agreements/[approvalId]/sign/page.tsx`; `components/portal/agreements/client-signing-review.tsx`.
- Canonical implementation: `lib/operations/agreements/signing-service.ts`, `signing-repository.ts`, `signing-worker.ts`, `signing-route.ts`.
- depends_on AUTH and INFRA; consumes AGREEMENT records and approved COMMERCIAL-OFFER terms; used_by DELIVERY and BILLING through signed evidence. Signing notification links share the COMMERCIAL-OFFER routing described above.
- Debug/reuse start: signing service and repository; Graphify file nodes under `lib_operations_agreements_signing_*`.
- Evidence: `lib/operations/agreements/signing-http.test.ts`, `signing-render.test.ts`; detailed cross-domain consumers remain to be mapped.

## Public site subfeatures

Inventoried from source on 2026-11-11. Connections between these IDs: SITE-SERVICES feeds SITE-METADATA, SITE-SCHEMA and SITE-DISCOVERY through `publicPages`; SITE-BLOG feeds SITE-DISCOVERY; SITE-BLOG-API feeds SITE-BLOG; SITE-CONTENT-OPS feeds SITE-BLOG-API and SITE-SERVICES as editorial input; SITE-MOTION and SITE-LEADS are independent of the SEO chain. Growth and infrastructure edges are listed per entry.

### SITE-SERVICES: service pages, sector and authority pages

- Status: implemented. Nine service pages: `ai-integration`, `ai-agents`, `ai-receptionist`, `ai-readiness-audit`, `custom-software-development`, `portal-development`, `workflow-automation`, `software-modernisation`, `private-ai`.
- Entry: one thin route per page, `app/(site)/services/<slug>/page.tsx`, each reading `commercialPages["/services/<slug>"]`, calling `createPageMetadata(page)` and rendering `components/sections/public/commercial-page.tsx#CommercialPage`. Index: `app/(site)/services/page.tsx` renders `components/sections/public/services-page.tsx#ServicesPage` (service rail styles in `service-rail.module.css`). Charity sector page: `app/(site)/sectors/charities-faith-organisations/page.tsx`, content in `lib/commercial/authority.ts#authorityPages`.
- Canonical content: `lib/commercial/services.ts#servicePages` (shared `serviceDefaults`, `aiRelated`), merged with `authorityPages` and `guidePages` (`guides.ts`) in `lib/commercial/pages.ts#commercialPages`. Shared links in `links.ts` (`aiServiceLinks`, `serviceLinks`, `sectorLink`, `costLink`); page shape in `types.ts#CommercialPageContent`. Primary navigation: `components/layout/site-header-nav-items.ts#navItems`.
- depends_on SITE-METADATA (`PageMetadataInput`), SITE-SCHEMA (`buildCommercialSchema`); used_by SITE-METADATA and SITE-DISCOVERY (`lib/seo/pages.ts#publicPages` spreads `commercialPages`), SITE-LEADS (call-to-action destinations).
- Debug start: a wrong title, description or related link is data in `lib/commercial/services.ts`; a layout fault is `CommercialPage`. A missing sitemap or llms.txt entry means the page is absent from `commercialPages` or has `index: false`.
- Reuse decision: add a service by adding an entry to `servicePages` and a route file that copies an existing one. No per-page component.
- Graph nodes: `lib/commercial/*` is in the 2026-11-11 code-only scope; query `graphify query "commercial pages services"`. `components/sections/public` is outside graph scope.
- Evidence: `components/sections/commercial-pages.test.tsx`, `components/sections/public-pages.test.tsx`, `tests/integration/public-site-crawl.test.ts`, `app/sitemap.test.ts`. Coverage of every individual service route is unknown.

### SITE-METADATA: page registry, metadata and canonicals

- Status: implemented.
- Entry: `lib/seo/pages.ts#publicPages` (registry of `PublicPage` with `path`, `index`, `modifiedDate`); `lib/seo/metadata.ts#createPageMetadata`, `canonicalUrl`, `pageSchemaId`, `socialImage`; article and resource variants in `lib/seo/content-metadata.ts#createArticleMetadata`, `createResourceMetadata`. Social image route: `app/social/[...path]` rendering `components/seo/social-image.tsx#renderSocialImage`.
- depends_on SITE-SERVICES (registry content), `lib/site-config.ts`; used_by every `app/(site)` route, SITE-SCHEMA, SITE-DISCOVERY.
- Debug start: `canonicalUrl` for canonical or host faults; host redirects are covered by `lib/seo/routing.test.ts`.
- Reuse decision: every public page uses `createPageMetadata`; do not hand-write `metadata` objects.
- Graph nodes: `lib/seo/metadata.ts`, `lib/seo/pages.ts` (code-only scope).
- Evidence: `lib/seo/metadata.test.ts`, `lib/seo/routing.test.ts`, `lib/seo/content-release.test.ts`, `components/seo/social-image.test.ts`, `app/public-metadata.test.tsx`.

### SITE-SCHEMA: JSON-LD structured data

- Status: implemented.
- Entry: `components/seo/json-ld.tsx#JsonLd` renders the data; `root-schema.tsx#RootSchema` (mounted in `app/(site)/layout.tsx`), `service-schema.tsx#ServiceSchema`, `article-schema.tsx#ArticleSchema`, `resource-schema.tsx#ResourceSchema`, `breadcrumb-schema.tsx#BreadcrumbSchema`.
- Builders: `lib/seo/schema.ts` (`organisationId`, `websiteId`, `buildPageSchema`, `buildRootSchema`, `isOrganisationAuthor`), `lib/seo/commercial-schema.ts` (`buildCommercialSchema`, `commercialBreadcrumbs`), `lib/seo/organisation.ts#organisation`. The organisation node is typed `["Organization", "ProfessionalService"]`; `ArticleSchema` uses `isOrganisationAuthor(post.author)` to attribute organisation-authored posts to that node.
- depends_on SITE-METADATA (`canonicalUrl`, `pageSchemaId`); used_by SITE-SERVICES (`CommercialPage`), SITE-BLOG.
- Debug start: the `@id` helpers in `lib/seo/schema.ts`; every node must reference `organisationId` rather than redeclare the organisation.
- Reuse decision: extend the builders; no inline JSON-LD in route files.
- Graph nodes: `lib/seo/schema.ts`, `commercial-schema.ts`, `organisation.ts`, and `components/seo` (code-only scope; TSX symbol extraction is limited).
- Evidence: `lib/seo/metadata.test.ts` (asserts the `ProfessionalService` type), `components/seo/content-evidence.test.tsx`. Direct tests of `isOrganisationAuthor` and `buildCommercialSchema`: unknown.

### SITE-DISCOVERY: robots, sitemap, llms.txt, RSS

- Status: implemented.
- Entry: `app/robots.ts` calls `lib/seo/robots.ts#buildRobots` (explicit groups for `aiCrawlers`: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended; `/api/` disallowed; whole site disallowed when `siteConfig.allowSearchIndexing` is false). `app/sitemap.ts#buildSitemapEntries`. `app/llms.txt/route.ts` with `lib/seo/llms.ts#buildLlmsTxt`, `llmsTxtResponse`. `app/feed.xml/route.ts` with `lib/seo/rss.ts#buildRssFeed`. All revalidate hourly.
- depends_on SITE-METADATA (`publicPages`, `canonicalUrl`), SITE-BLOG (`getAllBlogPosts`), `lib/resources.ts`, `lib/site-config.ts`; used_by external crawlers and AI agents.
- Debug start: sitemap omissions are `index: false` pages or non-`indexable` posts; blog posts missing here usually mean SITE-BLOG-API rows failed to load.
- Reuse decision: new public routes appear here only by joining `publicPages`, `getAllBlogPosts` or `getAllResources`. No separate lists.
- Graph nodes: `lib/seo/robots.ts`, `llms.ts`, `rss.ts`, `app/llms.txt` (code-only scope); `app/sitemap.ts` and `app/robots.ts` are outside the scoped directories, so Graphify coverage unknown.
- Evidence: `lib/seo/discovery.test.ts`, `lib/seo/llms.test.ts`, `app/sitemap.test.ts`, `tests/integration/public-site-crawl.test.ts`; release checklist `docs/seo-aeo-release-checks.md`.

### SITE-BLOG: blog content and routes

- Status: implemented.
- Entry: `app/(site)/blog/page.tsx` (`components/sections/blog/blog-index.tsx#BlogIndex`), `app/(site)/blog/[slug]/page.tsx` (`blog-post-page.tsx#BlogPostPage`), the fixed `app/(site)/blog/church-management-software-vs-bespoke`. Layout components in `components/blog` (`BlogPostLayout`, `mdx-components.tsx`, `mdx-callout.tsx`, `mdx-cta-block.tsx`, `blog-post-card.tsx`).
- Canonical implementation: `lib/blog.ts` (`blogFrontmatterBaseSchema`, `getAllBlogPostsWith`, `getBlogPostBySlugWith`, `getAllBlogPosts`, `getFeaturedBlogPosts`, `getRelatedPosts`). It merges MDX files in `content/blog`, the code-defined `churchArticle` (`lib/commercial/church-article.ts`) and database rows via `getPublishedRows`; file slugs win over rows (`rowsNotOwnedBy`).
- depends_on SITE-BLOG-API (rows), SITE-SCHEMA, SITE-METADATA; used_by SITE-DISCOVERY.
- Debug start: `getAllBlogPostsWith` merge order; a post present in the database but not on the site is usually a slug clash with a file post or a degraded row load.
- Reuse decision: write posts as MDX or through the API; do not add a third source.
- Graph nodes: `lib/blog.ts` (code-only scope); components outside scope.
- Evidence: `lib/blog-api/slug-resolution.test.ts`, `rows.test.ts`, `render.test.ts`, `tests/integration/public-site-crawl.test.ts`. A direct `lib/blog.ts` test file: none found.

### SITE-BLOG-API: token-gated blog publishing

- Status: implemented; the `growth.blog_posts` migration is unapplied until merge.
- Entry: `app/api/blog/route.ts` exports `GET` and `POST` from `lib/blog-api/handler.ts#createBlogHandlers`; the token is read from `BLOG_API_TOKEN` in the route. Runbook: `docs/runbooks/blog-api.md`.
- Canonical implementation: `lib/blog-api/handler.ts` (`isAuthorised`, `clientKeyOf`, `createWriteLimiter`), `post-schema.ts#blogPostInputSchema` (`MAX_BODY_CHARS`, `findMdxConstruct`), `store.ts#createBlogStore`, `rowToPost`, `rows.ts` (`loadRowsSafely`, `requireRows`, `createTtlMemo`), `slug.ts`, `links.ts#isSafeLinkDestination`, `render.ts`, `keyword-bank.ts` (`parseKeywordBank`, `markKeywordUsed`, `isKnownKeyword`). Schema: `supabase/migrations/20261111120000_growth_blog_posts.sql`.
- Generator: `scripts/generate-blog-post.ts` imports `lib/blog-api/keyword-bank`; the bank path is `docs/seo/keyword-bank.md` (`KEYWORD_BANK_PATH`). The script also reads `scripts/seo-keyword-tracker.json`; how the two sources relate is unknown.
- depends_on INFRA (`lib/growth/db/client#getGrowthDb`), GROWTH database schema, SITE-CONTENT-OPS (keyword bank); used_by SITE-BLOG.
- Debug start: `handler.ts` for 401/429, `post-schema.ts` for validation, `rows.ts` for degraded reads.
- Reuse decision: all non-file posts go through this API; no direct SQL inserts.
- Graph nodes: `lib/blog-api/*`, `app/api/blog` (code-only scope).
- Evidence: `lib/blog-api/{handler,handler-limits,config-gate,post-schema,post-schema-hardening,rows,render,slug-resolution,keyword-bank,keyword-bank-mark}.test.ts`, `tests/integration/growth/blog-posts-store.test.ts`.

### SITE-LEADS: contact, lead magnet and intake forms

- Status: implemented for the forms on this branch; **planned, PR #330 open** (title "Guide contact enquiries one question at a time"): `/contact` is being rebuilt as a five-step form. This branch has the single `components/forms/contact-form.tsx#ContactForm`, not the five-step flow.
- Entry: `/contact` renders `components/sections/public/contact-page.tsx#ContactPageContent` (with `ContactForm`; validation in `lib/forms/contact-request.ts#prepareContactRequest`). Lead magnet: `components/forms/lead-magnet-capture-form.tsx#LeadMagnetCaptureForm` (used by `components/sections/ai-questionnaire/ai-deployment-quiz.tsx`). `/start`: `components/sections/business-intake/business-intake-form.tsx#BusinessIntakeForm`.
- Server: `app/api/lead/route.ts` (`leadSubmissionSchema` from `lib/forms/lead-capture.ts`, then `lib/server/lead-submission.ts#processLeadSubmission`); `app/api/intake/route.ts` (`intakeSubmissionPayloadSchema` from `lib/intake/schema.ts`, then `lib/server/intake-submission.ts#processIntakeSubmission`). Leads reach the Growth database through `lib/growth/inbound/submit-lead.ts#submitLeadInTransaction`; email through `lib/server/resend.ts`; HubSpot through `lib/server/hubspot.ts`.
- Caution: `components/forms/lead-capture-form.tsx#LeadCaptureForm` is a different form (Growth dashboard prospects, plus `contact-hero.tsx`). Whether `contact-hero.tsx` is still routed publicly is unknown.
- depends_on INFRA, GROWTH (inbound leads), Resend and HubSpot integrations; used_by GROWTH CRM, SITE-SERVICES call-to-action links.
- Debug start: the API route first, then the matching `lib/server/*-submission.ts`.
- Reuse decision: extend the existing schemas and server modules; PR #330 should reuse `prepareContactRequest`.
- Graph nodes: `lib/server`, `lib/forms`, `lib/intake` are outside the 2026-11-11 code-only scope; Graphify coverage unknown.
- Evidence: `lib/forms/contact-request.test.ts`, `lib/forms/lead-capture.test.ts`, `lib/intake/schema.test.ts`, `tests/integration/growth/public-form-persistence.test.ts`. No route-level or server-module test found for `/api/lead` or `/api/intake`.

### SITE-MOTION: cinematic motion and particle effects

- Status: implemented.
- Standing rule: these effects must not be removed. Lighthouse and performance work defers or optimises them; it does not delete them.
- Entry: `components/layout/site-interactions.tsx` loads `components/redesign/fss-interactions.tsx#FssInteractions` lazily. Scenes: `motion-scenes.ts` (`bindMotionReveals`, `bindScrollScenes`), `story-scenes.ts`, `app-journey-scenes.ts`; particle network: `value-network.ts` (`buildValueNetwork`, `networkFormation`), `value-network-canvas.ts#bindValueNetwork`; shared maths in `motion-values.ts`, `story-progress.ts`, `showcase-progress.ts`, `app-journey-progress.ts`. Styles: `cinematic-motion.css`, `app-journey-motion.css`. Service rail: `components/sections/public/service-rail.module.css`, used by `services-page.tsx`.
- Reduced motion: `FssInteractions` reads `prefers-reduced-motion` and passes `reducedMotion` to the scene binders; reduced motion shows stationary structure with no pinning. Design reference: `docs/public-cinematic-motion.md`.
- depends_on SITE shell (`components/layout/site-shell.tsx`); used_by SITE-SERVICES index and the home page.
- Debug start: `FssInteractions` effect setup, then the specific `bind*` function.
- Reuse decision: extend the existing scene binders; no second animation runtime or dependency.
- Graph nodes: `components/redesign` is outside the 2026-11-11 code-only scope; coverage unknown.
- Evidence: `components/redesign/{motion-values,value-network,story-progress,showcase-progress,app-journey-progress}.test.ts`; `scripts/check-homepage-budget.mjs` and `scripts/validate-public-redesign-shell.mjs` exist as checks (their wiring into CI is unknown).

### SITE-CONTENT-OPS: editorial inputs and design

- Status: implemented as documents; not executable code.
- Required reading before writing any blog post or service page: `docs/seo/keyword-bank.md` (also parsed by `lib/blog-api/keyword-bank.ts`, so its table format is load-bearing). Supporting: `docs/seo/research/icp.md`, `docs/seo/research/competitors.md`, `docs/seo/google-business-profile.md`, release checks `docs/seo-aeo-release-checks.md`. Design doc: `docs/superpowers/specs/2026-11-11-ai-led-seo-lead-growth-design.md`.
- used_by SITE-BLOG-API, SITE-SERVICES, SITE-BLOG; depends_on nothing in code.
- Debug start: if the generator or API rejects a keyword, check the row in `docs/seo/keyword-bank.md` against `parseKeywordBank`.
- Reuse decision: one keyword bank; do not start a parallel keyword list (`scripts/seo-keyword-tracker.json` pre-dates it, reconciliation unknown).
- Graph nodes: none; documents are outside graph coverage.
- Evidence: `lib/blog-api/keyword-bank.test.ts` covers parsing only; document accuracy is not machine-verified.
