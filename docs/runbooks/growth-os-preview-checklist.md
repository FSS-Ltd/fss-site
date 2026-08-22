# Growth OS preview checklist

Verification checklist for a reviewed Vercel preview deployment, before
requesting founder sign-off (Task 7's cutover gate). This does not
authorise production promotion by itself — see
[`docs/runbooks/growth-os-cutover.md`](./growth-os-cutover.md).

## Step 1: Preview data boundaries

Before opening the release pull request, confirm one of:

- Preview points at an isolated Supabase branch or a clearly separate
  preview schema/database, **or**
- If the plan cannot provide isolation, all of the following are true:
  automations stay disabled throughout preview verification, every test
  record uses a founder-owned test address, every test record is
  prefixed so it is unmistakably test data, and a cleanup script or
  migration exists to remove it afterward.

Never point an unreviewed preview at active production outreach data.

## Step 2: Preview-scoped Vercel variables

Set (Preview environment scope only): preview URL, Gmail OAuth redirect
URI matching the preview deployment's exact origin, `DATABASE_URL` /
`DIRECT_DATABASE_URL` for the isolated preview database, provider test
credentials, and `GROWTH_OS_AUTOMATIONS_ENABLED=false`. Confirm in the
Vercel dashboard that no Production-scoped secret is also exposed to
Preview — see
[`docs/runbooks/growth-os-environment-matrix.md`](./growth-os-environment-matrix.md)
for the full per-variable scope table.

## Step 3: Open the release pull request

Push the reviewed branch and open the pull request. The linked Vercel
project creates the preview deployment automatically from the PR — do
not run `vercel --prod`, and do not run `vercel deploy` manually for this
step; use the GitHub-integration-triggered preview so the deployment's
provenance (exact commit, PR) is recorded by Vercel itself.

Record here once opened:

- Pull request URL:
- Commit SHA:
- Vercel preview deployment URL:
- Vercel deployment ID:

## Step 4: Run preview contract tests

Automated (safe, no side effects — rejection paths and public
availability only):

```bash
GROWTH_OS_PREVIEW_URL="https://<preview-deployment>.vercel.app" \
  node --import tsx --test tests/integration/growth/preview-contract.test.ts

# Also exercises the "automations disabled" no-op response, using the
# preview's own CRON_SECRET (never the production one):
GROWTH_OS_PREVIEW_URL="https://<preview-deployment>.vercel.app" \
  GROWTH_OS_PREVIEW_CRON_SECRET="<preview CRON_SECRET>" \
  node --import tsx --test tests/integration/growth/preview-contract.test.ts
```

Manual (side-effecting or requires a live provider console — do these
deliberately, one at a time, recording the result):

- [ ] **Founder sign-in accepts only the founder.** Sign in with the
      founder's Google account; confirm access. Attempt sign-in with any
      other account (or an unverified session); confirm rejection.
- [ ] **Database health and migration version are correct.** Run
      `pnpm verify:growth-release` against the preview's environment
      variables (or check `/growth/settings` once signed in). Confirm no
      pending migration and no connection error.
- [ ] **Signed ingestion accepts a fixture and rejects a replay.** Submit
      `docs/growth-os/fixtures/research-run-v1.json` following
      `docs/growth-os/runbooks/scheduled-research.md`'s signing steps
      against the preview URL with the preview's
      `GROWTH_OS_AGENT_HMAC_SECRET`. Confirm `200` with the expected
      accepted-candidate mapping. Resubmit the exact same signed request;
      confirm the duplicate returns the same persisted result rather than
      creating a second run.
- [ ] **One Gmail draft or sandbox send uses the founder-controlled test
      mailbox.** From `/growth/settings`, connect Gmail with a
      founder-controlled test account (not the real production mailbox
      unless explicitly approved). Trigger one draft creation from the
      dashboard. Confirm it appears in the test mailbox's Drafts, not
      Sent.
- [ ] **One Resend transactional test and one newsletter test reach
      approved test recipients.** Use `/growth/newsletter`'s send-test
      action and the resource-delivery flow with a founder-controlled
      test address. Confirm delivery in the Resend dashboard's activity
      log, not just a `200` response.
- [ ] **Webhook replays are idempotent.** From the Resend dashboard,
      resend one already-delivered webhook event. Confirm no duplicate
      state change (check `growth.audit_log` for a single entry, not
      two).
- [ ] **Automation routes report disabled.** Already covered by the
      automated `GROWTH_OS_PREVIEW_CRON_SECRET` check above — confirm
      the response body here if running manually with `curl`.
- [ ] **Static assets and email images use HTTPS and return expected
      cache headers.** Already covered by the automated sitemap check;
      additionally spot-check one Vercel Blob email asset URL.

## Step 5: Quality and security review

- [ ] No secret appears in client JavaScript, HTML, source maps, server
      logs, or the build output — grep the built `.next` output for any
      configured secret value as a smoke check.
- [ ] Auth cookies are `HttpOnly`, `Secure`, and `SameSite` appropriately
      scoped.
- [ ] Security headers (CSP, `X-Content-Type-Options`, etc.) are present
      on the preview responses.
- [ ] Every route runs on the intended runtime (`export const runtime =
      "nodejs"` where required — grep confirms this statically, but
      spot-check the Vercel deployment's function list too).
- [ ] No unnecessary CORS is enabled on a founder-only or provider
      webhook route.
- [ ] Every founder-mutating route validates its request origin (already
      covered by existing route tests — this step confirms it's still
      true on the actual deployed preview, not just in unit tests).

## Step 6: Founder visual sign-off

Jean-Fidele compares the preview manually against
`docs/growth-os/mockups/` and records approval or requested changes
below. Required before production promotion.

- Approved / changes requested:
- Notes:
- Date:

## Step 7: Commit the completed checklist evidence

Fill in this section with dates, the deployment ID, commit SHA, pass/fail
results per step above, and any safe provider message IDs returned
during manual verification. Never include an access token, API key, or
recipient email address here.

- Verification date:
- Deployment ID:
- Commit SHA:
- Automated contract test result:
- Manual checklist result:
- Deviations or follow-ups:
