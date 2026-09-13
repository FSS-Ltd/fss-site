# Final review corrections

Date: 2026-09-13
Base: `58e60e68`
Scope: the two Important and two Minor findings from the final whole-branch review.

## Changes

- Restored the original portal signing page width, centering, header spacing, title typography, and introductory paragraph treatment in `signing.module.css`. The founder Operations signing route now uses a separate `operationsPage` class. Shared article styling still applies to both. The portal route itself was not edited.
- Replaced raw role formatting in the approval preview with `ProposalAccessPreview`, a small typed presentation component using `getPortalRolePresentation`. Every recipient shows the authoritative label and description. Proposal selections now map the existing shared `portalRoleOptions`, preserving schema values, current defaults, and the no-new-access choice.
- Added an explicit `inline-flex`, minimum 44px by 44px Requests action in each client row.
- Put the role help button and its sibling tooltip in one hover boundary. The tooltip touches that boundary without a pointer gap. Escape dismisses help through a document listener while help is open, including hover-only help; cleanup removes the listener. Pointer exit preserves keyboard focus without reopening help already dismissed by Escape. Native radios, persistent descriptions, focus, hover, and click/tap access remain.

No dependencies, backend/API/auth/database/Clerk contracts, approval confirmations, or mutation commands changed. No push or deployment was performed.

## RED and GREEN evidence

Before implementation, added focused regression assertions and ran:

```sh
node --import tsx --test components/operations/signing/signing-styles.test.ts components/operations/onboarding/journey-preview.test.tsx components/operations/clients/client-list.test.tsx components/operations/clients/portal-role-picker.test.tsx
```

Initial RED: exit 1, 14 tests, 7 passed and 7 failed. A second pre-implementation run moved the preview source assertion before loading the new component so that it failed directly on the existing defect rather than the not-yet-created component. The same seven assertions failed:

| Regression                                        | RED evidence                                                              | GREEN coverage                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portal signing isolation, Important 1             | Missing `.page` `max-width: 960px` and `margin-inline: auto` rules        | CSS assertions for the prior width and header/title/paragraph rules; source checks prove only the founder route uses `operationsPage`                                |
| Authoritative approval preview roles, Important 2 | `role.replaceAll` still present in `journey-preview.tsx`                  | Static rendering checks all four authoritative labels, descriptions, and recipient emails; source verifies the preview is wired to the retained snapshot             |
| Authoritative proposal options, Important 2       | Shared options import absent and hard-coded options present               | Checks shared options mapping, `role.value` submission values, `role.label` text, and absence of duplicated literal options                                          |
| Requests action, Minor 1                          | Rendered Requests link lacked `rowAction`; CSS lacked the explicit target | Rendered class/href assertion plus non-inline minimum-height CSS assertion                                                                                           |
| Escape and hover boundary, Minor 2                | Escape returned `owner` instead of `null`; shared help wrapper absent     | Production state checks plus markup/CSS checks for the shared boundary, contiguous tooltip, button without a leave handler, and document Escape registration/cleanup |

After implementation: exit 0, 14/14 passed.

Follow-up RED: added a focused Escape-then-pointer-exit assertion and hover-only Escape listener checks. The role picker suite exited 1 with 3 passed and 2 failed: pointer exit returned `owner` after dismissal, and the document listener was absent. Fixed both using production-owned state/event handling.

Final focused GREEN: the same four-file command exited 0 with 15 tests passed, 0 failed, 0 skipped. Tests use real static rendering and the production state helper. No React hooks or event behavior were monkey-patched. CSS loading uses the existing repository test convention.

## Aggregate verification

The shell initially selected unsupported Node 21.7.0. The first aggregate unit run had 1,746 passes and 18 failures from unsupported runtime behavior and restricted local listeners; lint completed ESLint but the cover validator failed to create its IPC pipe. Typecheck passed. No tests were weakened to bypass these failures.

Reran the required checks using Node 24.21.0 with approved local IPC/loopback access:

```sh
export PATH=/Users/JeanFidele/.nvm/versions/node/v24.21.0/bin:$PATH
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm build
```

- Complete unit suite: passed, 1,764 tests, zero failures or skips.
- Typecheck: passed.
- Lint: passed, including all 6 blog cover validations.
- Build: passed, production compilation and all 270 static pages generated successfully.
- Prettier check over all 14 changed implementation/test files: passed.
- `git diff --check`: passed.
- Reopened and reviewed every changed file and the complete patch for syntax, imports, scope, state behavior, preserved controls, and unintended changes.

Local diagnostic logs: `/tmp/fss-final-fix-unit.log` (initial restricted/unsupported-runtime run), `/tmp/fss-final-fix-unit-node24.log` (successful full suite), and `/tmp/fss-final-fix-build.log` (production build).

## Files changed

- `app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/signing/page.tsx`
- `components/operations/signing/signing.module.css`
- `components/operations/signing/signing-styles.test.ts` (new)
- `components/operations/onboarding/journey-preview.tsx`
- `components/operations/onboarding/journey-preview.test.tsx`
- `components/operations/onboarding/proposal-form.tsx`
- `components/operations/onboarding/proposal-access-preview.tsx` (new)
- `components/operations/clients/client-list.tsx`
- `components/operations/clients/client-list.module.css`
- `components/operations/clients/client-list.test.tsx`
- `components/operations/clients/portal-role-picker.tsx`
- `components/operations/clients/portal-role-picker-state.ts`
- `components/operations/clients/portal-role-picker.module.css`
- `components/operations/clients/portal-role-picker.test.tsx`
- This report.

## Remaining verification limits

Live browser pointer movement, Escape, tap, keyboard focus, and visual portal-versus-Operations comparison remain outstanding. There is no usable authenticated local browser fixture, DOM test library, or browser executable for this task. The state and source/CSS tests establish the implemented contracts but cannot prove browser layout or event delivery.

Database integration/coverage checks were not run: these corrections only change presentation and local interaction, and a configured local test database is unavailable. No CI run was triggered because no branch was pushed. No known code blocker remains in the reviewed scope.
