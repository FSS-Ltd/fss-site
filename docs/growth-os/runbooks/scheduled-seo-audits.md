# Scheduled SEO And AEO Audits

## Purpose

At 06:30 Europe/London every day, the local scheduler claims at most three
eligible prospects, then gives an isolated GPT agent a private candidate file.
Eligibility requires an active sequence, a sent Day 5 follow-up, no inbound
reply, and a public website. For each candidate, the agent researches public
pages and writes an evidence-led SEO and AEO audit. The scheduler submits it,
and the application creates the PDF and keeps the Day 11 email unsent for
founder approval in `/growth/outreach`.

The agent does not connect to PostgreSQL directly. The signed claim endpoint
performs the scoped database query in the trusted scheduler, which keeps
database credentials and the signing secret outside the agent runtime while
returning only the minimum information needed to research the business.

## Safety Contract

- The scheduler uses the `seo-audit-agent-v1` key ID and the existing
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

## Claim And Submit Scheduler Requests

The trusted scheduler wrapper, not the isolated agent, runs the tracked local
client. It claims up to three candidates, writes their response to a private
temporary file, then gives the agent only that file and an empty private
submission directory. The agent writes one strict JSON file per completed audit
to that directory. The wrapper validates and submits the files after the agent
exits. The schema is `lib/growth/seo-audits/schema.ts`.

The signing client reads the Keychain secret at runtime, preserves the exact
signed bytes, and never prints the secret or signature. The isolated agent
never reads the Keychain, signs a request, or calls an application endpoint.

If the isolated agent exits without completing every claim, or a submission
fails, the scheduler uses the same signed client to release only the remaining
claimed audits immediately. Released audits are eligible for the next run and
are recorded in the Growth audit log. The endpoint responses are operational
input, not report content; the final scheduler response remains the redacted
JSON report defined by the wrapper.

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
