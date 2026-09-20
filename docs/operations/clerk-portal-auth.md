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

1. A founder invites an FSS Admin, a new client owner, or a user of an existing client organisation. Client owners can also invite permitted team roles within their own organisation.
2. Operations records the approved invitation before Clerk sends the activation email. Both invitation windows are three days. Re-inviting an existing Clerk recipient is supported.
3. New users create an account with the invitation ticket. Existing users sign in, then claim their database invitation using their verified primary email.
4. Staff access is checked first and routes to Studio. Only an approved first-owner client invitation can create an organisation. An existing-client invitation joins its specified organisation.
5. Each request checks the database membership through the restricted `operations_portal` role. Roles are never inferred from an organisation name or browser-submitted metadata.
6. Clerk invitations accepted during signup appear as accepted. Obsolete pending invitations for an already verified session are revoked after the database claim, within the matching staff or client realm. Provider cleanup errors are logged and retried on a later claim without blocking granted access.

Application profiles hold the confirmed display name and verified email. Asynchronous Clerk webhooks initialize missing profiles without replacing an existing confirmed name. See [the invitation repair and rollout record](auth-invitation-repair-2026-09-20.md) for migration order and verification.

Invitation screens do not display recipient or saved-session email addresses. A saved session that differs from the invitation hint, or has no hint to compare, must be cleared before continuing. Account switching clears Clerk's browser sessions and fully reloads the same invitation with its ticket intact. The page then removes personal query fields again. The hint only controls this prompt; the server still authorizes access from the verified identity and approved database invitation. See [the privacy follow-up](auth-invitation-privacy-2026-09-20.md).

Deleting a Clerk account prevents a new portal session immediately. Revoke the operations membership in Growth OS to remove the retained access record as well.

## Studio cutover

FSS Studio is available only when the production environment enables
`OPERATIONS_FSS_STUDIO_ENABLED=true`. The founder must first complete the
initial Admin invitation and verify its active staff membership. Only then may
`OPERATIONS_GROWTH_OPERATIONS_CUTOVER_ENABLED=true` redirect the old Growth
Operations client and billing routes to Studio. Follow the ordered checks in
[the Operations Studio cutover runbook](../runbooks/operations-studio-cutover.md).
