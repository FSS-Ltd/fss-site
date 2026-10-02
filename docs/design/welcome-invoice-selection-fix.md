# Welcome invoice selection fix

Date: 2026-10-02

The welcome Schedule stage disabled its first-invoice selector whenever billing
was unconfigured. Its choices come from recorded agreement terms, so this also
blocked choosing an invoice for a saved draft before provider setup.

The selector now requires available agreement obligations and no pending action.
Selecting and saving an obligation works independently of billing configuration.
Missing agreements and agreements without invoiceable installments or recurring
charges show accessible guidance beside the disabled selector. The billing notice
explains that draft preparation remains available.

Exact preview and approval retain their existing billing prerequisites and
server validation. Scheduling remains at 09:00 Europe/London. No contractual
amounts, due dates, provider controls or organisation boundaries change.

Verification:

- Component regressions reproduced the disabled selector and missing guidance,
  then passed after the fix: three component tests passed.
- Twenty existing and new browser cases passed on desktop and mobile using
  installed Chrome in fresh test contexts. Regressions verify selection, retained
  stage values, the saved draft command, disabled exact review without billing,
  and recovery after selecting a missing agreement.
- All 84 related onboarding units, TypeScript, changed-file ESLint and the
  production build passed.

Rollout requires the normal reviewed application release. No database migration,
provider configuration change or external send is required for this UI fix.
