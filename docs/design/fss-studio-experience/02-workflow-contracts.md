# Workflow contracts

These rules are normative for the proposed build. Wireframes illustrate them; the server enforces them.

## A. Requests and bug reports

### A1. Entry points and creation

“New request” is a visible filled button on client home, project detail and the request board. It opens C06 with the current organisation retained and the project preselected when launched from a project. “Report a bug” opens C07 with the bug type selected.

Required: authorised project/service context, type, title 1–160 characters, description 1–10,000, desired outcome 1–4,000. Bug type additionally requires reproduction steps, expected behaviour and actual behaviour, each 1–4,000. Desired date and impact are optional. Optional URL/browser fields are additions to validate, not assumptions about existing API support.

The existing form requires a shared project. For zero projects, show “We need to connect your request to a project” and a real “Ask FSS to set up your project” support route. The founder receives a setup action. Do not silently submit under an arbitrary project, expose a UUID field, or pretend the request has been created.

On submission: validate → focus first invalid field if needed → change button to “Submitting…” → prevent duplicates → persist with a stable idempotency key → display reference and acknowledgement target → navigate to detail → announce success. Refresh must show the same record. Timeout retains the draft and key so retry does not duplicate it.

### A2. Board layout

Desktop default is Kanban; remember board/list preference per user. At narrow widths default to a labelled list grouped or filtered by state. Six visual columns:

| Column | Stored state |
|---|---|
| Inbox | New and Acknowledged; each card shows its exact state |
| Planned | Planned |
| In progress | In progress |
| Ready for review | Ready for review |
| Changes requested | Changes requested |
| Done | Done or explicitly labelled Closed by FSS |

Cancelled records remain discoverable through a filter/archive and keep history. A blocker is a badge with reason, responsible party and next check date; it does not replace the underlying state.

Cards: request reference; short title; work/bug/change/help type; exact state where grouped; next action; owner; agreed date if any; review version if relevant; blocked indicator; comment/attachment indicators. Founder cards additionally show organisation and internal operational priority. Avoid invented percentage progress.

Filters: project/client, type, state, action needed, blocked, owner on founder view, search, archived. Server filtering and cursor pagination operate on all authorised records. Counts reflect the filtered result set, not only currently loaded cards.

### A3. Transition policy

| From | To | Allowed actor | Preconditions |
|---|---|---|---|
| New | Acknowledged | Founder | Owner + scope classification or assessment pending |
| Acknowledged | Planned | Founder | Included/approved scope + next action |
| Planned | In progress | Founder | Assignee + service-start gates + capacity |
| In progress | Ready for review | Founder | Retained deliverable version + current reviewer + instructions + public summary |
| Ready for review | Done | Client owner/designated active reviewer | Explicit acceptance of current deliverable and cycle |
| Ready for review | Changes requested | Same authorised reviewer | Required feedback for current version |
| Changes requested | In progress | Founder | Included revision confirmed or approved scope change |
| Any open | Cancelled | Founder | Recorded reason; client informed |
| Done | Acknowledged | Founder | Reopen reason + new review cycle |

Contributor without designation can create and comment but cannot accept. Viewer is read-only. Billing contact has no delivery access unless separately granted by the existing capability model.

Founder administrative closure records a separate closure kind, actor and reason. It is never presented as “Accepted by client” and is excluded from client acceptance metrics.

### A4. Drag and keyboard behaviour

- Drag handle is visible on hover/focus on authorised cards; whole card remains an Open details target.
- Highlight only valid targets. Invalid targets explain the missing requirement.
- Dropping into a state with additional required information opens the appropriate transition sheet. Cancel leaves the original state unchanged.
- Every card exposes **Move to** with the same transition choices. It works using click, tap and keyboard, so drag is never required. This also meets the intent of WCAG's single-pointer alternative requirement. [W3C dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements).
- Client reviewers may drag from review into Done or Changes requested, but the drop opens the same explicit version acceptance/feedback confirmation. They cannot drag arbitrary delivery states.
- During save, announce “Moving NS-014 to Ready for review”. On success announce the saved state and keep focus on the moved card. On failure restore its position, retain entered text, and offer retry.
- Commands send expected record version and review-cycle/version identifiers where relevant. Conflict: “This request changed while you were working. Review the latest version before trying again.” Never overwrite silently.
- Card reordering within one column is cosmetic unless an explicit prioritisation feature is implemented. It must not imply a new commitment, alter internal priority or send a notification.

### A5. Review and completion

The review screen must show request outcome, public changes summary, version label, linked deliverables, concrete review instructions, reviewer and history. The acceptance control names the version: “Accept version 3”.

Acceptance is separate from signing a commercial agreement. A review deadline is a reminder target. Silence never means acceptance. Changes requested must preserve prior evidence and open a new cycle when a new version is published.

Completion view shows accepted version, decision actor/time, final files, handover/support link and a linked follow-up action. Administrative closure displays the FSS closure reason. Reopened work retains the earlier completion record.

## B. Notifications

### B1. Event matrix

| Event | In-app recipients | Email recipients/default | Destination |
|---|---|---|---|
| Request received | Author; founder queue | Author confirmation | New request detail |
| Meaningful public status change | Author and subscribed project members | Preference-controlled digest/immediate | Request detail |
| Public comment | Other thread participants/watchers | Preference-controlled; never internal notes | Exact thread |
| Review requested | Active designated reviewer; authorised owner | Reviewer, enabled by default | Exact request, cycle and deliverable version |
| Changes requested | Founder and request participants | Founder; client receipt as configured | Review feedback |
| Client accepts / work completed | Author, reviewer and authorised subscribed members | Completion email enabled by default | Completion and final deliverable |
| Closed by FSS | Author and reviewer | Closure notice with distinct wording | Closure reason |
| Journey needs attention | Founder | Founder operational alert | Specific failed/held step |
| Invoice action required | Authorised billing contact/owner | Existing billing recipient policy | Authenticated billing view |

Suppress self-notifications for ordinary comments and internal edits. Deduplicate recipients who have several roles. Resolving a recipient must verify active membership and content entitlement. Recheck before email dispatch so revoked members do not receive private details.

### B2. Inbox and delivery

Inbox fields: event type, concise subject, client/project, timestamp, unread state, action-needed badge and direct action. Clicking marks read, but **read is not resolved**. Resolve review actions only from actual domain state. Mark-all-read affects only the user's authorised inbox.

Domain mutation, audit event and notification intent commit atomically. Email runs after commit. Use unique `event + recipient + channel` records. A failed email never rolls back a successful review/status change.

Provider states: queued, attempting, accepted, delivered, bounced, complained, retryable failure, unknown outcome and exhausted. “Delivered” is not “read”. Email webhooks are verified and deduplicated. Retry uses bounded backoff and permanent local deduplication; old uncertain attempts require reconciliation.

### B3. Required email copy

**Review requested**

- Subject: “Ready for your review: {{request_title}}”
- Heading: “Your update is ready.”
- Body: “{{public_summary}} Review {{version_label}} and let us know whether it meets the agreed outcome.”
- CTA: “Review the update”
- Supporting: project name, request reference, what to check, review target where applicable.

**Completed after client acceptance**

- Subject: “Completed: {{request_title}}”
- Heading: “All done.”
- Body: “{{reviewer_name}} accepted {{version_label}} on {{decision_date}}. Your final deliverable and review history are available in your workspace.”
- CTA: “View completed work”

**Administrative closure**

- Subject: “FSS closed: {{request_title}}”
- Body names the founder-recorded closure reason and does not claim client acceptance.

Use normal authenticated portal URLs, not bearer signing/payment credentials. Keep sensitive detail out of subject lines and attachments. Templates need HTML and plain-text variants. Marketing remains a separate explicit opt-in.

## C. Agreement builder

### C1. Six-step process

1. **Client & engagement:** organisation, named engagement, agreement name, template or prior draft.
2. **Scope & outcomes:** goals, deliverables, exclusions, acceptance criteria, assumptions, responsibilities and support.
3. **Fees & terms:** line items, quantity, cadence, amount, discount/tax treatment, deposit, installments, start conditions, term and notice.
4. **People:** billing contact, required signers, FSS signer, reviewer and responsibilities.
5. **Document:** generate from the draft or upload an existing approved source; retain exact bytes; preview accessible representation.
6. **Review & approve:** complete summary, full document, unresolved checks, recipient/signature preview and send-now versus welcome-journey choice.

Each step has persistent labels, examples, inline errors, Back, Save draft and Continue. Show “Saved at 14:32”, “Saving…” or “Could not save; retry” accurately. Incomplete wizard drafts must be separate from final, fully validated agreement revisions.

### C2. Engagement selector

Replace `engagementIds: string[]` with a founder-authorised named summary DTO:

```ts
type EngagementOption = {
  id: string;
  title: string;
  organisationName: string;
  reviewStatus: "needs_review" | "reviewed";
  reviewedAt: string | null;
};
```

States:

- Loading: labelled skeleton/“Loading linked engagements…”.
- Populated: “Website & booking experience · Discovery reviewed 12 Sep”.
- No links: explain the prerequisite and offer **Link existing engagement** and **Create engagement**.
- None eligible: show why the visible engagement requires review, with **Review engagement**.
- Failed query: **Retry**; do not render failure as an empty successful result.
- One option: preselect only when its organisation and eligibility are verified; display the choice.

Link/create occurs through a server-validated founder command. Check the growth/client relationship and tenant ownership; record who reviewed/linked it. Return to the saved draft with the named option selected. Never offer arbitrary UUID entry as a product solution.

### C3. Document evidence

Remove “Reviewed source document SHA-256” and “Private source document reference” from normal data entry.

New user-facing document block:

- “Agreement document”
- “Generate from this draft” / “Upload an existing agreement”
- File name, revision, preparation time, scan status where applicable.
- “Preview document”, “Replace document”, “Download”.
- Status: **Document fingerprint recorded automatically**.
- Collapsed **Document details** may display a read-only fingerprint with Copy, record provenance and retained storage version for support.

The server calculates the fingerprint from exact stored bytes after final generation/upload and validation. Never trust a browser-submitted fingerprint as proof of the stored file. If the source is replaced or commercial content changes, create a new revision and invalidate incompatible approvals. Rendered summary, retained source, signed revision and signing UI must refer to the same version.

Manual signature recording is a separate founder-only exception flow: upload/select signed artifact, identify source revision and all signers, record completion date and evidence provenance, calculate signed-file fingerprint automatically, and require explicit attestation. Do not represent this as cryptographic verification.

### C4. Readiness checks

Block approval/send for missing engagement, unresolved scope, invalid money/tax treatment, unreconciled installments, missing signers, unavailable retained document, unreviewed revision, invalid recipient access or provider readiness failure. Each failure links to the exact step. Saving a partial draft remains possible.

## D. Welcome journey

### D1. Builder and templates

Founder can start from client detail or journey list. **Create journey** opens five steps: client/goals, content, people/access, schedule/tasks, readiness/activation.

Templates include welcome email, five-section guide, signing notice, thank-you, additional-recipient activation email and default client tasks. Prefill from approved data; show which facts are missing. No AI-generated facts or unapproved prices.

Founder may edit copy, include optional checklist tasks, reorder tasks where dependencies permit, set task owner/due target and preview the client experience. Fixed commercial dependencies cannot be dragged away. Publishing a template creates a version; active journeys retain their snapshots.

Required guide sections: client priorities; proposed work; delivery process; working together; next steps. Provide accessible HTML/text equivalent to the PDF. “Edit guide” opens each section, word guidance, save status and full preview; it must not be a dead button.

### D2. Readiness and activation

Preflight returns a structured checklist: organisation/contact validity, selected agreement and revision, approved recipient roles, content completeness, guide generated, sender authorised, first signed billing obligation mapped, signing enabled, delivery worker/provider configuration ready, no conflicting active journey.

Each check has passed, needs action or failed status, a clear reason and a Fix action. Start can be disabled only with visible reasons. A draft may be saved at any stage.

**Start journey** shows exact recipients, content versions and effects about to be queued. One explicit approval records that snapshot and creates durable work atomically. Duplicate clicks return the existing journey. Starting never sends unrelated marketing or changes client roles beyond the reviewed invitation scope.

Welcome may start before proposal approval, provided the proposal is visibly held. It must describe proposed work and avoid promising an unconditional start date.

### D3. Existing timing to preserve

| Trigger | Effect |
|---|---|
| Founder starts approved journey | Queue welcome email and guide |
| Email provider accepts welcome | Anchor proposal eligibility at acceptance +2 elapsed hours |
| Proposal becomes due | Send only current approved revision to approved signers with required access |
| All signatures verified and evidence retained | Schedule next calendar day 09:00 Europe/London invoice/access/thank-you effects |
| Client claims invitation | Establish verified membership and show setup checklist |
| Payment/asset/capacity prerequisites satisfied | Founder can confirm service readiness |

Next calendar day includes weekends under the existing plan. Persist policy and UTC due time using IANA timezone rules. A later retry must not move the original +2-hour anchor. Late work becomes eligible now; never backdate the effect.

### D4. Monitoring and recovery

Journey states: draft, active, paused, blocked, completed, cancelled. Each step shows prerequisites, exact intended effect, due time, latest attempt, actual result and next action.

Controls: preview, approve/reapprove, start, pause, resume, cancel remaining steps, revise proposal, retry confirmed failure, inspect/reconcile unknown outcome, repair expired invite via the approved access flow.

Pause/cancel fences future actions with a generation/version check immediately before effects. An already accepted message cannot be unsent. Resuming skips successful work. Invoice, membership/invitation, activation email and thank-you have separate durable records; one failure does not recreate the others.

Cancelling remaining journey steps does not void an agreement, refund an invoice, revoke membership or cancel a subscription. Those are separate explicit actions.

### D5. Client setup checklist

1. Confirm contact and organisation details.
2. Review/sign the designated agreement.
3. Complete applicable billing setup/payment obligation.
4. Submit required approved assets through the secure path.
5. Confirm kickoff from founder-provided availability.
6. See FSS's confirmed readiness/start conditions.

Profile fields and optional preparation tasks can be marked complete by the appropriate user. Signature/payment/upload evidence is derived from authoritative records, never a generic client checkbox. Checklist progress counts completed required tasks over total required tasks; no arbitrary “10%” value. Show the owner of each pending task and the next useful action. Do not block already-authorised portal access solely because service work cannot start.
