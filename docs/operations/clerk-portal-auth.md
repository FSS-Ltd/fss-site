# Clerk portal authentication

The client portal uses Clerk for identity and invitation delivery. The operations database remains the source of truth for portal roles.

## Required Clerk configuration

- Before enabling prefix-free routing, keep
  `https://portal.faithfulsoftware.dev/portal/activate` as an allowed redirect
  URL. Add `https://portal.faithfulsoftware.dev/activate` before enabling
  `OPERATIONS_PORTAL_PREFIX_FREE_ENABLED=true`. Keep both during the rollback
  window so an approved flag rollback does not invalidate an outstanding
  invitation.
- Enable email verification codes for custom sign-in and sign-up flows.
- Create a webhook at `https://portal.faithfulsoftware.dev/api/webhooks/clerk` for `user.created` and `user.updated` events.
- Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, and `OPERATIONS_PORTAL_ORIGIN=https://portal.faithfulsoftware.dev` in the deployment environment.

## Access flow

1. A founder grants an approved contact a portal role in Growth OS.
2. The operations database records the auditable invitation, then Clerk sends the activation email.
3. A verified Clerk account reaches the signed webhook or portal claim endpoint.
4. The portal creates or reactivates the membership only when the verified email matches the pending approved contact.
5. Each portal request checks that membership through the restricted `operations_portal` database role.

Deleting a Clerk account prevents a new portal session immediately. Revoke the operations membership in Growth OS to remove the retained access record as well.

## Studio cutover

FSS Studio is available only when the production environment enables
`OPERATIONS_FSS_STUDIO_ENABLED=true`. The founder must first complete the
initial Admin invitation and verify its active staff membership. Only then may
`OPERATIONS_GROWTH_OPERATIONS_CUTOVER_ENABLED=true` redirect the old Growth
Operations client and billing routes to Studio. Follow the ordered checks in
[the Operations Studio cutover runbook](../runbooks/operations-studio-cutover.md).
