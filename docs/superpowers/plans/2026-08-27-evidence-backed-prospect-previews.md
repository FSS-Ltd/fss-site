# Evidence-backed Prospect Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Generate private prospect previews whose hero, brand treatment, and interactive conversion journey directly reflect verified first-party research.

**Architecture:** Research produces a versioned structured experience brief, with raw provenance retained server-side. The compiler produces an immutable safe composition digest. Focused renderer modules create the art-directed hero, typographic logo fallback, researched interaction, and reduced-motion scroll reveals. Private media lives in Vercel Blob and is streamed only through an approval-aware route.

**Tech Stack:** Next.js 16 App Router, React, TypeScript strict mode, Zod, Postgres/Supabase, Vercel Blob, Sharp, Node test runner with tsx, Tailwind CSS.

**Spec:** docs/superpowers/specs/2026-08-27-evidence-backed-prospect-previews-design.md

## Global constraints

- Research only first-party websites and first-party channels linked from them.
- Never use Google Maps content, third-party imagery, stock imagery, or an AI image API.
- Generated composition source never contains a raw source URL, email, contact detail, Blob URL, or remote image URL.
- Private Blob media is streamed through the application, never redirected to its storage URL.
- No preview refresh, source generation, asset upload, or reconciliation may publish a preview, create a Gmail draft, or send outreach.
- Missing or unsuitable brand media must use a typographic mark or current abstract stage.
- Demo interaction remains local browser state. It has no lookup, booking, persistence, email, analytics, or submission endpoint.
- Motion is in-context and disabled under prefers-reduced-motion. No random floating objects, autoplay, video, or parallax.
- Create the database migration with supabase migration new and let the existing main-merge workflow apply it.

---

## File structure

| File | Responsibility |
| --- | --- |
| lib/growth/prospect-previews/experience-brief.ts | Zod schemas and safe types for hero, journey, visual evidence, and local asset references. |
| lib/growth/research/types.ts and ingestion-schema.ts | Version 1.1 research bundle and first-party provenance validation. |
| lib/growth/research/candidate-details.ts | Persist the assessment experience brief and source-evidence rows. |
| lib/growth/prospect-previews/content.ts | Produce a version 1.1 safe private preview snapshot. |
| lib/growth/prospect-previews/assets/ | Normalize, persist, authorize, and serve private logo and hero assets. |
| lib/growth/prospect-previews/compositions/ | Compile, digest, serialize, and validate the evidence-backed composition. |
| components/prospect-previews/composition-modules/ | Brand mark, hero media, typed journey field, and scroll reveal modules. |
| lib/growth/prospect-previews/refresh/ | Refresh only existing draft concepts and return them to source-only generation. |
| app/api/agent/prospect-preview-assets and prospect-preview-refresh | HMAC-protected agent endpoints. |
| app/api/prospect-preview-assets/[assetId] | State-gated private Blob stream. |
| docs/growth-os/prompts/weekday-research.md | Research instructions for new and refresh runs. |
| supabase/migrations/<timestamp>_evidence_backed_preview_data.sql | Brief column and private asset table. |

## Task 1: Define the versioned evidence and interaction contract

**Files:**
- Create: lib/growth/prospect-previews/experience-brief.ts
- Create: lib/growth/prospect-previews/experience-brief.test.ts
- Modify: lib/growth/prospect-previews/types.ts and types.test.ts
- Modify: lib/growth/research/types.ts, ingestion-schema.ts, ingestion-schema.test.ts, ingestion-schema.test-fixture.ts

**Interfaces:**
- Produces ExperienceBrief, PreviewJourneyStep, PreviewVisual, ResearchBrandEvidenceCandidate, and parseExperienceBrief.
- Supports only vehicle-registration, service-choice, timing-preference, short-note, and contact-preference field kinds.
- Safe Visual stores nullable UUID asset IDs and a validated hexadecimal accent colour. Raw sources remain ResearchBrandEvidenceCandidate only.

- [ ] **Step 1: Write failing contract tests.**

~~~ts
test("accepts Marden's registration-first journey", () => {
  const brief = parseExperienceBrief({
    schemaVersion: "1.1",
    hero: {
      statement: "MOT, servicing and repairs with a clearer first step.",
      supportingServiceLanguage: "Vehicle service requests prepared before workshop follow-up.",
    },
    journey: {
      title: "Prepare your vehicle request",
      primaryCta: "Continue with vehicle details",
      completionMessage: "This demonstration does not send or store your request.",
      steps: [
        { kind: "vehicle-registration", label: "Vehicle registration", required: true },
        { kind: "service-choice", label: "Service required", options: ["MOT", "Service", "Repair"], required: true },
      ],
    },
    visual: { accentColor: "#0e6c80", logoAssetId: null, heroAssetId: null },
  });
  assert.equal(brief.journey.steps[0]?.kind, "vehicle-registration");
});

test("rejects remote visual URLs and a generic text step", () => {
  assert.throws(() => parseExperienceBrief(invalidBrief));
});
~~~

- [ ] **Step 2: Run the new test before implementation.**

Run: node --import tsx --test lib/growth/prospect-previews/experience-brief.test.ts

Expected: missing-module or missing-export failure for parseExperienceBrief.

- [ ] **Step 3: Implement the smallest strict schema.**

Use a Zod discriminated union keyed by kind. A vehicle-registration field is required, carries no options, and does not accept an arbitrary placeholder. A service-choice carries two to six display options. Reject raw URL and email patterns in all display text. Extend research input with brand evidence records containing kind, source URL, observed timestamp, source host, and private-review-only or approved-hero-media use.

- [ ] **Step 4: Extend research validation.**

Require assessment.experienceBrief and brandEvidence in bundle version 1.1. Verify source URLs are HTTP(S), on the verified business host or a related subdomain, and represented as first-party source evidence. Reject Google Maps, third-party hosts, absent provenance, empty journeys, unsafe display text, and unrecognized fields.

- [ ] **Step 5: Verify the domain boundary.**

Run: node --import tsx --test lib/growth/prospect-previews/experience-brief.test.ts lib/growth/prospect-previews/types.test.ts lib/growth/research/ingestion-schema.test.ts

Expected: first-party Marden brief passes; generic, Google, and remote cases fail.

- [ ] **Step 6: Commit.**

Run:
    git add lib/growth/prospect-previews/experience-brief.ts lib/growth/prospect-previews/experience-brief.test.ts lib/growth/prospect-previews/types.ts lib/growth/prospect-previews/types.test.ts lib/growth/research/types.ts lib/growth/research/ingestion-schema.ts lib/growth/research/ingestion-schema.test.ts lib/growth/research/ingestion-schema.test-fixture.ts
    git commit -m "feat: define evidence-backed preview briefs"

## Task 2: Persist safe briefs and private first-party media

**Files:**
- Create migration with: supabase migration new evidence_backed_preview_data
- Create: lib/growth/prospect-previews/assets/service.ts and service.test.ts
- Create: lib/growth/prospect-previews/assets/repository.ts and repository.test.ts
- Modify: lib/growth/research/candidate-details.ts and candidate-details.test.ts
- Modify: lib/growth/prospect-previews/content.ts and content.test.ts
- Modify: lib/growth/email/assets/vercel-blob.ts and vercel-blob.test.ts

**Interfaces:**
- Produces version 1.1 StoredProspectPreviewSnapshot with a safe ExperienceBrief and only opaque asset IDs.
- Produces storeProspectPreviewAsset(input, dependencies), returning an opaque UUID with access private.
- Reads raw provenance only from the private database.

- [ ] **Step 1: Write failing storage tests.**

~~~ts
test("stores a verified first-party logo privately", async () => {
  const asset = await storeProspectPreviewAsset(validLogoInput, dependencies);
  assert.match(asset.id, UUID_PATTERN);
  assert.equal(asset.access, "private");
});

test("rejects an asset whose source URL is not recorded first-party evidence", async () => {
  await assert.rejects(() => storeProspectPreviewAsset(unrecordedSource, dependencies));
});
~~~

- [ ] **Step 2: Run the test before implementation.**

Run: node --import tsx --test lib/growth/prospect-previews/assets/service.test.ts

Expected: missing-module or missing-export failure.

- [ ] **Step 3: Create the migration.**

In the CLI-generated migration add an optional jsonb experience_brief column to growth.website_assessments, constrained to an object when present. Create growth.prospect_preview_assets with opaque UUID ID, prospect and research-run foreign keys, asset kind constrained to logo, on_site_image, or hero_media, source URL, private Blob URL, normalized image dimensions, SHA-256, and review status constrained to private_review_only, approved_hero_media, or rejected. Index prospect ID plus review status and research run ID. Revoke all public, anon, authenticated, and service_role access; grant growth_app only.

- [ ] **Step 4: Implement normalization and persistence.**

Validate JPEG, PNG, and WebP magic bytes, bound input pixels with Sharp, normalize to WebP, and enforce positive dimensions. Add a private Blob adapter using access private and preserve the existing public email asset behaviour. Persist only when the source URL exactly matches first-party evidence for the same prospect and research run. Never surface a Blob URL in a composition or agent report.

- [ ] **Step 5: Build safe snapshots.**

Persist assessment experience_brief and construct a schema version 1.1 snapshot with safe display content and null asset IDs. Keep legacy version 1.0 snapshots parseable for historical public records. The compiler must later refuse legacy snapshots until the concept has a refresh brief.

- [ ] **Step 6: Verify persistence.**

Run: node --import tsx --test lib/growth/prospect-previews/assets/service.test.ts lib/growth/prospect-previews/assets/repository.test.ts lib/growth/research/candidate-details.test.ts lib/growth/prospect-previews/content.test.ts

Run after migration generation: supabase migration list --local

Expected: all tests pass and exactly one new migration appears.

- [ ] **Step 7: Commit.**

Run:
    git add supabase/migrations lib/growth/prospect-previews/assets lib/growth/research/candidate-details.ts lib/growth/research/candidate-details.test.ts lib/growth/prospect-previews/content.ts lib/growth/prospect-previews/content.test.ts lib/growth/email/assets/vercel-blob.ts lib/growth/email/assets/vercel-blob.test.ts
    git commit -m "feat: persist private preview evidence and assets"

## Task 3: Add signed asset intake and approval-aware delivery

**Files:**
- Create: lib/growth/prospect-previews/assets/route-handler.ts and route-handler.test.ts
- Create: app/api/agent/prospect-preview-assets/route.ts and route.test.ts
- Create: lib/growth/prospect-previews/assets/public-route-handler.ts and public-route-handler.test.ts
- Create: app/api/prospect-preview-assets/[assetId]/route.ts and route.test.ts

**Interfaces:**
- HMAC upload accepts exactly runId, prospectId, assetKind, sourceUrl, altText, and file.
- GET streams the private object only in a nonproduction review deployment, or after the linked preview is published.
- Upload atomically records asset ID in the still-draft snapshot. It cannot alter email or publication state.

- [ ] **Step 1: Write failing authorization and public-delivery tests.**

~~~ts
test("rejects unsigned upload before reading multipart bytes", async () => {
  const response = await handler(unsignedRequest);
  assert.equal(response.status, 401);
  assert.equal(storeCalls, 0);
});

test("does not serve a private logo from Production before approval", async () => {
  const response = await getAsset({ production: true, previewState: "merged_draft" });
  assert.equal(response.status, 404);
});
~~~

- [ ] **Step 2: Run tests before implementation.**

Run: node --import tsx --test lib/growth/prospect-previews/assets/route-handler.test.ts lib/growth/prospect-previews/assets/public-route-handler.test.ts

Expected: missing-module or missing-export failure.

- [ ] **Step 3: Implement narrow intake.**

Verify x-fss HMAC before multipart parsing. Bound input size, reject SVG and magic-byte mismatch, call Task 2 storage, and set only the matching draft snapshot asset field. Return redacted status and opaque asset ID.

- [ ] **Step 4: Implement state-gated serving.**

Use Node runtime and the private Blob get API to stream bytes. In review deployments set X-Robots-Tag to noindex, nofollow and Cache-Control to private, no-store. Production only streams an asset linked to a preview whose status and generation status are both published. Never redirect to the Blob URL.

- [ ] **Step 5: Verify asset routes.**

Run: node --import tsx --test lib/growth/prospect-previews/assets/route-handler.test.ts app/api/agent/prospect-preview-assets/route.test.ts lib/growth/prospect-previews/assets/public-route-handler.test.ts app/api/prospect-preview-assets/[assetId]/route.test.ts

Expected: HMAC, provenance, noindex, private streaming, and production-gate tests pass.

- [ ] **Step 6: Commit.**

Run:
    git add app/api/agent/prospect-preview-assets app/api/prospect-preview-assets lib/growth/prospect-previews/assets
    git commit -m "feat: add private prospect preview asset intake"

## Task 4: Compile evidence rather than sector defaults

**Files:**
- Modify: lib/growth/prospect-previews/compositions/types.ts and types.test.ts
- Modify: lib/growth/prospect-previews/compositions/compiler.ts and compiler.test.ts
- Modify: lib/growth/prospect-previews/compositions/serialize.ts and serialize.test.ts
- Modify: lib/growth/prospect-previews/generation/generated-files.ts and generated-files.test.ts

**Interfaces:**
- Version 1.1 ProspectPreviewComposition contains hero statement, typed journey steps, accent colour, and local opaque asset IDs.
- Compiler result adds missing_experience_brief as an unavailable reason.
- Digest includes each safe interaction and visual field.

- [ ] **Step 1: Write the failing Marden compiler test.**

~~~ts
test("compiles a registration-first MOT journey from research", () => {
  const result = compileProspectPreviewComposition(mardenInput);
  assert.equal(result.status, "compiled");
  if (result.status === "compiled") {
    assert.equal(result.composition.copy.headline, "MOT, servicing and repairs with a clearer first step.");
    assert.equal(result.composition.journey.steps[0]?.kind, "vehicle-registration");
  }
});

test("does not turn a legacy snapshot into a generic form", () => {
  assert.deepEqual(compileProspectPreviewComposition(legacyInput), {
    status: "unavailable",
    reason: "missing_experience_brief",
  });
});
~~~

- [ ] **Step 2: Run it before implementation.**

Run: node --import tsx --test lib/growth/prospect-previews/compositions/compiler.test.ts

Expected: the current family headline and generic journey fail the assertions.

- [ ] **Step 3: Remove the generic fallback.**

Delete headlineForFamily and journeyForFamily. Retain family solely for visual variation. Feed the typed brief into the composition and canonical digest. Do not include brand evidence source URLs or Blob URLs. Record missing briefs as unavailable without touching approval, email, or public status.

- [ ] **Step 4: Verify compilation and source serialization.**

Run: node --import tsx --test lib/growth/prospect-previews/compositions/types.test.ts lib/growth/prospect-previews/compositions/compiler.test.ts lib/growth/prospect-previews/compositions/serialize.test.ts lib/growth/prospect-previews/generation/generated-files.test.ts

Expected: deterministic safe source packages pass; generic and remote data fail.

- [ ] **Step 5: Commit.**

Run:
    git add lib/growth/prospect-previews/compositions lib/growth/prospect-previews/generation/generated-files.ts lib/growth/prospect-previews/generation/generated-files.test.ts
    git commit -m "feat: compile evidence-backed preview journeys"

## Task 5: Render art-directed evidence and local-only interaction

**Files:**
- Create: components/prospect-previews/composition-modules/composition-brand-mark.tsx and test
- Create: components/prospect-previews/composition-modules/composition-hero-media.tsx and test
- Create: components/prospect-previews/composition-modules/composition-journey-step.tsx and test
- Modify: components/prospect-previews/composition-modules/composition-hero.tsx
- Modify: components/prospect-previews/composition-modules/composition-journey.tsx
- Modify: components/prospect-previews/composition-preview.tsx and composition-preview.test.tsx
- Modify: components/prospect-previews/reveal-on-scroll.tsx and reveal-on-scroll.test.tsx
- Modify: app/preview/preview.css

**Interfaces:**
- All props passed to client code are serializable composition values.
- CompositionBrandMark renders a text mark if logoAssetId is null.
- CompositionJourneyStep owns local input state for one allowed step only.

- [ ] **Step 1: Write failing brand and hero tests.**

~~~tsx
test("uses a text brand mark without a logo asset", () => {
  const html = renderToStaticMarkup(<CompositionBrandMark composition={withoutLogo} />);
  assert.match(html, /Marden Garage/);
  assert.doesNotMatch(html, /prospect-preview-assets/);
});

test("uses the research hero rather than a sector headline", () => {
  const html = renderToStaticMarkup(<CompositionHero composition={marden} />);
  assert.match(html, /MOT, servicing and repairs with a clearer first step/);
  assert.doesNotMatch(html, /Vehicle care made easier to book/);
});
~~~

- [ ] **Step 2: Run tests before implementation.**

Run: node --import tsx --test components/prospect-previews/composition-modules/composition-brand-mark.test.tsx components/prospect-previews/composition-modules/composition-hero-media.test.tsx

Expected: missing module or current generic-headline failure.

- [ ] **Step 3: Implement the brand and hero stage.**

Use next/image with the internal asset route, explicit dimensions and sizes. The typographic mark is the accessible fallback. The existing abstract artwork remains the visual fallback. Only an explicit approved hero asset may replace it; research alone never invents a 3D image.

- [ ] **Step 4: Write a failing interactive Marden journey test.**

~~~tsx
test("renders registration before service choice and has no submit endpoint", () => {
  const html = renderToStaticMarkup(<CompositionJourney composition={marden} />);
  assert.ok(html.indexOf("Vehicle registration") < html.indexOf("Service required"));
  assert.match(html, /AB12 CDE/);
  assert.match(html, /Demonstration only\. This form does not send or store information/);
  assert.doesNotMatch(html, /action=/);
});
~~~

- [ ] **Step 5: Implement typed steps.**

Normalize number plates in client memory, require each declared step before continuation, use labelled controls and aria-live confirmation, and import neither analytics nor a server mutation. Make timing and note fields appear only where research declares them.

- [ ] **Step 6: Add Apple-style in-context reveal.**

Wrap the hero media stage and relevant below-fold sections with RevealOnScroll. Add opacity, transform, and mask transitions only inside prefers-reduced-motion: no-preference. In reduced mode, remove transform and duration. Ensure unobserved markup remains visible when JavaScript is absent.

- [ ] **Step 7: Verify components.**

Run: node --import tsx --test components/prospect-previews/composition-preview.test.tsx components/prospect-previews/composition-modules/composition-brand-mark.test.tsx components/prospect-previews/composition-modules/composition-hero-media.test.tsx components/prospect-previews/composition-modules/composition-journey-step.test.tsx components/prospect-previews/reveal-on-scroll.test.tsx

Expected: Marden step order, text fallback, evidence headline, motion behavior, and demo-only guard pass.

- [ ] **Step 8: Commit.**

Run:
    git add components/prospect-previews app/preview/preview.css
    git commit -m "feat: render evidence-backed preview experiences"

## Task 6: Refresh existing drafts and regenerate all thirteen source packages

**Files:**
- Create: lib/growth/prospect-previews/refresh/service.ts and service.test.ts
- Create: lib/growth/prospect-previews/refresh/repository.ts and repository.test.ts
- Create: lib/growth/prospect-previews/refresh/route-handler.ts and route-handler.test.ts
- Create: app/api/agent/prospect-preview-refresh/route.ts and route.test.ts
- Modify: docs/growth-os/prompts/weekday-research.md
- Modify: lib/growth/research/scheduled-agent-runner.ts and test
- Modify: lib/growth/research/redacted-run-report.ts and test
- Modify: lib/growth/prospect-previews/generation/orchestrator.ts and test
- Modify: lib/growth/prospect-previews/generation/reconcile.ts and test
- Modify: lib/growth/prospect-previews/generation/github-preview-pr.ts and test
- Modify: scripts/run-scheduled-research-agent.ts
- Modify: docs/growth-os/runbooks/scheduled-research.md

**Interfaces:**
- Refresh accepts a signed first-party brief for an existing prospect UUID.
- It changes only draft assessment and preview snapshot, clears old composition metadata, and sets generation status pending_pr.
- It does not insert prospects, alter public ID, change prospect status, mutate email tasks, create email messages, or publish.

- [ ] **Step 1: Write the failing refresh safety tests.**

~~~ts
test("refreshes only an existing draft for source regeneration", async () => {
  const result = await refreshPreview(validInput, repository);
  assert.equal(result.status, "refreshed");
  assert.equal(repository.updated.previewStatus, "draft");
  assert.equal(repository.updated.generationStatus, "pending_pr");
  assert.equal(repository.prospectInserts, 0);
  assert.equal(repository.emailWrites, 0);
});

test("rejects a published preview before changing its content", async () => {
  await assert.rejects(() => refreshPreview(publishedInput, repository));
});
~~~

- [ ] **Step 2: Run tests before implementation.**

Run: node --import tsx --test lib/growth/prospect-previews/refresh/service.test.ts

Expected: missing-module or missing-export failure.

- [ ] **Step 3: Implement atomic refresh and HMAC route.**

Accept only draft states pending_pr, composition_unavailable, or merged_draft. Validate the exact first-party brief, append provenance, replace the safe content snapshot, clear composition digest and PR metadata, and set pending_pr. Return redacted aggregate result. The HMAC route must not return contacts, raw sources, Blob URLs, email content, or business content.

- [ ] **Step 4: Update controlled research instructions.**

Require version 1.1 brand evidence and journey for every new prospect. Add refresh mode that operates only on supplied existing identities, uploads eligible assets through the new signed asset endpoint, and emits only aggregate report counts. Preserve the explicit bans on GitHub calls by the child, AI image calls, Gmail drafts, and sends.

- [ ] **Step 5: Verify refresh and scheduler controls.**

Run: node --import tsx --test lib/growth/prospect-previews/refresh/service.test.ts lib/growth/prospect-previews/refresh/repository.test.ts lib/growth/prospect-previews/refresh/route-handler.test.ts app/api/agent/prospect-preview-refresh/route.test.ts lib/growth/research/redacted-run-report.test.ts lib/growth/research/scheduled-agent-runner.test.ts lib/growth/prospect-previews/generation/orchestrator.test.ts lib/growth/prospect-previews/generation/reconcile.test.ts lib/growth/prospect-previews/generation/github-preview-pr.test.ts

Expected: only drafts change, source PR output stays composition-only, and no email/public actions occur.

- [ ] **Step 6: Run the thirteen-record private refresh.**

Use the existing signed agent credential and refresh workflow. Confirm its redacted report says thirteen refreshed drafts and zero publications, Gmail drafts, or sends. Trigger the existing source-PR parent only after refresh succeeds. Do not merge that PR.

- [ ] **Step 7: Verify the review PR.**

Run: gh pr view <new-pr-number> --json state,files,checks,url

Expected: it is open and changes only generated composition source and manifest. There are no public routes, media source URLs, outreach, or email changes.

- [ ] **Step 8: Commit implementation and runbook changes.**

Run:
    git add lib/growth/prospect-previews/refresh lib/growth/prospect-previews/generation app/api/agent/prospect-preview-refresh docs/growth-os/prompts/weekday-research.md docs/growth-os/runbooks/scheduled-research.md lib/growth/research/scheduled-agent-runner.ts lib/growth/research/redacted-run-report.ts scripts/run-scheduled-research-agent.ts
    git commit -m "feat: refresh evidence-backed preview packages"

## Task 7: Full verification and review handoff

**Files:**
- Modify only files from Tasks 1 through 6.
- Never stage the pre-existing untracked planning or design documents.

- [ ] **Step 1: Run the focused workflow suite.**

Run:
    node --import tsx --test $(rg --files lib/growth/prospect-previews lib/growth/research components/prospect-previews app/preview app/api/agent app/api/prospect-preview-assets | rg '\.test\.(ts|tsx)$' | sort)

Expected: all related tests pass with no skips.

- [ ] **Step 2: Run static and build checks.**

Run:
    pnpm typecheck
    pnpm lint
    pnpm exec next build --webpack
    pnpm verify:migrations
    supabase migration list --local

Expected: each command exits 0. Record the local Node 22 engine warning if present; CI uses Node 24.

- [ ] **Step 3: Verify private production state.**

Use the signed production inventory endpoint. Confirm every refreshed package is pr_open or merged_draft, published remains 0, and there are no email-task writes from generation or refresh. Confirm the public repository still requires both preview status published and generation status published.

- [ ] **Step 4: Self-review and present approval material.**

Run:
    git diff --check
    git diff --stat
    gh pr view <new-pr-number> --json state,files,checks,url

Present the source PR and private preview URLs for founder review. Do not merge, publish, create a Gmail draft, or contact prospects without a separate founder instruction.

