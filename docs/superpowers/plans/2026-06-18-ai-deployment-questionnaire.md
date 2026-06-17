# AI Deployment Questionnaire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated questionnaire that recommends local AI, cloud AI, or hybrid AI and converts qualified visitors into Private AI Workflow Audit leads.

**Architecture:** Add a new App Router page at `/ai-deployment-questionnaire`. Keep recommendation scoring in a plain TypeScript module under `lib/ai-questionnaire/` and render the interactive quiz in client components under `components/sections/ai-questionnaire/`. Reuse existing lead capture, SEO, schema, layout, and UI primitives.

**Tech Stack:** Next.js App Router, React 19, TypeScript, lucide-react, existing FSS UI components, Node test runner for pure scoring tests.

---

## File Structure

- Create `lib/ai-questionnaire/scoring.ts`: question data, answer scores, result metadata, and `calculateAiRecommendation`.
- Create `lib/ai-questionnaire/scoring.test.ts`: Node test runner coverage for local, cloud, hybrid, incomplete, and tie behaviour using the existing `tsx` loader.
- Create `components/sections/ai-questionnaire/ai-questionnaire-page.tsx`: server-rendered marketing sections and page layout.
- Create `components/sections/ai-questionnaire/ai-deployment-quiz.tsx`: client-side questionnaire interaction and result panel.
- Create `app/ai-deployment-questionnaire/page.tsx`: metadata, JSON-LD, and route export.
- Modify `app/sitemap.ts`: include the new route.

## Task 1: Scoring Tests

**Files:**
- Create: `lib/ai-questionnaire/scoring.test.ts`

- [ ] **Step 1: Write failing scoring tests**

Create tests that import `calculateAiRecommendation`, `aiQuestionnaireQuestions`, and `type`-compatible answer maps from `./scoring.ts`.

Cover these behaviours:
- highly sensitive regulated answers return `local`.
- low-risk speed-first answers return `cloud`.
- mixed sensitive and low-risk answers return `hybrid`.
- incomplete answers return `null`.
- close local/cloud scores return `hybrid`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --import tsx --test lib/ai-questionnaire/scoring.test.ts`

Expected: failure because `lib/ai-questionnaire/scoring.ts` does not exist yet.

## Task 2: Scoring Module

**Files:**
- Create: `lib/ai-questionnaire/scoring.ts`

- [ ] **Step 1: Implement typed scoring data**

Create exported types:
- `AiDeploymentRecommendation = "local" | "cloud" | "hybrid"`
- `AiScore = Record<AiDeploymentRecommendation, number>`
- `AiQuestionOption`
- `AiQuestion`
- `AiQuestionnaireAnswers`
- `AiRecommendationResult`

Create `aiQuestionnaireQuestions` with seven questions and weighted options.

- [ ] **Step 2: Implement result metadata**

Create `aiRecommendationContent` for local, cloud, and hybrid result cards. Each result needs a title, summary, bullets, best-fit statement, risk note, and CTA note.

- [ ] **Step 3: Implement `calculateAiRecommendation`**

Return `null` unless every question has a selected option. Sum answer scores. Return hybrid for exact ties or when local and cloud are within two points. Otherwise return the highest-scoring recommendation and its metadata.

- [ ] **Step 4: Run scoring tests and verify GREEN**

Run: `node --import tsx --test lib/ai-questionnaire/scoring.test.ts`

Expected: all scoring tests pass.

## Task 3: Interactive Quiz Component

**Files:**
- Create: `components/sections/ai-questionnaire/ai-deployment-quiz.tsx`

- [ ] **Step 1: Build client interaction**

Create a client component that renders all questions, selected option states, progress text, reset behaviour, and a disabled result button until all questions are answered.

- [ ] **Step 2: Render result panel**

When submitted, call `calculateAiRecommendation`, show the recommendation title, summary, score labels, bullets, best-fit statement, risk note, and next-step note.

- [ ] **Step 3: Add lead form**

Render `LeadMagnetCaptureForm` after the result with `sourceContext="ai-deployment-questionnaire"`, `resourceSlug="ai-deployment-questionnaire"`, and `ctaLabel="Request a Private AI Workflow Audit"`.

## Task 4: Page And SEO

**Files:**
- Create: `components/sections/ai-questionnaire/ai-questionnaire-page.tsx`
- Create: `app/ai-deployment-questionnaire/page.tsx`
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Build page sections**

Create hero, trust/risk strip, questionnaire section, answer-style AEO section, process section, and final CTA using existing components and styling conventions.

- [ ] **Step 2: Add route metadata**

Set title, description, canonical URL, Open Graph title/description, and Open Graph URL for `/ai-deployment-questionnaire`.

- [ ] **Step 3: Add JSON-LD**

Use `JsonLd` with a graph containing `WebPage`, `Service`, and `FAQPage`. Visible FAQ answers on the page must match the schema content.

- [ ] **Step 4: Add sitemap entry**

Add `/ai-deployment-questionnaire` with monthly change frequency and priority `0.9`.

## Task 5: Verification

**Files:**
- Inspect every changed file.

- [ ] **Step 1: Run scoring tests**

Run: `node --import tsx --test lib/ai-questionnaire/scoring.test.ts`

Expected: exit code 0.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 4: Manual red-line review**

Inspect changed files for syntax, imports, unused exports, accessibility, responsive layout classes, schema consistency, and no temporary debug code.

- [ ] **Step 5: Report final state**

Summarise files changed, checks run, checks not run, and implementation notes.
