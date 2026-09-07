# Client identity and invitations

The portal uses a separate Supabase Auth project and server-side cookies. Founder Google/Auth.js authentication remains independent. Operations is disabled unless `OPERATIONS_ENABLED=true`; its staged migrations must not be promoted before the release gate.

## Configuration

Server runtime requires `OPERATIONS_SUPABASE_URL`, `OPERATIONS_SUPABASE_PUBLISHABLE_KEY` and `OPERATIONS_PORTAL_DATABASE_URL`. The URL must use HTTPS outside local development. Use a dedicated database login that can assume only `operations_portal`; do not give this login founder, superuser or BYPASSRLS privileges. Runtime explicitly assumes and verifies the portal role. The existing founder connection remains separate in `OPERATIONS_DATABASE_URL`.

Only the operator environment needs `OPERATIONS_SUPABASE_SECRET_KEY`. Do not configure this administrative key in the browser or portal runtime. Keep credentials in the secure store or approved deployment secret manager.

Disable public signup and all unused identity providers in the managed project. Enable email authentication, configure the canonical site's exact `/portal/auth/callback` URL, set email links to expire after ten minutes, and configure authenticated SMTP before release. Do not allow wildcard production redirects. The local prototype used a five-minute JWT lifetime to exercise refresh; set and verify hosted session expiry and refresh settings during release testing.

Founder provisioning creates a confirmed email account without a password. This is necessary because signup-disabled authentication rejects unconfirmed accounts. Provisioning creates no session or membership. The recipient must still prove inbox ownership through the one-time email link and claim the separate invitation. An existing account is reused, never reset. Provider provisioning can succeed before a database failure; such an account has no portal access until a valid membership claim succeeds.

## Reviewed operator workflow

Use Node 24 and the project dependencies. Prepare one reviewed JSON operation. The CLI defaults to validation without writes:

```sh
pnpm exec tsx scripts/manage-operations-portal.ts /private/path/reviewed.json
pnpm exec tsx scripts/manage-operations-portal.ts /private/path/reviewed.json --apply --reviewed-by founder@example.com
```

The reviewer must match `GROWTH_OS_OWNER_EMAIL`. Dedicated founder database credentials are also required; the email argument alone does not grant database authority. Each operation requires an explicit organisation and review reference.

Create a contact:

```json
{
  "action": "create_contact",
  "organisationId": "11111111-1111-4111-8111-111111111111",
  "name": "Reviewed contact",
  "email": "client@example.com",
  "reviewReference": "approved-onboarding-record"
}
```

Issue an invitation to the returned contact ID:

```json
{
  "action": "issue_invite",
  "organisationId": "11111111-1111-4111-8111-111111111111",
  "contactId": "22222222-2222-4222-8222-222222222222",
  "role": "viewer",
  "reviewReference": "approved-access-record"
}
```

For issuance, add `--output /private/path/new-invitation.json`. The CLI creates this file exclusively with mode 0600 and writes the activation URL there. It never prints the bearer token or sends an invitation email. Share it through the approved customer communication process. Keep the file outside Git and the synced vault, then remove it after delivery. If writing fails after issuance, reissue to revoke the inaccessible token. Reissuing revokes the previous unclaimed invitation.

Revoke a membership with `action: "revoke_membership"`, `organisationId`, `membershipId` and `reviewReference`. No output file is accepted for contact creation or revocation. Revocation is checked on subsequent protected operations; possessing an unexpired authentication cookie does not preserve tenant access.

## Security boundaries

Invitations contain 256 random bits, expire after 72 hours and persist only as SHA-256 hashes. Claims atomically verify the exact confirmed email, intended organisation and unclaimed state. Replacement, expiry, replay, wrong-email and concurrent claims are tested against the actual restricted database role.

Activation links carry the token in a URL fragment. The client captures it once and removes it from browser history before submission. A same-origin POST stores it in a separate HTTP-only, SameSite=Lax cookie for ten minutes while the recipient completes email verification. The callback consumes and clears this cookie. Authentication cookies use the `fss-portal-auth` namespace and are HTTP-only, SameSite=Lax and Secure on HTTPS. Responses disable caching and referrer transmission. PKCE exchange uses the same browser and fixed callback; arbitrary return URLs are not accepted.

Proxy refresh uses the managed SDK. Protected server code uses the provider's `getUser()` response, never the user object supplied by a session cookie. Every tenant transaction checks a live membership with transaction-local identity and selected organisation. Context cannot leak across pooled connections. Organisation reads expose only the public ID and display name; internal founder metadata, Growth data and authentication tables are inaccessible to portal roles. Future document views, storage links and counts must preserve this boundary.

Roles are owner, contributor, billing contact and viewer. An owner can request access changes but cannot provision accounts. Agreement acceptance remains denied until Task 9 verifies the separately approved signer identity. Authentication does not infer signing or payment authority.

Login applies atomic database limits of 30 requests per trusted IP and five per email per fifteen minutes. Callback uses the IP limit. Only Vercel's platform `x-vercel-forwarded-for` header is trusted when running on Vercel; elsewhere requests share a fail-closed network bucket. Configure a separately verified trusted-IP adapter before deploying behind another proxy. Counters store hashes rather than raw email/IP values and expire through bounded cleanup. All unknown-account responses are generic. Provider errors are logged by safe error name and correlation ID, without email, code, token or cookie contents.

## Managed-auth prototype evidence

Before adding dependencies, a disposable Supabase Auth/Mailpit sandbox verified passwordless non-Google login, disabled public signup, PKCE exchange, verified email, email/code replay rejection, server-cookie refresh, token rotation, cache headers, rejection of spoofed cookie identity, and rejection of a globally revoked session by `getUser()`. Only synthetic mailboxes were used; no customer email was sent.

Pinned SDKs: `@supabase/ssr` 0.12.6 and `@supabase/supabase-js` 2.116.0. These provide managed cookie and token handling. The local sandbox's mail sink and credentials are temporary verification infrastructure, not a deployment configuration.

References: [Supabase server-side clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [passwordless email authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless), and [Vercel request headers](https://vercel.com/docs/headers/request-headers). Hosted SMTP delivery, production redirect settings, cross-browser/mobile email behavior and release environment credentials remain explicit Task 14 verification items.
