# FSS deployment (GitHub + Vercel)

GitHub validates changes and Vercel hosts preview and production deployments.

## Branch and deployment model

- Feature work happens on feature branches.
- Changes enter `main` through reviewed pull requests.
- GitHub Actions runs the repository's type check, lint, database-backed
  coverage gates, migration policy check, dependency audit, build, and bundle
  budget check. Lighthouse is available as a manual workflow.
- Vercel creates an isolated preview deployment for each pull request.
- A merge to `main` creates a Vercel production deployment.

## Repository configuration

- `vercel.json` defines the protected Growth OS cron schedules and pins
  functions to Vercel's Paris region (`cdg1`), close to the Supabase
  eu-west-3 database.
- `.node-version` and `package.json#engines` keep local, CI, and Vercel builds
  on Node.js 24.
- `NEXT_PUBLIC_SITE_URL` is the canonical production origin. When it is unset
  in a preview, `resolveSiteUrl()` uses Vercel's `VERCEL_URL`.
- Public lead capture always posts to the first-party `/api/lead` route. HubSpot
  and Resend credentials remain server-side.

## Environment variables

Configure Preview and Production independently in the Vercel project. The
authoritative ownership, scope, and rotation matrix is
[`docs/runbooks/growth-os-environment-matrix.md`](runbooks/growth-os-environment-matrix.md).

At minimum, the public site requires:

- `HUBSPOT_ACCESS_TOKEN`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL`
- `LEAD_NOTIFICATION_EMAIL`
- `NEXT_PUBLIC_SITE_URL` in Production

The Growth OS adds its database, authentication, provider, signing, and cron
variables from the environment matrix. Server-only names must never use a
`NEXT_PUBLIC_` prefix.

## Release checks

Before merging a production-affecting pull request:

1. Install Chromium once with `pnpm exec playwright install chromium`, then run
   `pnpm test:visual` locally before committing UI changes. Playwright compares
   screenshots against baselines for the local operating system.
2. Confirm the required GitHub CI check and Vercel preview pass. Run the manual
   Lighthouse workflow when reviewing performance-sensitive changes.
3. Complete the Growth OS preview checklist when Growth OS code or provider
   configuration changes.
4. Keep `GROWTH_OS_AUTOMATIONS_ENABLED=false` until the provider rollout gates
   pass.
5. Obtain Jean-Fidele's explicit approval for production deployment or domain
   changes.

Use [`docs/runbooks/growth-os-rollback.md`](runbooks/growth-os-rollback.md) to
promote the last known-good Vercel deployment if production validation fails.
