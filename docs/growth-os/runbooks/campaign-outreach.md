# Campaign outreach operations

This runbook follows the [approved outreach design](../../superpowers/specs/2026-11-17-outreach-revamp-design.md) and the [video research brief](../research/2026-11-17-video-outreach-brief.md). The release candidate uses isolated fixtures. Production activation and the first live run are pending.

## Operating schedule

| Europe/London          | Stage                                                    | CRM evidence                                                                                     |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 07:00                  | Research businesses                                      | Signed daily run with accepted candidates, reasoned rejections or a verified zero-result outcome |
| 07:30                  | Discover public Facebook destinations                    | Signed directory observations for founder rules review and manual activity                       |
| 08:30                  | Prepare eligible email                                   | Current permission event, leased preparation job, frozen offer and assigned CTA                  |
| 09:00–17:00 by default | Submit due messages within the approved recipient window | Reservation, exact attempt evidence, provider acceptance and separately verified confirmation    |
| 17:30                  | Record daily CRM progress and consume due monthly reports | Immutable daily snapshot and separate monthly snapshots in Analytics                             |

The 08:30 and 17:30 Vercel entries accept the five-minute London window. A preparation run that misses its slot can be picked up by an existing dispatch invocation when the preparation flag is enabled. A due monthly report waits for the next accepted report slot and the worker claims at most five per invocation. The daily summary records the state observed at its actual run, with later traffic outside that snapshot. Confirm actual Vercel schedule delivery before activation. [Vercel cron documentation](https://vercel.com/docs/schedules/cron-jobs)

## Research and approval

Use the release-pinned local runner and the private state location described in [Global research](global-research.md). The business and Facebook runners keep separate signed run identities. A valid empty search records zero results. A failed search stays failed. Both configured models passed harmless authenticated native-search probes. Repeat this check in the scheduler's environment before activation.

In Growth, qualify the business and confirm the current contact and source observation. Record the permission scope under the selected versioned campaign. Resend requires explicit campaign-purpose opt-in. Gmail campaign delivery requires the approved consent or specifically requested service path. A public Facebook page or published mailbox establishes a source, and its outreach permission requires separate evidence. Keep Facebook posting manual and review current destination rules in the separate workspace. [Resend acceptable use](https://resend.com/legal/acceptable-use), [Gmail program policies](https://support.google.com/mail/answer/16734397)

The three monthly offers have stored versioned terms. Policy approval leaves the campaign paused. The founder separately resumes the reviewed version after verifying its sender and current evidence. Changes to terms or CTA wording produce a new paused version.

## Capacity and evidence

Review the shared ramp at 25, 50, 100 and 150 daily. Each account is independently limited by its own approved ramp, provider usage, health and eligibility. The shared London-day cap is the highest reviewed ramp among eligible wired senders, up to 150. Display shortfalls when available permitted volume falls below the requested 100–150 range.

Inspect prepared, issued, accepted and confirmed counts separately. Gmail uses a verified SENT observation. Resend uses an attributable signed delivery observation. Neither is an exact transmission time unless separately established. Uncertain submission holds the account or attempt as applicable and remains charged against the relevant capacity. Keep the durable evidence when reconciling.

A report becomes due one calendar month after the first verified confirmation under its provider basis. Analytics shows the immutable cohort, cutoff, comparable arms, matured counts and evidence gaps. Missing coverage, unmatched terms, thin samples or ambiguous outcomes keep the result inconclusive. Recorded reply evidence is attributable to the observed message. Meeting and payment observations require their own evidence.

## Release and first run

Release on the exact revision reviewed by Code Reviewer and Security Reviewer with required CI green on the revision and test merge. Rehearse the committed migrations, private app role, customer exclusions and stored opt-outs. Complete the in-app browser checks and required design-craft jury. Record separate founder decisions for production deployment and campaign activation.

Keep `GROWTH_OS_OUTREACH_PREPARATION_ENABLED` and `GROWTH_OS_OUTREACH_SUMMARY_ENABLED` unset or false during the disabled rollout. Check the deployed signed intake, separate provider credentials and reviewed sender identities, account limits and health, current monitoring, provider signature handling and exact permitted recipients before enabling the applicable stage. Keep scheduler output limited to counts and machine failure categories.

`GROWTH_OS_RESEND_OUTREACH_ENABLED` also defaults off. With both preparation and Resend flags enabled, the 08:30 route can prepare eligible Resend work. Only the dispatch route can issue it. Both reuse the invocation's existing bound Gmail sync and require current reply coverage for the exact reviewed monitoring mailbox. The Resend worker makes no provider request on idle, makes one bounded usage request when work is due, and processes at most 25 total preparation and send claims per invocation. The separate newsletter dispatcher uses its existing schedule.

### Provider bindings

- Use the founder’s existing Gmail connection in Growth Settings. Verify the actual Workspace edition, required grant, monitoring continuity and a complete current usage observation before recording readiness. A connected account alone is insufficient evidence.
- In Resend, review the actual team, environment, verified sender domain and monitored business Gmail Reply-To. The server reads `RESEND_OUTREACH_TEAM`, `RESEND_OUTREACH_ENVIRONMENT`, `RESEND_OUTREACH_FROM_EMAIL` and `RESEND_OUTREACH_REPLY_TO_EMAIL` for that binding.
- Keep the sending and usage keys separately scoped in `RESEND_OUTREACH_SEND_API_KEY` and `RESEND_OUTREACH_USAGE_API_KEY`. The usage endpoint requires a full-access key. Review their independently recorded generation IDs in `RESEND_OUTREACH_SEND_GENERATION` and `RESEND_OUTREACH_USAGE_GENERATION`. [Resend account usage API](https://resend.com/changelog/account-usage-api)
- Point the separately reviewed outreach webhook at `/api/webhooks/resend/outreach` for delivery, bounce and complaint events. The server uses `RESEND_OUTREACH_WEBHOOK_SECRET` and the reviewed `RESEND_OUTREACH_WEBHOOK_GENERATION`. A delivery can receive a retryable response while the prior acceptance is being recorded. Verify scoped delivery, permanent-bounce and complaint handling before enabling sends. [Resend webhook events](https://resend.com/docs/webhooks/event-types)

After activation, run the same release-pinned 07:00 research entry point once and verify the signed CRM receipt for that London day. A scheduler record is configuration evidence. The CRM run receipt is execution evidence. Email delivery requires its own verified provider observation.

To stop campaign work, pause the campaign and the affected sending account, then disable the applicable scheduled entries. Retain membership, permission, suppression, receipt and audit history. Reconcile uncertain reservations before any subsequent resume.
