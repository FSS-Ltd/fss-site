# Portal invitation direct link

Owner: Technical Agent
Status: Approved 2026-11-02; implemented on fix/client-invite-link
Date: 2026-11-02

## Problem

A client clicked a resent portal invitation and nothing happened.

Every portal and staff invitation is emailed by Clerk (`notify: true` in `provisionPortalAccount`). The emailed link points at Clerk's ticket endpoint on `clerk.faithfulsoftware.dev`, which checks the ticket and then redirects to our `/activate` page. When the ticket is invalid or revoked, Clerk does not redirect. It returns a bare JSON error (`ticket_invalid_code`). To a client this looks like a dead link.

A resend deliberately revokes the previous Clerk invitation. Any older invitation email in the client's inbox therefore lands on that JSON error. We cannot see which email a client clicks, and we do not control Clerk's error response.

Verified on 2026-11-02:

- The live `/activate` page loads, Clerk initialises, and the form is usable with a ticket in the URL.
- `clerk.faithfulsoftware.dev/v1/tickets/accept` with an invalid ticket returns the raw JSON error and no redirect.

## Approach

Send invitation emails ourselves, with a link that goes straight to our `/activate` page. Clerk still owns the invitation and the ticket. We only stop routing the click through Clerk's endpoint.

1. `provisionPortalAccount` creates the Clerk invitation with `notify: false` and reads the returned `Invitation.url`.
2. It takes the `ticket` query parameter from that URL and sets it as `__clerk_ticket` on our activation URL (built by `createInvitationActivationUrl`, unchanged).
3. It sends the invitation email through the existing `ResendGateway` (the one founder invitations use) with the Operations key `OPERATIONS_RESEND_API_KEY`, from `OPERATIONS_EMAIL_FROM`, under a new `portal-invitation` category. The journey-bound onboarding sender was not a fit for a one-off email.
4. On `/activate`, a failed sign-up whose Clerk error code mentions a ticket or invitation shows: "This invitation was replaced or is no longer valid. Use the most recent email from FSS, or ask your FSS contact for a new invitation." Codes containing `expired` show an expiry message instead. The mapping lives in `clerkErrorMessage`, so every ticket error path uses it.

Every caller (first invite, owner invite, staff invite, resend) goes through `provisionPortalAccount`, so the fix sits in that one function and the activation page.

### Decisions

- **Reuse the Resend sender we already have instead of adding a provider.** Founder and agreement emails already use it, and it supports idempotency keys and delivery tracking.
- **Use Clerk's ticket directly.** Passing `__clerk_ticket` to our page is Clerk's documented custom-flow input, and our page already reads it.
- **No pre-check endpoint for ticket validity.** A lookup endpoint would add an enumeration surface. A clear error on submit is enough. If clients still struggle, we can revisit this.

## Data model

No schema change. The idempotency key is `portal-invitation:<sha256(ticket)>`. Every Clerk invitation has a ticket, legacy metadata included, and the hash keeps the ticket out of provider logs. A retried send of the same ticket cannot email twice.

## Failure modes

| Failure | Handling |
|---|---|
| Clerk returns no `url` or no `ticket` | Throw `PortalProvisioningError("UNKNOWN_PROVIDER_ERROR")`. Callers already mark the local invitation failed. |
| Clerk invite created, Resend send fails | Revoke the just-created Clerk invitation, then throw. Callers mark the local invitation failed, so staff can resend. No orphaned pending ticket. |
| Client opens an old email after a resend | Our page loads and shows the "replaced" message on submit instead of a dead link. |
| Client already has an account | Unchanged by this work. The existing signed-in path still applies. Not-signed-in existing users are out of scope and logged as follow-up. |
| Invitations already sent by Clerk before release | Their Clerk links keep working as before. Only new sends change. |

## Security and privacy

- The ticket is a bearer credential. It already appears in the activation URL today, after Clerk's redirect, and stays there so a page refresh keeps working. The activation page still strips name, email and decline token from history.
- No secrets in code. Resend and Clerk keys stay in the existing environment variables.
- The email body contains the recipient's name and the link only. No role or organisation details.
- Redirect URL validation in `provisionPortalAccount` stays in place.

## Email content

Plain and short, in the same inline HTML and text style as the founder invitation email. Subject: "Your FSS portal invitation" (it also covers staff invites). Body: who invited them, one link to the activation page, the 30-day lifetime, and a line saying older invitation emails no longer work. Follows the brand voice rules.

## Testing

- Unit: `provisionPortalAccount` sends `notify: false`; builds the link with the ticket; throws on missing URL or ticket; revokes the Clerk invitation when Resend fails; uses a stable idempotency key.
- Unit: the activation page maps invalid, revoked and expired ticket errors to the right screens, and strips the ticket from history.
- Email render test for the new template.
- Existing invitation, resend and portal-access suites stay green.
- Manual check after release: resend an invite to a team address, open both the old and new emails, and confirm the old one shows the "replaced" screen and the new one activates.

## Rollout and rollback

- No migration. Ships as a normal PR; merge deploys to production.
- Requires `OPERATIONS_RESEND_API_KEY` in production. Confirmed present on 2026-11-02 (names only were listed).
- After release, resend the affected client's invitation so they get a working email.
- Rollback: revert the PR. Clerk resumes sending its own emails. Invitations sent while the fix was live keep working, because their links point at our page with a valid ticket.

## Success metrics

- The affected client activates from a resent invite.
- No "link does nothing" reports. Opening an old invitation email shows the "replaced" screen.
- Resend shows a delivery event for each invitation sent.

## Out of scope

- Signing in existing Clerk users who are not signed in when they open an invite.
- Changing invitation expiry or the resend workflow in Studio.
