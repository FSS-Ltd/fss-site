# Growth OS environment matrix

Server-only configuration for the Growth OS, validated by
`lib/growth/config/env.ts` (`parseGrowthServerEnv`). No values are recorded
here — only where each name is set and how it is rotated. See
[`docs/runbooks/growth-os-secrets-rotation.md`](./growth-os-secrets-rotation.md)
for rotation mechanics and
[`docs/runbooks/growth-os-provider-setup.md`](./growth-os-provider-setup.md)
for first-time provider setup.

`GROWTH_OS_AUTOMATIONS_ENABLED=true` is rejected at boot in production
unless Gmail (`GOOGLE_GMAIL_*`), Resend (`RESEND_*`), and `CRON_SECRET` are
all fully configured — see the "rejects production automations enabled
without complete provider configuration" test in
`lib/growth/config/env.test.ts`.

Founder decision recorded on 25 August 2026: Growth OS uses Supabase project
`gfeyanrriryihpcgdvqi` only. Vercel Preview must keep `DATABASE_URL` unset
rather than receive Production database access. Database-backed Preview checks
are therefore disabled; controlled hosted verification runs in Production with
automations off and the least-privileged `growth_app` role.

| Name                                  | Owner       | Local source                                                              | Vercel Preview                                      | Vercel Production                                                                                      | Rotation                                                                                                               | Restart required                 |
| ------------------------------------- | ----------- | ------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `DATABASE_URL`                        | Jean-Fidele | `.env.local`, Supabase transaction pooler URL                             | **Do not set; database-backed Preview is disabled** | Production Supabase pooler URL                                                                         | Rotate via Supabase connection string reset; update in Vercel first, redeploy                                          | Yes                              |
| `DIRECT_DATABASE_URL`                 | Jean-Fidele | `.env.local` or an operator's ephemeral shell, Supabase direct connection | **Do not set in Vercel**                            | **Do not set in Vercel**                                                                               | Rotate with the administrative Supabase credential and update only approved operator environments                      | No runtime restart; tooling only |
| `AUTH_SECRET`                         | Jean-Fidele | `.env.local`, generated locally                                           | **Do not set; Growth OS Preview is disabled**       | `<set in Vercel>`                                                                                      | Generate a new high-entropy value, set in Vercel, redeploy; invalidates existing sessions                              | Yes                              |
| `GOOGLE_AUTH_CLIENT_ID`               | Jean-Fidele | `.env.local`                                                              | **Do not set; Growth OS Preview is disabled**       | `<set in Vercel>`                                                                                      | Rotate in Google Cloud Console, update in Vercel                                                                       | Yes                              |
| `GOOGLE_AUTH_CLIENT_SECRET`           | Jean-Fidele | `.env.local`                                                              | **Do not set; Growth OS Preview is disabled**       | `<set in Vercel>`                                                                                      | Rotate in Google Cloud Console, update in Vercel                                                                       | Yes                              |
| `GOOGLE_GMAIL_CLIENT_ID`              | Jean-Fidele | `.env.local`, optional locally                                            | **Do not set; Growth OS Preview is disabled**       | `<set in Vercel>`                                                                                      | Rotate in Google Cloud Console (dedicated Gmail OAuth client, separate from `GOOGLE_AUTH_CLIENT_ID`), update in Vercel | Yes                              |
| `GOOGLE_GMAIL_CLIENT_SECRET`          | Jean-Fidele | `.env.local`, optional locally                                            | **Do not set; Growth OS Preview is disabled**       | `<set in Vercel>`                                                                                      | Rotate in Google Cloud Console, update in Vercel                                                                       | Yes                              |
| `GOOGLE_GMAIL_REDIRECT_URI`           | Jean-Fidele | `.env.local`, loopback callback                                           | **Do not set; Growth OS Preview is disabled**       | `https://faithfulsoftware.dev/api/integrations/gmail/callback`                                         | Update alongside domain changes; must exactly match a registered redirect URI in Google Cloud Console                  | Yes                              |
| `GROWTH_OS_OWNER_EMAIL`               | Jean-Fidele | `.env.local`, founder address                                             | Same founder address                                | Same founder address                                                                                   | Not rotated — fixed to the founder's address                                                                           | Yes                              |
| `GROWTH_OS_AGENT_HMAC_SECRET`         | Jean-Fidele | `.env.local`, optional locally                                            | **Do not set; Growth OS Preview is disabled**       | `<set in Vercel>`                                                                                      | Generate a new high-entropy value, set in Vercel and in the external Codex research task's secret store together       | Yes                              |
| `TOKEN_ENCRYPTION_KEY`                | Jean-Fidele | `.env.local`, 32 bytes base64                                             | **Do not set; Growth OS Preview is disabled**       | `<set in Vercel>`                                                                                      | Rotating invalidates stored Gmail OAuth tokens — reconnect Gmail after rotation                                        | Yes                              |
| `CRON_SECRET`                         | Jean-Fidele | `.env.local`, optional locally                                            | **Do not set; Growth OS Preview is disabled**       | `<set in Vercel>`                                                                                      | Generate a new high-entropy value, set in Vercel (Vercel Cron sends it automatically once configured)                  | Yes                              |
| `NEWSLETTER_UNSUBSCRIBE_TOKEN_SECRET` | Jean-Fidele | `.env.local`, optional locally                                            | **Do not set; Growth OS Preview is disabled**       | `<set in Vercel>`                                                                                      | Rotating invalidates outstanding unsubscribe links                                                                     | Yes                              |
| `RESEND_API_KEY`                      | Jean-Fidele | `.env.local`, optional locally                                            | **Do not set; provider-backed Preview is disabled** | Resend production key                                                                                  | Rotate in Resend dashboard, update in Vercel                                                                           | Yes                              |
| `RESEND_FROM_EMAIL`                   | Jean-Fidele | `.env.local`, optional locally                                            | **Do not set; provider-backed Preview is disabled** | Verified production sending address                                                                    | Update alongside domain/DNS verification                                                                               | Yes                              |
| `RESEND_REPLY_TO_EMAIL`               | Jean-Fidele | `.env.local`, optional locally                                            | **Do not set; provider-backed Preview is disabled** | Founder's reply-to address                                                                             | Update as needed, no rotation risk                                                                                     | Yes                              |
| `RESEND_WEBHOOK_SECRET`               | Jean-Fidele | `.env.local`, optional locally                                            | **Do not set; provider-backed Preview is disabled** | `<set in Vercel>`, matches Production webhook endpoint                                                 | Regenerate in Resend dashboard when re-registering the webhook                                                         | Yes                              |
| `BLOB_READ_WRITE_TOKEN`               | Jean-Fidele | `.env.local`, optional locally                                            | **Do not set; the empty Preview store was deleted** | Vercel-issued Production token                                                                         | Managed by Vercel Blob store attachment; detach/reattach to rotate                                                     | Yes                              |
| `GROWTH_OS_AUTOMATIONS_ENABLED`       | Jean-Fidele | `.env.local`, `false`                                                     | `false`                                             | `false` at initial promotion, enabled only through the Task 7 two-gate rollout                         | Not a secret; flip via Vercel project settings                                                                         | Yes                              |
| `GROWTH_OS_PREVIEW_PR_ENABLED`        | Jean-Fidele | `.env.local`, `false`                                                     | `false`                                             | `false` until the source-only preview workflow is reviewed                                             | Not a secret; flip with the GitHub token configuration                                                                 | Yes                              |
| `GITHUB_PROSPECT_PREVIEW_TOKEN`       | Jean-Fidele | Approved local operator environment only                                  | **Do not set**                                      | Fine-grained token restricted to `FSS-Ltd/fss-site`, `contents: write` and `pull_requests: write` only | Revoke and recreate in GitHub, update Vercel, redeploy                                                                 | Yes                              |
| `GITHUB_PROSPECT_PREVIEW_REPOSITORY`  | Jean-Fidele | `FSS-Ltd/fss-site`                                                        | **Do not set**                                      | `FSS-Ltd/fss-site` exactly                                                                             | Fixed allowlist, not a secret                                                                                          | Yes                              |

## Operations worker gates

`OPERATIONS_ENABLED` controls access to the live Operations portal. It must not
be used to activate background workers. Each worker remains disabled unless its
dedicated gate is explicitly set to `true` in Production after its release
prerequisites are met.

The Studio cutover uses three separate Production-only routing flags. They are
not credentials and must remain server-only. In development and automated tests
the established portal and Studio routes remain available; a deployment with
`NODE_ENV=production` requires the exact `true` value shown below.

| Flag                                           | Default in Production | Purpose                                                                                                                              | Rollback                                                                            |
| ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `OPERATIONS_PORTAL_PREFIX_FREE_ENABLED`        | `false`               | Rewrites portal-host UI routes to the internal `/portal` namespace and redirects legacy `/portal/*` URLs to prefix-free equivalents. | Set `false` to redirect prefix-free paths back to visible legacy `/portal/*` paths. |
| `OPERATIONS_FSS_STUDIO_ENABLED`                | `false`               | Enables the FSS Studio `/admin` workspace and staff command endpoints.                                                               | Set `false` to remove Studio routes and make the Growth cutover ineffective.        |
| `OPERATIONS_GROWTH_OPERATIONS_CUTOVER_ENABLED` | `false`               | Redirects and retires legacy Growth client and billing workflows after Studio is enabled.                                            | Set `false` to restore the legacy Growth workflow routes and endpoints.             |

Use the ordered checks in
[the Operations Studio cutover runbook](./operations-studio-cutover.md). Do
not make these changes in Preview or use them as a substitute for staff access
verification.

| Worker     | Default                               | Required configuration before activation                                                                                      |
| ---------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Onboarding | `OPERATIONS_ONBOARDING_ENABLED=false` | `OPERATIONS_ONBOARDING_DATABASE_URL` using the dedicated least-privilege worker role, plus a reviewed onboarding release gate |
| Signing    | `OPERATIONS_SIGNING_ENABLED=false`    | `OPERATIONS_SIGNING_DATABASE_URL` using the dedicated least-privilege worker role, plus a reviewed signing release gate       |
| Billing    | `OPERATIONS_BILLING_ENABLED=false`    | `OPERATIONS_BILLING_DATABASE_URL`, reviewed Stripe account/mode/webhook configuration, and a billing release gate             |

The flags and connection-string names are server-only. Do not place a value in
source control or expose any of them through `NEXT_PUBLIC_*`.

## Public values

Only these are safe under `NEXT_PUBLIC_*` and may appear in the client
bundle:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`

`lib/growth/config/env.ts` explicitly rejects any `NEXT_PUBLIC_*` variant of
a server-only Growth OS name (database URLs, the token encryption key,
Gmail OAuth credentials) so a misconfigured deployment fails closed instead
of leaking a secret into the browser.
