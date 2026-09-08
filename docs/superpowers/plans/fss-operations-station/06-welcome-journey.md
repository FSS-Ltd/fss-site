# Welcome journey, proposals and content plan

Status: Proposed automation specification. All content remains Markdown planning. No messages or PDFs generated or sent.

## Founder trigger

On client/deal detail, “Prepare welcome journey” opens a review screen. Required: correct organisation and contacts, client goals, proposed scope, proposal revision, billing terms, signatories and welcome template. Show welcome email, welcome PDF preview, proposal revision, first-invoice schedule and all planned send times. “Start approved journey” records the founder's approval scope and queues only the permitted actions.

The founder can start welcome while the proposal is still being edited, but the two-hour proposal step then holds until explicit proposal approval. The screen makes this visible before starting. Welcome says “proposed work” until signatures complete. It does not promise an unconditional start date or state that the contract is already signed.

## Timeline and exact scheduling

| Event                               | Action                                                                         | Conditions and timing                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Founder starts journey              | Queue approved welcome email with welcome PDF                                  | Exact recipient/content/PDF snapshot approved; no active duplicate journey                                    |
| Welcome accepted by Resend          | Record provider ID and accepted_at; schedule proposal                          | proposal_due_at = accepted_at + 2 elapsed hours                                                               |
| Proposal due                        | Send approved current portal signing link through Resend                       | Current revision/hash and signers still match approval; no bounce, pause, stop or already-sent signing notice |
| Proposal edited before send         | Hold proposal step                                                             | New immutable revision requires reapproval; earliest send remains original due_at, or approval time if later  |
| All required signatures completed   | Verify evidence, activate signed-agreement record                              | Complete matching approval/revision and retained evidence; retries no-op                                      |
| Following calendar day 09:00 London | Create/finalise first agreed invoice, ensure portal invitation, send thank-you | Signed evidence saved; invoice and invitation steps individually durable                                      |
| Client claims invitation            | Establish verified membership, show checklist                                  | Independent of payment clearance                                                                              |
| Invoice payment succeeds            | Update billing and evaluate service-start conditions                           | Activation follows contract, assets and capacity requirements, not email opening                              |

“Accepted” means provider API acceptance, not delivered or read. Bounce/complaint events halt pending welcome/proposal emails and create a founder action. If delivery never becomes known, show uncertainty; never claim the client read it. The two-hour delay is a chosen experience rule, not evidence that this interval improves conversion.

“Following day” defaults to the next calendar date at 09:00 Europe/London, including weekends. Store local scheduling policy and computed UTC instant using IANA timezone rules. Example: signature Friday 18:00 London → Saturday 09:00 London. If the founder prefers business days, approve a policy change before launch. Delayed signature completion processing after the due instant makes the action immediately eligible once verified; record actual lateness. Never backdate an invoice or email.

Cron proposed every five minutes, subject to Vercel plan and execution limits. A proposed operational target is dispatch within ten minutes of due time while providers are healthy. Use database due_at, not a two-hour sleeping function or browser timer. Keep this separate from existing 90-minute Growth jobs.

## Workflow state and controls

Journey state: draft, active, paused, blocked, completed, cancelled. Steps: pending, due, leased, succeeded, retryable_failure, unknown_outcome, held, cancelled. Signature waiting is an external prerequisite, not a worker retry loop.

Founder controls: preview, approve, start, pause, resume, cancel remaining steps, replace proposal, resend failed invitation, reconcile unknown outcome. Pause/cancel increments a journey generation; every worker rechecks state/generation immediately before its external call. A call already accepted externally cannot be unsent. Show that race accurately and retain the effect.

Cancelling a journey does not void a signed agreement, cancel a subscription or refund a payment. Those require separate explicit domain actions. Resume never replays succeeded steps. Restart requires an explicit new journey version and excludes already fulfilled commercial obligations.

## Durable delivery and recovery

Persist the approved snapshots and outbox job in one transaction. Use keys such as journey ID + step + generation; provider event dedupe additionally includes provider account/environment. Each worker claims a short lease, calls the provider with an idempotency key and persists the result. A database crash after provider success creates unknown_outcome; reconcile it before any new send.

Resend's idempotency retention is 24 hours, so it is not a permanent deduplication store. Keep permanent application send records. An unresolved timeout older than that window holds for reconciliation/founder review instead of blind resending. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

Retry transport errors with bounded backoff (proposed 1, 5, 15, 60 minutes, then 4 hours, maximum five retries) and honour provider rate limits. Invalid recipient/contract/configuration is a hold, not a retry. Emit alert on terminal failure and when a due step is over 15 minutes late. Preserve next action and safe error code without leaking message content.

Invoice generation, invitation generation and thank-you send are separate resumable steps. If invoice creation succeeds but email fails, retry only the email. If PDF generation fails, hold welcome. If invoice fails, hold thank-you with invoice dependency visible. Signed clients remain visible in founder operations while these failures are resolved.

## Content specification

The following copy is a draft to refine before template approval. Merge fields are explicit data bindings, not instructions for an AI to invent facts. Missing required fields block preview approval.

### Welcome email

Subject: Your next steps with FSS

Hello {{contact_first_name}},

Thank you for talking through {{primary_goal}} with us. Our proposed work will focus on {{agreed_outcome_summary}}.

The attached welcome guide explains the process, what we will need from you and how we will keep you informed. We will send the proposal separately for your review and signature. It will set out the services, fees and terms before work begins.

If we have misunderstood a priority, reply and tell us. We will use your goals to guide the work and review progress with you.

Jean-Fidele
Faithful Software Solutions

Do not state “in two hours” in client copy because an unapproved proposal or failed delivery can hold the step. Provide a browser-readable accessible version alongside the attachment.

### Welcome PDF outline

Target 4–6 readable pages, accessible text, clear headings, FSS design, no stock claims or unrelated sales content. Use existing PDFKit where feasible; verify actual reading order, fonts and extraction, and provide equivalent portal/HTML content if tagging support is insufficient. Keep the attachment under a proposed 2 MB.

| Page                             | Content                                                                                       | Required source fields                              |
| -------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1: Your priorities               | Client's problem, desired outcomes, how success will be reviewed                              | Discovery goals, approved outcome summary           |
| 2: The proposed work             | Included deliverables, exclusions, assumptions; proposal governs final terms                  | Current scope revision                              |
| 3: How delivery works            | Proposal/signature → invoice/access → kickoff/assets → milestones → review → handover/support | Actual delivery model and start prerequisites       |
| 4: Working together              | FSS owner, client approver, updates, request board, feedback, secure asset handoff            | Contact roles, support hours, agreed review process |
| 5: Progress and next steps       | Outcome checklist, first required assets, target dates only if agreed                         | Milestones and dependencies                         |
| 6 if needed: Support and billing | Help route, payment/mandate distinction, change-request process, escalation                   | Contract-specific policies                          |

Suggested central paragraph: “Your goals will guide the work. We will connect each agreed deliverable to the outcome it supports, make progress visible and raise changes early. You will know what we are working on and what we need from you.” Avoid guarantees that FSS cannot substantiate.

### Proposal email

Subject: Your FSS proposal is ready to review

Hello {{contact_first_name}},

Your proposal sets out {{scope_summary}}, the agreed fees and the delivery process. Review and sign it here: {{secure_signing_link}}.

Please check the scope, payment schedule and responsibilities. If anything needs changing, reply before signing so we can issue a revised proposal.

Jean-Fidele
Faithful Software Solutions

The user approved in-house signing on 8 September. Resend owns the single approved signing notice with a normal portal URL, never an embedded signing credential. Before the proposal step, ensure each designated signer can claim approved portal access; Task 9 requires verified active membership before signing. Keep the approval ID and notification delivery evidence in the journey. The post-signature invitation step reuses existing access and only provisions missing access, without duplicate invitations.

### Post-signature thank-you

Subject: Your FSS agreement and next steps

Hello {{contact_first_name}},

Thank you for signing the agreement. Your first invoice is ready: {{hosted_invoice_link}}. The invoice shows the amount and agreed due date.

Activate your client portal here: {{portal_claim_link}}. You can follow progress, submit requests, review work and manage payments in one place.

Our next step is {{contractual_next_step}}. {{required_client_action}}.

Jean-Fidele
Faithful Software Solutions

The actual invoice and its PDF include the stable portal activation landing URL. The email's private claim link is short-lived and issued only to the intended verified contact. A billing contact may receive the invoice while a different owner receives the portal invite; preview these as separate recipient messages.

### Optional newsletter invitation

Optional approved line: “If you would like practical notes from FSS, you can choose to join Field Notes in your portal. It is separate from your service and you can unsubscribe at any time.”

Adding promotional material can make a service email direct marketing. Do not assume a subscription invitation is legally exempt because it accompanies an invoice. Gate the line using the reviewed marketing policy and existing suppression/consent state; when no suitable basis is recorded, show the voluntary choice inside the authenticated portal instead. Always send necessary invoice/access information independently. Signing, paying or creating a portal account never subscribes the client. Preserve existing optional opt-in and avoid another invitation in completion thanks if already invited/subscribed. [ICO guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/).

## Acceptance fixtures

- Welcome accepted at 10:15 UTC → approved proposal due 12:15 UTC; pending approval holds.
- Reapproval at 13:00 UTC after original due time → eligible at 13:00, one send.
- Second signer completes → next-day action scheduled once; first signer alone does not schedule it.
- Signature timestamp around London DST change → correct next calendar date at 09:00 local.
- Duplicate start, signature webhook, cron lease and invoice creation attempts → one intended external effect each.
- Cancellation while provider call is in flight → accepted effect recorded; later steps cancelled, UI never claims unsent.
- Bounce after welcome → proposal held; corrected contact needs new approval.
- Invoice succeeded/email failed → same invoice reused on recovery.
- Newsletter opted out → service invoice still sent, no promotional line or subscription.
