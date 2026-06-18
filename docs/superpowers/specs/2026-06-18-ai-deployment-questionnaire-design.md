# AI Deployment Questionnaire Design

Title: Local AI vs Cloud AI Questionnaire
Owner: Technical Agent
Status: Approved for implementation
Created: 2026-06-18
Last Updated: 2026-06-18
Related Docs: fss_seo_opportunity_map.md

## Problem Statement

Privacy-sensitive organisations want the productivity upside of AI, but many cannot safely send client, patient, financial, or operational data into unmanaged third-party AI APIs. A static landing page explains the offer, but it does not help a buyer diagnose whether local AI, cloud AI, or a hybrid approach is the right first move.

## Goals

- Build a dedicated questionnaire page that recommends local AI, cloud AI, or hybrid AI for a business.
- Position FSS as the practical partner for privacy-aware AI workflow design.
- Capture qualified leads after providing a useful result.
- Keep the recommendation logic transparent, typed, and easy to test.
- Preserve existing FSS site architecture, styling conventions, lead form plumbing, and SEO patterns.

## Non-Goals

- Do not build a full AI procurement platform.
- Do not store questionnaire answers server-side in this iteration.
- Do not make legal, clinical, regulatory, or security guarantees.
- Do not add new dependencies.
- Do not replace the homepage.

## User And Business Impact

The target user is a leader in a law firm, clinic, hospital, finance team, charity, school, or service business who is trying to decide how to adopt AI without exposing sensitive information. The page should help them understand the likely deployment pattern and then invite them to request a Private AI Workflow Audit.

The business outcome is a higher-intent lead than a generic contact form because the prospect has already reflected on data sensitivity, compliance, operational pressure, budget, and internal capability.

## Architecture

Create a dedicated route at `/ai-deployment-questionnaire`.

The page will be server-rendered for metadata and schema, with a client component for the interactive questionnaire. Scoring logic will live in a plain TypeScript module so it can be tested without React. UI components will live under `components/sections/ai-questionnaire/` and reuse existing `Button`, `GlowCard`, and form components.

## Questionnaire Model

The questionnaire will ask concise multiple-choice questions:

1. What kind of data would AI touch?
2. Which compliance or assurance pressure applies?
3. How much control do you need over where data is processed?
4. How fast do answers need to be?
5. What budget and technical capacity do you have?
6. What systems should the AI connect to?
7. What is the first business outcome you want?

Each answer contributes points to `local`, `cloud`, and `hybrid`. The highest score produces the recommendation. Close local/cloud scores produce a hybrid recommendation because mixed environments are common for regulated organisations.

## Recommendation Outcomes

### Local AI

Use when the organisation handles highly sensitive data, has strict data residency or confidentiality needs, and can support private infrastructure or managed private deployment. The result should stress control, privacy, governance, and slower but safer rollout.

### Cloud AI

Use when the organisation works mostly with low-risk data, needs speed and broad model capability, and can use approved third-party providers. The result should stress speed, lower infrastructure cost, and vendor governance.

### Hybrid AI

Use when the organisation has both sensitive and low-risk workflows. The result should recommend keeping confidential workflows local/private while using approved cloud AI for lower-risk productivity and research tasks.

## Lead Capture

After showing the result, the page will display a lead form using the existing lead capture system. The CTA will be `Request a Private AI Workflow Audit`. The `sourceContext` will be `ai-deployment-questionnaire`, and `resourceSlug` will be `ai-deployment-questionnaire`.

## SEO And AEO

The page will include:

- Metadata targeting "local AI vs cloud AI for business", "private AI for law firms", "AI for healthcare data privacy", and "secure AI workflow automation".
- A clear H1 and answer-style sections for "Is local AI better than cloud AI?", "When should a business use private AI?", and "What is hybrid AI?"
- JSON-LD with `WebPage`, `Service`, and `FAQPage` entities.
- Sitemap inclusion with a high priority.

## Visual Direction

Use the existing FSS dark technical visual language, but make the page more premium and restrained. The first viewport should feel like an Apple product decision experience: large headline, calm copy, crisp contrast, high spacing discipline, and a focused interactive panel. Avoid noisy dashboards, decorative blobs, nested cards, and in-app instructional filler.

## Accessibility

- Use semantic buttons for options.
- Keep questions and results keyboard-accessible.
- Use visible focus states inherited from existing controls.
- Do not rely on colour alone to indicate selected answers.
- Ensure result content is plain text, readable, and not hidden behind animation.

## Failure Modes

- If the user skips questions, keep the primary CTA disabled until all questions are answered.
- If scoring produces a tie, recommend hybrid AI and explain why.
- If lead submission fails, use the existing lead form error handling.

## Testing

- Add unit tests for scoring local, cloud, hybrid, and tie behaviour.
- Run type checking through the production build.
- Run linting.
- Manually inspect changed files for imports, syntax, accessibility, and copy quality.

## Rollout And Rollback

The feature is isolated to a new route and new components. Rollback is removing the route, the new component folder, the scoring module/tests, and the sitemap entry.

## Success Criteria

- `/ai-deployment-questionnaire` renders an interactive questionnaire.
- Completing the quiz produces a local, cloud, or hybrid recommendation.
- The result includes clear next steps and a Private AI Workflow Audit CTA.
- Lead capture uses existing submission infrastructure.
- SEO metadata, JSON-LD, and sitemap are present.
- Relevant automated checks pass or any environmental blocker is documented.
