# FSS welcome and operations implementation handoff

Updated: 2026-10-02. Status: implemented and verified locally; production rollout requires explicit approval.

## Delivered

Three complete Website Build, Website + SEO and Systems Portal editions produce ten searchable A4 pages with FSS editorial assets, an equivalent semantic client reading view, and authenticated retained-PDF download. Matching image-led welcome, proposal, activation and thank-you emails retain plain-text alternatives and legacy snapshot compatibility. The template library opens before editing; the persistent five-stage journey composer restores edited content, checklist provenance and recipient facts and reviews the actual generated PDF.

Portal access starts with full-dataset metrics and scoped identity cards. Native invitation/removal dialogs retain pending/error/success states and restore focus. Active staff membership plus server-verified founder identity gates staff administration.

Settings apply through focused revisioned section updates and append-only audit history. Applied identity, reply-to, timezone, response guidance and capacity values feed their documented consumers. Historical drafts and existing approved material remain frozen. Welcome scheduling remains 09:00 Europe/London.

Next.js and eslint-config-next are patched to 16.3.8. Existing React Email Button and Img packages were promoted from transitive to direct dependencies at their already installed versions, so the native synchronous renderer resolves predictably in deployed applications. No new runtime library or package version was introduced for email rendering. Explicit route traces retain the four small runtime packages. A copied deployment trace successfully rendered its image and primary action; all four approved packet assets are present in the packet preparation trace.

## Verification

- Full Node24 unit suite: 2,184 passed, zero failures or skips.
- Full isolated Operations database integration suite: 148 passed, zero failures or skips.
- Final packet/client focused suite: 42 passed. New packet/client line coverage: 96.62%; branch coverage: 88.85%.
- Production Next.js 16.3.8 webpack build: passed, including type checking and page generation.
- Repository TypeScript, ESLint and six blog-cover checks: passed.
- Prettier: supported owned files passed. Existing mixed client-form, fixture and screen-contract files were preserved and staged only by their task hunks. The pnpm lockfile retains package-manager formatting. SQL/CSV use migration policy, schema/coverage and git whitespace checks rather than an unavailable Prettier parser.
- Migration policy: all 67 current migrations passed. Task migrations were exercised only against the isolated local database.
- Desktop/mobile browser flows: 36/36 passed on patched Next.js, including keyboard focus restoration, real PDF preview/download and hash, draft restore, settings consumers/conflicts, dark appearance and 200% text. The first cold run exposed two navigation timeouts during initial compilation; the runner now waits for the fixture route before starting interaction timers.
- All 30 PDF pages and four desktop/mobile welcome-message families were rendered and visually inspected. Blocked images, narrow email layouts, semantic reading, actual PDF bytes/hash, missing facts, overflow, legacy approvals, tenant boundaries, founder capability, settings conflicts and consumers were verified.
- Dependency production audit: no known vulnerabilities. git diff --check: passed.

## Unique imagery refinement, 2026-10-02

New designed editions use each photograph exactly once across the set: three distinct covers and the Systems Portal service overview. Other sections use searchable editorial text and native process diagrams. The twelve service/stage email variants each use an original diagram composition, served as a small email-compatible PNG. No cropped or tinted duplicates are used. `scripts/generate-welcome-email-artwork.ts` reproduces these assets with the existing Sharp dependency.

The typed `text` section layout permits image-free pages; image layouts still require approved image identifiers. New packet drafts carry `emailArtworkVersion: 1` through personalisation, draft saves and approvals. Missing artwork version retains the original renderer-2 email header. Retained renderer-2 PDF and email bytes were compared against the previous commit and remain identical; regression hashes now enforce this. Edited drafts and published versions require deliberate replacement through the existing draft/publish flow.

Refinement checks: 82 onboarding/component unit tests and 20 desktop/mobile welcome browser tests passed; TypeScript, scoped ESLint, changed-file formatting and the production build passed. All 30 PDF pages and all 12 email variants were rendered and inspected, including 24 desktop/mobile email captures with blocked images. Asset paths and content hashes are unique across all 16 material images. The PDFs remain ten pages, searchable and below 2 MB. Database integration tests were not repeated for this presentation-only refinement; the previous 148-test integration run remains recorded above. CI, live mail-client delivery and production rollout remain unexecuted.

Refinement files: packet contract/metadata/copy, PDF/editorial/HTML/email renderers, `email-artwork.ts`, journey draft propagation and preview, packet and browser regression tests, the artwork generator, twelve files in `public/images/welcome/`, and this handoff/rollout guidance. Unrelated commercial changes were preserved.

## PR integration with current main, 2026-10-02

The PR branch `feat/welcome-operations-redesign` merges current main in an isolated checkout. Shared fixture metadata retains the accurate integration-configuration wording; the client form preserves both new billing currencies and applied timezone defaults; both regression tests remain; the browser runner includes agreement and welcome/access/settings coverage. Next.js 16.3.8 and the matching lockfile remain in place. The original checkout and its uncommitted commercial work were untouched.

Merge verification: 85 focused onboarding/client-form units, 38 desktop/mobile welcome/access/settings browser tests, TypeScript, merge-file lint/formatting and all 67 migration-policy checks passed. The merged production Next.js 16.3.8 build passed. The two pre-existing commercial-offer screen-coverage gaps remain unchanged.

## Remaining release conditions

CI repair, 2026-10-02: three real-signing integration scenarios had expired fixed October 1 activation/payment dates. The shared signing fixture now derives service and payment dates from the database clock, and commercial activation records today's verified evidence. Production date guards remain unchanged. The failing files pass all 12 tests; the exact Operations CI coverage command passes all 590 tests (92.34% lines, 88.34% branches, 93.46% functions). TypeScript, scoped ESLint, formatting and whitespace checks pass. GitHub verification and redesigned visual-baseline review are in progress.

The repository screen-coverage command still reports two routes introduced by unrelated commercial work without coverage rows: `/portal/agreements/offers/:parameter` and `/portal/admin/clients/:parameter/commercial-offers/:parameter`. This task updated all welcome, access and settings rows and preserved the commercial edits.

CI and real Outlook/Gmail delivery were not exercised. No production migrations, deployment, invitations or outbound emails were performed. Before rollout, follow [the rollout guide](./fss-welcome-rollout.md), configure the approved reply-to list, apply active settings, and save/publish the three designed editions through the existing template workflow. Existing edited drafts are deliberately not converted or published automatically.

The historical settings draft writer retains a pre-existing database grant mismatch; historical drafts remain readable and inactive. The new active settings writer passed real database tests. Browser-history transitions within the same App Router document are not directly trapped by the dirty guard; explicit page links, cancel/discard and reload/unload are covered.

## Review artifacts

Prepared PDFs and desktop contact sheets are retained under `/Users/JeanFidele/.codex/visualizations/2026/10/01/01a0f8de-bf5b-7411-b606-acf9017c02ba/welcome-packets/`.

Detailed logs, visual captures, hashes, coverage, ownership manifests and agent reports are under `/private/tmp/fss-welcome-redesign/`. The original worktree dependency directory was preserved; this checkout now owns its patched node_modules. No temporary Git worktree was created.

## Changed files

This manifest includes task-owned changes only. Shared files retain unrelated working-tree edits outside the task commits.

- `app/(portal)/(studio)/portal/admin/clients/[organisationId]/journey/page.tsx`
- `app/(portal)/(studio)/portal/admin/clients/new/page.tsx`
- `app/(portal)/(studio)/portal/admin/clients/page.tsx`
- `app/(portal)/(studio)/portal/admin/layout.tsx`
- `app/(portal)/(studio)/portal/admin/notifications/page.tsx`
- `app/(portal)/(studio)/portal/admin/portal-access/page.tsx`
- `app/api/portal/organisations/[organisationId]/onboarding/packet/[approvalId]/download/route.ts`
- `app/visual/fss-studio/[scenario]/studio-workspace-visual-fixtures.tsx`
- `app/visual/fss-studio/[scenario]/welcome-experience-visual-data.ts`
- `app/visual/fss-studio/[scenario]/welcome-visual-fixtures.tsx`
- `components/operations/onboarding/journey-preview.tsx`
- `components/operations/onboarding/welcome-form.tsx`
- `components/portal/onboarding/client-onboarding-workspace.test.tsx`
- `components/portal/onboarding/client-onboarding-workspace.tsx`
- `components/portal/onboarding/client-welcome-packet.module.css`
- `components/portal/onboarding/client-welcome-packet.tsx`
- `components/portal/onboarding/journey-composer-types.ts`
- `components/portal/onboarding/journey-content-stage.tsx`
- `components/portal/onboarding/journey-preparation-stages.tsx`
- `components/portal/onboarding/journey-review-stage.tsx`
- `components/portal/onboarding/staff-journey-builder.tsx`
- `components/portal/onboarding/staff-journey-workspace.tsx`
- `components/portal/onboarding/use-journey-composer.ts`
- `components/portal/onboarding/use-unsaved-welcome-changes.ts`
- `components/portal/onboarding/use-welcome-pack-editor.ts`
- `components/portal/onboarding/welcome-pack-content-editor.tsx`
- `components/portal/onboarding/welcome-pack-editor.test.tsx`
- `components/portal/onboarding/welcome-pack-editor.tsx`
- `components/portal/onboarding/welcome-pack-library.tsx`
- `components/portal/onboarding/welcome-packet-preview.tsx`
- `components/portal/onboarding/welcome-packet.module.css`
- `components/portal/shell/navigation.test.tsx`
- `components/portal/shell/portal-shell.module.css`
- `components/portal/shell/studio-settings-context.module.css`
- `components/portal/shell/studio-shell.tsx`
- `components/portal/studio/access-dialog-fields.tsx`
- `components/portal/studio/access-dialog.tsx`
- `components/portal/studio/access-identity-card.tsx`
- `components/portal/studio/access-operation.test.ts`
- `components/portal/studio/access-operation.ts`
- `components/portal/studio/access-presentation.test.ts`
- `components/portal/studio/access-presentation.ts`
- `components/portal/studio/client-create-dialog.tsx`
- `components/portal/studio/client-form.test.tsx`
- `components/portal/studio/client-form.tsx`
- `components/portal/studio/client-register.tsx`
- `components/portal/studio/notification-delivery.test.tsx`
- `components/portal/studio/notification-delivery.tsx`
- `components/portal/studio/portal-access-workspace.test.tsx`
- `components/portal/studio/portal-access-workspace.tsx`
- `components/portal/studio/portal-access.module.css`
- `components/portal/studio/settings-editor-state.test.ts`
- `components/portal/studio/settings-editor-state.ts`
- `components/portal/studio/settings-section-card.tsx`
- `components/portal/studio/settings-section-fields.tsx`
- `components/portal/studio/studio-settings.module.css`
- `components/portal/studio/studio-settings.test.tsx`
- `components/portal/studio/studio-settings.tsx`
- `components/portal/studio/use-settings-editor.ts`
- `docs/design/fss-studio-experience/03-screen-contracts.md`
- `docs/design/fss-studio-experience/screen-coverage.csv`
- `docs/design/fss-welcome-experience.md`
- `docs/design/fss-welcome-rollout.md`
- `docs/runbooks/operations-studio-settings.md`
- `docs/superpowers/plans/2026-10-01-welcome-operations-redesign.md`
- `lib/operations/auth/access-overview-metrics.ts`
- `lib/operations/auth/founder-access-repository.ts`
- `lib/operations/auth/founder-access.test.ts`
- `lib/operations/auth/founder-access.ts`
- `lib/operations/http/staff-portal-access-route.test.ts`
- `lib/operations/http/staff-portal-access-route.ts`
- `lib/operations/http/staff-settings-route.test.ts`
- `lib/operations/http/staff-settings-route.ts`
- `lib/operations/onboarding/approval-schema.test.ts`
- `lib/operations/onboarding/approval-schema.ts`
- `lib/operations/onboarding/approval.ts`
- `lib/operations/onboarding/client-packet-contract.ts`
- `lib/operations/onboarding/client-packet-http.ts`
- `lib/operations/onboarding/client-packet.test.ts`
- `lib/operations/onboarding/client-packet.ts`
- `lib/operations/onboarding/client-workspace.ts`
- `lib/operations/onboarding/command-schema.ts`
- `lib/operations/onboarding/content/activation-email.ts`
- `lib/operations/onboarding/content/email-fragments.node.ts`
- `lib/operations/onboarding/content/email-html.ts`
- `lib/operations/onboarding/content/packet-email.ts`
- `lib/operations/onboarding/content/packet-html.ts`
- `lib/operations/onboarding/content/packet-pdf.ts`
- `lib/operations/onboarding/content/proposal-email.ts`
- `lib/operations/onboarding/content/thank-you.ts`
- `lib/operations/onboarding/content/welcome-email.ts`
- `lib/operations/onboarding/content/welcome-pdf.ts`
- `lib/operations/onboarding/journey-composer-contract.ts`
- `lib/operations/onboarding/packet-copy.ts`
- `lib/operations/onboarding/packet-editions.ts`
- `lib/operations/onboarding/packet-metadata.ts`
- `lib/operations/onboarding/packet-rendering.test.ts`
- `lib/operations/onboarding/prepare-preview.test.ts`
- `lib/operations/onboarding/prepare-preview.ts`
- `lib/operations/onboarding/preview-envelope.ts`
- `lib/operations/onboarding/queries.ts`
- `lib/operations/onboarding/types.ts`
- `lib/operations/onboarding/welcome-pack-contract.ts`
- `lib/operations/onboarding/welcome-personalisation.test.ts`
- `lib/operations/onboarding/welcome-personalisation.ts`
- `lib/operations/onboarding/workspace-commands.ts`
- `lib/operations/onboarding/workspace-types.ts`
- `lib/operations/studio/access-capability.test.ts`
- `lib/operations/studio/access-capability.ts`
- `lib/operations/studio/active-settings-types.ts`
- `lib/operations/studio/active-settings.test.ts`
- `lib/operations/studio/active-settings.ts`
- `lib/operations/studio/portal-access-read.ts`
- `lib/operations/studio/portal-access.test.ts`
- `lib/operations/studio/portal-access.ts`
- `lib/operations/studio/settings-reply-to.ts`
- `lib/operations/studio/settings.test.ts`
- `lib/operations/studio/settings.ts`
- `next.config.ts`
- `package.json`
- `playwright.config.ts`
- `pnpm-lock.yaml`
- `supabase/migrations/20261001150000_operations_active_studio_settings.sql`
- `supabase/migrations/20261001151000_operations_welcome_draft_restoration.sql`
- `supabase/migrations/20261001153000_operations_client_welcome_packets.sql`
- `tests/e2e/portal-access-workspace.spec.ts`
- `tests/e2e/studio-settings.spec.ts`
- `tests/e2e/welcome-composer.spec.ts`
- `tests/e2e/welcome-rendered-review.spec.ts`
- `tests/integration/operations/client-welcome-packets.test.ts`
- `tests/integration/operations/studio-access-dashboard.test.ts`
- `tests/integration/operations/studio-settings.test.ts`
- `tests/integration/operations/welcome-draft-restoration.test.ts`
