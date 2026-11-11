# AI-led SEO and lead growth: handoff

Updated 2026-11-11 15:50 GMT. Read this first, then the design doc
`docs/superpowers/specs/2026-11-11-ai-led-seo-lead-growth-design.md`.

## Standing rules from the founder

- Lead model orchestrates; Haiku, Sonnet and Opus subagents do the work
  (skill `orchestrating-model-tiers`). Keep the lead's own context small.
- One pull request per change. Sonnet code review and Sonnet security review,
  findings fixed, before a PR is marked ready. Merge one at a time on green
  checks. A merge is a production deploy.
- UI work uses `/design-craft` and must reach 8/10 on the jury skill's
  critic score (the critic's own number, not the calibrated jury estimate).
  Founder confirmed this on 2026-11-11. PR #330 scored 7.05, so it is below
  the gate and must be improved before it ships.
- Never remove particle or motion effects. No AI attribution in commits or
  PRs. Never commit to main. Never raise the homepage CSS budget.
- Positioning: all businesses, small to large, led by AI integration and
  automation. Charity and faith is one sector, not the headline.
- No invented prices, statistics, client names or results on the site.
- Short replies to the founder (`/caveman`).

## Done and live on https://faithfulsoftware.dev

- #328 SEO signals: `/llms.txt`, AI crawler rules, ProfessionalService schema.
- #327 nine AI-led service pages, home and index repositioned.
- #329 blog API: `GET`/`POST /api/blog`, `growth.blog_posts` migration
  applied by the production workflow (job succeeded).
- #331 AI receptionist GDPR answer states the data-flow description is
  included in every build (founder confirmed this and the NexSteps claims).
- On branch `docs/ai-led-seo-growth` (pushed, no PR yet): design doc,
  research, `docs/seo/keyword-bank.md`, `docs/seo/google-business-profile.md`,
  `FEATURE_TREE.md` public-site section, Graphify update, CLAUDE.md pointer.

## In progress

1. PR #330 `feat/stepped-enquiry-form` (draft). Worktree
   `.claude/worktrees/agent-a1013263835a4c6a0`, head `1bf5ba6bc`
   ("Keep the homepage CSS within its original budget"), tree clean, CI was
   pending. Next: confirm CI green and the budget file is unchanged from
   main; an Opus agent raises the design to 8/10 on the critic score (remaining
   criticisms are in the PR body); then run Sonnet code review and security
   review; fix findings; mark
   ready; merge on green; verify `/contact` live (five steps, progress bar,
   submit path with a fake value intercepted, never a real production submit).
2. PR D `feat/editorial-blog-layout`. Worktree
   `.claude/worktrees/editorial-blog-layout`, one local commit `1ef83e280`,
   not pushed, no PR. The Opus agent was cut off; jury result unknown. Next:
   an Opus agent checks the build in a browser, runs the jury, iterates to
   8/10, pushes, opens a draft PR; then reviews and merge as above.
3. PR F `feat/public-motion-polish` (Opus), not started. Starts after PR D.
   Brief is in the design doc. Jury noted page changes are hard cuts with no
   transition, a footer em dash, and misaligned header/content/footer edges.
4. Docs PR from `docs/ai-led-seo-growth`: open after the above, then update
   the Context Pack at
   `/Users/JeanFidele/The Nexus Ecosystem/The Nexus/14 AI Collaboration/Context Packs/fss-site/Context Pack.md`
   and remove this handoff's "In progress" items as they land.

## Founder actions outstanding

- Done by the founder on 2026-11-11: `BLOG_API_TOKEN` set in Vercel; `www`
  redirect set to permanent.
- Google Business Profile: phone, hours, opening date, photos
  (`docs/seo/google-business-profile.md`).
- Optional, biggest remaining lead lever: real price ranges and measured
  case-study results to publish.

## Known gaps

- Blog API behaviour under a database outage and scheduled posts are covered
  by unit tests only.
- Graphify update is code-only and scoped; communities unlabelled.
- The preview deployments are behind Vercel login; verify UI with a local
  production build.
