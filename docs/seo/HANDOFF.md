# AI-led SEO and lead growth: handoff

Updated 2026-11-12. Read this first, then the design doc
`docs/superpowers/specs/2026-11-11-ai-led-seo-lead-growth-design.md`.

## Standing rules from the founder

- Opus plans, Sonnet executes (builds, reviews, jury), Haiku does mechanical
  sweeps. Fable is an advisor only, called when a piece fails two Sonnet
  rounds or the jury score stalls (skill `orchestrating-model-tiers`, changed
  by the founder on 2026-11-12). Keep the lead's own context small.
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

Order changed on 2026-11-11 (orchestrator's call): PR F goes first. The
critic's remaining complaints on #330 are site-wide (hard-cut page changes,
footer em dash, misaligned header/content/footer edges), so #330 and the blog
layout cannot reach 8/10 until PR F fixes them. To reverse: run items 1 and 2
before 3. State at the time of writing: #330 CI all green, budget file
untouched by its diff, branch 2 commits behind main; an Opus agent is building
PR F in `.claude/worktrees/public-motion-polish` (draft PR to follow); a
Sonnet code and security review of #330 is running.

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

## State 2026-11-12

- #330 was merged to main at 21:34 GMT on 2026-11-11 at critic score 7.05,
  below the 8/10 gate. Its review findings 1, 3 and 4 are still open. They
  go in a follow-up PR after PR F, which also re-scores `/contact`.
- PR F is draft PR #333, head `e158e4a2f`. Three Sonnet fix rounds; critic
  scores 6.6, 7.05, 6.8. Creativity stuck at 6. Cards in the worktree's
  `.jury/127.0.0.1-4400/` (scorecard-1.md, scorecard-2.md, scorecard.md).
  Fable advised: label the hero network with business nouns (Inbox, Calls,
  CRM, Invoices, Rota, Reports) and a rust path to an FSS node; make the
  scroll sequence change the network's state; crop the NexSteps screenshot
  legibly; services hero as labelled network; broken-link 404. Fable's
  estimate: about 7.5 to 7.7, and 8 needs founder decisions (commit to "your
  business as a connected system" as the concept; supply real NexSteps
  problem, idea and outcome material). Founder committed to the concept and
  gave NexSteps facts on 2026-11-12 (see memory and the case study copy).
- Rounds 4 to 6 (Sonnet): 7.0, 7.4, 7.3. Head `70199980e`. Plateau near
  7.3 to 7.4. Latest card: `.jury/127.0.0.1-4400/scorecard.md` in the
  worktree. Not yet code or security reviewed since round 1. Waiting on the
  founder: accept about 7.4 and ship, or fund another round.
- Open on #333: the old hero card hover lift (on main) went with the card;
  give the new hero a pointer response. Homepage CSS has 4 B gzip headroom.
  The app screenshot shows the founder's first name; founder to confirm.
- Commit trailers: early commits on #333 and this branch carry a
  Co-Authored-By line against the founder's rule. Squash-merge with a clean
  message to drop them. Never add them again.
- PR D `feat/editorial-blog-layout`: one local commit `1ef83e280`, unpushed.
  Waits for PR F (shared site chrome).

## Run log 2026-11-11 (scheduled continuation)

- State found: #330 head `849d8a211` pushed, draft, Vercel check pending.
  `public-motion-polish` worktree was still equal to main (no PR F work
  existed). `editorial-blog-layout` still one unpushed commit.
- Started: Opus agent building PR F in `public-motion-polish`; Sonnet code
  and security review of #330 (read-only). Results not yet recorded here.
- Correction 20:30 GMT: another agent from an earlier dispatch is already
  editing `public-motion-polish` (about 10 files, uncommitted, still
  growing). My Opus agent stopped without changes to avoid a clash. Do not
  start a second PR F agent. Check `git status` there; if it goes quiet with
  no PR, review its diff and continue it.
- #330 Sonnet review (code pass, security pass, no blockers, all minor):
  (1) step 0 chip auto-advances so the optional detail box is only reachable
  via Back: stop auto-advance or move detail to the last step; (2) hero canvas
  is `calc(100% + 640px)` tall, cap on narrow widths and confirm resize;
  (3) put Detail on its own line in `lib/forms/contact-request.ts`;
  (4) add a component test for focus, Enter, chip guard, reduced motion.
  Fix 1, 3 and 4 on #330 after PR F merges. Tests 2476 pass, typecheck and
  lint clean, homepage budget file unchanged. Not browser-verified.
- Next: fix review findings on #330 after PR F merges (#330 and PR D need
  PR F for the 8/10 critic score), then PR D, then docs PR.

## Founder actions outstanding

- Done by the founder on 2026-11-11: `BLOG_API_TOKEN` set in Vercel; `www`
  redirect set to permanent.
- Google Business Profile: phone, hours, opening date, photos
  (`docs/seo/google-business-profile.md`).
- Optional, biggest remaining lead lever: real price ranges and measured
  case-study results to publish.

## Blog API access

- Production accepts the token: an authenticated empty POST returned 400
  `invalid_body` (not 401) on 2026-11-11. No post was written.
- The founder said to use the token in the main checkout's `.env`
  (`/Users/JeanFidele/The Nexus Ecosystem/Projects/fss-site/.env`, key
  `BLOG_API_TOKEN`). Read it into a shell variable; never print or commit it.
- No post has been published through the API yet. Posts default to draft.

## Known gaps

- Blog API behaviour under a database outage and scheduled posts are covered
  by unit tests only.
- Graphify update is code-only and scoped; communities unlabelled.
- The preview deployments are behind Vercel login; verify UI with a local
  production build.
