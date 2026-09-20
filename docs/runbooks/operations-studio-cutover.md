# Operations Studio cutover

This runbook moves staff operations from the legacy Growth workflow pages to
FSS Studio without changing production data directly. It records the only
permitted order for portal routing, Studio availability, and legacy-route
retirement. It does not authorise a deployment, Clerk change, or production
migration by itself.

## Preconditions

- The reviewed pull request has passed its required checks and is ready to
  merge.
- The protected GitHub Actions `production` environment is configured for the
  migration job. Production migrations run only after the validated `main`
  workflow receives the required GitHub approval. Do not use an operator
  workstation to run `supabase db push`.
- The founder has issued and accepted the initial FSS Admin invitation. Verify
  the active staff membership through the live staff guard before retiring any
  Growth workflow.
- Clerk allows both `https://portal.faithfulsoftware.dev/portal/activate` and
  `https://portal.faithfulsoftware.dev/activate`. Do not change Clerk from
  this runbook without explicit founder approval.
- Record the current production deployment and all three cutover flag values.

## Route mapping

| Legacy Growth route                                                | FSS Studio destination                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `/growth/operations/clients`                                       | `https://portal.faithfulsoftware.dev/admin/clients`                                       |
| `/growth/operations/clients/[organisationId]/agreements`           | `https://portal.faithfulsoftware.dev/admin/clients/[organisationId]/agreements`           |
| `/growth/operations/clients/[organisationId]/journey`              | `https://portal.faithfulsoftware.dev/admin/clients/[organisationId]/journey`              |
| `/growth/operations/clients/[organisationId]/requests`             | `https://portal.faithfulsoftware.dev/admin/clients/[organisationId]/requests`             |
| `/growth/operations/clients/[organisationId]/requests/[requestId]` | `https://portal.faithfulsoftware.dev/admin/clients/[organisationId]/requests/[requestId]` |
| `/growth/operations/clients/[organisationId]/signing`              | `https://portal.faithfulsoftware.dev/admin/clients/[organisationId]/signing`              |
| `/growth/operations/billing`                                       | `https://portal.faithfulsoftware.dev/admin/billing`                                       |

`/growth/operations` remains the founder-only portal access console. The
legacy client, agreement, journey, request, signing, billing, and metric-export
endpoints return `404` once the final cutover flag is enabled. The portal access
endpoint remains available to the founder.

## Enable in order

Each flag change requires a production redeploy and a fresh smoke check. Use
exact lowercase `true`; any other value is disabled in production.

1. Set `OPERATIONS_PORTAL_PREFIX_FREE_ENABLED=true`.
   - Confirm portal-host `/`, `/login`, `/activate`, and a nested client route
     resolve without a visible `/portal` prefix.
   - Confirm visible `/portal/*` links redirect to their prefix-free form,
     including query strings.
   - Confirm public-site, API, webhook, static-asset, and preview routes are
     unchanged.
2. Set `OPERATIONS_FSS_STUDIO_ENABLED=true`.
   - Confirm an active FSS Admin reaches `/admin`; a client role cannot access
     `/admin` or a staff API; and a revoked Admin is rejected on the next
     request.
   - Verify at least one client context, agreement, request, signing, journey,
     billing unavailable state, and delivery action using the correct staff
     guard. Do not create a real provider side effect merely to test routing.
3. Set `OPERATIONS_GROWTH_OPERATIONS_CUTOVER_ENABLED=true`.
   - Confirm every mapping in the table redirects to the portal hostname.
   - Confirm the legacy workflow endpoints return `404`; confirm the founder
     portal access console and its invitation/revocation commands still work.
   - Confirm no user-visible portal URL or transactional redirect contains
     `/portal`.

## Rollback

Set the third flag to `false` first, then the Studio flag if necessary, then
the portal-routing flag if necessary. Redeploy and smoke-test after every
change. This restores the legacy Growth workflow and visible `/portal` paths
without removing the additive staff tables, signed records, or audit history.
See [Growth OS rollback](./growth-os-rollback.md) for incident recording and
database recovery rules.
