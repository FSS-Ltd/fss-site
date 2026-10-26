# Portal email delivery correction

Owner: Technical Agent
Status: Implemented locally; release approval required
Date: 2026-10-26

## Findings

The agreement sender was hardcoded to `FSS <hello@faithfulsoftwaresolutions.co.uk>`, while the configured business sender should use `faithfulsoftware.dev`. Request-notification emails and newly prepared welcome content used the same old domain. Agreement delivery webhooks also accepted only the old sender.

Read-only production inspection found a signing notification with two attempts, a `configuration` failure, and no provider receipt. This establishes a pre-acceptance failure; the generic stored code does not preserve the provider's exact rejection message. The user's provider-side observation identifies the sender-domain mismatch.

Production logs also repeatedly reported `permission denied for function dispatch_request_notifications`. The cron runs as `operations_onboarding_worker`, while the four request-email procedures allowed only `operations_founder`. Agreement notification procedures already allow the correct worker, so this is a separate request-email failure.

## Changes

- Share the current Operations sender identity, `hello@faithfulsoftware.dev`, between agreement emails, request notifications, and the welcome composer.
- Accept delivery events from the current sender and the exact previously supported legacy sender. Existing provider-ID, recipient, event, and notification bindings remain authoritative.
- Keep already approved welcome snapshots immutable. Newly prepared exact welcome reviews use the corrected sender; saved or approved legacy content needs a fresh review to adopt it.
- Grant the existing onboarding worker EXECUTE on exactly four private request-delivery procedures: dispatch, claim, complete, and fail. Do not grant table access, role membership, or access to public/portal/billing/signing roles.

## Verification

Sender and webhook tests reproduce the old-domain defect and verify current/legacy event handling. A local PostgreSQL 17 database reproduces the production permission denial before the migration and dispatches through the real worker role after it. Negative privilege tests check all other runtime roles and direct table access. A browser test checks the sender in the saved exact-review content and preview request on desktop and mobile. Provider calls are mocked; no real email is sent.

## Rollout

This work makes no production changes. The migration must follow normal human approval. Deploy the corrected sender code before enabling the new worker grants. Review the request-email backlog and keep `OPERATIONS_REQUEST_EMAILS_ENABLED` disabled during the coordinated release if deployment/migration ordering cannot be guaranteed. Applying the grant can release eligible queued request notifications on the next existing cron run.

After the corrected code is live, the operator can use Resend signing email to create a new versioned attempt. Do not automatically requeue failed or unknown historical signing messages. Verify the provider receipt and final delivery event rather than treating an HTTP response as delivery confirmation.

## Rollback

Revoke EXECUTE on the same four procedures from `operations_onboarding_worker` to stop request-email dispatch without changing table data or founder access. Reverting the application commit restores the prior sender defaults; avoid that rollback while the old sender domain remains invalid. No data migration, approved-content rewrite, or automatic historical retry is included.

## Local verification record

- 2,381 unit tests and all 160 Operations database integration tests passed.
- All 24 welcome-composer browser checks passed on desktop/mobile, including sender identity in exact review and preview payloads.
- Typecheck, repository lint, production build, homepage bundle budget, dependency audit, and all 83 migration-policy checks passed.
- Supabase security advisors against the disposable database reported no error-level issues.
- Independent review found no actionable issues. The narrow grant rollback was exercised transactionally on the disposable database; permissions returned to their migrated state after rollback.
- New files and fully formatted touched files passed Prettier. Existing formatting outside the edited lines in request template source/tests was preserved; the full diff passed whitespace checks.
