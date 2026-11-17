# Growth outreach revamp

**Status:** Design approved by the user on 17 November 2026; implementation is in progress. Production deployment and campaign activation remain subject to the documented review and approval gates.
**Date:** 17 November 2026
**Baseline:** `origin/main` `618e7d730`; verify against the implementation checkout before planning. The initial structural map covered 198 selected files; consult FEATURE_TREE.md and graphify-out/source-hashes.json for the current scoped inventory, which is not exhaustive.
**Source research:** [Video outreach brief](../../growth-os/research/2026-11-17-video-outreach-brief.md).

## Intent and success

Give the founder one CRM record for research, qualification, outreach, replies, and outcomes. Prepare prospects and drafts daily. Send automatically only when the recipient and provider satisfy a reviewed campaign policy. Provide a separate Facebook discovery and manual activity workspace. After one calendar month from the first actual send, compare message variants with honest denominators and outcomes.

The desired throughput is 100 confirmed actual sends per London day, targeting 150 when enough eligible recipients and account capacity exist. The 150-attempt budget conservatively includes retries; attempts alone do not satisfy the confirmed-send goal. These are operating goals, not permission to lower eligibility or a guarantee of avoiding spam complaints or warnings. Record the reason and count for shortfalls. No target creates a minimum-send obligation.

Success means a founder can trace every step from a sourced prospect to a reviewed outcome, distinguish accepted from delivered messages, stop work immediately, and explain why an eligible campaign did or did not send. The first month report must show its cohort and limits. The UI must pass a fresh design-craft critical jury at raw weighted score **at least 7.5**, aiming for 8 in each category.

## Scope and choices

**Recommended approach:** extend the existing Growth CRM, research ingestion, sequence controls, integrations, and analytics. Add a small campaign policy and event layer around them. This preserves existing client and suppression boundaries, and avoids a second prospect database.

**Alternatives:** a separate campaign product duplicates identities, permissions, and outcomes; a provider-only campaign tool cannot give the requested end-to-end CRM trace or shared suppression checks. Both add avoidable reconciliation. These alternatives are not selected.

The requested automatic eligible sends alter the existing per-message founder approval workflow. The proposed versioned founder policy is a new approval boundary, subject to this design's review and applicable provider and jurisdiction checks. Public email publication or a video's prospect criteria alone does not establish consent or permission. A public business mailbox or personal Gmail address alone does not establish subscriber classification; jurisdiction-specific permission still applies. Where permission is absent or uncertain, keep the first contact as a draft requiring explicit review under existing rules; do not auto-send.

Out of scope until separately approved: new paid infrastructure, DNS changes, a new mail server, production promotion, invented offer capabilities, automated Facebook login, joining, posting, or private-data collection. No provider rotation to bypass limits.

## Current system and reuse

- `lib/growth/research/global-schema.ts`, `global-ingest.ts`, `global-repository.ts`, and `global-identity.ts` implement global research v2, source evidence, identity and intake. Extend those contracts deliberately; retain old callers and validation. `global-identity.ts` does not treat a Facebook host as a unique business website.
- `lib/growth/crm/schemas.ts`, `lead-service.ts`, `lead-repository.ts`, `commands.ts`, and `app/(growth)` implement CRM capture, tasks, activities and views. Legacy manual capture requires a company number and corporate type. Add a separately validated source-aware path without relaxing existing callers or creating a parallel lead store.
- `lib/growth/sequences/approval.ts`, `research-email-approval.ts`, `dispatcher.ts`, `dispatcher-repository.ts`, `gmail-sync.ts`, and `app/api/cron/{outreach-dispatch,gmail-sync}` provide review, delivery leases, suppression and reply checks. Existing follow-up timing is a distinct legacy policy; do not silently apply it to the new campaign.
- `lib/growth/integrations/google-oauth.ts` requests Gmail `modify`; current grants, Workspace plan and sending health must be checked at activation. `lib/growth/integrations/resend/webhook.ts` verifies event signatures and applies permanent-bounce and complaint suppression.
- `lib/growth/analytics/definitions.ts` and `lib/growth/dashboard/analytics.ts` provide existing metrics. Their approval-based reply rate is not a versioned campaign cohort analysis.
- `docs/growth-os/runbooks/global-research.md` describes v2 batches, research-only contacts and individual review. The prior scheduled prospect automation was removed; historical runbook references are not proof of a live scheduler.

## Eligibility and provider routing

A versioned founder-approved campaign policy defines an eligible offer, supported market, jurisdiction, evidence and recipient criteria, channel, approved message variants, cadence, budget, halt thresholds, and effective dates. It is immutable once used; a change creates a new version and triggers re-evaluation before send.

For automatic delivery, require all of the following at reservation and immediately before provider submission:

1. An active approved policy and an FSS offer with verified delivery capability; clear terms and pricing are current.
2. Identifiable source evidence, an appropriately recent verified contact, and a documented permission basis permitted in that jurisdiction and by the chosen provider. A public address alone does not satisfy this test.
3. Recipient and prospect versions match the evaluated snapshot; no duplicate, opt-out, bounce, complaint, prior reply, booking, talks, or payment stop condition applies.
4. Exclusion checks against authoritative Operations links and normalised email/domain identities, including all five existing client organisations, and both existing opt-outs. Exact baseline is rechecked, not hard-coded as the permanent population. Ambiguous identity matches require review. Do not accept an LLM-only classification or confidence score as proof of qualification; unknowns require review.
5. A truthful message and source: no inferred owner name; use a business-addressed subject when identity is not verified. A completed-preview claim requires a verified existing artifact.
6. An available atomic daily reservation and rolling provider allowance, active connection, verified domain and account health, and no campaign halt condition.

Gmail is for permitted one-to-one or permission-based messages. Resend remains limited to explicitly opted-in recipients: its [acceptable use policy](https://resend.com/legal/acceptable-use) prohibits cold or scraped marketing. The current Resend client rejects cold outreach; do not route around that check. Gmail's [sender guidance](https://support.google.com/mail/answer/81126) cautions against unsolicited mail, recommends gradual ramping and keeping spam rates below 0.3%. [Workspace limits](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace) include rolling 24-hour limits of 2,000 for paid accounts and 500 for trial accounts; actual plan, quota, account state, and other sends must be verified. These external rules and jurisdictional eligibility require fresh verification at activation.

DNS observations on 17 November: SPF included Google SMTP and DMARC was `p=none`; DKIM was not checked. A database connection showing Gmail last synced on 12 November is not proof of health. No email was sent as part of this design work. Before activation, check OAuth grant, account health, DKIM and domain authentication, plan, remaining rolling quota, and current provider restrictions.

## Limits and delivery safety

Propose a London-day campaign cap of **150 total outbound attempts**, including follow-ups and any retry that can create another provider submission. Reserve capacity atomically before each attempt. Reserve an uncertain submission until reconciled; never retry an unknown outcome as if it failed. Reconstruct rolling 24-hour account usage from a bounded, paginated Gmail Sent search at startup and reconnect, then incrementally from Gmail history. Include manual sends, aliases and recipient counts; cache the cutoff and freshness. Gmail has no simple remaining-quota API. Partial history, a page bound being exceeded, stale usage, or an unknown quota response holds the campaign pending reconciliation. Before queueing, require known usage plus outstanding reservations plus the attempted send to remain at or below the verified account edition cap minus a proposed reserve of 50 messages for business mail, as well as the atomic application cap of 150. Do not send concurrently beyond either budget.

A proposed conservative ramp starts at 25/day, then 50, 100, and 150 only after measured account health and founder approval at each increase. These are review points, not a claim that any number is inherently safe. Other mailbox activity can race with reconstruction, so exact account-wide quota compliance cannot be guaranteed by the application ledger. Gmail quota-related 429/403 responses halt sending; stale or incomplete usage also halts. Do not circumvent quota errors. This approach requires provider integration tests before it can be treated as proven. Stop on complaints, hard bounces, rate-limit errors, revocation, unknown provider state, missing consent evidence, or health thresholds defined in the approved policy. Keep paused, exhausted, shortfall, failed, and unknown states visible.

Use idempotency keys, transactional reservation, existing lease/reconciliation patterns, and provider message IDs. A provider acceptance is not delivery. Preserve unknown outcomes; never fabricate delivery or reply classifications. Recheck suppression and identity under the same authority immediately before send. A reply, opt-out, bounce, booking, talks, or cleared payment cancels future campaign sends.

## CRM model and lifecycle

Proposed additions, subject to schema review and reversible migrations:

- `campaigns` and immutable versioned policies; `campaign_variants` with versioned offer, message and single tested factor.
- `campaign_memberships` references the canonical prospect and its policy version. One active outreach membership per business is allowed across all campaigns and existing sequences; enforce this transactionally and reconcile legacy sequences before activation. Variant assignment becomes stable at first send; retries and follow-ups inherit it.
- Append-only `outreach_events` refer to campaign, membership, actor and stable IDs. Payloads contain no credentials, email address, copy, or other PII. Private body snapshots live in existing protected message storage.
- A transactional send-budget reservation ledger records London day, provider rolling window, state, idempotency key, and uncertain outcomes. An outbox and due-time jobs carry committed wakeups and scheduled work.
- `experiment_reviews` store immutable cohort definitions and report snapshots. Facebook destination, evidence, membership and manual post activity refer to the same prospect where relevant.
- Extend the prospect source model with `facebook_page`, `facebook_group`, `manual`, `web`, `google_maps`, `referral`, and `inbound`, recording source URL and evidence. Preserve a distinct manual source; never create a second lead store.

Trace: **found → deduplicated → qualified or rejected with reason → permission/review → variant assigned → draft → reserved → provider accepted → sent/delivered if known → reply classified by a person or reviewable confidence → meeting/proposal → cleared payment → suppressed/closed**. Missing observations stay unknown. Keep stale or revoked eligibility visible and unqueue it. Protect all records with existing founder authority; events are notifications, not authorisation.

## Offers, copy and cadence

On 17 November 2026 the founder confirmed that the free website plus monthly services model is a separate offer from all bespoke FSS services, and approved this design. Preserve existing bespoke services and pricing. Give the separate offer its own identity, approved terms and reporting cohort. The founder supplied three separate monthly tiers: Lead & Review Essentials at £297/month for automatic enquiry follow-up, a website appointment assistant and Google review requests, configured around the business and managed by FSS; Booking & Recovery at £497/month for unanswered quotes, missed appointments and repeat business; and AI Front Desk at £797/month for managed inbound call answering, qualification, booking and human handover. There is no setup fee for now. Do not infer tier inheritance. Free-site scope, minimum term and cancellation terms remain unspecified; keep these unset and the commercial configuration in draft until complete. These approved rates do not prove delivery capability. Never adopt the videos' $297/$397/$497 examples as FSS prices. Free-build, review management, AI booking and texting claims still require actual approved delivery capability. No existing client plan, public service catalogue, billing subscription or domain is changed by this clarification.

Original message concepts for founder review, with names and facts filled only from verified evidence:

- **Review permission:** “We noticed [verified comparison] in [place]. Would a short plan for requesting and responding to reviews be useful?” Build the plan after an affirmative response.
- **Website preview permission:** “We prepared a preview for [business]. May we send the link?” Use only when the named preview exists and is reviewed.
- **Facebook group offer:** “We are offering [approved number] local businesses a [approved free-build scope] in exchange for feedback. Comment if interested; we will ask your business name and current website.” Post manually only where current group rules permit.

Show free and paid terms separately. Any feedback requested in exchange for a free build means private product feedback, never an incentivised Google or other public review. Google prohibits [incentivised reviews](https://support.google.com/business/answer/7400114). Use the same review-request process for every eligible customer, without filtering out customers likely to give low ratings. The client retains domain ownership. Review counts require authorised sources and manual verification where appropriate; use Google Maps only for permitted discovery references, not prohibited bulk copying of Maps content. Preview expiry must be a real backend-enforced timestamp, displayed accurately; cleanup and availability follow the same timestamp. Never invent scarcity, results, ownership, testimonials, or completed work.

For the Facebook sequence, propose follow-ups at two days and two days later, then stop. The review video says one or two checks the next week; days 5 and 10 are this design's proposal, not an exact video instruction. All follow-ups obey the stop conditions above. Legacy day 5/11/14 sequences remain unchanged unless expressly migrated to an approved new policy.

## Facebook workspace

Add `/growth/facebook` as a separate workspace using existing Growth white, navy and teal tokens and accessible CRM primitives. Thin routes call the canonical Growth services. List public pages to follow and groups to join; pages are followed, groups are joined. Record destination URL, locality, public activity evidence, posting rules, evidence timestamp, and manual join/follow/post status. Unknown or stale rules mean unqualified for posting. Discovery uses public information only, with no login bypass, scraping of private groups, automatic joining or posting.

The proposed initial Facebook pilot has two free-build slots total. Each is a private, one-page review preview using the canonical preview technology and includes at most one revision. This is an FSS design proposal, not a claim about the video. The founder has confirmed the separate free-website/monthly-service offer direction; its published-site and recurring-service terms remain pending. These private preview allocations describe the validation pilot and do not silently define the separate commercial terms. Do not promise SMS, booking, review management or a monthly bundle as live without approved capability evidence. The private free preview requires no payment; payment is required only for an approved paid setup, activation or domain connection. The client retains the domain and no automatic hosting migration occurs.

A founder may create a prospect from a Facebook page with the source URL and evidence. Registration number and person name may be unknown in the source-aware research-only path. Missing information cannot turn into send permission. Reuse CRM deduplication, suppression, contact verification, research and campaign history; existing legacy capture contract stays intact.

The daily outreach workspace shows research, eligibility and review queues, sends, cap/shortfalls, failures and stops. Campaign settings expose policy versions and controls; variant results show cohort and evidence. Add source filters to existing CRM views. Loading, empty, error, focus, keyboard, and responsive states are required.

## Schedule and events

Proposed daily schedule, Europe/London, including weekends for research:

| Time        | Work                                                                                 |
| ----------- | ------------------------------------------------------------------------------------ |
| 07:00       | Research eligible prospects, with idempotent daily ownership.                        |
| 07:30       | Discover Facebook destinations and update evidence.                                  |
| 08:30       | Prepare source review and drafts.                                                    |
| 09:00–17:00 | Pace due sends to qualifying recipients within their configured business-day window. |
| 17:30       | Produce aggregate summary and explain shortfalls.                                    |

Business-day recipient windows are a configurable policy, not a weekday-only research assumption. Handle DST using the named timezone. Discovery runs once per day, not repeatedly to force a quota.

Use the existing signed v2 HMAC intake and trusted Keychain-backed wrapper for a Codex research automation. Redact output; never print credentials or prospect content. Create or enable scheduling only after the deployed build and campaign are authorised. First research starts after the same gates pass; sending additionally requires healthy routing and eligible recipients.

Committed durable state is authoritative. Publish authenticated outbox events after commit; use idempotent handlers, due-time wakeups, leases, bounded retries, and explicit cancellation. Reconcile on startup and reconnect, including revoked permissions. Gmail history notifications require Gmail watch and an authorised Google Cloud Pub/Sub project and subscription if absent; the existing application event system is not evidence that this provider channel exists. Do not create a watch or cloud resources before the relevant deployment gate. A bounded request-scoped reconciliation before a worker batch is permitted; no idle database polling for changes, with an idle-query target of zero. Existing scheduled invocations may execute already-due work; document any necessary reconciliation fallback, frequency and query budget. Unsubscribe and shut down cleanly.

## One-month variant review

Propose two variants per offer, with identical eligibility and deterministic 50/50 assignment by business ID and experiment seed, stratified by market. Experiment one changes only the permission CTA wording; subject generation follows the same verified business/owner policy for both arms. The three video offers are distinct offers, not arms A/B/C. Compare only within the same offer and market. Freeze cohort, offer, market, policy and variant version and assign a stable variant at first send. This is an experiment design proposal, not a video claim. Commit a durable due-time report job with the first actual send event, for its one-calendar-month anniversary in Europe/London; if the original day does not exist in the next month, clamp to its last valid day. Do not fix an upfront calendar date or use a Codex polling loop.

The primary outcome is the **14-day positive-reply rate** for recipients first sent during the first 14 London calendar days who have a complete 14-day observation window at report cutoff. A positive reply is manually reviewed and expresses explicit interest or requests a next step. Exclude bots, opt-outs and out-of-office replies. List later or otherwise censored recipients separately; do not infer a winner from incomplete observation. Secondary outcomes are qualified meetings within 14 days and paid conversions by report cutoff, with censoring shown. Show intervals, denominators, sample maturity, missing data and attribution windows; do not crown a thin or confounded result.

Use provider thread and enrollment identifiers to attribute replies to one membership. The founder records an explicit membership origin for meetings and proposals. Paid conversion requires a reviewed link from that membership to engagement, agreement and invoice evidence of net cleared payment for its campaign offer. Unique provider and event IDs prevent duplicate counts; no overlapping campaigns receive credit for one outcome. Historical unmapped outcomes remain unknown. Provider acceptance, delivery where known and the rest of the funnel remain visible; opens are not primary; use only existing first-party observations and add no tracking pixels without a user request. No later recurring monthly report is assumed without a separate scope decision.

## Implementation phases and acceptance

These phases are proposals for a later approved implementation plan, not permission to build.

1. **Policy and evidence:** confirm offer/pricing, video adaptations, legal/provider eligibility, Workspace quota and activation criteria. Acceptance: policy specifies permitted paths and every uncertain recipient remains review-only.
2. **CRM and campaign state:** extend source-aware intake, campaign versions, memberships, events and reservation ledger with reversible migrations and indexed foreign keys. Acceptance: no duplicated prospect store; clients, opt-outs and legacy capture stay protected.
3. **Research and manual Facebook:** extend v2 ingestion, daily task and workspace with auditable public evidence and manual activity. Acceptance: retries are idempotent, unknown rules block posting, and no private or automatic Facebook activity occurs.
4. **Eligibility and sending:** implement founder policy approval, routing, pacing, budget reservations, due jobs, halt/reconcile paths and Gmail send reuse. Acceptance: concurrent sends cannot exceed limits; uncertain results cannot duplicate; no Resend cold sends.
5. **Variant analysis and interface:** assign stable variants, record outcomes and generate one-month report; complete daily and Facebook workspaces. Acceptance: denominators and missing outcomes are explicit; founder can operate all states accessibly.
6. **Verification and staged release:** run unit, integration and concurrency checks; exercise DST, reconnect and provider failures; gather browser and critical jury evidence. Require independent code and security reviews on the exact PR revision and required green CI. Obtain explicit founder approval for production deployment and a separate campaign activation gate.

## Verification and rollout

Use repository scripts from `package.json` for typecheck, lint, tests and build; select existing Growth integration tests plus focused additions. Test v2 ingestion and legacy compatibility; source provenance; client/suppression isolation; unchanged five client relationships; races around budget reservation; rolling/day boundaries and DST; duplicate events; failed/unknown provider outcomes; retries and revocations; replies and stop conditions; authorised payment joins; cohort immutability; reconnect catch-up; unsubscribe and shutdown. Measure idle queries and bounded due-job load. Run query plans for new database queries and verify migration down paths.

Use the Codex in-app browser only for founder-page fixtures and responsive, keyboard and focus checks. A Chrome-dependent jury script is not an acceptable fallback. A fresh raw weighted jury score must reach 7.5 or higher, with category scores reported and an 8-per-category target. Report unavailable browser or measurement gaps rather than asserting a pass.

Roll out disabled, with reviewed preview and rollback plan. Preserve legacy campaign behavior and Operations data. Activation requires verified provider/account prerequisites, policy approval, instrumentation and an explicit release decision. Rollback disables new scheduling and sends, drains or cancels due work safely, and retains durable audit and uncertainty records; never discard existing client or opt-out data.

## Optional mail infrastructure

[Postal](https://github.com/postalserver/postal) is open-source software, but hosting, a suitable server, port 25, domain reputation and operations are not free by implication. A typical setup needs material compute and disk capacity. Do not install, provision, pay for, or change DNS for it without an identified host and separate approval. A new MTA is not required merely to target 150 eligible sends.

## Open decisions

- Approve or revise the proposed FSS offers, pricing, free-build scope and capability evidence.
- Choose the specific markets, recipient windows, permission evidence, policy approver and halt thresholds after provider and legal review.
- Confirm whether the proposed review follow-up days and one-month-only report match the intended workflow.
- Confirm Workspace plan and account health, DKIM, approved send ramp and any approved infrastructure budget.
- Review this design before implementation planning. The caption tracks were retrieved but not checked against audio.
