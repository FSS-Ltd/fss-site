# Growth OS provider setup

External service setup for the Growth OS Vercel release. This runbook
documents what to configure and in what order — it does not authorise
running any of it. Per the release plan's Global Constraints, none of
these steps by themselves authorise a production deployment, DNS change,
Supabase production migration, OAuth consent publication, or provider
credential creation. Review Step 6 below before any external mutation.

Resend setup (domain verification, webhook registration, unsubscribe
secret) is already fully documented in
[`docs/runbooks/resend-marketing.md`](./resend-marketing.md) — this
runbook only orders it into the release sequence, it does not repeat it.
The signed research-agent ingestion secret
(`GROWTH_OS_AGENT_HMAC_SECRET`) is documented in
[`docs/growth-os/runbooks/scheduled-research.md`](../growth-os/runbooks/scheduled-research.md).

## Step 1: Supabase linking and migration flow

```bash
supabase --version
supabase login
supabase init
supabase link --project-ref gfeyanrriryihpcgdvqi
supabase db diff --linked
supabase migration list --linked
```

- Run `pnpm verify:migrations` before `supabase db diff` — it catches
  duplicate timestamps, non-`.sql` files, destructive statements, missing
  `growth.`-schema qualification, and grants to `anon`/`authenticated`
  locally, before anything touches the linked project.
- Review the diff output yourself; do not pipe it into `supabase db push`
  unattended.
- `supabase db push` requires explicit approval after the diff is
  reviewed and a backup exists (Task 7's cutover gate covers this — this
  runbook only documents the linking, not authorises the push).
- Runtime `DATABASE_URL` uses the transaction pooler connection string.
  `DIRECT_DATABASE_URL` is limited to migration and maintenance tooling
  (`scripts/verify-growth-release.ts`, `scripts/verify-migrations.ts`,
  `supabase` CLI commands) — never set it in the Vercel project or expose it
  to the request-serving app.

## Step 2: Separate Google OAuth clients

Create **two** OAuth clients in Google Cloud Console — do not reuse one
for both purposes:

1. **Dashboard sign-in client** (`GOOGLE_AUTH_CLIENT_ID` /
   `GOOGLE_AUTH_CLIENT_SECRET`, consumed by Auth.js). Limit this to the
   founder's own Google account — `requireFounder()`
   (`lib/growth/auth/require-founder.ts`) already rejects any session
   whose email doesn't match `GROWTH_OS_OWNER_EMAIL`, but the OAuth
   consent screen and client should not be configured for public sign-up
   regardless.
2. **Gmail automation client** (`GOOGLE_GMAIL_CLIENT_ID` /
   `GOOGLE_GMAIL_CLIENT_SECRET` / `GOOGLE_GMAIL_REDIRECT_URI`). Requested
   only through the founder's explicit Gmail connect flow
   (`/api/integrations/gmail/connect`) — never at dashboard sign-in.
   Request offline access (`access_type=offline`) so the refresh token
   survives past the session.

Record the exact redirect URIs for each environment — `env.ts`'s
`gmailRedirectUriSchema` (`lib/growth/config/env.ts`) requires an exact
match with no query string, fragment, or embedded credentials:

| Environment | Gmail redirect URI |
| --- | --- |
| Local | `http://localhost:3000/api/integrations/gmail/callback` |
| Preview | `https://<preview-deployment>.vercel.app/api/integrations/gmail/callback` |
| Production | `https://<canonical-domain>/api/integrations/gmail/callback` |

The dashboard sign-in client's redirect URI is whatever Auth.js's own
provider configuration expects — register it the same way, one entry per
environment, in the same Google Cloud Console client.

## Step 3: Resend

Follow [`docs/runbooks/resend-marketing.md`](./resend-marketing.md) in
full: verify the sending domain, set `RESEND_FROM_EMAIL` /
`RESEND_REPLY_TO_EMAIL` / `RESEND_API_KEY`, set
`NEWSLETTER_UNSUBSCRIBE_TOKEN_SECRET`, register the signed webhook, and
use founder-controlled test recipients only. Resend cannot send cold
outreach in this codebase — `ResendMessage.category` is a closed
allowlist with no cold/prospect category in it (see that runbook for the
full explanation).

## Step 4: Vercel Blob and project setup

1. Link the GitHub repository to the existing Vercel Pro account. Keep
   the framework preset as Next.js — no custom build command is needed.
2. Create a private Vercel Blob store. It must produce stable public URLs
   for approved email visual assets (the dashboard reports its presence
   via `BLOB_READ_WRITE_TOKEN`, see
   [`docs/runbooks/founder-dashboard.md`](./founder-dashboard.md)).
3. Scope every token (Blob, and every environment variable below) by
   Vercel environment — Preview and Production must not share a live
   secret. See
   [`docs/runbooks/growth-os-environment-matrix.md`](./growth-os-environment-matrix.md)
   for the full per-variable scope table.

## Step 5: Secret generation and rotation

Generate independent high-entropy values for: `AUTH_SECRET`,
`CRON_SECRET`, `GROWTH_OS_AGENT_HMAC_SECRET`,
`NEWSLETTER_UNSUBSCRIBE_TOKEN_SECRET`, and `TOKEN_ENCRYPTION_KEY` (32
bytes, base64-encoded — `parseTokenEncryptionKey` in
`lib/growth/integrations/token-crypto.ts` rejects anything else). Do not
reuse a value across environments or across names. See
[`docs/runbooks/growth-os-secrets-rotation.md`](./growth-os-secrets-rotation.md)
for where each is set and how to rotate it — no value is recorded in
either document.

## Step 6: Review before any external mutation

Before running any command in this runbook against a real account, a
human (Jean-Fidele) confirms:

- **Account ownership** — the Google Cloud project, Vercel team, Resend
  account, and Supabase project all belong to Faithful Software
  Solutions, not a personal or test account.
- **Billing scope** — Vercel Pro, Resend, and Supabase billing are on the
  intended plan and payment method.
- **Redirect domains** — every registered OAuth redirect URI matches a
  domain this release plan actually controls.
- **Sending domain** — the Resend sending domain's DNS is under FSS's
  control, not a placeholder.
- **Project reference** — `gfeyanrriryihpcgdvqi` is still the intended
  Supabase project before linking or pushing a migration.
- **Rollback access** — Netlify access, the current DNS values, and the
  last known-good Vercel deployment are all still available (Task 7 and
  8's cutover and rollback runbooks depend on this).
