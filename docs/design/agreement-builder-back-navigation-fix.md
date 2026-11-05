# Agreement builder backward navigation

Owner: Technical Agent. Updated: 2026-11-05. Status: implemented on `fix/agreement-builder-back-navigation`, based on `main` at `25da4a2ef`.

## Problem and resulting behavior

Cross-stage Back buttons invoked validated draft saves. Incomplete money, email, or required fields could prevent returning to earlier fields. Draft-service failures also blocked return. Review's repair actions shared this coupling.

`StaffAgreementBuilder.goBack` now changes the visible stage without validation or network requests. Unfinished stages remain mounted under hidden containers, preserving raw fee state and uncontrolled inputs. Successful saves remove that stage from retention, allowing a later visit to restore authoritative content. Confirmed engagement changes discard retained stages so another engagement cannot inherit unfinished controls. Navigation focuses the active stage's visible group heading and preserves the existing direction animation.

Save, Continue, finalisation, organisation permissions, optimistic versions, commercial offers, currencies, and fee configuration retain their existing contracts. Unfinished edits survive navigation within this page; Save draft or Continue is still required for persistence across a reload. No dependencies, schemas, migrations, provider settings, or production configuration changed.

## Source and tests

The existing guided builder is canonical. The scope, fees, people, document, and review modules receive a typed `onBack`; review repair callbacks are synchronous local navigation. The direct fee component currency fixture supplies the new callback. Regression coverage in `tests/e2e/agreement-builder-navigation.spec.ts` covers all five backward transitions without API calls, invalid-fee retention, scope edits, forward save validation, and engagement replacement. It is registered in the existing Playwright configuration.

## Verification

All commands used the repository's required Node 24 runtime for final verification.

- `pnpm test:unit`: **2,401 passed**, zero failures.
- `pnpm typecheck`: passed.
- Scoped ESLint, Prettier, and `git diff --check`: passed.
- Codex in-app browser: reproduced invalid fees blocking Back on the base revision; verified the fixed Fees → Scope → Fees round trip retains malformed fee text and changed goals, and Save still rejects malformed money. Verified Review → Document → People → Fees → Scope → Work at 390 × 844 with invalid email, fees, and goals. Dummy draft responses were intercepted locally; no database writes or finalisation occurred.
- `pnpm audit --prod --audit-level=high`: passed; one low-severity advisory remains in existing dependencies.
- `pnpm build`: passed, including compilation, type checking, and static page generation.

The standalone Playwright runner was not launched locally because project policy requires the Codex in-app browser. Equivalent core navigation scenarios were exercised there. The newly added engagement-replacement browser regression is awaiting CI: interactive verification was blocked when the browser tool timed out opening the fixture's confirmation dialog. Database integrations were not run locally; backend behavior is unchanged.

## Maps, review, and handoff

`FEATURE_TREE.md` provides the canonical project-wide domain index and detailed agreement entries. Graphify's persistent agreement graph covers 109 TypeScript source/test files; TSX symbol and other-domain coverage gaps are explicit in its report. Both maps were refreshed for this branch, and source references and file hashes were verified. The original detached checkout, unresolved dependency merge, staged edits, and unrelated untracked work were preserved.

The fix was ported to the current guided builder, preserving newer commercial and currency behavior. No old builder files or unrelated work were copied into this branch. Rollback consists of reverting this focused commit; no database rollback is required. No merge or production deployment is authorised by this change.
