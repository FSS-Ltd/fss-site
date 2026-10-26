# Growth CRM implementation handoff

Completed locally on 2026-10-26. See [the operations runbook](../../runbooks/growth-crm.md) for verification, rollout, rollback and known limitations. The attached managed worktree is preserved because these commits have not been merged. The original dirty checkout was left untouched. No Production migration, deployment, push or pull request was performed.

Commits: `bfbae828` (domain), `127b57a5` (workspace), `415ab253` (independent-review fixes). All changed production files received independent review; no actionable findings remain. Local checks passed: 2,161 unit tests, 57 Growth integrations, 16 desktop/mobile browser journeys, TypeScript, lint, formatting, production build, all 64 migration policies, fresh-cluster bootstrap and zero-vulnerability production audit. Nine external preview checks skipped. Broader Operations: 129 passed, two inherited billing failures reproduced on base.

The following execution ledger preserves the implementation decisions and their verification chronology. Earlier pending entries are superseded by the final entries.

# SDD ledger — plan: docs/superpowers/plans/2026-10-26-growth-crm-upgrade.md

Approved design: founder selected Growth-native Twenty-style workflows and approved full scope on 2026-10-26.
Base: b74be2393dfeb05ac0a4b966fa3b31e4caa487f6; isolated managed worktree.
Pre-flight: Task 1 command union feeds Tasks 2/3/4; one authenticated dispatcher owns validation. Task 2 workspace feeds Task 4 record panels; keyset cursors remain read-only. Task 3 filter schema feeds Task 2 saved views; shared browser-safe query module avoids importing SQL into clients. No conflicts.
Ruling: Execute natively with one final independent review, because user explicitly approved proceeding and another process-choice approval adds no scope protection.
Ruling: Use command-driven committed browser events with focus/online reconciliation, because Growth has no authenticated live-event infrastructure. No claim of cross-session server push; no polling or paid service.
Ruling: Preserve nullable manual verification explicitly; business verified_at becomes nullable, manual records start uncertain, optional contacts require evidence and subscriber_type uncertain until existing verification flows approve them. Existing verified records remain untouched. Cost: nullable display handling must be updated.
Task 1: in progress. Baseline unit run active; dependencies installed from frozen lockfile.

Task 1/2: shared command schema/dispatcher and CRM migration implemented together; unit RED evidence in /tmp/fss-crm-red-schemas.log and /tmp/fss-crm-red-route.log, integration RED evidence in /tmp/fss-crm-red-records.log and /tmp/fss-crm-red-workspace.log. Focused unit 26 passed; four real-database CRM tests passed. Cleanup helpers independently seed and remove their own identities.
Ruling: Existing direct imports of @react-email/button and @react-email/img are undeclared at the inspected base, causing baseline TypeScript errors and seven welcome-email/PDF test failures. Declare those exact already-transitive packages rather than masking resolution with test-only symlinks. No new library is introduced.
Baseline: 2140 unit tests, 2133 passed, seven failed in welcome-packet rendering (complete names in /tmp/fss-crm-baseline-unit.log); no Growth failure.

Ruling: Existing production code has no deal-creation entry point and does not project closed engagement stages onto prospect status, preventing a second opportunity after a win. Add explicit idempotent create_opportunity and sourced attach_contact commands. Synchronize prospect commercial state in the existing transition transaction, preserving rejected/suppressed statuses and a consistent prospect-before-engagement lock order. Regression reproduced in /tmp/fss-crm-red-closed-lifecycle.log.

Security audit inherited baseline: 2 critical, 7 high, 6 moderate, 1 low. Added a security review note and performing targeted local updates of existing libraries; no Production deployment. Next 16.4.2 + matching lint config, sharp 0.35.5, Zod >=4.6.6, source-map-js 1.2.2 and undici 6.29.1 affected range. All gates must be rerun afterward.
Broader Operations integration: 129 passed, 2 failures in billing date/signing expectations. Reproduce on base before attributing to CRM.
Browser rerun final2: 10 passed, including actual cross-tab focus catch-up and zero idle RSC requests. Visual review found blank New lead text caused by inherited stage-button style; fixed with distinct primary-button styling. Screenshots now wait for board navigation, close view-management panel and reset scroll. Additional lost-response retry/browser coverage pending final rerun.

Patched dependency graph audit: zero vulnerabilities. New matching ESLint configuration exposed pre-existing render-in-try lint errors in two Operations UI loaders; move only data loading into try, preserving rendering/permission behavior. Contact form watch warning is handled with the library's subscription hook.
Patched browser run: 13/14 passed; task sequential action exposed a real stale-version window (409 after promoting then immediately completing a task). Keep command controls pending through the post-commit server refresh with React transition tracking. Regression is the existing real browser task lifecycle test; rerun required.

Task timing regression: shared scoped CrmRefreshProvider now keeps every CRM control disabled from command start through authoritative RSC refresh. Six repeated real desktop/mobile task lifecycle runs passed after the final fix. The gated-network test also asserts the other task action stays disabled during a promotion. An earlier test harness unroute/fulfill race was corrected by awaiting the handled response before removing interception.
Latest typecheck and lint passed with patched dependencies and no warnings. Full patched suite previously passed 2160 unit tests and 51 Growth integrations, with nine externally configured preview contracts skipped; final full/browser/build checks still pending for final code.
Security/lint compatibility changes outside CRM are deliberately limited to two data-loader render boundaries and the contact form's useWatch/event binding; no Operations billing source was changed.

Final review: independent whole-branch review inspected all changed production files and the repair diff, with no remaining actionable findings. Reviewer independently ran 26 focused tests. No deferred minors.
Final: fixed timestamp pagination — pipeline/enquiry sub-millisecond pagination tests RED→GREEN; full suite 2161 unit/57 Growth database passed.
Final: fixed stale filter defaults — desktop/mobile built-in/private-view navigation RED→GREEN; final browser suite16/16 passed.
Final: fixed contact conflict recovery — cross-company contact conflict link test RED→GREEN; full suite2161/57 passed.
Final: fixed historical closed lifecycle — historical closed-deal capture test RED→GREEN; audited projection repair is transactional and preserves suppression/rejection.
Final: fixed lock inversion — two-connection business lookup/editor lock test RED (lock timeout)→GREEN; full suite2161/57 passed.
Final: fixed money overflow — combined integer-pence schema regression RED→GREEN; full suite2161/57 passed.
Final: Ruling: inherited production dependency vulnerabilities — targeted existing package upgrades plus matching lint compatibility changes, all audit severities zero; cost if wrong: framework compatibility regression, mitigated by full unit/database/browser/build checks.
Final: Ruling: remote CI, live OAuth/provider behavior and Production rollout — outside authorized local implementation, remain release gates; cost if wrong: deployment-specific failures remain untested.
Final: Ruling: independent screen-reader testing — not performed; semantic labels, keyboard controls and real responsive screens checked; cost if wrong: assistive-technology-specific issues remain possible.
Final: Ruling: two broader Operations billing failures — both independently reproduced on base source, no unrelated financial logic changes; cost if wrong: broader release gate remains red until those inherited failures are resolved.
Final verification: typecheck/lint passed,64 migrations policy passed, fresh-cluster migration bootstrap passed, zero production dependency vulnerabilities, CRM domain coverage97.81% lines/86.31% branches/96.75% functions. Nine externally configured preview contracts skipped. Final production rebuild passed with Next.js16.4.2.

All five tasks complete. Finishing gate preserves the attached detached worktree and leaves integration/Production rollout pending founder decision; broader Operations failure evidence is retained in the runbook. Final ledger and rulings copied to the committed handoff report before removing this ignored per-plan workspace.
