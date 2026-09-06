# Client portal and request-board specification

Status: Proposed. See [roles](01-product-specification.md) and [security](02-architecture-data-security.md).

## Screens and content

| Screen         | Main content and actions                                                                       | Empty/error handling                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Home           | Agreed goals, current milestone, next action, things waiting on client, next invoice           | “Your workspace is ready. Your project schedule will appear here.” No fabricated progress |
| Projects       | Active and completed work, scope, target date, owner, public milestones                        | Explain when scheduling is awaiting assets/deposit                                        |
| Project detail | Outcome, deliverables, milestone timeline, updates, linked requests/documents                  | Internal estimates and comments absent from response                                      |
| Requests       | Kanban and accessible list, filters, “New request”                                             | Explain state labels and acknowledgement target                                           |
| Request detail | Description, state, scope decision, public thread, attachment/review history                   | Failed submission preserves draft and offers retry                                        |
| Help           | Create help request, agreed support hours, urgent incident route                               | Do not promise 24/7 human support unless sold                                             |
| Services       | Approved packages, inclusions, exclusions, enquiry action                                      | Hide unpublished offers; display quote-based pricing when no fixed price approved         |
| Documents      | Welcome pack, signed agreement, deliverables and accessible summaries                          | Expired file URL can be regenerated after authorisation                                   |
| Billing        | Outstanding/paid invoices, due dates, payment/mandate status, hosted payment-management action | Provider outage leaves last-known status and safe retry; never fake success               |
| Account        | Contact data, memberships, notification preferences, newsletter choice                         | Transactional and marketing preferences distinguished                                     |

Use existing FSS typography/tokens and shared components. On mobile, show lists by default; do not squeeze a multi-column board into the viewport. Keyboard users can change status through a menu; drag-and-drop is optional, never the only control. Label controls, announce saved state with a live region, preserve focus, avoid colour-only status and honour reduced motion. Target WCAG 2.2 AA with manual keyboard and screen-reader verification.

## Request creation contract

Required: project/service context, title (1–160 characters), description (1–10,000), request type (work/change/bug/help) and desired outcome. Optional: desired date, impact, attachments. Urgency is the client's reported impact; founder sets operational priority. Ask for reproduction steps and expected/actual behaviour only when bug type is selected.

Server verifies membership, project scope, input limits and request idempotency key. Same submission key returns the existing request. Response supplies request reference, submitted time and current acknowledgement target. Attachments remain quarantined until cleared. Strip disallowed rich content; launch with plain text or a limited safe formatting subset.

## State machine

| From              | To                | Who                                 | Requirement                                                          |
| ----------------- | ----------------- | ----------------------------------- | -------------------------------------------------------------------- |
| New               | Acknowledged      | Founder                             | Owner and scope classification or explicit “assessment pending”      |
| Acknowledged      | Planned           | Founder                             | Scope approved/included and next action; optional agreed target date |
| Planned           | In progress       | Founder                             | Assignee, capacity available, any deposit/start gates satisfied      |
| In progress       | Ready for review  | Founder                             | Deliverable version, review instructions and public summary          |
| Ready for review  | Done              | Client owner or designated reviewer | Explicit acceptance of current version                               |
| Ready for review  | Changes requested | Client owner or designated reviewer | Feedback required; preserve original review record                   |
| Changes requested | In progress       | Founder                             | Confirm included revision or begin scope-change assessment           |
| Any open state    | Cancelled         | Founder                             | Reason; notify client; no deletion                                   |
| Done              | Acknowledged      | Founder                             | Reopen reason, audit and new review cycle; distinguish new scope     |

“Blocked” is a flag on an open state, with blocked_since, reason, responsible party and next check date. It does not destroy the underlying workflow state. A client contributor can suggest cancellation or submit feedback; only designated reviewers accept deliverables. Founder can administratively close with recorded reason, clearly labelled “Closed by FSS”, not client acceptance.

## Scope and capacity

Classify each request as included, assessment_pending, quote_required or declined_with_reason. Acknowledgement does not consume the client's commercial approval. Quote-required work links to a new approved agreement/change order and cannot enter In progress until accepted. Acceptance of a quote does not automatically charge a stored method unless the signed billing terms authorise it.

Track included allowance in its contractual unit: hours, tasks or milestones, with approved adjustment history. Do not invent unlimited support. Initial WIP policy: proposed maximum three In progress items per delivery owner. Founder may override with reason. Review capacity weekly and revise the number using actual throughput.

## Notifications

Immediate transactional notifications: request received, meaningful status change, new public comment, review requested, acceptance and billing action required. Do not notify for every internal edit or board reorder. Daily digest is an optional client preference for ordinary updates. Mentions resolve only within the organisation; do not accept arbitrary email recipients.

Founder work queue includes requests unacknowledged after one business day and review waiting after three business days. These thresholds are proposed internal reminders. Business clock: Monday–Friday 09:00–17:00 Europe/London, excluding configured England/Wales bank holidays. Holiday source and maintenance are a build-kickoff choice. No automatic completion after silence. Urgent incidents follow the contracted escalation route and may be logged as a high-priority help request.

## Offers and AI receptionist enquiry

An offer has approved name, outcome, audience, inclusions, exclusions, setup needs, support hours, recurring/one-off pricing display policy and status. Suggested launch categories: maintenance/care, hosting/support, website improvements and AI call receptionist. These are catalog candidates, not approved products or promises.

Receptionist enquiry asks about call volume, operating hours, booking/CRM systems, transfer contact and desired handling of missed calls. Describe 24/7 automated answering only if service capability is verified; human escalation remains subject to its actual hours. Do not promise emergency handling, perfect accuracy or guaranteed conversion. Recording/transcript retention, caller notice, data processing, fallback routing and spending limits belong in that service's later design. Enquiries create an owner/next-action item linked to the organisation, not a live subscription.

## Acceptance scenarios

- Client A guesses Client B request, attachment, search and invoice IDs: every surface denies disclosure.
- Billing-only contact cannot access delivery editing; contributor cannot create payment-management sessions.
- Two founder tabs update the same request version: second returns conflict, preserves its draft and reloads current state.
- Client accepts deliverable v1 while v2 is current: conflict; no v2 acceptance recorded.
- Internal comment never appears in HTML, API response, notification, activity feed or export.
- Client requests extra package: enquiry created, no price mutation, charge or service activation.
- 375 px viewport, keyboard-only status changes and screen-reader notification paths remain usable.
