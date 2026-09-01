# Scheduled SEO And AEO Audits

## Purpose

At 06:30 Europe/London every day, a local isolated GPT agent asks the Growth
OS for at most three eligible prospects. Eligibility requires an active
sequence, a sent Day 5 follow-up, no inbound reply, and a public website.
For each candidate, the agent researches public pages, submits an evidence-led
SEO and AEO audit, and drafts the Day 11 follow-up. The application creates the
PDF and keeps the email unsent for founder approval in `/growth/outreach`.

The agent does not connect to PostgreSQL directly. The signed claim endpoint
performs the scoped database query, which keeps database credentials out of the
agent runtime and returns only the minimum information needed to research the
business.

## Safety Contract

- The agent key ID is `seo-audit-agent-v1`; it uses the existing
  `GROWTH_OS_AGENT_HMAC_SECRET` stored in macOS Keychain under service
  `dev.faithfulsoftware.growth-os.agent-hmac` and account
  `growth-os-daily-seo-audit`.
- `POST /api/agent/seo-audits/claim` claims at most three prospects for two
  hours. A timed-out claim may be retried by a later daily run.
- `POST /api/agent/seo-audits` accepts only a strict, bounded JSON audit. The
  app renders and stores the PDF in Vercel Blob, then creates a founder-review
  draft. It never queues an email at submission time.
- Founder approval is the only action that queues the Day 11 audit email. The
  dispatcher sends the stored, approved snapshot in the original Gmail thread
  at the Day 11 cadence.
- Existing generic Day 11 messages are cancelled by the migration. Day 5 and
  Day 14 remain automatic shared-template follow-ups. Day 14 closes the loop
  only when the prospect has not replied.

## Claim And Submit Agent Requests

The agent must use the tracked local client rather than creating request
signatures itself. The client reads the Keychain secret at runtime, preserves
the exact signed bytes, and never prints the secret or signature.

```bash
pnpm tsx scripts/seo-audit-agent-api.ts claim
pnpm tsx scripts/seo-audit-agent-api.ts submit /private/tmp/audit-submission.json
```

The claim command returns at most three candidates. The agent writes each
strict JSON submission to a private temporary file outside the repository, then
passes that file to the submit command. The schema is
`lib/growth/seo-audits/schema.ts`.

If the isolated agent exits without completing every claim, the scheduler uses
the same signed client to release only the remaining claimed audits immediately.
Released audits are eligible for the next run and are recorded in the Growth
audit log. The endpoint responses are operational input, not report content;
the final scheduler response remains the redacted JSON report defined by the
wrapper.

## Installation

This job is intentionally external to the Next.js deployment. It uses the
signed-in macOS user's authenticated Codex runtime and must not be invoked
from a desktop automation or Vercel cron.

After the database migration and Production environment are approved, install
the tracked LaunchAgent once:

```bash
launchctl bootstrap gui/$(id -u) scripts/launchd/dev.faithfulsoftware.growth-os-daily-seo-audit.plist
```

Validate it manually first with:

```bash
pnpm growth:seo-audits:daily
```

Its stdout is a redacted JSON summary only. Detailed prospect data, source
URLs, email copy, request payloads, and signatures must never enter the log.

To stop it, use `launchctl bootout gui/$(id -u)/dev.faithfulsoftware.growth-os-daily-seo-audit`.
