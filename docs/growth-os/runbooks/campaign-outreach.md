# Campaign outreach operations

This runbook follows the [approved outreach design](../../superpowers/specs/2026-11-17-outreach-revamp-design.md) and the [video research brief](../research/2026-11-17-video-outreach-brief.md). The release candidate uses isolated fixtures. Production activation and the first live run are pending.

## Operating schedule

| Europe/London          | Stage                                                    | CRM evidence                                                                                     |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 07:00                  | Research businesses                                      | Signed daily run with accepted candidates, reasoned rejections or a verified zero-result outcome |
| 07:30                  | Discover public Facebook destinations                    | Signed directory observations for founder rules review and manual activity                       |
| 08:30                  | Prepare eligible email                                   | Current permission event, leased preparation job, frozen offer and assigned CTA                  |
| 09:00–17:00 by default | Submit due messages within the approved recipient window | Reservation, exact attempt evidence, provider acceptance and separately verified confirmation    |
| 17:30                  | Review CRM progress and consume due monthly reports      | Daily counts in Outreach and immutable monthly snapshots in Analytics                            |

The 08:30 and 17:30 Vercel entries accept the five-minute London window. A preparation run that misses its slot can be picked up by an existing dispatch invocation when the preparation flag is enabled. A due monthly report waits for the next accepted report slot and the worker claims at most five per invocation. Confirm actual Vercel schedule delivery before activation. [Vercel cron documentation](https://vercel.com/docs/schedules/cron-jobs)

## Research and approval

Use the release-pinned local runner and the private state location described in [Global research](global-research.md). The business and Facebook runners keep separate signed run identities. A valid empty search records zero results. A failed search stays failed. The installed CLI trials returned zero completed native searches, including the explicit live setting. Treat live search capability as unverified until a harmless authenticated run returns real tool evidence.

In Growth, qualify the business and confirm the current contact and source observation. Record the permission scope under the selected versioned campaign. Resend requires explicit campaign-purpose opt-in. Gmail campaign delivery requires the approved consent or specifically requested service path. A public Facebook page or published mailbox establishes a source, and its outreach permission requires separate evidence. Keep Facebook posting manual and review current destination rules in the separate workspace. [Resend acceptable use](https://resend.com/legal/acceptable-use), [Gmail program policies](https://support.google.com/mail/answer/16734397)

The three monthly offers have stored versioned terms. Policy approval leaves the campaign paused. The founder separately resumes the reviewed version after verifying its sender and current evidence. Changes to terms or CTA wording produce a new paused version.

## Capacity and evidence

Review the shared ramp at 25, 50, 100 and 150 daily. Each account is independently limited by its own approved ramp, provider usage, health and eligibility. The shared London-day cap is the highest reviewed ramp among eligible wired senders, up to 150. Display shortfalls when available permitted volume falls below the requested 100–150 range.

Inspect prepared, issued, accepted and confirmed counts separately. Gmail uses a verified SENT observation. Resend uses an attributable signed delivery observation. Neither is an exact transmission time unless separately established. Uncertain submission holds the account or attempt as applicable and remains charged against the relevant capacity. Keep the durable evidence when reconciling.

A report becomes due one calendar month after the first verified confirmation under its provider basis. Analytics shows the immutable cohort, cutoff, comparable arms, matured counts and evidence gaps. Missing coverage, unmatched terms, thin samples or ambiguous outcomes keep the result inconclusive. Recorded reply evidence is attributable to the observed message. Meeting and payment observations require their own evidence.

## Release and first run

Release on the exact revision reviewed by Code Reviewer and Security Reviewer with required CI green on the revision and test merge. Rehearse the committed migrations, private app role, customer exclusions and stored opt-outs. Complete the in-app browser checks and required design-craft jury. Record separate founder decisions for production deployment and campaign activation.

Keep `GROWTH_OS_OUTREACH_PREPARATION_ENABLED` unset or false during the disabled rollout. Check the deployed signed intake, separate provider credentials and reviewed sender identities, account limits and health, current monitoring, provider signature handling and exact permitted recipients before enabling the applicable stage. Do not print credentials or signed bodies in scheduler output.

After activation, run the same release-pinned 07:00 research entry point once and verify the signed CRM receipt for that London day. A scheduler record is configuration evidence. The CRM run receipt is execution evidence. Email delivery requires its own verified provider observation.

To stop campaign work, pause the campaign and the affected sending account, then disable the applicable scheduled entries. Retain membership, permission, suppression, receipt and audit history. Reconcile uncertain reservations before any subsequent resume.
