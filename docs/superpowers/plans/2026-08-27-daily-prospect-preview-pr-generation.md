# Daily Prospect Preview PR Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Create a validated, source-controlled unique site composition for every accepted discovery prospect, open one review PR per 06:00 run, and publish each page and its email link only after individual founder approval.

**Architecture:** A pure composition compiler transforms the existing safe preview snapshot into an allowlisted package and SHA-256 digest. A trusted HMAC-authenticated server boundary writes package sources to a dated GitHub branch; the disposable researcher has no GitHub write capability. Dashboard and public pages render the same merged package, while the existing atomic approval flow receives new source, merge, and digest checks.

**Tech Stack:** Next.js App Router, React, strict TypeScript, Zod, Node crypto, PostgreSQL/Supabase, postgres, injected fetch, Node test runner with tsx, Vercel PR deployments.

**Spec:** docs/superpowers/specs/2026-08-27-prospect-preview-pr-creation-design.md

## Global Constraints

- Do not call an AI, image-generation, paid-model, or remote-image API. Hero treatments use local CSS/SVG primitives and reviewed local fallback assets only.
- Reuse core primitives only. Every composition has business-specific copy and a same-sector-unique fingerprint of visual direction, hero treatment, section order, and conversion journey within a run.
- The researcher remains disposable and read-only. It receives no GitHub credential, source write permission, preview publication permission, or email drafting/sending permission.
- One run opens or updates one branch named generated/prospect-previews/YYYY-MM-DD. Package content and manifest output are deterministic from accepted private snapshots.
- Vercel PR review routes and canonical preview routes are noindex and nofollow, absent from the sitemap, and absent from public navigation.
- PR creation and merge never publish a preview or change email. Individual founder approval is the only publication action.
- Generated package source excludes contact names, email addresses, phone numbers, company numbers, raw research URLs, private notes, credentials, and tokens.
- Do not add a dependency. Use existing Zod, Node standard library, fetch, and test patterns.
- Preserve status (draft, published, withdrawn) and add a separate generation state. Generic historical drafts remain unpublishable until a merged package matches them.
- Run supabase migration new prospect_preview_generation during implementation and use the filename it creates. Do not invent a migration timestamp.

---

## File Structure

- lib/growth/prospect-previews/compositions/types.ts owns the allowlisted composition schema, digest, fingerprint, and package privacy checks.
- lib/growth/prospect-previews/compositions/compiler.ts deterministically compiles a snapshot into one family-specific composition and resolves same-sector collisions.
- lib/growth/prospect-previews/compositions/manifest.ts imports merged package files and looks them up by slug, prospect ID, and digest.
- lib/growth/prospect-previews/compositions/generated/*.ts are generated, reviewable package files. Daily PRs change these files and the manifest only.
- lib/growth/prospect-previews/compositions/serialize.ts produces stable TypeScript source for GitHub commits.
- components/prospect-previews/composition-preview.tsx and composition-modules/*.tsx render shared local-only modules without database knowledge.
- lib/growth/prospect-previews/composition-repository.ts persists/retrieves generation state and founder change requests.
- lib/growth/prospect-previews/generation/*.ts owns generated-file assembly, GitHub transport, PR orchestration, and merge reconciliation.
- app/api/agent/prospect-preview-prs/route.ts is the signed trusted-scheduler trigger.
- scripts/backfill-prospect-preview-pr.ts creates the one source-only PR for the ten existing drafts.

### Task 1: Composition schema and deterministic compiler

**Files:**

- Create: lib/growth/prospect-previews/compositions/types.ts
- Create: lib/growth/prospect-previews/compositions/types.test.ts
- Create: lib/growth/prospect-previews/compositions/compiler.ts
- Create: lib/growth/prospect-previews/compositions/compiler.test.ts
- Modify: lib/growth/prospect-previews/types.ts

**Interfaces:**

- Consumes: StoredProspectPreviewSnapshot from lib/growth/prospect-previews/types.ts.
- Produces: ProspectPreviewComposition, validateProspectPreviewComposition, buildCompositionDigest, buildCompositionFingerprint, and compileProspectPreviewComposition.
- Compiler input is { prospectId, slug, snapshot, existingFingerprints }; output is either { status: "compiled", composition } or { status: "unavailable", reason: "unsupported_sector" | "no_unique_variant" }.

- [ ] **Step 1: Write failing schema tests**

~~~ts
test("accepts a local-only composition with a canonical digest", () => {
  const input = {
    schemaVersion: "1.0", prospectId: ID, slug: "marden-garage",
    family: "automotive", visualDirection: "precision-dark", heroTreatment: "workshop-geometry",
    sectionOrder: ["hero", "proof", "services", "journey", "locality", "owner-cta"],
    journey: { type: "mot-request", completionMessage: "Your preferred time is ready for a follow-up." },
    copy: { businessName: "Marden Garage", locality: "Marden", headline: "A clearer route into vehicle care.", primaryCta: "Request an MOT slot" },
  } as const;
  const digest = buildCompositionDigest(input);
  assert.equal(validateProspectPreviewComposition({ ...input, digest }).digest, digest);
});

test("rejects remote hero assets and repeated modules", () => {
  assert.throws(() => validateProspectPreviewComposition({
    ...valid,
    heroTreatment: "https://images.example/hero.webp",
    sectionOrder: ["hero", "proof", "proof", "journey", "owner-cta"],
  }));
});
~~~

- [ ] **Step 2: Confirm the new test fails**

Run: node --import tsx --test lib/growth/prospect-previews/compositions/types.test.ts

Expected: FAIL because no composition schema exists.

- [ ] **Step 3: Implement the small allowlisted schema**

~~~ts
export const prospectPreviewFamilySchema = z.enum([
  "automotive", "property-trades", "hospitality", "property", "professional-services",
]);
export const previewSectionSchema = z.enum([
  "hero", "proof", "services", "case-for-change", "journey", "locality", "owner-cta",
]);
export const previewJourneySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mot-request"), completionMessage: safeText(1, 220) }).strict(),
  z.object({ type: z.literal("quote-request"), completionMessage: safeText(1, 220) }).strict(),
  z.object({ type: z.literal("table-enquiry"), completionMessage: safeText(1, 220) }).strict(),
  z.object({ type: z.literal("valuation-request"), completionMessage: safeText(1, 220) }).strict(),
  z.object({ type: z.literal("consultation-request"), completionMessage: safeText(1, 220) }).strict(),
]);

export function buildCompositionDigest(
  input: Omit<ProspectPreviewComposition, "digest"> | ProspectPreviewComposition,
): string {
  const { digest: _discarded, ...canonical } = input;
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
~~~

Use strict objects, UUID prospect IDs, lowercase 64-hex digests, a URL-safe slug pattern, named local hero treatments, no duplicate sections, and required hero/journey sections. Do not change the stored snapshot schema version.

- [ ] **Step 4: Write failing compiler tests**

~~~ts
test("chooses a different automotive fingerprint when the first is used in this run", () => {
  const first = compileProspectPreviewComposition({
    prospectId: ID_A, slug: "marden-garage", snapshot, existingFingerprints: new Set(),
  });
  assert.equal(first.status, "compiled");

  const second = compileProspectPreviewComposition({
    prospectId: ID_B, slug: "dunkleys-of-deal", snapshot,
    existingFingerprints: new Set([buildCompositionFingerprint(first.composition)]),
  });
  assert.equal(second.status, "compiled");
  assert.notEqual(buildCompositionFingerprint(second.composition), buildCompositionFingerprint(first.composition));
});

test("rejects a sector without an allowlisted family", () => {
  assert.deepEqual(
    compileProspectPreviewComposition({ ...unknownSectorInput, existingFingerprints: new Set() }),
    { status: "unavailable", reason: "unsupported_sector" },
  );
});
~~~

- [ ] **Step 5: Implement compiler variants and copy derivation**

~~~ts
export function compileProspectPreviewComposition(
  input: CompileProspectPreviewCompositionInput,
): CompileProspectPreviewCompositionResult {
  const family = resolveProspectPreviewFamily(input.snapshot.sector);
  if (family === null) return { status: "unavailable", reason: "unsupported_sector" };

  for (const variant of orderedVariants(family, input.prospectId)) {
    const composition = finalizeComposition({
      ...variant,
      prospectId: input.prospectId,
      slug: input.slug,
      copy: deriveCopy(input.snapshot, family, variant),
    });
    if (!input.existingFingerprints.has(buildCompositionFingerprint(composition))) {
      return { status: "compiled", composition };
    }
  }
  return { status: "unavailable", reason: "no_unique_variant" };
}
~~~

Map garage/vehicle/MOT to automotive; roofing/plumbing/property repairs to property-trades; cafes/restaurants/beer venues to hospitality; estate/letting to property; and accountant/legal/consulting to professional-services. Add three named local-only variants per family. Derive copy solely from the safe stored snapshot.

- [ ] **Step 6: Run focused tests**

Run: node --import tsx --test lib/growth/prospect-previews/compositions/types.test.ts lib/growth/prospect-previews/compositions/compiler.test.ts

Expected: PASS.

- [ ] **Step 7: Commit**

~~~bash
git add lib/growth/prospect-previews/types.ts lib/growth/prospect-previews/compositions
git commit -m "feat: add deterministic prospect preview compositions"
~~~

### Task 2: Static package manifest and reusable composition renderer

**Files:**

- Create: lib/growth/prospect-previews/compositions/manifest.ts
- Create: lib/growth/prospect-previews/compositions/manifest.test.ts
- Create: lib/growth/prospect-previews/compositions/serialize.ts
- Create: lib/growth/prospect-previews/compositions/serialize.test.ts
- Create: components/prospect-previews/composition-preview.tsx
- Create: components/prospect-previews/composition-preview.test.tsx
- Create: components/prospect-previews/composition-modules/composition-hero.tsx
- Create: components/prospect-previews/composition-modules/composition-proof.tsx
- Create: components/prospect-previews/composition-modules/composition-journey.tsx
- Create: components/prospect-previews/composition-modules/composition-owner-cta.tsx
- Modify: app/preview/[slug]/page.tsx
- Modify: components/prospect-previews/prospect-preview-renderer.tsx
- Modify: docs/prospect-previews.md

**Interfaces:**

- Consumes: ProspectPreviewComposition from Task 1.
- Produces: getMergedProspectPreviewCompositionBySlug, getMergedProspectPreviewCompositionByProspectId, serializeGeneratedComposition, and CompositionPreview with composition/mode props.
- Generated files follow lib/growth/prospect-previews/compositions/generated/<slug>.ts and export a typed package constant.

- [ ] **Step 1: Write failing manifest and serializer tests**

~~~ts
test("serialises a stable, safe TypeScript package", () => {
  const source = serializeGeneratedComposition(composition);
  assert.match(source, /satisfies ProspectPreviewComposition/);
  assert.doesNotMatch(source, /https?:\/\//);
  assert.equal(source, serializeGeneratedComposition(composition));
});

test("returns null for absent merged package lookups", () => {
  assert.equal(getMergedProspectPreviewCompositionBySlug("not-a-real-prospect"), null);
  assert.equal(
    getMergedProspectPreviewCompositionByProspectId("00000000-0000-4000-8000-000000000000"),
    null,
  );
});
~~~

- [ ] **Step 2: Confirm these tests fail**

Run: node --import tsx --test lib/growth/prospect-previews/compositions/manifest.test.ts lib/growth/prospect-previews/compositions/serialize.test.ts

Expected: FAIL because manifest and serializer do not exist.

- [ ] **Step 3: Implement static manifest and serializer**

~~~ts
export function getMergedProspectPreviewCompositionBySlug(
  slug: string,
): ProspectPreviewComposition | null {
  const composition = generatedProspectPreviewCompositions[slug];
  return composition === undefined ? null : validateProspectPreviewComposition(composition);
}

export function serializeGeneratedComposition(
  composition: ProspectPreviewComposition,
): string {
  const parsed = validateProspectPreviewComposition(composition);
  const identifier = toTypeScriptIdentifier(parsed.slug + "-composition");
  return [
    'import type { ProspectPreviewComposition } from "../types";',
    "",
    "export const " + identifier + " = " + JSON.stringify(parsed, null, 2)
      + " as const satisfies ProspectPreviewComposition;",
    "",
  ].join("\n");
}
~~~

manifest.ts is an explicit import/map only, rewritten deterministically by Task 5. Do not use runtime filesystem scanning. Review deployments must render packages without database credentials.

- [ ] **Step 4: Write a failing rendering test for two unique shapes**

~~~tsx
test("renders an ordered automotive journey", () => {
  const markup = renderToStaticMarkup(<CompositionPreview composition={automotive} mode="review" />);
  assert.match(markup, /Request an MOT slot/);
  assert.ok(markup.indexOf("MOT request") < markup.indexOf("Service area"));
});

test("does not render automotive content for hospitality", () => {
  const markup = renderToStaticMarkup(<CompositionPreview composition={hospitality} mode="review" />);
  assert.match(markup, /Plan your table enquiry/);
  assert.doesNotMatch(markup, /MOT request/);
});
~~~

- [ ] **Step 5: Implement shared local-only primitives**

~~~tsx
export function CompositionPreview({ composition, mode }: CompositionPreviewProps) {
  const sections: Record<PreviewSection, ReactNode> = {
    hero: <CompositionHero composition={composition} key="hero" />,
    proof: <CompositionProof composition={composition} key="proof" />,
    services: <CompositionServices composition={composition} key="services" />,
    "case-for-change": <CompositionCaseForChange composition={composition} key="case-for-change" />,
    journey: <CompositionJourney composition={composition} key="journey" />,
    locality: <CompositionLocality composition={composition} key="locality" />,
    "owner-cta": <CompositionOwnerCta composition={composition} key="owner-cta" mode={mode} />,
  };
  return <main data-preview-family={composition.family}>{composition.sectionOrder.map((section) => sections[section])}</main>;
}
~~~

Hero art is CSS/SVG selected by heroTreatment, never a remote asset and never random floating animation. The simulated journey prevents network submission and shows the package completion message. In Vercel Preview, /preview/[slug] reads the static manifest. Preserve the two current manual samples as typed fixtures until generated packages supersede them.

- [ ] **Step 6: Run renderer, route, and sitemap tests**

Run: node --import tsx --test lib/growth/prospect-previews/compositions/manifest.test.ts lib/growth/prospect-previews/compositions/serialize.test.ts components/prospect-previews/composition-preview.test.tsx app/preview/page.test.tsx app/sitemap.test.ts

Expected: PASS.

- [ ] **Step 7: Commit**

~~~bash
git add app/preview/[slug]/page.tsx components/prospect-previews lib/growth/prospect-previews/compositions docs/prospect-previews.md
git commit -m "feat: render source-controlled prospect preview packages"
~~~

### Task 3: Generation persistence and founder change requests

**Files:**

- Create: migration generated by supabase migration new prospect_preview_generation
- Create: lib/growth/prospect-previews/composition-repository.ts
- Create: lib/growth/prospect-previews/composition-repository.test.ts
- Create: lib/growth/prospect-previews/change-requests.ts
- Create: lib/growth/prospect-previews/change-requests.test.ts
- Modify: lib/growth/prospect-previews/founder-review.ts
- Modify: lib/growth/prospect-previews/founder-review.test.ts
- Modify: scripts/verify-migrations.ts

**Interfaces:**

- Consumes: package digest/composition from Tasks 1–2.
- Produces: listPreviewGenerationCandidates, recordPreviewGenerationResult, getFounderPreviewComposition, and createPreviewChangeRequest.
- PreviewGenerationRecord contains slug, compositionDigest, generationStatus, generationPrNumber, generationBranch, reviewDeploymentUrl, generationExternalRunId, and generatedAt.

- [ ] **Step 1: Write failing persistence tests**

~~~ts
test("stores only private generation metadata", async () => {
  await repository.recordPreviewGenerationResult(db, {
    prospectId: ID, slug: "marden-garage", compositionDigest: "a".repeat(64),
    generationStatus: "pr_open", generationPrNumber: 321,
    generationBranch: "generated/prospect-previews/2026-08-27",
    reviewDeploymentUrl: "https://example.vercel.app/preview/marden-garage",
    generationExternalRunId: "weekday-2026-08-27-0600-europe-london-v1",
    generatedAt: new Date("2026-08-27T06:05:00.000Z"),
  });
  assert.match(capturedSql, /composition_digest/);
  assert.doesNotMatch(capturedSql, /email_address|contact_name|company_number/i);
});

test("rejects outer-spaced feedback and an unmatched digest", async () => {
  await assert.rejects(() => createPreviewChangeRequest(db, { ...validRequest, notes: " change the hero" }));
  await assert.rejects(() => createPreviewChangeRequest(db, { ...validRequest, compositionDigest: "b".repeat(64) }));
});
~~~

- [ ] **Step 2: Create and verify the migration**

Run: supabase migration new prospect_preview_generation

Add nullable slug, composition_digest, generation_pr_number, generation_branch, review_deployment_url, generation_external_run_id, and generated_at to growth.prospect_previews. Add generation_status text not null default 'pending_pr' constrained to pending_pr, pr_open, merged_draft, composition_unavailable, published, and withdrawn. Add a partial unique slug index and checks requiring slug/digest/PR/branch for pr_open, merged_draft, and published.

Create growth.prospect_preview_change_requests with UUID key, prospect_preview_id foreign key on delete restrict, digest, optional PR number, notes, status (open, resolved, superseded), creator actor ID, and timestamps. Revoke all then grant only growth_app select/insert/update.

Run: pnpm verify:migrations

Expected: PASS.

- [ ] **Step 3: Implement repository/read model**

~~~ts
export async function getFounderPreviewComposition(
  prospectId: string,
  db = getGrowthDb(),
): Promise<FounderPreviewCompositionResult> {
  const row = await selectPreviewGenerationRow(prospectId, db);
  if (row === null) return { status: "not_found" };

  const composition = getMergedProspectPreviewCompositionBySlug(row.slug);
  if (composition === null || composition.digest !== row.compositionDigest) {
    return { status: "not_ready", reason: composition === null ? "missing_package" : "digest_mismatch" };
  }
  return row.generationStatus === "merged_draft" || row.generationStatus === "published"
    ? { status: "ready", preview: { composition, ...row } }
    : { status: "not_ready", reason: row.generationStatus };
}
~~~

Use tagged postgres queries, generic dashboard errors with correlation IDs, and no contact data in request records or dashboard payloads.

- [ ] **Step 4: Run persistence tests**

Run: node --import tsx --test lib/growth/prospect-previews/composition-repository.test.ts lib/growth/prospect-previews/change-requests.test.ts lib/growth/prospect-previews/founder-review.test.ts scripts/verify-migrations.test.ts && pnpm verify:migrations

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add supabase/migrations lib/growth/prospect-previews/composition-repository.ts lib/growth/prospect-previews/composition-repository.test.ts lib/growth/prospect-previews/change-requests.ts lib/growth/prospect-previews/change-requests.test.ts lib/growth/prospect-previews/founder-review.ts lib/growth/prospect-previews/founder-review.test.ts scripts/verify-migrations.ts
git commit -m "feat: record generated prospect preview lifecycle"
~~~

### Task 4: Founder review and fail-closed publication

**Files:**

- Create: app/api/growth/prospects/[id]/preview/change-request/route.ts
- Create: app/api/growth/prospects/[id]/preview/change-request/route.test.ts
- Create: lib/growth/prospect-previews/change-request-route-handler.ts
- Create: lib/growth/prospect-previews/change-request-route-handler.test.ts
- Modify: components/growth/prospects/preview-approval.tsx
- Modify: components/growth/prospects/founder-preview-list.tsx
- Modify: app/(growth)/(dashboard)/growth/prospects/[prospectId]/preview/page.tsx
- Modify: lib/growth/prospect-previews/approval.ts
- Modify: lib/growth/prospect-previews/approval-repository.ts
- Modify: lib/growth/prospect-previews/public-repository.ts
- Modify: app/preview/[slug]/page.tsx
- Modify: app/preview/p/[publicId]/page.tsx

**Interfaces:**

- Consumes: Task 3 getFounderPreviewComposition and createPreviewChangeRequest plus Task 2 manifest lookup.
- Produces: POST /api/growth/prospects/:id/preview/change-request, buildCodexChangeBrief, and getPublishedProspectPreviewBySlug.
- Approval now requires generationStatus === "merged_draft", a current manifest package, and exact source/database digest equality.

- [ ] **Step 1: Write failing approval and feedback tests**

~~~ts
test("does not publish or revise email on a package digest mismatch", async () => {
  const approve = createProspectPreviewApprover({
    repository: mismatchRepository, now: fixedNow, siteUrl: "https://faithfulsoftware.dev",
  });
  await assert.rejects(
    () => approve(db, validInput),
    (error) => error instanceof ProspectPreviewApprovalError && error.code === "not_publishable",
  );
  assert.equal(mismatchRepository.publishCalls, 0);
});

test("returns a safe Codex brief without invoking a model", async () => {
  const response = await handler(createFounderRequest({
    notes: "Use the quieter professional-services hero and keep the consultation journey.",
  }));
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.match(body.codexBrief, /change only the prospect package/i);
  assert.doesNotMatch(body.codexBrief, /@|https?:\/\/source/i);
});
~~~

- [ ] **Step 2: Confirm tests fail**

Run: node --import tsx --test lib/growth/prospect-previews/approval.test.ts lib/growth/prospect-previews/approval-repository.test.ts lib/growth/prospect-previews/change-request-route-handler.test.ts

Expected: FAIL because generation guards and feedback handler do not exist.

- [ ] **Step 3: Add source/DB approval checks and friendly route**

~~~ts
if (
  state.preview.generationStatus !== "merged_draft" ||
  !state.preview.slug ||
  !state.preview.compositionDigest ||
  getMergedProspectPreviewCompositionBySlug(state.preview.slug)?.digest !== state.preview.compositionDigest
) {
  throw new ProspectPreviewApprovalError("not_publishable");
}

function previewUrl(siteUrl: string, slug: string): string {
  return new URL("/preview/" + slug, siteUrl).toString();
}
~~~

Update the same optimistic update to change generation_status to published. Public lookup queries only status = 'published', then fails closed on a missing/mismatched merged package. Production /preview/[slug] uses this lookup. Preserve /preview/p/[publicId] as a noncanonical redirect to a published slug, or notFound.

- [ ] **Step 4: Implement founder change feedback**

~~~tsx
<form action={requestChanges} className="flex flex-col gap-3">
  <label htmlFor="preview-change-notes">What should change?</label>
  <textarea id="preview-change-notes" name="notes" maxLength={2000} required />
  <button disabled={pending} type="submit">Request changes</button>
</form>
~~~

Disable approval unless composition is ready. Show branch, PR, and protected review deployment to founder only. After saving feedback, show a readonly brief with a Copy control through navigator.clipboard.writeText. Browser and route must not invoke Codex, GitHub, webhooks, or any model API.

- [ ] **Step 5: Run route, approval, and UI tests**

Run: node --import tsx --test lib/growth/prospect-previews/approval.test.ts lib/growth/prospect-previews/approval-repository.test.ts lib/growth/prospect-previews/public-repository.test.ts lib/growth/prospect-previews/change-request-route-handler.test.ts app/api/growth/prospects/[id]/preview/change-request/route.test.ts components/growth/prospects/*.test.tsx app/preview/page.test.tsx

Expected: PASS.

- [ ] **Step 6: Commit**

~~~bash
git add app/api/growth/prospects/[id]/preview/change-request app/(growth)/(dashboard)/growth/prospects/[prospectId]/preview/page.tsx app/preview/[slug]/page.tsx app/preview/p/[publicId]/page.tsx components/growth/prospects lib/growth/prospect-previews
git commit -m "feat: gate prospect preview publication on merged packages"
~~~

### Task 5: Signed GitHub PR generation after discovery

**Files:**

- Create: lib/growth/prospect-previews/generation/types.ts
- Create: lib/growth/prospect-previews/generation/github-client.ts
- Create: lib/growth/prospect-previews/generation/github-client.test.ts
- Create: lib/growth/prospect-previews/generation/orchestrator.ts
- Create: lib/growth/prospect-previews/generation/orchestrator.test.ts
- Create: lib/growth/prospect-previews/generation/route-handler.ts
- Create: lib/growth/prospect-previews/generation/route-handler.test.ts
- Create: app/api/agent/prospect-preview-prs/route.ts
- Create: app/api/agent/prospect-preview-prs/route.test.ts
- Modify: lib/growth/config/env.ts
- Modify: lib/growth/config/env.test.ts
- Modify: scripts/run-scheduled-research-agent.ts
- Modify: lib/growth/research/scheduled-agent-runner.ts
- Modify: docs/growth-os/runbooks/scheduled-research.md
- Modify: docs/runbooks/growth-os-environment-matrix.md

**Interfaces:**

- Consumes: Task 3 candidate repository and Tasks 1–2 compiler/serializer.
- Produces: createProspectPreviewPrRun, createProspectPreviewPrPostHandler, and signed POST /api/agent/prospect-preview-prs.
- Request body is exactly { externalRunId: string }. Response is { externalRunId, status: "created" | "existing" | "disabled" | "unavailable", generated, unavailable, pullRequestNumber } with no prospects, contacts, source URLs, or package content.

- [ ] **Step 1: Write failing orchestration tests**

~~~ts
test("creates one dated branch and one PR for a run", async () => {
  const result = await createProspectPreviewPrRun({
    externalRunId: RUN_ID, db, github: fakeGithub, now: fixedNow,
  });
  assert.deepEqual(fakeGithub.createdBranches, [{
    branch: "generated/prospect-previews/2026-08-27", base: "main",
  }]);
  assert.equal(fakeGithub.pullRequests.length, 1);
  assert.equal(result.generated, 3);
});

test("is idempotent when the dated PR exists", async () => {
  const result = await createProspectPreviewPrRun({
    externalRunId: RUN_ID, db, github: githubWithExistingPr, now: fixedNow,
  });
  assert.equal(result.status, "existing");
  assert.equal(githubWithExistingPr.createdBranches.length, 0);
});

test("rejects unsigned generation before GitHub is called", async () => {
  const response = await handler(new Request(
    "https://faithfulsoftware.dev/api/agent/prospect-preview-prs",
    { method: "POST", body: JSON.stringify({ externalRunId: RUN_ID }) },
  ));
  assert.equal(response.status, 401);
  assert.equal(fakeGithub.calls, 0);
});
~~~

- [ ] **Step 2: Confirm tests fail**

Run: node --import tsx --test lib/growth/prospect-previews/generation/github-client.test.ts lib/growth/prospect-previews/generation/orchestrator.test.ts lib/growth/prospect-previews/generation/route-handler.test.ts app/api/agent/prospect-preview-prs/route.test.ts

Expected: FAIL because GitHub and generation boundaries do not exist.

- [ ] **Step 3: Implement narrow GitHub transport**

~~~ts
export interface ProspectPreviewGitHubClient {
  getBranchSha(branch: string): Promise<string>;
  createBranch(input: { branch: string; baseSha: string }): Promise<void>;
  createCommit(input: {
    branch: string; message: string; files: readonly GeneratedFile[];
  }): Promise<string>;
  findOpenPullRequest(head: string): Promise<{ number: number; htmlUrl: string } | null>;
  createPullRequest(input: {
    title: string; body: string; head: string; base: "main";
  }): Promise<{ number: number; htmlUrl: string }>;
}
~~~

Call only https://api.github.com/repos/FSS-Ltd/fss-site/* with GitHub JSON accept/version headers and server-only bearer token. Reject paths outside lib/growth/prospect-previews/compositions/generated/ plus manifest.ts. Never shell out to git, log the token, or expose it to the researcher.

- [ ] **Step 4: Implement orchestration, environment validation, and parent trigger**

~~~ts
export async function createProspectPreviewPrRun(
  input: CreateProspectPreviewPrRunInput,
): Promise<ProspectPreviewPrRunResult> {
  const candidates = await input.repository.listGenerationCandidates(input.db, input.externalRunId);
  const compiled = compileRun(candidates);
  await input.repository.markCompositionUnavailable(input.db, compiled.unavailable);
  if (compiled.packages.length === 0) {
    return {
      externalRunId: input.externalRunId, status: "unavailable",
      generated: 0, unavailable: compiled.unavailable.length, pullRequestNumber: null,
    };
  }
  const branch = "generated/prospect-previews/" + londonDate(input.now());
  const pr = await createOrUpdateRunPullRequest(input.github, branch, compiled.files);
  await input.repository.recordOpenPullRequest(input.db, {
    externalRunId: input.externalRunId, branch, pullRequestNumber: pr.number,
    packages: compiled.packages,
  });
  return {
    externalRunId: input.externalRunId, status: pr.created ? "created" : "existing",
    generated: compiled.packages.length, unavailable: compiled.unavailable.length,
    pullRequestNumber: pr.number,
  };
}
~~~

Use the current verifyAgentRequest HMAC route pattern. Add optional GROWTH_OS_PREVIEW_PR_ENABLED, GITHUB_PROSPECT_PREVIEW_TOKEN, and GITHUB_PROSPECT_PREVIEW_REPOSITORY to GrowthServerEnv; enabled requires a token and exact FSS-Ltd/fss-site. Disabled returns status "disabled" before any database/GitHub call. The parent run-scheduled-research-agent.ts, not the child agent, signs the fixed body after a successful report with accepted prospects. Amend the child prompt to explicitly forbid this endpoint.

- [ ] **Step 5: Run automation and configuration tests**

Run: node --import tsx --test lib/growth/config/env.test.ts lib/growth/research/scheduled-agent-runner.test.ts lib/growth/prospect-previews/generation/*.test.ts app/api/agent/prospect-preview-prs/route.test.ts

Expected: PASS.

- [ ] **Step 6: Commit**

~~~bash
git add app/api/agent/prospect-preview-prs lib/growth/prospect-previews/generation lib/growth/config/env.ts lib/growth/config/env.test.ts scripts/run-scheduled-research-agent.ts lib/growth/research/scheduled-agent-runner.ts docs/growth-os/runbooks/scheduled-research.md docs/runbooks/growth-os-environment-matrix.md
git commit -m "feat: create daily prospect preview review PRs"
~~~

### Task 6: Merge reconciliation and source-only current-ten backfill

**Files:**

- Create: lib/growth/prospect-previews/generation/reconcile.ts
- Create: lib/growth/prospect-previews/generation/reconcile.test.ts
- Create: app/api/cron/prospect-preview-reconciliation/route.ts
- Create: app/api/cron/prospect-preview-reconciliation/route.test.ts
- Create: scripts/backfill-prospect-preview-pr.ts
- Create: scripts/backfill-prospect-preview-pr.test.ts
- Modify: package.json
- Modify: vercel.json
- Modify: components/growth/prospects/founder-preview-list.tsx
- Modify: docs/growth-os/runbooks/scheduled-research.md

**Interfaces:**

- Consumes: Task 5 PR metadata and GitHub client.
- Produces: reconcileProspectPreviewGenerationRun, protected cron route, and pnpm growth:previews:backfill-pr -- --run-id current-ten-2026-08-27.

- [ ] **Step 1: Write failing reconciliation/backfill tests**

~~~ts
test("marks only merged, digest-matching packages ready", async () => {
  const result = await reconcileProspectPreviewGenerationRun(db, githubWithMergedPr);
  assert.deepEqual(result, { merged: 2, waiting: 1, withdrawn: 0, invalid: 0 });
  assert.equal(repository.updated[0]?.generationStatus, "merged_draft");
});

test("backfills exactly ten packages without approval, email, or model activity", async () => {
  const result = await runBackfill({ db, github, runId: "current-ten-2026-08-27" });
  assert.equal(result.generated, 10);
  assert.equal(fakeApproval.calls, 0);
  assert.equal(fakeEmail.calls, 0);
  assert.equal(fakeAi.calls, 0);
});
~~~

- [ ] **Step 2: Confirm tests fail**

Run: node --import tsx --test lib/growth/prospect-previews/generation/reconcile.test.ts app/api/cron/prospect-preview-reconciliation/route.test.ts scripts/backfill-prospect-preview-pr.test.ts

Expected: FAIL because reconciliation and source-only backfill do not exist.

- [ ] **Step 3: Implement reconciliation**

~~~ts
if (pr.mergedAt !== null && composition?.digest === record.compositionDigest) {
  await repository.updateGenerationStatus(record.id, "merged_draft");
} else if (pr.state === "closed" && pr.mergedAt === null) {
  await repository.updateGenerationStatus(record.id, "pending_pr");
}
~~~

Use the existing cron-secret guard. If Vercel supports the needed schedule, register authenticated weekday reconciliation at 06:15; otherwise document the protected endpoint for the trusted host scheduler to call after PR deployment polling. Do not scrape deployment URLs. The dashboard shows awaiting merge, unavailable, merged-ready, or generic error. No reconciliation path publishes a URL.

- [ ] **Step 4: Implement the explicit ten-draft command**

~~~ts
const runId = parseBackfillRunId(process.argv.slice(2));
const result = await createProspectPreviewPrRun({
  db,
  github: createProspectPreviewGitHubClient(readGrowthServerEnv()),
  externalRunId: runId,
  selection: "eligible_existing_drafts",
  now: () => new Date(),
});
process.stdout.write(JSON.stringify(toRedactedBackfillReport(result)) + "\n");
~~~

Accept only --run-id current-ten-2026-08-27. Query ungenerated, non-terminal drafts in creation order and hard-limit ten. If count is not exactly ten, exit non-zero before GitHub. The command creates package files, manifest, and PR metadata only. It must not alter status, approved_at, first-email snapshots, provider drafts, research records, or email delivery.

- [ ] **Step 5: Run reconciliation/backfill tests**

Run: node --import tsx --test lib/growth/prospect-previews/generation/reconcile.test.ts app/api/cron/prospect-preview-reconciliation/route.test.ts scripts/backfill-prospect-preview-pr.test.ts components/growth/prospects/*.test.tsx

Expected: PASS.

- [ ] **Step 6: Commit**

~~~bash
git add app/api/cron/prospect-preview-reconciliation lib/growth/prospect-previews/generation/reconcile.ts lib/growth/prospect-previews/generation/reconcile.test.ts scripts/backfill-prospect-preview-pr.ts scripts/backfill-prospect-preview-pr.test.ts package.json vercel.json components/growth/prospects/founder-preview-list.tsx docs/growth-os/runbooks/scheduled-research.md
git commit -m "feat: reconcile and backfill prospect preview packages"
~~~

### Task 7: Full verification, controlled activation, and current-ten PR

**Files:**

- Modify: docs/growth-os/runbooks/scheduled-research.md
- Modify: docs/runbooks/growth-os-environment-matrix.md
- Modify: docs/prospect-previews.md
- Modify: docs/superpowers/specs/2026-08-27-prospect-preview-pr-creation-design.md

**Interfaces:**

- Consumes: every preceding task.
- Produces: a dry-run-tested activation and the source-only PR for the current ten. GROWTH_OS_PREVIEW_PR_ENABLED=true requires a restricted GitHub credential in the trusted production execution environment.

- [ ] **Step 1: Add end-to-end safety tests**

~~~ts
test("the current-ten fixtures have ten distinct composition fingerprints", () => {
  const fingerprints = currentTenFixtures.map(({ composition }) =>
    buildCompositionFingerprint(composition),
  );
  assert.equal(new Set(fingerprints).size, 10);
});

test("no email revision occurs before a merged package and founder approval", async () => {
  await assert.rejects(() => approveProspectPreview(db, draftWithoutMergedPackage));
  assert.equal(emailRepository.revisions.length, 0);
});
~~~

- [ ] **Step 2: Run all relevant local checks**

Run:

~~~bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration:growth:preview
pnpm verify:migrations
pnpm build
pnpm perf:budget:homepage
~~~

Expected: every command exits 0. If approved database integration credentials are available, also run pnpm test:integration:growth:database:ci and pnpm test:coverage:growth.

- [ ] **Step 3: Exercise disabled generation**

Run: GROWTH_OS_PREVIEW_PR_ENABLED=false pnpm growth:research:weekday

Expected: no package source write, no PR, no email revision, and a redacted generation.status "disabled" result.

- [ ] **Step 4: Configure restricted trusted credential**

Set GITHUB_PROSPECT_PREVIEW_TOKEN only where the trusted production scheduler/API runs. Restrict it to FSS-Ltd/fss-site with Contents read/write, Pull requests read/write, and Metadata read. Set GITHUB_PROSPECT_PREVIEW_REPOSITORY=FSS-Ltd/fss-site and GROWTH_OS_PREVIEW_PR_ENABLED=true. Keep all three absent from Vercel Preview and the disposable researcher. Confirm Vercel deployment protection for PR deployments before activation.

- [ ] **Step 5: Create the ten-prospect source-only PR**

Run: pnpm growth:previews:backfill-pr -- --run-id current-ten-2026-08-27

Expected: one PR from generated/prospect-previews/2026-08-27, exactly ten package files plus a manifest update, generated 10, unavailable 0, non-null PR number, no public page, no email change, no provider draft, and no send. Inspect all pages in the protected PR deployment before merging.

- [ ] **Step 6: Merge and review individually**

Merge only after CI and visual review pass. Reconcile the PR, then open /growth/prospects/previews. For each package, either save a change request and use its copyable Codex brief in a normal reviewed PR, or founder-approve it. Each approval makes only its own /preview/[slug] reachable and refreshes only its own stored first-email review revision. Do not send email.

- [ ] **Step 7: Commit operational documentation**

~~~bash
git add docs/growth-os/runbooks/scheduled-research.md docs/runbooks/growth-os-environment-matrix.md docs/prospect-previews.md docs/superpowers/specs/2026-08-27-prospect-preview-pr-creation-design.md
git commit -m "docs: document prospect preview PR activation"
~~~

## Self-review checklist

- Tasks cover packages, unique fingerprints, rendering, data lifecycle, founder feedback, public gates, trusted GitHub generation, scheduler isolation, merge reconciliation, current ten, and verification.
- No task creates a Gmail provider draft, sends email, calls a model API, uses remote imagery, or hands GitHub authority to the researcher.
- Every consumed function/type is defined in its producing task.
- The current-ten command has an exact run ID, exact expected count, and fails before GitHub if the count differs.
- The database migration follows the Supabase CLI workflow rather than an invented timestamp.
