# Scheduled Research Runbook

## Purpose

Run the founder-controlled Growth OS research workflow at 06:00
Europe/London every weekday. Each successful run targets up to ten accepted,
new corporate prospects in Kent. It prepares research and first-email drafts
for review. It never sends email.

The scheduled task is external to the application. It submits a signed JSON
bundle to `POST /api/agent/research-runs`, then may upload one mapped visual per
accepted prospect to `POST /api/agent/email-assets`.

## Schedule And Target Mix

- Schedule: weekdays at 06:00 Europe/London.
- Target: ten accepted prospects. Fewer is valid when the evidence does not
  support ten safe candidates; report the shortfall.
- Keep a balanced mix across home and property services, garages and vehicle
  services, accountants and other professional services, estate agents,
  restaurants and hospitality, and similar Kent local-service companies.
- Do not lower the acceptance standard to fill a category or reach ten.

## Required Runtime Inputs

- The preview or production application base URL supplied by the operator.
- Agent key ID `weekday-agent-v1`.
- `GROWTH_OS_AGENT_HMAC_SECRET` from the scheduled task's secret store.
- The versioned prompt in
  `docs/growth-os/prompts/weekday-research.md`.
- The version 1.0 example in
  `docs/growth-os/fixtures/research-run-v1.json`.
- Local Codex authentication for the isolated GPT child process.

Never print the HMAC secret, signature input, raw bundle, email address, or
contact name to a run log. Never store a secret in this repository.

## Isolated Execution Boundary

Run the workflow through the repository wrapper:

```bash
pnpm growth:research:weekday
```

The wrapper creates a mode `0700` workspace outside the repository, starts an
ephemeral GPT process without user configuration or project rules, discards
the child process's stdout and stderr, and accepts only a final response that
matches the strict redacted-report schema. It removes the complete temporary
workspace on success, failure, or timeout. The scheduled Codex task must invoke
this wrapper rather than executing the research prompt directly.

This boundary keeps prospect details, work emails, source URLs, draft copy,
request bodies, signatures, and tool traces out of the visible automation log.
The wrapper prints one redacted JSON report and exits non-zero when the child
does not return a successful submission.

## Modes

### Dry Run

Research and validate the complete JSON bundle, but do not call either API.
Write the bundle to the operator-approved local output location and produce the
redacted run report described below. Prefix the `externalRunId` with
`dry-run-`.

The output location must be access-restricted, local, and outside this Git
repository, the synced Nexus vault, cloud-sync folders, and logs. Delete the
full dry-run bundle immediately after operator review and no later than 24
hours after creation. Retain only the redacted run report.

### Submit

Validate the bundle, sign its exact bytes, post it once, and upload only visuals
that can be mapped from the accepted-candidate response. Submission does not
authorise sending email.

## Research Procedure

1. Use Google Search and Google Maps only to discover candidate businesses. Do
   not use browser-control automation.
2. Verify Kent location, active corporate status, legal name, corporate type,
   and company number. Companies House evidence must use the matching company
   profile.
3. Verify the opportunity and work-email source on the business's own site.
   Record factual claim summaries, source URLs, and observation and verification
   times.
4. Treat Google Maps as a discovery index, not a content database. A Google
   place ID and Maps reference URL may be retained. Do not copy or persist
   reviews, photos, ratings, categories, descriptions, or listing text.
5. Reject sole traders, personal subscribers, inactive companies, uncertain
   partnerships, unverifiable work emails, unrelated email domains, unsupported
   claims, known duplicates, and known suppressed contacts. The ingestion
   service performs the authoritative duplicate and suppression checks.
6. For each accepted candidate, prepare the complete structured website
   assessment, FSS offer recommendation, 140 to 220 word first email, matching
   safe HTML and plain text, direct opt-out sentence, and conceptual visual
   brief. Include `emailNarrative` with one factual first-party strength and
   two or three sourced website-journey observations. A published review is
   permitted only when it is published on the business's own site. Google Maps
   content is never a narrative source. The application adds the preview link
   only after individual founder approval.
7. The visual must not fabricate staff, premises, testimonials, reviews,
   credentials, results, or an existing product. The ingestion bundle always
   uses `assetId: null` and an approved fallback key. This guarantees that a
   reviewable draft exists before any generated image is uploaded.

## Rejection Reason Codes

Use only this vocabulary:

| Code                                | Apply when                                                  |
| ----------------------------------- | ----------------------------------------------------------- |
| `outside_kent`                      | The candidate's Kent location cannot be verified.           |
| `ineligible_corporate_type`         | The legal form is not an eligible corporate subscriber.     |
| `inactive_company`                  | Companies House does not show an active entity.             |
| `personal_subscriber`               | The proposed recipient or mailbox is personal.              |
| `uncertain_partnership`             | Partnership eligibility cannot be established.              |
| `unverifiable_work_email`           | A related-domain work email and source cannot be verified.  |
| `unsupported_claim`                 | A proposed claim is not supported by a permitted source.    |
| `insufficient_opportunity_evidence` | The sources do not support a useful FSS opportunity.        |
| `known_duplicate`                   | The business or contact is already known before submission. |
| `suppressed_contact`                | An authorised suppression check finds the address.          |

Do not create catch-all or free-text codes. Put no personal detail in a reason
code.

## Fallback Selection

Use one of these reviewed keys:

| Business type                         | Fallback key            |
| ------------------------------------- | ----------------------- |
| Home and property services            | `home-property`         |
| Garages and vehicle services          | `automotive`            |
| Accountants and professional services | `professional-services` |
| Estate agents                         | `estate-agency`         |
| Restaurants and hospitality           | `hospitality`           |

Use the reviewed fallback alt text from the application registry. Do not invent
claims in fallback alt text.

## Validate The Bundle

The JSON must match schema version `1.0`, remain below 4 MB, and use a unique,
stable identifier in this form:

```text
weekday-YYYY-MM-DD-0600-europe-london-v1
```

Validate through `parseResearchRunIngestion` before signing. The repository
test that protects the fixture and schema is:

```bash
node --import tsx --test lib/growth/research/ingestion-schema.test.ts
```

Do not submit if validation fails.

## Sign And Submit

1. Serialize the validated bundle once as UTF-8 JSON. Preserve those exact raw
   bytes for every retry.
2. Create the current Unix timestamp in whole seconds.
3. Calculate lowercase hexadecimal HMAC-SHA256 using the secret and this exact
   byte sequence:

   ```text
   timestamp + "." + rawBody
   ```

4. Send the raw body with `Content-Type: application/json` and these headers:

   ```text
   X-FSS-Key-Id: weekday-agent-v1
   X-FSS-Timestamp: <unix-seconds>
   X-FSS-Signature: <lowercase-hex-hmac>
   ```

5. The timestamp must be within five minutes of the application clock. Generate
   a new timestamp and signature for a retry, but do not change the raw body or
   `externalRunId`.

A successful response returns the run ID, counts, and
`acceptedProspects: [{ candidateIndex, prospectId }]`. Treat this mapping as
authoritative. `candidateIndex` is the zero-based index of the candidate in the
exact original `prospects` array. Do not reorder, filter, or reindex that array
between serialization and asset mapping. A duplicate retry returns the
persisted result.

## Upload Generated Visuals

Image upload is the second phase. For each generated image whose
`candidateIndex` appears in `acceptedProspects`:

1. Use the returned `runId` and mapped `prospectId`.
2. Build the complete multipart body with its generated boundary, then capture
   the fully encoded raw bytes. Create a fresh timestamp and HMAC-SHA256 over
   `timestamp + "." + rawMultipartBody`. Send those exact bytes with the same
   three `X-FSS-*` headers and a `Content-Type` containing the matching
   boundary. Do not reuse the research-request signature, sign individual form
   fields, or let the HTTP client re-encode the body after signing.
3. Submit that one signed multipart request to
   `POST /api/agent/email-assets` with `assetKind=cold_first_email`, factual alt
   text, a short prompt summary, and the image file.
4. Keep the multipart request below 512 KB. JPEG, PNG, and WebP input are
   accepted. The normalised WebP must be no more than 180 KB and use an aspect
   ratio from 1.85:1 through 1.95:1.
5. If generation, validation, mapping, or upload fails, do not retry with unsafe
   metadata. Leave the reviewed fallback attached to the draft.

Never upload a visual for a duplicate or rejected candidate.

## Retry Policy

Make no more than three submission attempts in total.

- Retry timeouts, connection failures, HTTP 429, and HTTP 5xx with the exact
  same body and `externalRunId`. Wait 30 seconds before attempt two and two
  minutes before attempt three.
- Do not automatically retry HTTP 400, 401, 413, or 422. Correct the input or
  credentials under operator review.
- A suppressed-candidate response rolls back the run. Remove the candidate,
  record `suppressed_contact`, and use a correction suffix on a newly reviewed
  `externalRunId`, such as `-correction-1`.
- Do not continue image uploads unless research ingestion returned HTTP 200.

## Redacted Run Report

Record only:

- run date, mode, `externalRunId`, prompt version, and final outcome;
- HTTP status and correlation ID when present;
- accepted, duplicate, and rejected totals;
- every controlled rejection reason-code total, including zeroes, and whether
  the target of ten was met. The reason-code totals must equal `rejected`;
- visual generation attempted, uploaded, failed, and fallback-retained totals;
- attempt count and safe failure class such as `timeout`, `unauthorized`,
  `invalid_bundle`, `suppressed_contact`, or `server_error`.

Do not record names, email addresses, phone numbers, raw URLs, email copy,
assessment text, signatures, secrets, or the raw request body.

## Stop Conditions

Stop and report without submission when schema validation fails, the secret is
missing, the application clock differs by more than five minutes, the endpoint
is not the operator-approved environment, or evidence cannot support a safe
candidate. Never send an email from this task.

## Prospect Preview Controls

Research ingestion creates a private draft preview from an accepted candidate's
structured assessment. The scheduled researcher must not create preview source
files, publish a preview, add a preview URL to email copy, create a provider
draft, or send an email.

The historical-preview backfill is a separate founder-operated command. It may
run only after the preview migration and application release are approved. It
creates draft records only; individual founder approval remains required to
publish a route and update an email review draft.
