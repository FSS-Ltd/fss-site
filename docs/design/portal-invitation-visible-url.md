# Portal invitation visible URL fallback

Owner: Technical Agent
Status: Implemented locally on `fix/portal-invite-visible-link`; release pending
Created: 2026-11-03
Related: [Direct activation links](portal-invitation-direct-link.md)

## Problem and evidence

A client screenshot shows the invitation in Gmail's Spam folder, with "Accept
your invitation" rendered as plain text. The sender includes an HTML anchor
with the activation URL, but the URL itself is not visible in the HTML body.
The plain-text MIME body already contains the full URL. The screenshot does
not establish whether Gmail removed the anchor or disabled its interaction.

## Repair

Include the full, escaped activation URL as visible HTML text, with instructions
to copy it into a browser if the link does not open. Inline styling makes the
primary link recognisable and wraps long fallback URLs on mobile screens.
The ticket, destination, expiry and send workflow remain unchanged. This repair
does not resolve Gmail's spam classification. No dependency or schema changes.

## Verification and release

The regression test removes HTML tags and verifies that the visible body still
contains the complete URL. It failed against the previous template and passes
with the fallback. Existing provisioning and resend tests also pass.

Local checks passed: 2,401 unit tests, 20 focused invitation/provisioning/resend
tests, type checking, full lint, changed-file formatting, and production build.
The production dependency audit passed the high-severity threshold with one
existing low-severity finding. A synthetic preview in the Codex in-app browser
confirmed that a long fallback URL wraps within a 320px email column.

Database integrations were not run locally because this isolated checkout has
no test database configured. CI runs them against disposable PostgreSQL.

Production deployment and an actual Gmail delivery check remain pending.
No client email was sent during this repair. After an approved release, a new
invitation will contain the fallback; delivered messages cannot be updated.
Rollback reverts this template change without affecting existing tickets.
