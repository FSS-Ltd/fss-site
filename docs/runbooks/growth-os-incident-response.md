# Growth OS incident response

How to handle a live incident involving the Growth OS in production.
For planned rollback (not an active incident), use
[`docs/runbooks/growth-os-rollback.md`](./growth-os-rollback.md) directly
— this document points there for the mechanics and adds the parts
specific to handling an incident as it happens: severity, communication,
and what to preserve.

## Severity

| Severity | Definition | Example |
| --- | --- | --- |
| **Sev 1** | Data or credential exposure, or an uncontrolled/duplicate send that reached a real (non-test) recipient. | A cold outreach email sent to the wrong list; a leaked `TOKEN_ENCRYPTION_KEY`. |
| **Sev 2** | Automation misbehaving but contained to test/founder-owned accounts, or a persistent `5xx` affecting the public site or dashboard. | A cron stuck in a retry loop against the preview mailbox; the founder dashboard returning `500` for more than a few minutes. |
| **Sev 3** | Degraded but non-urgent — a single provider integration unhealthy with no send risk. | Gmail shows `degraded` in `/growth/settings` but automations are already disabled. |

Sev 1 always means immediate containment first, everything else after —
see below. Sev 2 and 3 can tolerate a few minutes of investigation before
containment if containment itself carries risk (e.g., don't revoke a
Gmail connection over a Sev 3 read-only degradation).

## Immediate containment

Follow [`docs/runbooks/growth-os-rollback.md`](./growth-os-rollback.md)'s
"Immediate containment" section in order, starting with
`GROWTH_OS_AUTOMATIONS_ENABLED=false`. Do this before anything in this
document — the sections below are about handling the incident once
containment is underway, not a substitute for it.

## Provider revocation and sequence pause

Also per the rollback runbook: pause all active sequences from
`/growth/settings`, and revoke the Gmail automation connection
specifically if send safety is uncertain (not automatically on every
incident — only when the compromise could affect what gets sent or to
whom).

## Secret rotation

If the incident involves or might involve a leaked secret, follow
[`docs/runbooks/growth-os-secrets-rotation.md`](./growth-os-secrets-rotation.md)'s
"Emergency rotation" section for that specific secret. Do not rotate
every secret reflexively — each rotation has its own blast radius (see
that runbook's table), and an unnecessary rotation during an active
incident just adds more moving parts to track.

## Database evidence preservation

Before any repair or restore action:

- Do not truncate, rotate, or delete `growth.audit_log`.
- Export or snapshot the relevant rows (the specific `email_messages`,
  `sequence_enrollments`, or `research_runs` involved) before any forward
  repair migration touches them, so the pre-incident state is
  recoverable for review even after the fix is applied.
- Preserve Vercel function logs and the relevant provider console logs
  (Resend activity log, Google Cloud Console audit log) — these often
  have a shorter retention window than the database.

## Communication owner

Jean-Fidele is the sole communication owner for any Growth OS incident —
there is no other stakeholder or user base to notify (this is a
founder-only internal tool with no external users other than the
founder, per
[`docs/runbooks/founder-dashboard.md`](./founder-dashboard.md)). If a
Sev 1 involved a real external recipient (an uncontrolled send), Jean-
Fidele decides whether and how to follow up with that recipient — this
is a judgment call outside this runbook's scope, not an automated step.

## Recovery validation

Before considering an incident closed:

1. Every containment action taken is confirmed still in the correct
   state (automations flag, paused sequences, any revoked connection).
2. `pnpm verify:growth-release` and `/growth/settings` both report
   healthy for every provider that's supposed to be connected.
3. The specific failure mode that caused the incident has a regression
   test, a fixed root cause, or both — not just a symptom patch.
4. If a database restore was used: the restored state is confirmed
   correct against the preserved evidence from the section above, not
   just "the error went away."

## Post-incident review

Record, after the fact, without secret values:

- What happened, and when it was first detected vs. when it actually
  started.
- Severity and containment timeline.
- Root cause.
- What changed to prevent recurrence (code, runbook, or process).
- Whether this runbook itself needs updating as a result.
