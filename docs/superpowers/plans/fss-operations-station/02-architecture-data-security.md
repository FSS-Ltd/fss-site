# Architecture, data and security specification

Status: Proposed design. Implements [product specification](01-product-specification.md).

## Architecture decision

Keep one modular Next.js application with two access surfaces. `/growth/operations` uses the existing founder guard. `/portal` uses a separate client identity boundary. Server-side domain modules under `lib/operations` own organisations, agreements, billing, delivery and onboarding. Route handlers validate input, resolve identity, invoke one domain operation and return a deliberately shaped response.

PostgreSQL remains the application record. The payment provider is authoritative for payment execution, invoices issued there, mandates and subscriptions; the application keeps reconciled projections. The signature provider is authoritative for signing evidence. Never infer either from a browser redirect. No new microservice, message broker or ORM is justified initially.

Use existing PostgreSQL transaction and repository patterns. Add a private `operations` schema with dedicated least-privilege runtime roles, rather than exposing Growth tables to clients. Supabase Auth is a proposed managed identity addition; use verified server-side identity and application memberships, following [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs). Add its SDKs only when this choice passes the authentication prototype.

## Existing integration points

| Existing file/module                                        | Planned use                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `lib/growth/auth/require-founder.ts`                        | Guard every founder operation; preserve owner allowlist                                    |
| `lib/growth/auth/config.ts`                                 | Preserve current founder login; never add clients to its allowlist                         |
| `lib/growth/db/client.ts`, `types.ts`                       | Reuse bounded pooling/transaction patterns with separate operations credentials            |
| `lib/growth/pipeline/transition-engagement.ts`              | Existing stage validation and outreach stopping when a verified deal becomes won           |
| `lib/growth/clients/client-thank-you.ts`                    | Preserve post-completion thanks; prevent duplicate newsletter invitations                  |
| `lib/growth/integrations/resend/client.ts` and `webhook.ts` | Reuse provider transport/verification where compatible; add purpose-specific orchestration |
| `lib/growth/newsletter/subscribers.ts`                      | Reuse opt-in, unsubscribe and suppression policy                                           |
| `app/api/cron/resend-dispatch/handler.ts`                   | Inspect existing dispatch conventions, keep new journey queue distinct                     |

## Data dictionary

All new tenant-owned rows carry non-null `organisation_id`. UUID identifiers, UTC timestamps, ISO date-only service/due dates, GBP money in integer pence, integer versions and explicit status checks. Use database bigint for money where appropriate and decimal strings across JSON boundaries; do not silently cast unbounded bigint into JavaScript numbers. Percentages use deterministic decimal/rational arithmetic and round only for display.

| Entity                         | Fields and relationships that matter                                                                                | Integrity rules                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| organisations                  | legal/display name, trading status, billing address reference, timezone, lifecycle                                  | Stable client identity across engagements; archive instead of deleting financial history                |
| organisation_contacts          | organisation, email, display name, contact purpose, verification status                                             | Separate person/contact from login identity; restricted personal fields                                 |
| memberships                    | organisation, auth user ID, role, revoked_at                                                                        | Unique organisation/user; check active membership on every request                                      |
| portal_invites                 | organisation, intended contact, role, token hash, expiry, used/revoked time                                         | One-time claim; raw token never persisted in logs; no domain-based membership                           |
| engagement_links               | organisation, existing growth engagement ID                                                                         | Unique engagement ID; founder explicitly resolves historical duplicates                                 |
| agreements                     | organisation, engagement link, current revision, status                                                             | Draft/sent/signed/declined/expired/voided; signed evidence immutable                                    |
| agreement_revisions            | agreement, revision number, document hash, scope snapshot, terms, approved_by/at                                    | Unique agreement/revision; edits create new revision, invalidate approval                               |
| agreement_lines                | revision, service code, description, quantity, net unit pence, recurrence months, start/end, discount, tax snapshot | One-off and recurring distinguished; recurrence supports monthly/quarterly/annual; no negative quantity |
| signature_envelopes            | revision, provider account/envelope ID, expected signers, status, completed_at, certificate/document refs           | Provider/account/envelope unique; all required signers and revision verified                            |
| service_instances              | organisation, agreement line, activation/end dates, status, cancellation effective date                             | Lifecycle distinct from signing and payment; recurring metrics use these dates                          |
| projects / milestones          | organisation, agreement, owner, target date, public summary, status                                                 | Milestone evidence and client dependencies; no invented percent complete                                |
| requests                       | organisation, project, requester, title, description, type, status, priority, version, scope classification         | Composite organisation/project reference; optimistic concurrency                                        |
| request_comments               | organisation, request, author, body, visibility                                                                     | Separate public/internal queries; internal comments never appear in client payloads                     |
| deliverable_versions / reviews | request, artifact, version; reviewer, accepted/changes_requested, note, reviewed_at                                 | Acceptance refers to exact delivered version; append-only review history                                |
| attachments                    | organisation, parent entity, private object key, MIME, size, scan status                                            | Quarantine before access; private storage and authorised downloads                                      |
| offers / offer_enquiries       | versioned offer description, availability, pricing display policy; organisation, interest, owner, next action       | Publish is founder-only; enquiry is not a purchase                                                      |
| billing_customers              | organisation, provider/account/customer ID, environment                                                             | Unique mapping; sandbox/live isolated                                                                   |
| billing_schedules              | agreement revision, installment/milestone or recurring anchor, due terms, provider refs                             | One collection owner per obligation; signed-price snapshot                                              |
| invoices / invoice_lines       | provider ID/number, organisation, schedule, status, currency, amounts, due date, PDF/link reference                 | Issued snapshots immutable; corrections via credit/void/reissue                                         |
| payments / payment_allocations | provider ID, state, amount, confirmation time, invoice allocation                                                   | Unique external payment; no over-allocation; partial payments supported                                 |
| credits / refunds / disputes   | invoice/payment references, amount, lifecycle, reason                                                               | Separate financial events, never overwrite original paid evidence                                       |
| mandate_projections            | provider ref, billing customer, state, last four/reference when needed                                              | No account number or sort code in application database                                                  |
| journeys / journey_steps       | agreement, approved version, state, due_at, generation, stop reason                                                 | Unique agreement/journey type; unique journey/step/generation                                           |
| outbound_messages              | purpose, recipient snapshot, template/content hash, approved snapshot, provider ID, delivery state                  | Persist accepted send before scheduling dependent steps                                                 |
| outbox / provider_events       | operation key, payload version, lease, attempts; provider/account/event ID, verified receipt                        | Unique operation/event keys; durable receipt before acknowledgement                                     |
| audit_events                   | organisation, actor, action, object/version, correlation ID, time, reason                                           | Append-only, redact content/secrets                                                                     |
| metric_snapshots               | period, definition version, currency, result, reconciliation watermark                                              | Rebuildable; correction revision for late events                                                        |

An invoice can cover multiple schedule lines but only one organisation and currency. An organisation may have multiple projects, agreements and logins. Historical engagement estimates remain sales data; never treat them as settled invoices or active service revenue.

## Tenant isolation

Use separate founder and portal database connections. Portal role gets only required operations tables, no Growth grants, no BYPASSRLS and no schema ownership. Force RLS on tenant tables. Within a transaction, set the verified user context transaction-locally, then policies check active membership for the row organisation and required role. Never accept user ID, role or trusted organisation from request JSON. A requested organisation is only a selector validated against membership.

Composite foreign keys such as `(organisation_id, project_id)` prevent cross-client parent links. Repository methods require an authenticated context and organisation ID, not a free-form global lookup. Founder operations use a separate audited path. Test policy behaviour using actual runtime roles, including pooled connections after transaction completion. Browser and Supabase Data API roles have no access to operations tables. Views must not bypass policies.

Server-rendered portal responses are private and uncached across users. Do not use shared caches containing tenant data without an explicit user/organisation/permission key and revocation strategy; initially bypass such caches. Authorise files, exports, aggregate counts, search and notification recipients as carefully as rows. Avoid including internal fields and then hiding them with CSS.

## Identity and attachment rules

Invitation expires after 72 hours, single-use, revoked on replacement. An invoice PDF links to an organisation-neutral portal activation landing page; that page initiates email verification to the approved contact. Do not embed a long-lived login bearer in an invoice that can be forwarded. Email carries a short-lived claim link; successful claim also requires verified matching identity. Existing members sign in normally. Invite acceptance and consumption are atomic.

Require reauthentication for billing contact changes; log account recovery and revoke old access. Founder retains existing MFA-capable identity protection. Rate-limit auth/invite/request/upload endpoints. Reject cross-origin state changes, unsafe redirects and client-controlled provider URLs. Use safe output rendering for client text.

Attachments: proposed 10 MB each and five per request; PDF, PNG, JPEG and plain text initially. Reject executables, SVG/HTML and mismatched magic bytes. Quarantine, malware scan, then release. Scan service choice/cost must pass release gate; until then allow links to approved deliverables and disable file uploads. Never ask clients to place passwords/API keys in tickets; use an agreed secure credential-sharing process.

## Asynchronous work

Database outbox plus a bounded authenticated worker is sufficient. Claim due rows with leases and row locking; persist effects under stable operation keys. Provider calls occur outside long database transactions. Webhook routes verify raw payloads, enforce body limits, durably record events and respond promptly. Workers validate provider account/environment and object-to-organisation mapping before applying effects.

At-least-once delivery is expected. Duplicate events become no-ops. Out-of-order events cause authoritative object reconciliation, not blind status regression. Unknown mappings go into a founder-visible exception queue. A timeout after a provider call is an unknown outcome, not permission to repeat a charge. Reconcile by external reference/idempotency key first. Maintain a daily reconciliation sweep independent of webhooks.

## Retention and release safeguards

Before real data, record provider DPAs, regions/subprocessors, access policy and retention schedule. Proposed categories: auth/security event retention 90 days; routine closed request content 24 months; agreement/invoice records under accountant-approved statutory schedule and legal holds. These are proposed operational defaults, not legal retention advice. Deletion requests remove eligible personal data without destroying required financial evidence. Backups and restore procedures must preserve access revocation and pause external effects on restore.

Use expand/backfill/verify migrations. Generate real migration filenames with Supabase CLI only during authorised execution. Backfill organisation mappings as founder-reviewed candidates, rerunnable by unique engagement ID. Never activate historical journeys or create historical invoices automatically. Down migrations may remove unused new structures in a sandbox; after real financial data, use forward fixes and feature flags, not destructive rollback.
