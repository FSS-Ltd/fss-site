# Growth CRM dependency review

Status: Local dependency remediation completed. Production release requires founder review.

The production dependency audit of the inspected base reported two critical, seven high, six moderate and one low advisory. These were inherited from the baseline, not introduced by the CRM implementation. Next.js includes reported remote-code-execution advisories affecting versions through 16.4.0. Other affected dependencies include sharp, Zod, source-map-js and undici.

Audit evidence: `pnpm audit --prod --audit-level high --json` against the branch lockfile on 2026-10-26. Advisory references: GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r, GHSA-wq5f-xc86-pv6w, GHSA-mrhx-c7xc-m3w5, GHSA-68fv-2mgg-jv7q and GHSA-xjj6-f33q-929c. Remaining lower-severity Next.js/undici advisories are included in the same update.

Options:

1. Update affected existing dependencies locally and rerun unit, integration, browser, build and audit gates before release. Recommended.
2. Retain the old lockfile and hold the release. Do not represent the old dependency graph as production-ready.

Local remediation targets Next.js and its matching lint configuration at 16.4.2, sharp 0.35.5, Zod 4.6.6 or newer within major 4, source-map-js 1.2.2, and vulnerable undici 6.x resolutions at 6.29.1. No new production library is introduced. Override constraints are limited to advisory-affected ranges.

Deployment, Production migrations, credential changes and incident response on a live system are outside this local implementation authorization. The required founder decision is whether to release the reviewed, verified branch after the final evidence is available. This note is not evidence of exploitation or proof that a live deployment is affected by every listed code path.

The patched production dependency audit reported zero vulnerabilities. Final resolved versions: Next.js and eslint-config-next 16.4.2, sharp 0.35.5, Zod 4.6.7, source-map-js 1.2.2 and affected undici 6.x at 6.29.1. The transitive Zod 4.1.11 dependency under Vercel Blob is also constrained to the patched major-4 version. Remaining application verification is recorded in the CRM runbook.
