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

## Sign And Submit Agent Requests

The agent makes only two application requests: claim candidates, then submit
one completed audit for each candidate. It must use the signed request protocol
below for both endpoints.

1. Serialize the JSON request exactly once as UTF-8. Preserve those exact raw
   bytes from signing through the HTTP request. The claim body is
   `{\"limit\":3}`. The audit submission must conform to
   `lib/growth/seo-audits/schema.ts`.
2. Create the current Unix timestamp in whole seconds.
3. Calculate a lowercase hexadecimal HMAC-SHA256 using the Keychain secret and
   this exact byte sequence:

   ```text
   timestamp + "." + rawBody
   ```

4. Send the raw JSON with `Content-Type: application/json` and these headers:

   ```text
   X-FSS-Key-Id: seo-audit-agent-v1
   X-FSS-Timestamp: <unix-seconds>
   X-FSS-Signature: <lowercase-hex-hmac>
   ```

5. Use a short-lived local Node process with `node:crypto` to calculate the
   signature and make each request. The Keychain secret, raw body, signature,
   candidate response, and audit response must stay in that process and must
   never be printed, written to the repository, or returned in the scheduler
   report.
6. Generate a new timestamp and signature for each request and retry. Do not
   retry HTTP 400, 401, 409, 413, or 422 automatically. A claim is valid for
   two hours; skip a candidate if its submission returns 409.

The endpoint responses are operational input, not report content. The final
scheduler response must remain the redacted JSON report defined by the wrapper.

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
