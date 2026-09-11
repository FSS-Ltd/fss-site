# Client identity and invitations

The portal uses Clerk for identity and invitation delivery. The private
`operations` schema remains the source of truth for membership and portal roles.
Founder Growth authentication remains independent.

## Deployment configuration

Operations requires `OPERATIONS_ENABLED=true`, a founder-only
`OPERATIONS_DATABASE_URL`, and an independent
`OPERATIONS_PORTAL_DATABASE_URL`. Both URLs connect to the same database, but
their login roles may assume only `operations_founder` and `operations_portal`
respectively. Never reuse the Growth runtime or migration-administrator
credential.

Configure Clerk with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
and `CLERK_WEBHOOK_SIGNING_SECRET`. Set
`OPERATIONS_PORTAL_ORIGIN=https://portal.faithfulsoftware.dev`, allow
`https://portal.faithfulsoftware.dev/portal/activate` as a redirect URL, and
send Clerk `user.created` and `user.updated` webhooks to
`https://portal.faithfulsoftware.dev/api/webhooks/clerk`.

Keep every credential in the deployment secret manager. The publishable Clerk
key is the only browser-safe value; database URLs and Clerk secret/webhook keys
are server-only.

## Access flow

1. A founder creates or selects an approved contact and grants a portal role in
   Growth OS.
2. Operations records the auditable invitation before Clerk sends its activation
   email.
3. The recipient verifies their email with Clerk and reaches the signed webhook
   or portal claim endpoint.
4. Operations activates the membership only when the verified email matches the
   approved pending contact.
5. Every protected portal request re-checks membership through the restricted
   `operations_portal` database role.

Removing a Clerk account prevents a new portal session. Revoke the Operations
membership in Growth OS to remove its durable access record as well.

## Reviewed operator workflow

Use Node 24 and project dependencies. Prepare one reviewed JSON operation. The
CLI validates by default and does not write:

```sh
pnpm exec tsx scripts/manage-operations-portal.ts /private/path/reviewed.json
pnpm exec tsx scripts/manage-operations-portal.ts /private/path/reviewed.json \
  --apply --reviewed-by founder@example.com
```

The reviewer must match `GROWTH_OS_OWNER_EMAIL`. The email records reviewer
acknowledgement only: the restricted founder database credential provides the
database authority. Each operation needs an explicit organisation and review
reference.

To issue an invitation through the CLI, include `--output` with a new private
path. The script creates the output with mode 0600 and keeps it outside Git and
the synced vault. The Growth OS Portal access screen is the normal founder UI
for granting and revoking access; it sends the Clerk invitation directly.

## Security boundaries

Clerk does not determine an Operations role. The restricted database role
enforces a live, tenant-scoped membership for every portal request. Operations
roles are `owner`, `contributor`, `billing_contact`, and `viewer`; signing and
payment authority are explicit workflows and are never inferred from login.

Webhook verification is required before identity claims, and responses avoid
logging email addresses, tokens, cookies, provider payloads, or secret values.
