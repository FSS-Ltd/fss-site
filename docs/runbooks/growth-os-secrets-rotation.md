# Growth OS secrets rotation

Rotation mechanics for every Growth OS server-only secret. No values are
recorded here or in
[`docs/runbooks/growth-os-environment-matrix.md`](./growth-os-environment-matrix.md)
— only where a secret is set and what rotating it actually does. Generate
every value independently; never reuse one across names or environments.

## General procedure

1. Generate the new value locally (never paste a value into a chat tool,
   ticket, or this repository).
2. Set it in the Vercel project's environment variables for the affected
   environment (Preview, Production, or both).
3. Redeploy — every value in the matrix requires a restart to take
   effect; there is no hot-reload path.
4. Confirm via `/growth/settings` (founder dashboard) or
   `pnpm verify:growth-release` that the affected integration reports
   healthy again before considering the rotation complete.

## Per-secret rotation effects

| Secret | What rotating it breaks until reconnected | Who/what else needs the new value |
| --- | --- | --- |
| `AUTH_SECRET` | Invalidates every existing Auth.js session — the founder is signed out and must sign in again. | Nothing external. |
| `TOKEN_ENCRYPTION_KEY` | Invalidates every stored Gmail OAuth refresh token (`parseTokenEncryptionKey`, `lib/growth/integrations/token-crypto.ts`, rejects anything that isn't 32 bytes of canonical base64). Gmail sync and dispatch fail closed until reconnected. | The founder must reconnect Gmail from `/growth/settings` after rotation — there is no re-encryption path for the old token. |
| `CRON_SECRET` | Every Vercel Cron job starts returning `401` (`authorizeCronRequest`, `lib/growth/http/cron-auth.ts`) until Vercel Cron is updated to send the new value. | Vercel Cron's own configured `CRON_SECRET` header — update it in the same change, not after. |
| `GROWTH_OS_AGENT_HMAC_SECRET` | The scheduled Codex research task's submissions start failing signature verification (`docs/growth-os/runbooks/scheduled-research.md`). | The external scheduled task's own secret store — rotate both together or research ingestion goes dark. |
| `NEWSLETTER_UNSUBSCRIBE_TOKEN_SECRET` | **Silently** invalidates every unsubscribe link already delivered in prior newsletter emails — a recipient clicking an old link gets a bad-token error, not an unsubscribe (documented in `docs/runbooks/resend-marketing.md`). | Nothing external, but treat this as a one-way, user-visible action — never a routine rotation. |
| `RESEND_API_KEY` | Newsletter and transactional sends fail; `resend-dispatch` cron reports the failure per message, does not crash. | Regenerate in the Resend dashboard; scope it to sending only. |
| `RESEND_WEBHOOK_SECRET` | Inbound Resend delivery-event webhooks fail signature verification and return `401` (`verifyResendWebhookSignature`, `lib/growth/integrations/resend/webhook.ts`) until the Resend dashboard's webhook endpoint is re-registered with the new secret. | Must be rotated together with re-registering the webhook endpoint in the Resend dashboard — the secret is generated per-endpoint, not standalone. |
| `GOOGLE_AUTH_CLIENT_SECRET` | Dashboard sign-in fails until updated. | Google Cloud Console client. |
| `GOOGLE_GMAIL_CLIENT_SECRET` | Gmail OAuth connect/refresh fails until updated; existing connections keep working until their access token needs refreshing. | Google Cloud Console client — this is the dedicated Gmail automation client, never the dashboard sign-in client (see `docs/runbooks/growth-os-provider-setup.md`). |
| `BLOB_READ_WRITE_TOKEN` | Not directly rotatable as a value — managed by Vercel's Blob store attachment. Detach and reattach the store to issue a new token. | Nothing external; existing public asset URLs are unaffected (the token only gates writes). |

## Emergency rotation (suspected exposure)

If any secret is suspected exposed (committed, logged, pasted somewhere
outside this list's controlled path):

1. Set `GROWTH_OS_AUTOMATIONS_ENABLED=false` first if the exposed secret
   is `TOKEN_ENCRYPTION_KEY`, `GROWTH_OS_AGENT_HMAC_SECRET`,
   `RESEND_API_KEY`, or `CRON_SECRET` — see
   [`docs/runbooks/growth-os-rollback.md`](./growth-os-rollback.md) for
   full containment.
2. Rotate the specific secret immediately using the table above — do not
   wait for a scheduled maintenance window.
3. If it was a Google OAuth client secret, also revoke and reissue the
   client secret in Google Cloud Console (rotating only the environment
   variable does not invalidate a leaked client secret at Google's end).
4. Record the rotation date and reason in the incident log (see
   `docs/runbooks/growth-os-incident-response.md`) — never the secret
   value itself.
