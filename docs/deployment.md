# FSS Deployment (GitHub + Netlify)

This repo is set up for a simple, safe CI/CD model where GitHub validates changes and Netlify handles deployments.

## Branch + deploy model

- Feature work happens on feature branches.
- Open pull requests into `main` (no direct feature pushes to `main`).
- GitHub Actions runs lint + build on PRs.
- Netlify creates deploy previews for PRs.
- Production deploys from `main` only.

## Netlify configuration in repo

`netlify.toml` configures:

- Build command: `pnpm build`
- Node runtime: `NODE_VERSION=20`
- Next.js runtime plugin: `@netlify/plugin-nextjs`
- Functions bundler: `esbuild`
- Lead submission provider set to `api` for:
  - production
  - deploy previews
  - branch deploys

### Why this matters

- App Router + route handlers (`app/api/*`) are handled by Netlify’s Next runtime plugin.
- No custom redirects/rewrites file is needed for this architecture.
- Leads flow through `/api/lead` so HubSpot + Resend logic remains server-side.

## Environment variables

Set these in Netlify (Site configuration -> Environment variables).

### Required (all deployed contexts)

- `HUBSPOT_ACCESS_TOKEN`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL`
- `LEAD_NOTIFICATION_EMAIL`
- `NEXT_PUBLIC_LEAD_SUBMISSION_PROVIDER=api`

### Required (production context)

- `NEXT_PUBLIC_SITE_URL` (your canonical domain, e.g. `https://faithfulsoftwaresolutions.co.uk`)

### Optional

- `HUBSPOT_CHALLENGE_PROPERTY`
- `HUBSPOT_SOURCE_CONTEXT_PROPERTY`
- `HUBSPOT_SOURCE_PATH_PROPERTY`
- `HUBSPOT_RESOURCE_SLUG_PROPERTY`
- `HUBSPOT_API_KEY` (legacy fallback alias; prefer `HUBSPOT_ACCESS_TOKEN`)

### Netlify-provided runtime vars (automatic)

Do not set these manually:

- `CONTEXT`
- `URL`
- `DEPLOY_PRIME_URL`

If `NEXT_PUBLIC_SITE_URL` is not set (common for previews), the app falls back to:

1. `DEPLOY_PRIME_URL`
2. `URL`
3. hardcoded production fallback

## SEO behavior for preview vs production

- Production (`main`) can be indexed.
- Deploy previews and branch deploys are marked `noindex,nofollow`.
- `robots.txt` disallows crawling on preview/branch deploy contexts.

This avoids preview URLs competing with production SEO.

## GitHub Actions (validation only)

Workflow: `.github/workflows/ci.yml`

Runs on:

- PRs targeting `main`
- pushes to `main`

Checks:

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm build`

Netlify remains the deployment system.

## Manual setup checklist

1. **GitHub**
   - Protect `main`.
   - Require pull requests before merge.
   - Require CI status check (`CI / Lint and Build`) before merge.
2. **Netlify**
   - Connect this GitHub repo.
   - Set production branch to `main`.
   - Ensure Deploy Previews are enabled.
   - Add the required environment variables above.
3. **Resend**
   - Verify sender domain/address used by `RESEND_FROM_EMAIL`.
4. **HubSpot**
   - Create optional custom contact properties if you want enriched lead context fields.

## Operational assumptions / gotchas

- Lead capture is API-driven (`/api/lead`), not static HTML form posting.
- Hidden Netlify form registry exists for compatibility, but primary submission path is API.
- If HubSpot succeeds and an email send fails, submission still completes and an `emailWarning` is returned/logged.
