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

| Name | Owner | Local source | Vercel Preview | Vercel Production | Rotation | Restart required |
| --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Jean-Fidele | `.env.local`, Supabase transaction pooler URL | Preview-scoped Supabase branch/schema pooler URL | Production Supabase pooler URL | Rotate via Supabase connection string reset; update in Vercel first, redeploy | Yes |
| `DIRECT_DATABASE_URL` | Jean-Fidele | `.env.local`, Supabase direct connection | Preview-scoped direct URL, migration/maintenance tooling only | Production direct URL, migration/maintenance tooling only | Same as `DATABASE_URL` | Yes (tooling only, not the app runtime) |
| `AUTH_SECRET` | Jean-Fidele | `.env.local`, generated locally | `<set in Vercel>` | `<set in Vercel>` | Generate a new high-entropy value, set in Vercel, redeploy; invalidates existing sessions | Yes |
| `GOOGLE_AUTH_CLIENT_ID` | Jean-Fidele | `.env.local` | `<set in Vercel>` | `<set in Vercel>` | Rotate in Google Cloud Console, update in Vercel | Yes |
| `GOOGLE_AUTH_CLIENT_SECRET` | Jean-Fidele | `.env.local` | `<set in Vercel>` | `<set in Vercel>` | Rotate in Google Cloud Console, update in Vercel | Yes |
| `GOOGLE_GMAIL_CLIENT_ID` | Jean-Fidele | `.env.local`, optional locally | `<set in Vercel>` | `<set in Vercel>` | Rotate in Google Cloud Console (dedicated Gmail OAuth client, separate from `GOOGLE_AUTH_CLIENT_ID`), update in Vercel | Yes |
| `GOOGLE_GMAIL_CLIENT_SECRET` | Jean-Fidele | `.env.local`, optional locally | `<set in Vercel>` | `<set in Vercel>` | Rotate in Google Cloud Console, update in Vercel | Yes |
| `GOOGLE_GMAIL_REDIRECT_URI` | Jean-Fidele | `.env.local`, loopback callback | Preview deployment's exact HTTPS callback URL | Production canonical domain's exact HTTPS callback URL | Update alongside domain changes; must exactly match a registered redirect URI in Google Cloud Console | Yes |
| `GROWTH_OS_OWNER_EMAIL` | Jean-Fidele | `.env.local`, founder address | Same founder address | Same founder address | Not rotated — fixed to the founder's address | Yes |
| `GROWTH_OS_AGENT_HMAC_SECRET` | Jean-Fidele | `.env.local`, optional locally | `<set in Vercel>` | `<set in Vercel>` | Generate a new high-entropy value, set in Vercel and in the external Codex research task's secret store together | Yes |
| `TOKEN_ENCRYPTION_KEY` | Jean-Fidele | `.env.local`, 32 bytes base64 | `<set in Vercel>` | `<set in Vercel>` | Rotating invalidates stored Gmail OAuth tokens — reconnect Gmail after rotation | Yes |
| `CRON_SECRET` | Jean-Fidele | `.env.local`, optional locally | `<set in Vercel>` | `<set in Vercel>` | Generate a new high-entropy value, set in Vercel (Vercel Cron sends it automatically once configured) | Yes |
| `NEWSLETTER_UNSUBSCRIBE_TOKEN_SECRET` | Jean-Fidele | `.env.local`, optional locally | `<set in Vercel>` | `<set in Vercel>` | Rotating invalidates outstanding unsubscribe links | Yes |
| `RESEND_API_KEY` | Jean-Fidele | `.env.local`, optional locally | Resend test/sandbox key | Resend production key | Rotate in Resend dashboard, update in Vercel | Yes |
| `RESEND_FROM_EMAIL` | Jean-Fidele | `.env.local`, optional locally | Verified test sending address | Verified production sending address | Update alongside domain/DNS verification | Yes |
| `RESEND_REPLY_TO_EMAIL` | Jean-Fidele | `.env.local`, optional locally | Founder-controlled test address | Founder's reply-to address | Update as needed, no rotation risk | Yes |
| `RESEND_WEBHOOK_SECRET` | Jean-Fidele | `.env.local`, optional locally | `<set in Vercel>`, matches Preview webhook endpoint | `<set in Vercel>`, matches Production webhook endpoint | Regenerate in Resend dashboard when re-registering the webhook | Yes |
| `BLOB_READ_WRITE_TOKEN` | Jean-Fidele | `.env.local`, optional locally | Vercel-issued per-environment token | Vercel-issued per-environment token | Managed by Vercel Blob store attachment; detach/reattach to rotate | Yes |
| `GROWTH_OS_AUTOMATIONS_ENABLED` | Jean-Fidele | `.env.local`, `false` | `false` | `false` at initial promotion, enabled only through the Task 7 two-gate rollout | Not a secret; flip via Vercel project settings | Yes |

## Public values

Only these are safe under `NEXT_PUBLIC_*` and may appear in the client
bundle:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_LEAD_SUBMISSION_PROVIDER`

`lib/growth/config/env.ts` explicitly rejects any `NEXT_PUBLIC_*` variant of
a server-only Growth OS name (database URLs, the token encryption key,
Gmail OAuth credentials) so a misconfigured deployment fails closed instead
of leaking a secret into the browser.
