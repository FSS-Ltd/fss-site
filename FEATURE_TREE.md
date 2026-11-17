# Project feature tree

Source-backed baseline, 2026-11-17, checked against clean `origin/main` commit `618e7d730`. Status describes code present in this checkout, not deployment.

## Coverage and navigation

This is the canonical project inventory. The domain index covers the repository's public site, Growth OS, Operations, and infrastructure. Agreement and selected Growth navigation are mapped in detail below. Other domains are indexed at their entry points; exhaustive subfeature, permission, and test mapping remains **unknown**. Do not treat this baseline as exhaustive.

Graphify: [graph](graphify-out/graph.json), [audit report](graphify-out/GRAPH_REPORT.md). Deterministic extraction covers 198 tracked TypeScript sources: the prior 121 agreement, routing, notification and auth files plus 77 selected Growth CRM, research, sequence, provider, suppression and analytics files and Studio client reader. See [source-hashes.json](graphify-out/source-hashes.json) for the exact scope. Documentation, styles, and the rest of the project are outside graph coverage. The installed extractor provides limited TSX symbol extraction; verify component relationships in source.

## Domain index

| ID / purpose                                                                          | Status      | Entry points / canonical reuse points                                                                                                                              | Directed connections                                                                                                             | Verification / debugging start                                                                            |
| ------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| SITE: public marketing, services, work, blog, resources                               | implemented | `app/(site)`, `content`, `lib/navigation.ts`                                                                                                                       | uses INFRA; used_by public visitors                                                                                              | `tests/integration/public-site-crawl.test.ts`; start at affected route                                    |
| SITE-BLOG-API: token-gated blog publishing API (draft/published rows merged with MDX) | implemented | `app/api/blog/route.ts`, `lib/blog-api/*`, `lib/blog.ts` (`getPublishedRows`), `supabase/migrations/20261111120000_growth_blog_posts.sql`                          | uses SITE, INFRA (growth DB client); used_by blog index, post page, sitemap, RSS, `scripts/generate-blog-post.ts` (keyword bank) | `lib/blog-api/*.test.ts`; runbook `docs/runbooks/blog-api.md`                                             |
| PREVIEW: prospect demonstration pages and assets                                      | implemented | `app/preview`, `app/api/prospect-preview-assets`, `lib/growth/prospect-previews`                                                                                   | depends_on GROWTH, INFRA; used_by SITE prospect outreach                                                                         | `lib/growth/prospect-previews`; detailed coverage unknown                                                 |
| GROWTH: founder research, CRM pipeline, outreach, newsletter, analytics, SEO          | implemented | `app/(growth)`, `app/api/growth`, `lib/growth`                                                                                                                     | depends_on INFRA; uses Gmail and Resend integrations in `lib/growth/integrations`; used_by PREVIEW and founder dashboard         | `tests/integration/growth`; permission boundary `lib/growth/auth`                                         |
| OPS: client portal and founder Studio                                                 | implemented | `app/(portal)`, `app/api/portal`, `components/portal`, `lib/operations`                                                                                            | depends_on AUTH, INFRA; uses AGREEMENT, DELIVERY, BILLING                                                                        | `app/(portal)/(studio)/portal/admin`; integration tests `tests/integration/operations`                    |
| AUTH: identity, staff authority, organisation isolation, invitations                  | implemented | `lib/operations/auth`, `app/api/webhooks/clerk`, `app/(portal)/(auth)`                                                                                             | depends_on INFRA; used_by OPS, AGREEMENT, DELIVERY, BILLING                                                                      | `lib/operations/auth/staff-transaction.ts`; detailed revocation evidence unknown                          |
| AGREEMENT: reviewed engagement, draft builder, agreement lifecycle, signing           | implemented | `lib/operations/agreements`, `components/portal/agreements`                                                                                                        | depends_on AUTH, INFRA; uses BUILDER, COMMERCIAL-OFFER, SIGNING; used_by OPS, DELIVERY, BILLING                                  | detailed features below; service and component unit tests                                                 |
| DELIVERY: onboarding journeys, projects, requests, documents, support, services       | implemented | `lib/operations/onboarding`, `lib/operations/projects`, `lib/operations/requests`, `lib/operations/documents`, `lib/operations/support`, `lib/operations/services` | depends_on AUTH, INFRA; uses AGREEMENT; used_by OPS                                                                              | matching `app/(portal)/(client)/portal` routes; per-domain test coverage unknown                          |
| BILLING: payment obligations, provider setup, invoices                                | implemented | `lib/operations/billing`, `app/(portal)/(client)/portal/billing`                                                                                                   | depends_on AUTH, INFRA; uses AGREEMENT; used_by OPS, DELIVERY                                                                    | `tests/integration/operations`; provider activation and deployment unknown                                |
| INFRA: Next.js runtime, PostgreSQL, migrations, jobs, design primitives, CI           | implemented | `package.json`, `supabase/migrations`, `lib/operations/db`, `lib/growth/db`, `components/portal/ui`, `app/api/cron`, `.github/workflows`                           | used_by SITE, PREVIEW, GROWTH, OPS, AUTH, AGREEMENT, DELIVERY, BILLING                                                           | package scripts; migration verification; package scripts and migration checks define release verification |

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

## Growth CRM and outreach subfeatures

### GROWTH-CRM: CRM workspace and lead capture

- Status: implemented. Entry: `app/api/growth/crm/[id]/route.ts`. Canonical readers and capture: `lib/growth/crm/workspace-query.ts#getCrmWorkspace`, `lib/growth/crm/lead-service.ts#captureLead`, `lib/growth/crm/lead-repository.ts#captureBusiness`.
- depends_on INFRA and Growth auth; used_by GROWTH-RESEARCH and GROWTH-OUTREACH. Tests: `tests/integration/growth/crm-workspace.test.ts`, `tests/integration/growth/crm-records.test.ts`. Graph node: `lib_growth_crm_lead_service_ts`.

### GROWTH-RESEARCH: research ingestion

- Status: implemented. Entry: `app/api/growth/prospects/[id]/request-research/route.ts`, `lib/growth/research/scheduled-workflow.ts#runScheduledResearchWorkflow`. Canonical global ingestion: `lib/growth/research/global-ingest.ts#ingestGlobalResearchRun`, `lib/growth/research/global-repository.ts#inspectGlobalCandidate`.
- depends_on GROWTH-CRM, INFRA, evidence validation and suppression checks; used_by GROWTH-OUTREACH. Graph node: `lib_growth_research_global_ingest_ts`. Tests: `tests/integration/growth/global-research.test.ts`, `lib/growth/research/global-identity.test.ts`.

### GROWTH-OUTREACH: approved email sequences

- Status: implemented. Entry: `app/api/growth/messages/[id]/approve-research-send/route.ts`. Canonical approval and dispatcher: `lib/growth/sequences/research-email-approval.ts#createResearchEmailApprover`, `lib/growth/sequences/approval.ts#createFirstEmailApprover`, `lib/growth/sequences/dispatcher.ts#createOutreachDispatcher`.
- depends_on GROWTH-CRM, GROWTH-RESEARCH, GROWTH-SUPPRESSION and Gmail. Current approval flow is per message; automatic campaign policy is planned, not present. Graph node: `lib_growth_sequences_dispatcher_ts`. Tests: `lib/growth/sequences/dispatcher.test.ts`, `lib/growth/sequences/approval.test.ts`.

### GROWTH-SUPPRESSION: contact exclusion

- Status: implemented. Canonical check: `lib/growth/email/suppression.ts#isSuppressed`; dispatcher checks suppression in `lib/growth/sequences/dispatcher.ts`. `supabase/migrations/20260825170302_growth_gmail_outreach.sql` defines Growth suppressions.
- depends_on INFRA; used_by GROWTH-RESEARCH and GROWTH-OUTREACH. Graph node: `lib_growth_email_suppression_ts`. Tests: `lib/growth/email/suppression.test.ts`, `lib/growth/sequences/dispatcher.test.ts`.

### GROWTH-ANALYTICS: funnel definitions

- Status: implemented. Entry: `app/(growth)/(dashboard)/growth/analytics/page.tsx`; canonical definitions: `lib/growth/analytics/definitions.ts#FUNNEL_METRIC_DEFINITIONS`.
- depends_on INFRA and GROWTH-OUTREACH data; used_by Growth dashboard. Graph node: `lib_growth_analytics_definitions_ts`. Tests: `lib/growth/analytics/definitions.test.ts`. Variant attribution and automated experiment analysis are not established by this feature.

### GROWTH-FB-SOURCE: Facebook source identity handling

- Status: partial. `lib/growth/research/global-identity.ts` treats Facebook hosts as social sources; `lib/growth/crm/schemas.ts#sourceUrlSchema` validates public source URLs. This does not establish a Facebook workspace or automated collection.
- depends_on GROWTH-RESEARCH and GROWTH-CRM; used_by candidate identity and manual source entry. Graph node: `lib_growth_research_global_identity_ts`. Tests: `lib/growth/research/global-identity.test.ts`.

### OPS-CLIENT: Studio client ownership boundary

- Status: implemented. Entry and canonical readers: `lib/operations/studio/clients.ts#listStudioClients`, `lib/operations/studio/clients.ts#loadStudioClient`. `supabase/migrations/20261001120000_operations_studio_engagement_creation.sql` constrains delivery engagements to Growth prospect or Studio organisation ownership.
- depends_on AUTH and INFRA; used_by OPS and AGREEMENT. The schema alone does not prove any production records are unrelated. Graph node: `lib_operations_studio_clients_ts`. Tests: `lib/operations/studio/clients.test.ts`.

### Planned outreach work

These IDs describe proposed boundaries in the [draft design](docs/superpowers/specs/2026-11-17-outreach-revamp-design.md), not implemented functionality. Entry points, canonical implementation, schema and tests remain subject to design review.

- **GROWTH-CAMPAIGN**: planned. Campaign organisation and orchestration; intended to reuse GROWTH-CRM, GROWTH-RESEARCH and GROWTH-OUTREACH. Consumers and exact boundaries are design questions.
- **GROWTH-POLICY**: planned. Eligibility and automatic send policy; intended to reuse GROWTH-SUPPRESSION and existing approval/provider boundaries. Requires explicit authority and failure-mode design.
- **GROWTH-BUDGETS**: planned. Provider quota and daily budget controls; intended consumer GROWTH-POLICY. Current repository evidence does not establish a quota ledger.
- **GROWTH-VARIANT-ANALYTICS**: planned. Variant attribution and one-calendar-month experiment review; intended to reuse GROWTH-ANALYTICS. Current metrics do not establish experiment attribution.
- **GROWTH-FB-WORKSPACE**: planned. Manual Facebook group/posting workspace and manual lead source; intended to reuse GROWTH-FB-SOURCE and GROWTH-CRM. No automated Facebook posting or collection is implied.
