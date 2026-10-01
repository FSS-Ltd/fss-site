# Screen contracts and acceptance criteria

## Scope and interpretation

This inventory now defines 95 screen references: 32 client, 43 founder, 10 shared states, 2 emails and 8 mobile layouts. The seven additions cover active client onboarding, client-scoped agreements and requests, client signing status, and Studio project registers and creation. Screen IDs are stable across editable SVG references, the preview browser and content manifest. Five initial screen IDs also exist as native Figma frames; the remaining references are in the local atlas pending Figma capacity.

Routes below are **proposed interface locations**, not a claim that every route exists in the checkout. The existing portal already has login, activate, projects, requests, agreements, billing, services and onboarding routes. Prefer adapting the existing `/portal/onboarding` surface for Getting started rather than duplicating it under a new route. Preserve existing founder routes and services; map the information architecture before changing URLs. `?state=` examples are design scenarios, never a trusted way to set domain state. Always resolve organisation and capabilities from authenticated server context, not a query string alone.

## Common acceptance requirements

- **Loading:** structural skeleton, stable navigation, one accessible status. Do not show invented counts or empty-state copy until the query resolves.
- **Empty:** explain the missing data, who can fix it and the exact next action. Dependency failures and permission denials are not empty lists.
- **Error:** a safe, actionable message; preserved draft/filter/selection; retry only where safe; correlation reference for support. Never render raw database/provider errors.
- **Forms:** persistent labels; required fields identified; examples/helper copy; inline errors and linked error summary; pending state; duplicate protection; acknowledgement before success; unsaved-change protection for long editors.
- **Success:** retain the server record/version, update relevant lists and show a persistent result. A success illustration is conditional on its contract, not on clicking a button.
- **Permissions:** enforce organisation and capability at every server read/command/download. Show helpful read-only views when possible. Hide unrelated private/internal data, even from client owners.
- **Navigation:** retain client/project context, restore list filters and focus, use meaningful titles and breadcrumbs. No bare UUID selector. All links have a real destination or an explained unavailable state.
- **Accessibility:** semantic landmarks, labels and headings, 44 px target design, visible keyboard focus, 200% zoom, 320 px reflow, reduced motion, contrast checks, focus management for dialogs and click/tap alternatives to drag.
- **Responsive:** desktop sidebar becomes role-appropriate mobile navigation. Cards and fields stack; dense data has a deliberate list alternative. Drawers become full-width sheets. The eight mobile references establish the rules for every other screen.
- **Overlays:** upload, task editor, feedback, transition and confirmation surfaces use the same field/button components. Desktop maximum 640 px for a focused editor, 880 px for document review; mobile fills available width with 20 px padding. Title/close at top, error summary below title, labelled fields, explicit primary/cancel actions, focus trap and restored trigger focus.
- **Data:** all names, amounts, dates, progress and status in the drawings are synthetic examples. Derive the production equivalents from authorised records; hide non-applicable metrics rather than manufacturing values.

Workflow contracts take precedence over illustrative labels. The gallery is a screen browser with reference links, not a working business application or a complete interaction prototype. In production, no operation may skip validation, acknowledgement, signature evidence or notification deduplication because its next reference image is a success state.

## Screen index

| ID | Surface | Screen | Primary action |
|---|---|---|---|
| C00 | Client | [Welcome to your FSS workspace](./wireframes.html#C00) | Continue |
| C01 | Client | [Good morning, Alex.](./wireframes.html#C01) | New request |
| C02 | Client | [Let’s get you ready.](./wireframes.html#C02) | Continue setup |
| C03 | Client | [Your projects](./wireframes.html#C03) | Open active project |
| C04 | Client | [Website & booking experience](./wireframes.html#C04) | New request |
| C05 | Client | [Requests & feedback](./wireframes.html#C05) | New request |
| C06 | Client | [What would you like us to do?](./wireframes.html#C06) | Submit request |
| C07 | Client | [Report a problem](./wireframes.html#C07) | Submit bug report |
| C08 | Client | [Booking confirmation email](./wireframes.html#C08) | Send comment |
| C09 | Client | [Ready for your review](./wireframes.html#C09) | Open preview |
| C10 | Client | [What needs changing?](./wireframes.html#C10) | Send feedback |
| C11 | Client | [All done.](./wireframes.html#C11) | Back to requests |
| C12 | Client | [Your documents](./wireframes.html#C12) | Upload document |
| C13 | Client | [Booking flow · version 3](./wireframes.html#C13) | Download file |
| C14 | Client | [Your agreements](./wireframes.html#C14) | Review agreement |
| C15 | Client | [Your agreement, clearly explained.](./wireframes.html#C15) | Continue to signing |
| C16 | Client | [Review and sign](./wireframes.html#C16) | Sign agreement |
| C17 | Client | [Billing, at a glance](./wireframes.html#C17) | View next invoice |
| C18 | Client | [Invoice INV-2026-041](./wireframes.html#C18) | Download invoice |
| C19 | Client | [Support for what comes next.](./wireframes.html#C19) | Ask about a service |
| C20 | Client | [Tell us what you need](./wireframes.html#C20) | Send enquiry |
| C21 | Client | [Your updates](./wireframes.html#C21) | Mark all as read |
| C22 | Client | [How can we help?](./wireframes.html#C22) | Create help request |
| C23 | Client | [Your preferences](./wireframes.html#C23) | Save preferences |
| C24 | Client | [Your team](./wireframes.html#C24) | Request access change |
| C25 | Client | [Choose your workspace](./wireframes.html#C25) | Open Northstar |
| F01 | Founder | [Your studio, in focus.](./wireframes.html#F01) | View delivery |
| F02 | Founder | [Your clients](./wireframes.html#F02) | Add client |
| F03 | Founder | [Northstar Studio](./wireframes.html#F03) | Prepare welcome |
| F04 | Founder | [Add a client](./wireframes.html#F04) | Save client |
| F05 | Founder | [Delivery board](./wireframes.html#F05) | New request |
| F06 | Founder | [Booking confirmation email](./wireframes.html#F06) | Post public update |
| F07 | Founder | [Send work for review](./wireframes.html#F07) | Publish review |
| F08 | Founder | [Assess scope and next steps](./wireframes.html#F08) | Save assessment |
| F09 | Founder | [Agreements](./wireframes.html#F09) | New agreement |
| F10 | Founder | [Create an agreement](./wireframes.html#F10) | Continue to scope |
| F11 | Founder | [Define the work](./wireframes.html#F11) | Continue to fees |
| F12 | Founder | [Fees, schedule and terms](./wireframes.html#F12) | Continue to people |
| F13 | Founder | [People and responsibilities](./wireframes.html#F13) | Continue to document |
| F14 | Founder | [Prepare the agreement document](./wireframes.html#F14) | Generate & preview |
| F15 | Founder | [Review before sending](./wireframes.html#F15) | Approve signing request |
| F16 | Founder | [Link the work first](./wireframes.html#F16) | Link selected engagement |
| F17 | Founder | [Signed and recorded](./wireframes.html#F17) | Prepare welcome |
| F18 | Founder | [Welcome journeys](./wireframes.html#F18) | Create journey |
| F19 | Founder | [Prepare a warm welcome](./wireframes.html#F19) | Continue to content |
| F20 | Founder | [Make the welcome personal](./wireframes.html#F20) | Continue to access |
| F21 | Founder | [People, signing and access](./wireframes.html#F21) | Continue to schedule |
| F22 | Founder | [Sequence the next steps](./wireframes.html#F22) | Review journey |
| F23 | Founder | [Ready when you are.](./wireframes.html#F23) | Start journey |
| F24 | Founder | [Northstar’s welcome journey](./wireframes.html#F24) | Pause journey |
| F25 | Founder | [Resolve delivery safely](./wireframes.html#F25) | Check delivery |
| F26 | Founder | [Welcome templates](./wireframes.html#F26) | Save template draft |
| F27 | Founder | [Billing operations](./wireframes.html#F27) | Open exceptions |
| F28 | Founder | [People and portal access](./wireframes.html#F28) | Review invitation |
| F29 | Founder | [Notification delivery](./wireframes.html#F29) | Open failed deliveries |
| F30 | Founder | [Studio settings](./wireframes.html#F30) | Save settings draft |
| F31 | Founder | [Shape the client’s project view](./wireframes.html#F31) | Save project |
| F32 | Founder | [Create an engagement](./wireframes.html#F32) | Create & link engagement |
| S01 | Client | [Your first request starts here.](./wireframes.html#S01) | New request |
| S02 | Client | [Connect your project first](./wireframes.html#S02) | Ask FSS for help |
| S03 | Client | [This request has changed.](./wireframes.html#S03) | Review latest version |
| S04 | Client | [We couldn’t load your workspace.](./wireframes.html#S04) | Try again |
| S05 | Client | [This invitation has expired.](./wireframes.html#S05) | Request a new invitation |
| S06 | Founder | [Two things need your attention.](./wireframes.html#S06) | Review missing details |
| S07 | Client | [Your file is being checked.](./wireframes.html#S07) | Back to documents |
| S08 | Founder | [Move work to Ready for review](./wireframes.html#S08) | Publish review |
| S09 | Client | [Loading your requests…](./wireframes.html#S09) | None |
| S10 | Client | [You have read-only access.](./wireframes.html#S10) | View project |
| E01 | Client | [Your update is ready.](./wireframes.html#E01) | Review the update |
| E02 | Client | [All done.](./wireframes.html#E02) | View completed work |
| F33 | Founder | [Build the client checklist](./wireframes.html#F33) | Save checklist |
| F34 | Founder | [Record a signed agreement](./wireframes.html#F34) | Review signed evidence |
| M01 | Client | [Good morning, Alex.](./wireframes.html#M01) | New request |
| M02 | Client | [Let’s get you ready.](./wireframes.html#M02) | Continue setup |
| M03 | Client | [Requests & feedback](./wireframes.html#M03) | New request |
| M04 | Client | [Report a problem](./wireframes.html#M04) | Submit bug report |
| M05 | Client | [Ready for your review](./wireframes.html#M05) | Open preview |
| M06 | Client | [Your agreement, clearly explained.](./wireframes.html#M06) | Continue to signing |
| M07 | Founder | [Your studio, in focus.](./wireframes.html#M07) | View delivery |
| M08 | Founder | [Ready when you are.](./wireframes.html#M08) | Start journey |
| C26 | Client | [Tell us about your team](./wireframes.html#C26) | Save profile |
| C27 | Client | [Bring your brand with you](./wireframes.html#C27) | Submit assets |
| C28 | Client | [Let’s plan the kickoff](./wireframes.html#C28) | Choose a time |
| C29 | Client | [You’re ready for the next step.](./wireframes.html#C29) | View your project |
| C30 | Client | [Signed. A clear beginning.](./wireframes.html#C30) | Continue setup |
| C31 | Client | [Set up your FSS workspace](./wireframes.html#C31) | Create organisation |
| F35 | Founder | [Create a useful next step](./wireframes.html#F35) | Save task |
| F36 | Founder | [Create work for a client](./wireframes.html#F36) | Create request |
| F37 | Founder | [Signing request prepared](./wireframes.html#F37) | View signing status |
| F38 | Founder | [Northstar Studio: agreements](./wireframes.html#F38) | New agreement |
| F39 | Founder | [Client requests](./wireframes.html#F39) | Open request |
| F40 | Founder | [Signing status](./wireframes.html#F40) | Back to agreements |
| F41 | Founder | [Project workspace](./wireframes.html#F41) | Plan a project |
| F42 | Founder | [Plan a project](./wireframes.html#F42) | Create project |
| F43 | Founder | [Document register](./wireframes.html#F43) | Open client context |

## C00 · Welcome to your FSS workspace

**Audience:** Client. **Navigation:** Home.

**Proposed location:** `/portal/login`.

**Purpose:** One place for your project, feedback and next steps.

**Primary action:** Continue.

**Required behaviour and acceptance:** Use Clerk's supported sign-in flow. Submitting the invited email continues authentication; never create organisation access from the email alone. Preserve a safe internal return path. Show invalid credentials, pending authentication and invitation assistance without disclosing whether unrelated accounts exist.

[Full-size editable wireframe](./wireframes/C00.svg) · [Open in screen browser](./wireframes.html#C00)

### Exact illustrated content

**Good work starts here.** (hero)

Sign in with your invited email to see your workspace. Your project updates and decisions stay together.

**Sign in** (fields)

- Email address — alex@northstar.example — Use the email on your invitation.

**Have an invitation?** (notice)

Open the invitation link to activate your approved access. Need a fresh link? Request access help.


## C01 · Good morning, Alex.

**Audience:** Client. **Navigation:** Home.

**Proposed location:** `/portal?organisationId=:org`.

**Purpose:** Here is where things stand with Northstar Studio.

**Primary action:** New request.

**Required behaviour and acceptance:** Prioritise outstanding client decisions, then setup tasks and the next milestone. Each count is backed by authorised records. The primary next step opens the exact item; New request remains visible. If nothing needs attention, say so and show the latest meaningful update rather than empty metrics.

[Full-size editable wireframe](./wireframes/C01.svg) · [Open in screen browser](./wireframes.html#C01)

### Exact illustrated content

**Your booking flow is ready.** (hero)

Review the updated prototype and tell us whether it meets the agreed outcome.

Action: **Review the update**.

- 1 — Waiting for you

- 3 — In delivery

- 24 Sep — Next milestone

**Your next steps** (rows)

- Review booking flow · v3 — Ready for review · Alex Morgan · requested today — Open review

- Upload your approved brand assets — Needed before development · due 18 Sep — Add assets

**Your project** (rows)

- Website & booking experience — Design phase · Jean-Fidele · next update Friday — View project

- Latest update — The booking journey is ready for your review. Development starts after approval. — Read update


## C02 · Let’s get you ready.

**Audience:** Client. **Navigation:** Getting started.

**Proposed location:** `/portal/getting-started`.

**Purpose:** Three of six steps complete. Your progress is saved as you go.

**Primary action:** Continue setup.

**Required behaviour and acceptance:** Render assigned checklist tasks from the activated journey. Each task has an owner, due date, required/optional status, progress and a specific action. Profile tasks open labelled fields, asset tasks open an upload sheet, booking tasks open the configured booking destination, and agreement tasks open the agreement. Only verified outcomes complete required tasks; explain blocked prerequisites.

[Full-size editable wireframe](./wireframes/C02.svg) · [Open in screen browser](./wireframes.html#C02)

### Exact illustrated content

**Next: share your brand assets.** (hero)

Add your approved logo, brand guide and final copy so we can prepare your project.

Action: **Upload assets**.

**Your launch checklist** (timeline)

- ✓ — Confirm your details — Completed · 12 Sep

- ✓ — Review and sign your agreement — Signed · revision 2

- ✓ — Set up billing — Deposit paid · £1,200

- 4 — Share brand assets — Your action · logo, brand guide and approved copy

- 5 — Confirm kickoff — Choose from the times offered by FSS

- 6 — Ready to begin — FSS confirms the start after all prerequisites are met


## C03 · Your projects

**Audience:** Client. **Navigation:** Projects.

**Proposed location:** `/portal/projects`.

**Purpose:** Clear outcomes, visible milestones and a named owner.

**Primary action:** Open active project.

**Required behaviour and acceptance:** Show only shared projects with actual stage, next milestone and next action. Open the selected project with organisation context retained. Empty states explain whether setup is pending or no projects are shared.

[Full-size editable wireframe](./wireframes/C03.svg) · [Open in screen browser](./wireframes.html#C03)

### Exact illustrated content

- 1 — Active project

- 1 — Awaiting your review

- 1 — Completed project

**Active work** (rows)

- Website & booking experience — Design · next milestone 24 Sep · Jean-Fidele — Open project

**Completed work** (rows)

- Brand landing page — Delivered 28 Aug · handover available — View handover


## C04 · Website & booking experience

**Audience:** Client. **Navigation:** Projects.

**Proposed location:** `/portal/projects/:project`.

**Purpose:** Northstar Studio · Project NS-001 · Jean-Fidele

**Primary action:** New request.

**Required behaviour and acceptance:** Show the agreed outcome, stage, next milestone, named owner, client actions, approved deliverables and chronological public updates. A linked handover section contains final files, access instructions and support terms. Internal delivery notes never appear.

[Full-size editable wireframe](./wireframes/C04.svg) · [Open in screen browser](./wireframes.html#C04)

### Exact illustrated content

**A simpler route from enquiry to booking.** (hero)

Current milestone: approve the booking experience. Target: 24 September, subject to feedback.

Action: **Review milestone**.

**Delivery plan** (timeline)

- ✓ — Discover — Goals and scope agreed

- 2 — Design — Booking flow ready for your review

- 3 — Build — Starts after design approval and assets

- 4 — Launch & handover — Readiness checks, training and acceptance

**Project workspace** (rows)

- Agreed scope — Booking journey, five content pages and contact workflow — Read scope

- Requests & decisions — 7 requests · 1 waiting for review — Open board

- Files & deliverables — Brand guide, approved copy and design v3 — View files


## C05 · Requests & feedback

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests`.

**Purpose:** A shared view of what is coming, moving and ready for you.

**Primary action:** New request.

**Required behaviour and acceptance:** Default to the six-lane Kanban. Provide list view, server-backed filters and counts, accessible Move to, and role-limited drag. Opening a card shows C08; review opens C09. Apply workflow A for every transition; a drop alone never accepts work.

[Full-size editable wireframe](./wireframes/C05.svg) · [Open in screen browser](./wireframes.html#C05)

### Exact illustrated content

**How your board works** (notice)

FSS plans and progresses delivery. You can accept a review or request changes. Open a card for its next action and discussion.


## C06 · What would you like us to do?

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests/new`.

**Purpose:** A clear request helps us give you a useful next step.

**Primary action:** Submit request.

**Required behaviour and acceptance:** Implement all fields and limits in workflow A1. Preselect project when launched from project detail. Persist through the existing authenticated command with an idempotency key. Show a request reference only after acknowledgement. Zero eligible projects uses S02.

[Full-size editable wireframe](./wireframes/C06.svg) · [Open in screen browser](./wireframes.html#C06)

### Exact illustrated content

**Request type** (choices)

- New work

- Change

- Bug report

- Help

**Your request** (fields)

- Project — Website & booking experience  ⌄ — Only projects you can access appear here.

- Request title — Add a booking confirmation email

- Description — Send customers a confirmation with the appointment details.

- What does success look like? — Customers receive the right time, location and booking reference.

**Useful context** (fields)

- Desired date · optional — 25 September 2026 — A requested date is not yet an agreed delivery date.

- Impact · optional — Customers currently need to call us to confirm.

**Attachments** (notice)

Add a screenshot or document once secure uploads are enabled. Use your agreed secure sharing route for credentials.


## C07 · Report a problem

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests/new?type=bug`.

**Purpose:** Tell us what happened so we can reproduce it.

**Primary action:** Submit bug report.

**Required behaviour and acceptance:** Require reproduction steps, expected result and actual result. Capture client impact separately from founder priority. Allow safe attachments and optional URL/browser details; show upload progress and rejected-file reasons. Do not require a client to classify technical severity.

[Full-size editable wireframe](./wireframes/C07.svg) · [Open in screen browser](./wireframes.html#C07)

### Exact illustrated content

**Request type** (choices)

- New work

- Change

- Bug report

- Help

**The problem** (fields)

- Project — Website & booking experience  ⌄

- Short title — Booking confirmation shows the wrong time

- Steps to reproduce — 1. Choose a 10:00 slot.
2. Complete a test booking.
3. Open the confirmation email.

- What you expected — The email should show 10:00 Europe/London.

- What happened instead — The email shows 09:00.

**Impact & environment** (fields)

- Impact — Incorrect appointment time for customers

- Page URL · optional — https://northstar.example/book

- Browser / device · optional — Safari · iPhone


## C08 · Booking confirmation email

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests/:request`.

**Purpose:** NS-014 · New work · Website & booking experience

**Primary action:** Send comment.

**Required behaviour and acceptance:** Provide public activity, attachments, state, ownership, agreed dates and next action. Save comments with pending and retry states. Show public comments only. Founder-only details require the founder view. An empty discussion invites the first comment.

[Full-size editable wireframe](./wireframes/C08.svg) · [Open in screen browser](./wireframes.html#C08)

### Exact illustrated content

**In progress** (notice)

Jean-Fidele is building the email template. Next update: Friday.

**Request details** (rows)

- Desired outcome — Customers receive the correct time and booking reference.

- Scope — Included in your agreed booking workflow.

- Target — 24 September · agreed after assessment

**Latest conversation** (rows)

- Jean-Fidele · today, 10:32 — The template is built. I’m checking the time zone and mobile layout.

- Alex · yesterday, 15:10 — Please include our studio address in the confirmation.

**Add a comment** (fields)

- Your message — Write a message to your FSS team…

**History** (rows)

- Acknowledged → Planned → In progress — Owner: Jean-Fidele · 3 public updates — View history


## C09 · Ready for your review

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests/:request/review`.

**Purpose:** NS-014 · Booking confirmation email · Version 3

**Primary action:** Open preview.

**Required behaviour and acceptance:** Bind review to the exact cycle and version. Show what changed, what to check and the retained deliverable. Authorised reviewers can explicitly accept that version or request changes. Superseded versions show S03 and cannot be accepted.

[Full-size editable wireframe](./wireframes/C09.svg) · [Open in screen browser](./wireframes.html#C09)

### Exact illustrated content

**Does this meet the agreed outcome?** (hero)

Check the time, studio address and booking reference in the preview. Your decision applies to version 3.

Action: **Open preview**.

**What changed** (rows)

- Correct local time — Bookings now display Europe/London time.

- Clearer appointment details — The confirmation includes the address, date and booking reference.

**Your decision** (notice)

Accept this version when you are happy with the agreed work, or request changes with specific feedback.

**Review version 3** (review)

I confirm this deliverable meets the agreed requirements.

Actions: Accept version 3; Request changes.


## C10 · What needs changing?

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests/:request/review?decision=changes`.

**Purpose:** Your feedback stays attached to version 3.

**Primary action:** Send feedback.

**Required behaviour and acceptance:** Require clear feedback before sending. Preserve the draft after failure. Submit against the current cycle/version. Record the decision, notify the founder, and return to the updated detail. Cancelling leaves the review unchanged.

[Full-size editable wireframe](./wireframes/C10.svg) · [Open in screen browser](./wireframes.html#C10)

### Exact illustrated content

**Feedback** (fields)

- Required changes — The confirmation needs to include our cancellation contact.

- Why this matters · optional — Customers should know who to contact before their appointment.

**What happens next** (notice)

FSS will assess your feedback and confirm whether it is included in the agreed revision scope. No additional charge is created by this feedback.


## C11 · All done.

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests/:request?state=done`.

**Purpose:** NS-014 · Booking confirmation email

**Primary action:** Back to requests.

**Required behaviour and acceptance:** Display accepted version, actor and timestamp, final files and next support step. An administrative closure uses distinct wording and a reason. Follow-up work creates a linked new request; it does not silently alter the accepted version.

[Full-size editable wireframe](./wireframes/C11.svg) · [Open in screen browser](./wireframes.html#C11)

### Exact illustrated content

**Version 3 accepted.** (hero)

Accepted by Alex Morgan on 15 September at 14:12. The final files and review history are available below.

Action: **View final deliverable**.

**Completion record** (rows)

- Accepted outcome — Correct local time, studio address and booking reference.

- Final deliverable — Booking confirmation email · v3 · accepted

- Need something else? — Start a linked follow-up so the completed record stays intact. — New follow-up


## C12 · Your documents

**Audience:** Client. **Navigation:** Documents.

**Proposed location:** `/portal/documents`.

**Purpose:** Approved files, agreements and deliverables in one place.

**Primary action:** Upload document.

**Required behaviour and acceptance:** List entitled documents with category, version, date and access-safe download. Search/filter across the full authorised collection. Upload opens a labelled sheet with file picker, category and optional description; show progress, quarantine, failure and success. No raw storage keys are editable.

[Full-size editable wireframe](./wireframes/C12.svg) · [Open in screen browser](./wireframes.html#C12)

### Exact illustrated content

**Filter documents** (choices)

- All files

- Deliverables

- Agreements

- Welcome

**Shared with Northstar Studio** (rows)

- Booking flow · v3 — Deliverable · 15 Sep · ready for review — Open file

- Website agreement · revision 2 — Signed agreement · 12 Sep — View agreement

- Your welcome guide — Getting started · accessible web version available — Read guide

- Brand guide · v1 — Client asset · verified and ready — Open file


## C13 · Booking flow · version 3

**Audience:** Client. **Navigation:** Documents.

**Proposed location:** `/portal/documents/:document`.

**Purpose:** Shared by Jean-Fidele · 15 September 2026

**Primary action:** Download file.

**Required behaviour and acceptance:** Use authenticated previews and short-lived download access. Show filename, version, owner and publication date. If a format cannot be previewed, provide a clear download alternative. Unavailable or revoked files reveal no private location.

[Full-size editable wireframe](./wireframes/C13.svg) · [Open in screen browser](./wireframes.html#C13)

### Exact illustrated content

**Booking experience** (document)

01  Choose your appointment
02  Confirm the details
03  Receive your booking confirmation

**File information** (rows)

- Access — Shared with your project team

- Version history — v3 current · v2 superseded · v1 superseded

- Related request — NS-014 · Ready for review — Open request


## C14 · Your agreements

**Audience:** Client. **Navigation:** Agreements.

**Proposed location:** `/portal/agreements`.

**Purpose:** Know what is included, what it costs and what happens next.

**Primary action:** Review agreement.

**Required behaviour and acceptance:** Separate awaiting review/signature, active and archived agreements. Show title, project, version, parties and status with the correct next action. Do not treat viewed as signed.

[Full-size editable wireframe](./wireframes/C14.svg) · [Open in screen browser](./wireframes.html#C14)

### Exact illustrated content

**Action needed** (rows)

- Website & booking experience — Revision 2 · awaiting your signature · Alex Morgan — Review agreement

**Signed agreements** (rows)

- Brand landing page — Signed 28 August · all signatures complete — View signed copy


## C15 · Your agreement, clearly explained.

**Audience:** Client. **Navigation:** Agreements.

**Proposed location:** `/portal/agreements/:agreement`.

**Purpose:** Website & booking experience · Revision 2

**Primary action:** Continue to signing.

**Required behaviour and acceptance:** Summarise scope, exclusions, milestones, fees, billing schedule, dependencies and parties alongside the complete agreement. Provide download and version history. The summary never overrides the signed document; flag a newer version explicitly.

[Full-size editable wireframe](./wireframes/C15.svg) · [Open in screen browser](./wireframes.html#C15)

### Exact illustrated content

- £4,800 — One-off total

- £1,200 — Initial deposit

- 4 — Delivery milestones

**At a glance** (rows)

- What we will deliver — Five content pages, booking workflow, confirmation email and handover.

- What you provide — Approved brand assets, website copy and one authorised reviewer.

- Payment schedule — £1,200 deposit + 3 milestone payments of £1,200. Tax follows the agreement.

- Support & changes — Agreed defect support and a separate quote for additional scope.

**Full agreement** (document)

Scope, fees, delivery assumptions, responsibilities, support and terms.


## C16 · Review and sign

**Audience:** Client. **Navigation:** Agreements.

**Proposed location:** `/portal/agreements/:agreement/sign`.

**Purpose:** Website & booking experience · Revision 2

**Primary action:** Sign agreement.

**Required behaviour and acceptance:** Use the existing approved signing path for the named signer and exact immutable agreement version. Show consent, identity and confirmation before submission. Signed success requires verified signing evidence; cancel and provider failure preserve the unsigned state. Unauthorised users can read only when otherwise entitled.

[Full-size editable wireframe](./wireframes/C16.svg) · [Open in screen browser](./wireframes.html#C16)

### Exact illustrated content

**Signing as Alex Morgan** (notice)

You are a designated signer for Northstar Studio. Your verified email is alex@northstar.example.

**Agreement revision 2** (document)

The exact document you are signing is shown here. Download an accessible copy or read the full text.

**Your signature** (fields)

- Full legal name — Alex Morgan

- Role / position — Director

**Confirm your agreement** (review)

I have read this agreement and am authorised to sign on behalf of Northstar Studio.

Actions: Sign agreement; Back to agreement.


## C17 · Billing, at a glance

**Audience:** Client. **Navigation:** Billing.

**Proposed location:** `/portal/billing`.

**Purpose:** Invoices, payments and your agreed schedule.

**Primary action:** View next invoice.

**Required behaviour and acceptance:** Show current invoices, payment state and next contractual payment. Restrict to billing capabilities. Never infer payment success from a redirect. Unavailable billing data shows a retry rather than a zero balance.

[Full-size editable wireframe](./wireframes/C17.svg) · [Open in screen browser](./wireframes.html#C17)

### Exact illustrated content

- £1,200 — Next payment

- 24 Sep — Payment due

- £1,200 — Paid to date

**Invoices** (rows)

- INV-2026-041 · Design milestone — £1,200 · due 24 September · Awaiting payment — View invoice

- INV-2026-034 · Initial deposit — £1,200 · paid 12 September — Download receipt

**Payment details** (rows)

- Payment method — Manage securely with our payment provider. — Manage billing

- Billing contact — Alex Morgan · alex@northstar.example — Contact FSS


## C18 · Invoice INV-2026-041

**Audience:** Client. **Navigation:** Billing.

**Proposed location:** `/portal/billing/invoices/:invoice`.

**Purpose:** Northstar Studio · Design milestone

**Primary action:** Download invoice.

**Required behaviour and acceptance:** Show invoice line items, tax/total as recorded, due date, recipient and confirmed payment state. Download the retained invoice. Pay securely creates or opens the existing provider flow; webhooks reconcile results. Paid invoices offer a receipt instead of Pay.

[Full-size editable wireframe](./wireframes/C18.svg) · [Open in screen browser](./wireframes.html#C18)

### Exact illustrated content

**£1,200 due 24 September** (hero)

Issued 15 September · Website & booking experience · GBP

Action: **Pay securely**.

**Invoice breakdown** (rows)

- Design milestone — 1 × £1,200

- Tax treatment — As recorded on the issued invoice

- Amount due — £1,200

**Payment status** (notice)

Awaiting payment. If you have just paid, we will update this page when the provider confirms it.


## C19 · Support for what comes next.

**Audience:** Client. **Navigation:** Services.

**Proposed location:** `/portal/services`.

**Purpose:** Your services and ways we can help.

**Primary action:** Ask about a service.

**Required behaviour and acceptance:** Show relevant service offers and what each includes. Distinguish an enquiry from a purchase or contract change. Avoid unsupported price promises; any displayed rate must come from the approved catalogue.

[Full-size editable wireframe](./wireframes/C19.svg) · [Open in screen browser](./wireframes.html#C19)

### Exact illustrated content

**Your active services** (rows)

- Website delivery — Website & booking experience · in delivery — View scope

**Explore services** (rows)

- Website care — Maintenance, updates and agreed support. Scope and pricing confirmed in a proposal. — Explore care

- Workflow improvements — Remove repetitive steps with focused automation. — Discuss an idea

**A conversation first** (notice)

An enquiry starts a discussion. It does not activate a service or charge your payment method.


## C20 · Tell us what you need

**Audience:** Client. **Navigation:** Services.

**Proposed location:** `/portal/services/:offer/enquire`.

**Purpose:** Website care · Service enquiry

**Primary action:** Send enquiry.

**Required behaviour and acceptance:** Capture the selected service, desired outcome, timeframe and contact. On acknowledged submission create a tracked enquiry and show its reference/next step. No new paid service is activated by submitting this form.

[Full-size editable wireframe](./wireframes/C20.svg) · [Open in screen browser](./wireframes.html#C20)

### Exact illustrated content

**Your enquiry** (fields)

- What would you like help with? — Keeping our site updated after launch.

- Preferred start · optional — After the website launch

- Main contact — Alex Morgan · alex@northstar.example

**Next step** (notice)

FSS will review your enquiry and follow up with a proposed scope and price.


## C21 · Your updates

**Audience:** Client. **Navigation:** Notifications.

**Proposed location:** `/portal/notifications`.

**Purpose:** Important decisions and progress, without the noise.

**Primary action:** Mark all as read.

**Required behaviour and acceptance:** Offer All, Unread and Action needed filters. Read state and unresolved action state are separate. Open the exact authorised destination. A removed destination gives a safe explanation. Mark all as read affects only the current user.

[Full-size editable wireframe](./wireframes/C21.svg) · [Open in screen browser](./wireframes.html#C21)

### Exact illustrated content

**Inbox** (choices)

- Unread 3

- All

- Action needed

**Today** (rows)

- Review requested · Booking flow v3 — NS-014 · Your decision is needed · 10:30 — Review now

- Completed · Brand landing page — Accepted by Alex · final files available · 09:12 — View work

- New comment from Jean-Fidele — NS-012 · Mobile spacing update · 08:40 — Open request

**You control ordinary updates** (notice)

Review requests and completion emails are enabled. Change your update preferences in Settings.


## C22 · How can we help?

**Audience:** Client. **Navigation:** Help.

**Proposed location:** `/portal/help`.

**Purpose:** A clear route to the right support.

**Primary action:** Create help request.

**Required behaviour and acceptance:** Provide searchable guidance and a real support form with category, subject and message. Missing project setup must be supportable without pretending to create a project request. Show an acknowledged support reference and a configured response expectation.

[Full-size editable wireframe](./wireframes/C22.svg) · [Open in screen browser](./wireframes.html#C22)

### Exact illustrated content

**Something is not working?** (hero)

Report the issue with steps to reproduce and the impact on your team.

Action: **Report a bug**.

**Support options** (rows)

- Project question — Ask your named delivery contact about current work. — Create help request

- Urgent incident — Use the escalation contact and hours shown in your signed support agreement. — View support details

- Using your workspace — Learn how requests, reviews, files and billing work. — Read the guide


## C23 · Your preferences

**Audience:** Client. **Navigation:** Settings.

**Proposed location:** `/portal/settings`.

**Purpose:** Keep your details and updates working for you.

**Primary action:** Save preferences.

**Required behaviour and acceptance:** Save profile and optional email preferences with a clear confirmation. Identify essential account/billing messages separately. Display current organisation and permissions. Do not let profile editing grant permissions.

[Full-size editable wireframe](./wireframes/C23.svg) · [Open in screen browser](./wireframes.html#C23)

### Exact illustrated content

**Profile** (fields)

- Full name — Alex Morgan

- Email — alex@northstar.example — Change through verified account settings.

- Timezone — Europe/London  ⌄

**Email notifications** (settings)

- Review requested — On

- Work completed — On

- Public comments — Daily digest

- Ordinary status updates — Daily digest

- Marketing newsletter — Off

**Security** (rows)

- Account security — Manage your sign-in methods and active sessions. — Open security


## C24 · Your team

**Audience:** Client. **Navigation:** Settings.

**Proposed location:** `/portal/settings/team`.

**Purpose:** Northstar Studio · Access is managed by role.

**Primary action:** Request access change.

**Required behaviour and acceptance:** Show permitted team members and their plain-language capabilities. Access changes create a founder approval request unless an existing policy explicitly authorises direct changes. Never allow owners to accidentally remove their own final administrative access.

[Full-size editable wireframe](./wireframes/C24.svg) · [Open in screen browser](./wireframes.html#C24)

### Exact illustrated content

**Members** (rows)

- Alex Morgan — Owner · billing access · designated reviewer — View permissions

- Jamie Lee — Contributor · can create requests and comment — View permissions

- Taylor Reed — Viewer · read-only project access — View permissions

**Need to change access?** (notice)

Ask FSS to invite a teammate or change a role. Signer and reviewer designations are managed separately.


## C25 · Choose your workspace

**Audience:** Client. **Navigation:** Home.

**Proposed location:** `/portal/workspaces`.

**Purpose:** Your access is separate for each organisation.

**Primary action:** Open Northstar.

**Required behaviour and acceptance:** Show only active memberships. Switching invalidates organisation-scoped caches and navigates to that workspace. No membership displays an access-help route, not a blank dashboard.

[Full-size editable wireframe](./wireframes/C25.svg) · [Open in screen browser](./wireframes.html#C25)

### Exact illustrated content

**Available workspaces** (rows)

- Northstar Studio — Owner · 1 active project — Open workspace

- Harbour Foundation — Viewer · 2 active projects — Open workspace

**No workspace shown?** (notice)

Open your invitation or request help from FSS. Signing in does not grant organisation access.



## C31 · Set up your FSS workspace

**Audience:** Client. **Navigation:** First-time setup.

**Proposed location:** `/portal/onboarding`.

**Purpose:** Create the organisation that the authenticated account will manage.

**Primary action:** Create organisation.

**Required behaviour and acceptance:** Keep the form limited to the organisation display name, legal name and deployment timezone. Show pending and error feedback; create no membership unless the authenticated invitation flow allows it.

[Full-size editable wireframe](./wireframes/C31.svg) · [Open in screen browser](./wireframes.html#C31)

## F01 · Your studio, in focus.

**Audience:** Founder. **Navigation:** Overview.

**Proposed location:** `/growth/operations`.

**Purpose:** Tuesday, 15 September · All clients

**Primary action:** View delivery.

**Required behaviour and acceptance:** Prioritise reviews waiting on clients, delivery blockers, agreement actions and welcome exceptions. Every summary links to a filtered authoritative queue. Distinguish overdue, waiting and failed. Do not show decorative business metrics without definitions.

[Full-size editable wireframe](./wireframes/F01.svg) · [Open in screen browser](./wireframes.html#F01)

### Exact illustrated content

**Three decisions will move work forward.** (hero)

One request needs assessment, one agreement needs review and one welcome step needs attention.

Action: **Open action queue**.

- 3 / 3 — Delivery capacity

- 2 — Client reviews open

- £2,400 — Invoices overdue

**Needs your attention** (rows)

- Northstar · Review booking scope — New request · acknowledgement target today — Assess request

- Harbour · Finish agreement — Missing engagement link — Continue agreement

- Northstar · Welcome email — Delivery outcome unknown · reconcile before retry — Resolve delivery

**This week** (rows)

- Northstar · Website & booking — Design review 17 Sep · next action with client — View client

- Harbour · Membership portal — Kickoff pending agreement and assets — View client


## F02 · Your clients

**Audience:** Founder. **Navigation:** Clients.

**Proposed location:** `/growth/operations/clients`.

**Purpose:** Relationships, delivery and commercial readiness.

**Primary action:** Add client.

**Required behaviour and acceptance:** Search clients across the authorised dataset; show account owner, active work and next action. Add client opens F04; opening a row shows F03. Pagination preserves filters.

[Full-size editable wireframe](./wireframes/F02.svg) · [Open in screen browser](./wireframes.html#F02)

### Exact illustrated content

- 8 — Active clients

- 2 — Getting started

- 3 — Need attention

**Client register** (rows)

- Northstar Studio — Website & booking · Review pending · Jean-Fidele — Open client

- Harbour Foundation — Membership portal · Agreement incomplete — Open client

- Elm & Co — Website care · All on track — Open client


## F03 · Northstar Studio

**Audience:** Founder. **Navigation:** Clients.

**Proposed location:** `/growth/operations/clients/:org`.

**Purpose:** Client since September 2026 · Jean-Fidele

**Primary action:** Prepare welcome.

**Required behaviour and acceptance:** Make the client record the hub for people, projects, engagement links, agreements, journeys, billing and public notes. Show missing prerequisites with repair actions. Preserve the selected organisation when opening every child workflow.

[Full-size editable wireframe](./wireframes/F03.svg) · [Open in screen browser](./wireframes.html#F03)

### Exact illustrated content

**Design is ready for Alex’s review.** (hero)

One decision is outstanding. Billing and access are ready.

Action: **Open review**.

- 1 — Active project

- 7 — Open requests

- £1,200 — Next invoice

**Client workspace** (rows)

- Agreement & scope — Website & booking experience · signed revision 2 — Open agreements

- Welcome journey — Active · waiting for client assets — View journey

- People & access — Alex: owner and signer · Jamie: contributor — Manage access

- Projects & files — One project · four public milestones — Manage project


## F04 · Add a client

**Audience:** Founder. **Navigation:** Clients.

**Proposed location:** `/growth/operations/clients/new`.

**Purpose:** Start with the organisation and its primary contact.

**Primary action:** Save client.

**Required behaviour and acceptance:** Require client display/legal names and primary contact as appropriate to the existing client model. Validate duplicate candidates before creating a new record. Save creates a draft client record; invitations and emails are separate explicit actions.

[Full-size editable wireframe](./wireframes/F04.svg) · [Open in screen browser](./wireframes.html#F04)

### Exact illustrated content

**Organisation** (fields)

- Display name — Northstar Studio

- Legal entity name — Northstar Studio Ltd

- Organisation type — Company  ⌄

**Primary contact** (fields)

- Full name — Alex Morgan

- Email — alex@northstar.example

- Role — Director

**What saving does** (notice)

Creates the client record only. Invitations, agreements and welcome messages each have their own review step.


## F05 · Delivery board

**Audience:** Founder. **Navigation:** Delivery.

**Proposed location:** `/growth/operations/requests`.

**Purpose:** All clients · Owner: Jean-Fidele · 3 of 3 in progress

**Primary action:** New request.

**Required behaviour and acceptance:** Provide cross-client Kanban with client, owner, type, blocked and priority filters. Enforce capacity and domain transitions. New request opens a founder composer with client/project selectors and the C06/C07 fields; it never drops founder context into an arbitrary client workspace.

[Full-size editable wireframe](./wireframes/F05.svg) · [Open in screen browser](./wireframes.html#F05)

### Exact illustrated content

**Move work with confidence** (notice)

Drag a card or use Move to. Required scope, review and capacity checks appear before a move is committed.


## F06 · Booking confirmation email

**Audience:** Founder. **Navigation:** Delivery.

**Proposed location:** `/growth/operations/clients/:org/requests/:request`.

**Purpose:** Northstar Studio · NS-014 · In progress

**Primary action:** Post public update.

**Required behaviour and acceptance:** Separate Public update from Internal note with unmistakable labels and separate composers. Apply scope, owner, impact, priority, blocker and transition permissions. Public updates create only the notifications configured in workflow B; private notes never do.

[Full-size editable wireframe](./wireframes/F06.svg) · [Open in screen browser](./wireframes.html#F06)

### Exact illustrated content

**Delivery brief** (rows)

- Outcome — Correct local time, address and booking reference.

- Scope — Included · signed website agreement, revision 2

- Owner & target — Jean-Fidele · 24 September

**Controls** (rows)

- Next step — Publish version 3 for client review — Prepare review

- Workflow state — In progress — Move to

- Blocker — None — Add blocker

**Conversation visibility** (choices)

- Public discussion

- Internal notes

**Public update** (fields)

- Message to client — The email is built. I’m checking time zones before review.

**Client visibility** (notice)

Public updates appear in the portal. Internal notes stay within founder operations.


## F07 · Send work for review

**Audience:** Founder. **Navigation:** Delivery.

**Proposed location:** `/growth/operations/clients/:org/requests/:request/review`.

**Purpose:** NS-014 · Northstar Studio

**Primary action:** Publish review.

**Required behaviour and acceptance:** Require a retained version, deliverable, public changes summary, review instructions and current reviewer. Preview the client notification. Publish creates the review cycle and durable notification intent atomically. Email failure does not undo a successful publication.

[Full-size editable wireframe](./wireframes/F07.svg) · [Open in screen browser](./wireframes.html#F07)

### Exact illustrated content

**Review package** (fields)

- Deliverable — Booking confirmation email · version 3  ⌄

- Reviewer — Alex Morgan · Owner  ⌄

- What changed — Correct local time and clearer booking details.

- What to check — Confirm the time, studio address and booking reference.

- Review requested by — 18 September 2026 — Reminder target, not automatic acceptance.

**Notifications** (notice)

Alex will receive an in-app review request and one email linking to this version. The card moves to Ready for review.


## F08 · Assess scope and next steps

**Audience:** Founder. **Navigation:** Delivery.

**Proposed location:** `/growth/operations/clients/:org/requests/:request/scope`.

**Purpose:** NS-017 · Add a customer account area

**Primary action:** Save assessment.

**Required behaviour and acceptance:** Classify included, assessment pending, quote required or declined. Record rationale and the client-facing explanation separately. A quote-required item cannot be silently promoted to included delivery; approved scope evidence is required.

[Full-size editable wireframe](./wireframes/F08.svg) · [Open in screen browser](./wireframes.html#F08)

### Exact illustrated content

**Assessment** (fields)

- Scope decision — Additional quote required  ⌄

- Reason for client — Customer accounts are outside the signed website scope.

- Owner — Jean-Fidele  ⌄

- Next action — Prepare a change proposal

- Operational priority — Normal  ⌄ — Internal only. Separate from client-reported impact.

**Commercial link** (rows)

- Change agreement — Not created yet — Create change proposal

**Planning is held** (notice)

This request can be acknowledged now. Planning and delivery need approved scope.


## F09 · Agreements

**Audience:** Founder. **Navigation:** Agreements.

**Proposed location:** `/growth/operations/agreements`.

**Purpose:** Create clear agreements and track every revision.

**Primary action:** New agreement.

**Required behaviour and acceptance:** List agreement status, client, project, amount, version and next action. Distinguish draft, approved, awaiting signature, signed, superseded and voided. Continue draft resumes its saved step.

[Full-size editable wireframe](./wireframes/F09.svg) · [Open in screen browser](./wireframes.html#F09)

### Exact illustrated content

**Draft & awaiting signature** (rows)

- Harbour · Membership portal — Draft · engagement required — Continue draft

- Northstar · Website & booking — Revision 2 · ready for founder review — Review draft

**Signed** (rows)

- Elm & Co · Website care — Signed revision 1 · service active — View agreement


## F10 · Create an agreement

**Audience:** Founder. **Navigation:** Agreements.

**Proposed location:** `/growth/operations/clients/:org/agreements/new`.

**Purpose:** Northstar Studio · Saved as a draft

**Primary action:** Continue to scope.

**Required behaviour and acceptance:** Select a named client/project/engagement with human-readable summary and approved provenance. Search by title/client/reference. Handle loading, no matches, no eligible engagements and query failure distinctly. Missing linkage opens F16 or F32; never expose an empty UUID dropdown.

[Full-size editable wireframe](./wireframes/F10.svg) · [Open in screen browser](./wireframes.html#F10)

### Exact illustrated content

**Link the right work** (fields)

- Client — Northstar Studio  ⌄

- Engagement — Website & booking experience · Discovery complete  ⌄ — Linked to Northstar. Reviewed by Jean-Fidele on 12 Sep.

- Agreement title — Website & booking experience

- Starting point — Website project template · approved v2  ⌄

**No linked engagement?** (notice)

Link an existing engagement or create one here. Your draft stays saved.

**Related work** (rows)

- Website & booking experience — Goals and proposed scope available — View engagement


## F11 · Define the work

**Audience:** Founder. **Navigation:** Agreements.

**Proposed location:** `/growth/operations/clients/:org/agreements/new?step=scope`.

**Purpose:** Step 2 · Be clear about outcomes, inclusions and boundaries.

**Primary action:** Continue to fees.

**Required behaviour and acceptance:** Edit deliverables, inclusions, exclusions, assumptions and milestones with clear examples. Validate required scope before progressing. Preserve a draft on back/refresh. Scope must remain traceable to the selected engagement version.

[Full-size editable wireframe](./wireframes/F11.svg) · [Open in screen browser](./wireframes.html#F11)

### Exact illustrated content

**Scope** (fields)

- Client goals — Make it easier for customers to book online.

- Included deliverables — Five content pages, booking workflow and confirmation email.

- Not included — Customer accounts, paid advertising and ongoing content entry.

- Acceptance criteria — A customer can book, receive confirmation and find support details.

- Responsibilities & support — Client supplies final copy and brand assets. Support follows the agreed term.


## F12 · Fees, schedule and terms

**Audience:** Founder. **Navigation:** Agreements.

**Proposed location:** `/growth/operations/clients/:org/agreements/new?step=fees`.

**Purpose:** Step 3 · All amounts shown in GBP.

**Primary action:** Continue to people.

**Required behaviour and acceptance:** Use structured fee lines, currency, schedule and contractual terms. Calculate totals from server-validated amounts and display rounding consistently. Do not silently introduce tax, deposits or late fees. Changes that affect approved scope invalidate prior approval.

[Full-size editable wireframe](./wireframes/F12.svg) · [Open in screen browser](./wireframes.html#F12)

### Exact illustrated content

**Agreed fees** (pricing)

- Website & booking experience — 1 — £4,800 — £4,800

**Payment terms** (fields)

- Tax treatment — Use approved organisation tax policy  ⌄ — Select the applicable reviewed policy. Do not infer tax from this mockup.

- Deposit — £1,200

- Remaining payments — 3 milestone payments × £1,200

- Minimum term / notice — Project term · 30 days notice as drafted

**Validation** (notice)

Payment amounts must reconcile with the agreement total. Recurring lines must have a cadence and start policy.


## F13 · People and responsibilities

**Audience:** Founder. **Navigation:** Agreements.

**Proposed location:** `/growth/operations/clients/:org/agreements/new?step=people`.

**Purpose:** Step 4 · Make it clear who signs, pays and reviews.

**Primary action:** Continue to document.

**Required behaviour and acceptance:** Choose named legal parties and signers; show role and email. Validate missing identities, duplicate signers and inactive contacts. Selecting a signer does not grant portal ownership or billing permissions.

[Full-size editable wireframe](./wireframes/F13.svg) · [Open in screen browser](./wireframes.html#F13)

### Exact illustrated content

**Contacts** (fields)

- Billing contact — Alex Morgan · alex@northstar.example  ⌄

- Required client signer — Alex Morgan · Director  ⌄

- FSS signer — Jean-Fidele Ntagengwa  ⌄

- Delivery reviewer — Alex Morgan  ⌄

- Client responsibilities — Provide approved copy and assets before development.

**Separate permissions** (notice)

Being a signer does not grant owner access. Portal roles are reviewed separately before invitations are issued.


## F14 · Prepare the agreement document

**Audience:** Founder. **Navigation:** Agreements.

**Proposed location:** `/growth/operations/clients/:org/agreements/new?step=document`.

**Purpose:** Step 5 · The exact version reviewed is retained.

**Primary action:** Generate & preview.

**Required behaviour and acceptance:** Generate the final document from the chosen template and content, or select a supported retained source file. Compute the SHA-256 fingerprint server-side from immutable final bytes. Show document title/version/review status and Preview; advanced audit details are read-only.

[Full-size editable wireframe](./wireframes/F14.svg) · [Open in screen browser](./wireframes.html#F14)

### Exact illustrated content

**Document source** (choices)

- Generate from draft

- Upload existing PDF

**Website & booking experience** (document)

Revision 2
Scope, fees, responsibilities and agreed terms
Prepared from the saved draft

**Document fingerprint recorded** (notice)

Calculated automatically from the final document. If the document changes, a new revision must be reviewed.

**Document details** (rows)

- Website-agreement-r2.pdf — Revision 2 · prepared 15 Sep · private document — View details


## F15 · Review before sending

**Audience:** Founder. **Navigation:** Agreements.

**Proposed location:** `/growth/operations/clients/:org/agreements/new?step=review`.

**Purpose:** Step 6 · Northstar Studio · Revision 2

**Primary action:** Approve signing request.

**Required behaviour and acceptance:** Present complete document, parties, commercial summary and prerequisite results before approval. The signing action approves/queues the exact version; its acknowledgement must not claim the agreement is signed. Material edits require a new version and renewed review.

[Full-size editable wireframe](./wireframes/F15.svg) · [Open in screen browser](./wireframes.html#F15)

### Exact illustrated content

- £4,800 — Agreement total

- £1,200 — Initial deposit

- 2 — Required signers

**Website & booking experience** (document)

Client: Northstar Studio
Outcome: a clear online booking journey
Scope: five pages, booking flow and confirmation
Payment: £1,200 deposit + three milestone payments

**Readiness checks** (timeline)

- ✓ — Engagement linked — Website & booking experience

- ✓ — Fees and schedule reconcile — Total £4,800

- ✓ — Signers and access reviewed — Alex Morgan + Jean-Fidele

- ✓ — Document preview reviewed — Revision 2

**Sending choice** (notice)

Send the signing request now or attach this approved revision to a welcome journey. The same signing notice must not be sent twice.


## F16 · Link the work first

**Audience:** Founder. **Navigation:** Agreements.

**Proposed location:** `/growth/operations/clients/:org/agreements/new?state=no-engagement`.

**Purpose:** Your agreement draft is saved.

**Primary action:** Link selected engagement.

**Required behaviour and acceptance:** Explain why a valid engagement is required. Show eligible named records and Create engagement. Linking validates client/project/provenance and returns to the preserved agreement draft. Query failure is not presented as an empty list.

[Full-size editable wireframe](./wireframes/F16.svg) · [Open in screen browser](./wireframes.html#F16)

### Exact illustrated content

**No engagement is linked** (notice)

An engagement connects this agreement to the work you discussed. Choose existing work or create a new engagement.

**Available work** (rows)

- Website & booking experience — Northstar Studio · Discovery complete · 12 Sep — Link engagement

**Find an engagement** (fields)

- Search — Search by project or engagement name…

**Starting fresh?** (rows)

- Create an engagement — Record the goal, proposed scope and client relationship. — Create engagement


## F17 · Signed and recorded

**Audience:** Founder. **Navigation:** Agreements.

**Proposed location:** `/growth/operations/clients/:org/agreements/:agreement`.

**Purpose:** Northstar Studio · Website & booking · Revision 2

**Primary action:** Prepare welcome.

**Required behaviour and acceptance:** Show verified signed status, exact version, signer evidence, time and retained document. Offer audit history and next welcome step. Partial signatures remain awaiting signature; administrative evidence is explicitly labelled.

[Full-size editable wireframe](./wireframes/F17.svg) · [Open in screen browser](./wireframes.html#F17)

### Exact illustrated content

**Both signatures are complete.** (hero)

The signed copy and signing evidence are retained. Service activation still follows deposit, assets and capacity checks.

Action: **Open signed copy**.

**Signing record** (timeline)

- ✓ — Alex Morgan · Client — Signed 15 September · 14:12

- ✓ — Jean-Fidele · FSS — Signed 15 September · 14:18

- ✓ — Evidence retained — Signed document and source revision match

**Next steps** (rows)

- Welcome journey — First invoice and thank-you become eligible tomorrow at 09:00 London. — View journey

- Service readiness — Deposit, assets and capacity checked separately. — View readiness


## F18 · Welcome journeys

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/journeys`.

**Purpose:** Every client gets a considered start.

**Primary action:** Create journey.

**Required behaviour and acceptance:** List draft, active, paused, completed and needs-attention journeys by client and next step. Create journey starts F19. Resuming a draft restores content and validation; duplicate active journeys are blocked by domain policy.

[Full-size editable wireframe](./wireframes/F18.svg) · [Open in screen browser](./wireframes.html#F18)

### Exact illustrated content

- 2 — Draft journeys

- 3 — Active journeys

- 1 — Needs attention

**Your journeys** (rows)

- Northstar · Website & booking — Active · waiting for brand assets — Open journey

- Harbour · Membership portal — Draft · 3 of 5 setup steps complete — Continue setup

- Elm & Co · Website care — Needs attention · invitation delivery failed — Resolve issue


## F19 · Prepare a warm welcome

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/clients/:org/journey/new`.

**Purpose:** Northstar Studio · Draft journey

**Primary action:** Continue to content.

**Required behaviour and acceptance:** Choose client, linked engagement, agreement and versioned welcome template. Explain missing prerequisites and provide repair links. Save creates a draft only; no welcome email is sent at this step.

[Full-size editable wireframe](./wireframes/F19.svg) · [Open in screen browser](./wireframes.html#F19)

### Exact illustrated content

**Journey setup** (fields)

- Client — Northstar Studio  ⌄

- Agreement — Website & booking · revision 2  ⌄

- Primary recipient — Alex Morgan · approved billing contact  ⌄

- Template — Project welcome · approved v2  ⌄

- Primary goal — Make online booking easier for customers.

- Proposed outcome — A clear website and booking experience that reduces manual follow-up.

**Your starting point** (notice)

Client, agreement and discovery details are prefilled. Review them before continuing.


## F20 · Make the welcome personal

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/clients/:org/journey/new?step=content`.

**Purpose:** Step 2 · Edit and preview before anything is sent.

**Primary action:** Continue to access.

**Required behaviour and acceptance:** Edit welcome message and guide content with a client-facing preview. Use labelled subject/body fields and approved merge fields. Missing required merge values block approval. Save a versioned draft; changing approved content invalidates its previous approval.

[Full-size editable wireframe](./wireframes/F20.svg) · [Open in screen browser](./wireframes.html#F20)

### Exact illustrated content

**Email content** (fields)

- Subject — Your next steps with FSS

- Greeting — Hello Alex,

- Opening — Thank you for talking through your online booking goals.

- Next step — Your welcome guide explains the proposed work and how we will keep you informed.

**Your next steps with FSS** (document)

Hello Alex,

Thank you for talking through your online booking goals.

Your welcome guide explains our process, the proposed work and what we will need from you.

Jean-Fidele
Faithful Software Solutions

**Welcome guide · five sections** (rows)

- Your priorities · Proposed work · Delivery process — Prefilled from approved client facts — Edit guide

- Working together · Next steps — Named owner, client actions and support route — Preview guide


## F21 · People, signing and access

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/clients/:org/journey/new?step=access`.

**Purpose:** Step 3 · Confirm each person’s responsibilities.

**Primary action:** Continue to schedule.

**Required behaviour and acceptance:** Review exact recipients, signers and approved portal roles. Resolve missing contacts, inactive recipients and existing invitations. Invitations reuse approved access; no inferred or automatically elevated owner roles.

[Full-size editable wireframe](./wireframes/F21.svg) · [Open in screen browser](./wireframes.html#F21)

### Exact illustrated content

**Approved contacts** (rows)

- Alex Morgan — Signer · billing recipient · proposed owner role — Review role

- Jamie Lee — Not a signer · proposed contributor role — Review role

**Signing notice** (fields)

- Approved agreement — Website & booking · revision 2

- Subject — Your FSS proposal is ready to review

- Message — Please review the scope, payment schedule and responsibilities before signing.

**Existing access is reused** (notice)

Active memberships are not re-invited. Role conflicts need founder review. Additional recipients have their own activation preview.


## F22 · Sequence the next steps

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/clients/:org/journey/new?step=schedule`.

**Purpose:** Step 4 · Times shown in Europe/London.

**Primary action:** Review journey.

**Required behaviour and acceptance:** Show the ordered sequence, real prerequisites and London-local due-time previews. Welcome acceptance precedes the two-hour proposal delay; verified complete signature precedes the next-calendar-day 09:00 steps. Edit the client checklist through F33.

[Full-size editable wireframe](./wireframes/F22.svg) · [Open in screen browser](./wireframes.html#F22)

### Exact illustrated content

**Journey sequence** (timeline)

- 1 — Welcome email & guide — After you start the approved journey

- 2 — Proposal for signature — Two elapsed hours after welcome provider acceptance; held if unapproved

- 3 — First invoice, access & thank-you — Next calendar day at 09:00 after all signatures are verified

- 4 — Client checklist — Profile → agreement → billing → assets → kickoff

- 5 — Ready for delivery — Founder confirms contractual start prerequisites

**Client tasks** (fields)

- Required assets — Logo, brand guide and approved website copy

- Kickoff — Offer reviewed slots after signature

- First invoice — Deposit · £1,200 · signed obligation


## F23 · Ready when you are.

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/clients/:org/journey/new?step=activate`.

**Purpose:** Step 5 · Review exactly what starting will do.

**Primary action:** Start journey.

**Required behaviour and acceptance:** Display a pass/block result for each prerequisite plus recipients, content versions, attachments and due times. Start journey is disabled with actionable reasons until valid. Activation persists a generation/lease-safe schedule and transitions to F24 only after acknowledgement.

[Full-size editable wireframe](./wireframes/F23.svg) · [Open in screen browser](./wireframes.html#F23)

### Exact illustrated content

**Preflight** (timeline)

- ✓ — Client and contacts — Northstar Studio · Alex Morgan

- ✓ — Welcome email and guide — Approved content · accessible version ready

- ✓ — Proposal and signers — Revision 2 · Alex and Jean-Fidele

- ✓ — Billing and portal roles — First obligation selected · existing access reused

- ✓ — Delivery settings — Sender verified · provider and worker ready

**Start this journey** (notice)

Queues the reviewed welcome email to Alex now. The proposal follows its timing and approval gates. Later invoice and access steps wait for verified signatures.

**Final previews** (rows)

- Welcome · proposal · thank-you · activation emails — Exact recipients and content retained — Open previews


## F24 · Northstar’s welcome journey

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/clients/:org/journey`.

**Purpose:** Started 15 Sep · 10:00 · Active

**Primary action:** Pause journey.

**Required behaviour and acceptance:** Show each step as waiting, scheduled, attempting, provider accepted, delivered, completed, failed or unknown as applicable. Distinguish due from executed time. Pause blocks future unsent work and explains in-flight limitations; it cannot recall a sent email.

[Full-size editable wireframe](./wireframes/F24.svg) · [Open in screen browser](./wireframes.html#F24)

### Exact illustrated content

- 2 / 5 — Steps complete

- 16 Sep — Next eligible action

- 0 — Delivery issues

**Live timeline** (timeline)

- ✓ — Welcome accepted by email provider — 15 Sep, 10:01 · delivery confirmed 10:02

- ✓ — Proposal sent — 15 Sep, 12:01 · approved revision 2

- 3 — Waiting for signatures — Alex has signed · waiting for FSS

- 4 — Invoice, portal access & thank-you — Eligible next calendar day at 09:00 after verified signatures

- 5 — Client setup & kickoff — Starts after the required preceding steps

**Client progress** (rows)

- 3 of 6 setup steps complete — Brand assets are the next client action — View checklist

**Pause behaviour** (notice)

Pausing stops remaining eligible actions. Messages already accepted cannot be unsent.


## F25 · Resolve delivery safely

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/clients/:org/journey?view=recovery`.

**Purpose:** Elm & Co · Welcome journey · Needs attention

**Primary action:** Check delivery.

**Required behaviour and acceptance:** Show failure evidence and exact affected attempt. Offer retry only for confirmed safe failures; reconcile unknown outcomes first. Editing recipients/content requires renewed approval and generation handling. Audit actor, reason and result for recovery actions.

[Full-size editable wireframe](./wireframes/F25.svg) · [Open in screen browser](./wireframes.html#F25)

### Exact illustrated content

**Welcome email outcome unknown** (notice)

The provider may have accepted this message before the connection failed. Check the existing attempt before sending again.

**Attempt details** (rows)

- Last attempt — 15 September, 10:01 · connection timed out

- Client impact — Proposal step held until welcome acceptance is confirmed

- Next action — Reconcile the original message with the provider — Check delivery

**Recovery sequence** (timeline)

- 1 — Check provider record — Look up the existing message using its saved reference

- 2 — Confirm the outcome — Record accepted, failed or still unknown

- 3 — Resume eligible steps — Completed steps stay complete; do not recreate invoices or invitations

**When retry is safe** (notice)

Retry only a confirmed failed attempt with the same approved content and durable delivery key.


## F26 · Welcome templates

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/journeys/templates`.

**Purpose:** A consistent experience, adapted to each client.

**Primary action:** Save template draft.

**Required behaviour and acceptance:** Create/edit named, versioned templates with subject, content, guide, checklist and default sequence. Preview resolved sample content and publish only after validation. Active journeys remain pinned to their approved template version.

[Full-size editable wireframe](./wireframes/F26.svg) · [Open in screen browser](./wireframes.html#F26)

### Exact illustrated content

**Approved templates** (rows)

- Project welcome · v2 — Email, five-section guide, proposal and thank-you — Edit draft version

- Website care · v1 — Care scope, support route and billing introduction — Preview template

**Template editor** (fields)

- Template name — Project welcome

- Section — Working together  ⌄

- Content — Your FSS contact is {{delivery_owner}}. Your project updates and requests are available in your workspace.

**Versioned publishing** (notice)

Editing creates a draft version. Active journeys keep their approved content until explicitly revised and reapproved.


## F27 · Billing operations

**Audience:** Founder. **Navigation:** Billing.

**Proposed location:** `/growth/operations/billing`.

**Purpose:** Agreed obligations, invoices and exceptions.

**Primary action:** Open exceptions.

**Required behaviour and acceptance:** Provide failed/overdue/unreconciled billing queues with provider references and audit history. Reconcile provider state before retrying uncertain operations. Existing billing services remain authoritative; this page cannot directly mark an invoice paid.

[Full-size editable wireframe](./wireframes/F27.svg) · [Open in screen browser](./wireframes.html#F27)

### Exact illustrated content

- £7,200 — Due this month

- £2,400 — Overdue

- 1 — Needs reconciliation

**Action queue** (rows)

- Northstar · INV-2026-041 — £1,200 · due 24 September — Open invoice

- Harbour · Deposit invoice — £1,200 · overdue 3 days — Review collection

- Elm & Co · Payment status — Provider status needs reconciliation — Reconcile

**Commercial controls** (notice)

Invoice amounts come from retained signed terms. Reminder and collection actions do not change the agreement.


## F28 · People and portal access

**Audience:** Founder. **Navigation:** Portal access.

**Proposed location:** `/growth/operations/portal-access`.

**Purpose:** Invitations, memberships and roles with clear outcomes.

**Primary action:** Review invitation.

**Required behaviour and acceptance:** Review contact, organisation, capability and invitation status before grant/resend/revoke. Show the impact of revocation. Reuse active invitations and enforce tenant boundaries. No role changes result merely from adding a signer.

[Full-size editable wireframe](./wireframes/F28.svg) · [Open in screen browser](./wireframes.html#F28)

### Exact illustrated content

**Access register** (rows)

- Alex Morgan · Northstar — Owner · Active · last verified 15 Sep — Manage access

- Jamie Lee · Northstar — Contributor · Invitation sent · expires 22 Sep — View invitation

- Taylor Reed · Harbour — Viewer · Invitation expired — Prepare new invite

**Invite a contact** (fields)

- Client — Northstar Studio  ⌄

- Contact — Jamie Lee · jamie@northstar.example  ⌄

- Portal role — Contributor  ⌄ — Can create requests and comment. Cannot accept work unless designated.

**Before sending** (notice)

Review the contact, organisation and role. Confirmation must show sent, failed or pending delivery accurately.


## F29 · Notification delivery

**Audience:** Founder. **Navigation:** Notifications.

**Proposed location:** `/growth/operations/notifications`.

**Purpose:** See what clients received and resolve what they did not.

**Primary action:** Open failed deliveries.

**Required behaviour and acceptance:** Inspect event, recipient, channel, attempt status and next retry. Filter failures/unknown outcomes and inspect safe diagnostics. Retry/reconcile uses permanent deduplication; never replay a whole journey to recover one notification.

[Full-size editable wireframe](./wireframes/F29.svg) · [Open in screen browser](./wireframes.html#F29)

### Exact illustrated content

- 18 — Delivered today

- 1 — Retry scheduled

- 1 — Needs attention

**Delivery log** (rows)

- Northstar · Review requested · NS-014 v3 — In-app created · email delivered · Alex Morgan — View event

- Harbour · Work completed · HF-009 — In-app created · email retry scheduled — View attempt

- Elm & Co · Welcome — Outcome unknown · reconciliation required — Resolve

**One event, independent channels** (notice)

An email failure does not roll back the work status or remove the in-app notification.


## F30 · Studio settings

**Audience:** Founder. **Navigation:** Settings.

**Proposed location:** `/growth/operations/settings`.

**Purpose:** Keep your client experience consistent.

**Primary action:** Save settings draft.

**Required behaviour and acceptance:** Group business identity, notification defaults, response expectations and delivery settings. Display timezone explicitly. Save validated drafts; higher-impact configuration changes require the existing approval policy. Secrets stay outside ordinary form fields.

[Full-size editable wireframe](./wireframes/F30.svg) · [Open in screen browser](./wireframes.html#F30)

### Exact illustrated content

**Studio identity** (fields)

- Display name — Faithful Software Solutions

- Reply-to address — Choose an approved sender

- Default timezone — Europe/London

**Operational policies** (rows)

- Business calendar — Mon–Fri · 09:00–17:00 · reviewed England/Wales holidays — Review calendar

- Delivery capacity — 3 in-progress items · founder owner — Review policy

- Notification templates — Review requested, completed and welcome content — Manage templates

- Integrations — Authentication, email, signing, billing and file scanning — View health

**Changes with side effects** (notice)

Changing a sender, timing policy or published template does not rewrite active approvals.


## F31 · Shape the client’s project view

**Audience:** Founder. **Navigation:** Projects.

**Proposed location:** `/growth/operations/clients/:org/projects/:project/edit`.

**Purpose:** Northstar Studio · Website & booking experience

**Primary action:** Save project.

**Required behaviour and acceptance:** Maintain public project title/outcome, stage, milestones, owner and published deliverables. Separate public content from internal notes. Publish only retained authorised documents; preview the client view before acknowledgement.

[Full-size editable wireframe](./wireframes/F31.svg) · [Open in screen browser](./wireframes.html#F31)

### Exact illustrated content

**Public project details** (fields)

- Project title — Website & booking experience

- Client outcome — Make it easier for customers to book online.

- Delivery owner — Jean-Fidele

- Next update — Friday, 18 September

- Milestone — Design approval · target 24 September

**Public milestones** (rows)

- Discover — Complete · scope and goals agreed — Edit milestone

- Design — Active · client review needed — Edit milestone

- Build — Pending · assets and design approval — Edit milestone

- Launch & handover — Pending · readiness and client acceptance — Edit milestone

**Visibility preview** (notice)

Only published milestones and public updates appear in the client portal. Internal estimates remain private.


## F32 · Create an engagement

**Audience:** Founder. **Navigation:** Clients.

**Proposed location:** `/growth/operations/clients/:org/engagements/new`.

**Purpose:** Connect the client’s goals to a defined piece of work.

**Primary action:** Create & link engagement.

**Required behaviour and acceptance:** Create/link the engagement through the existing reviewed-work provenance model. Require title, client/project, reviewed source and status appropriate to the repository. Do not invent a free-form replacement record that bypasses review. Return the new eligible linkage to the saved agreement draft.

[Full-size editable wireframe](./wireframes/F32.svg) · [Open in screen browser](./wireframes.html#F32)

### Exact illustrated content

**Engagement** (fields)

- Client — Northstar Studio

- Engagement name — Website & booking experience

- Primary goal — Make it easier for customers to book online.

- Proposed scope — Website pages and a booking workflow

- Source — Founder discovery  ⌄

- Review status — Ready for founder review  ⌄

**Save and return** (notice)

Create the engagement, link it to this client and return to the saved agreement draft. Review status is recorded explicitly.


## S01 · Your first request starts here.

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests?state=empty`.

**Purpose:** Keep feedback connected to your project.

**Primary action:** New request.

**Required behaviour and acceptance:** Show a purposeful empty request board with New request and Report a bug. A creation result replaces the empty state after server acknowledgement. Do not display fake requests to populate the screen.

[Full-size editable wireframe](./wireframes/S01.svg) · [Open in screen browser](./wireframes.html#S01)

### Exact illustrated content

**Nothing in your board yet.** (hero)

Create a request or report a bug. FSS will assess scope and confirm the next step.

Action: **Create first request**.


## S02 · Connect your project first

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests/new?state=no-project`.

**Purpose:** No shared project is available.

**Primary action:** Ask FSS for help.

**Required behaviour and acceptance:** Explain missing project linkage, preserve the unsent draft and route a setup request to the founder. Distinguish pending setup from no permission. Do not enable submit until an authorised project is available.

[Full-size editable wireframe](./wireframes/S02.svg) · [Open in screen browser](./wireframes.html#S02)

### Exact illustrated content

**A project is needed for this request** (notice)

Ask FSS to connect the right project to your workspace. Your account does not currently have access to one.

**Your options** (rows)

- Project setup — Ask your FSS contact to set up or share the project. — Request setup

- Different organisation? — Choose another workspace you can access. — Switch workspace


## S03 · This request has changed.

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests/:request?state=conflict`.

**Purpose:** Your feedback has been kept.

**Primary action:** Review latest version.

**Required behaviour and acceptance:** Show what changed and the current version. Preserve unsent local feedback for copying/reapplication, but require review before resubmission. Never overwrite a newer decision automatically.

[Full-size editable wireframe](./wireframes/S03.svg) · [Open in screen browser](./wireframes.html#S03)

### Exact illustrated content

**Version 4 is now ready** (notice)

You were reviewing version 3. Review version 4 before accepting work. No acceptance has been recorded.

**Your saved feedback** (fields)

- Feedback — Please include the cancellation contact.


## S04 · We couldn’t load your workspace.

**Audience:** Client. **Navigation:** Home.

**Proposed location:** `/portal?state=unavailable`.

**Purpose:** Your work is safe. Please try again.

**Primary action:** Try again.

**Required behaviour and acceptance:** Show a safe error, retry and support reference without raw exceptions. Preserve organisation context. An unauthorised response follows the access route instead of repeated retry.

[Full-size editable wireframe](./wireframes/S04.svg) · [Open in screen browser](./wireframes.html#S04)

### Exact illustrated content

**Temporarily unavailable** (notice)

If this continues, contact FSS with reference FSS-DEMO-042.


## S05 · This invitation has expired.

**Audience:** Client. **Navigation:** Home.

**Proposed location:** `/portal/activate?state=expired`.

**Purpose:** We will help you get to the right workspace.

**Primary action:** Request a new invitation.

**Required behaviour and acceptance:** Explain that the invitation cannot be used, offer a new invitation request, and route to sign-in for already-active members. Avoid revealing another organisation's membership. Grant nothing until an approved invitation is accepted.

[Full-size editable wireframe](./wireframes/S05.svg) · [Open in screen browser](./wireframes.html#S05)

### Exact illustrated content

**A fresh invitation is needed** (notice)

Request another invitation from FSS. Signing in alone does not activate organisation access.

**Already have access?** (rows)

- Sign in with your existing account — Use your verified email to see memberships. — Sign in


## S06 · Two things need your attention.

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/journeys/new?state=blocked`.

**Purpose:** Welcome draft saved.

**Primary action:** Review missing details.

**Required behaviour and acceptance:** List exact failed preflight checks with repair destinations. Keep activation disabled until a new server validation passes. Repairs preserve the draft; stale client-side validation alone cannot authorise activation.

[Full-size editable wireframe](./wireframes/S06.svg) · [Open in screen browser](./wireframes.html#S06)

### Exact illustrated content

**Readiness checks** (timeline)

- ✓ — Client and contacts — Confirmed

- ! — Agreement needs review — Revision 3 replaced approved revision 2

- ! — Sender not configured — Choose a verified sender

- ✓ — Welcome guide — Prepared and previewed

**Resolve before starting** (rows)

- Review revision 3 — Previous approval retained in history. — Open agreement

- Configure sender — Use an authorised FSS identity. — Open settings


## S07 · Your file is being checked.

**Audience:** Client. **Navigation:** Documents.

**Proposed location:** `/portal/documents?state=quarantine`.

**Purpose:** Brand-guidelines.pdf · Upload complete

**Primary action:** Back to documents.

**Required behaviour and acceptance:** Show file name, progress/status and a clear safe-processing message. Quarantined files cannot be downloaded or attached to a published review. Rejection exposes a safe reason and Replace file; success moves to the retained document state.

[Full-size editable wireframe](./wireframes/S07.svg) · [Open in screen browser](./wireframes.html#S07)

### Exact illustrated content

**Security check in progress** (notice)

The file will be available after it passes the security check. You can leave and return later.

**Upload status** (rows)

- File received — Brand-guidelines.pdf · 2.4 MB

- Security check — In progress · not yet shared


## S08 · Move work to Ready for review

**Audience:** Founder. **Navigation:** Delivery.

**Proposed location:** `/growth/operations/requests?state=move-sheet`.

**Purpose:** Complete the review package before saving this move.

**Primary action:** Publish review.

**Required behaviour and acceptance:** Expose legal state destinations and required transition fields in a focus-managed sheet. Confirm persists with expected version; cancel returns focus to the original card. This is the click/tap/keyboard equivalent of dragging.

[Full-size editable wireframe](./wireframes/S08.svg) · [Open in screen browser](./wireframes.html#S08)

### Exact illustrated content

**Required for this move** (fields)

- Deliverable version — Choose an approved deliverable  ⌄

- Reviewer — Alex Morgan  ⌄

- Public summary — Describe what changed…

- Review instructions — Explain what the client should check…

**Nothing has moved yet** (notice)

Cancel to keep NS-014 In progress. Publishing creates the review and its in-app and email notifications.


## S09 · Loading your requests…

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests?state=loading`.

**Purpose:** Fetching the latest project updates.

**Primary action:** None while loading.

**Required behaviour and acceptance:** Use structural loading placeholders with one accessible loading status. Preserve layout and current filters. Timeouts transition to an actionable error; the skeleton never suggests real record counts.

[Full-size editable wireframe](./wireframes/S09.svg) · [Open in screen browser](./wireframes.html#S09)

### Exact illustrated content

**Loading board** (skeleton)


## S10 · You have read-only access.

**Audience:** Client. **Navigation:** Settings.

**Proposed location:** `/portal/requests?state=viewer`.

**Purpose:** You can view the project and its public updates.

**Primary action:** View project.

**Required behaviour and acceptance:** Show useful permitted information and a clear capability explanation. Hide or disable mutation actions with reasons. Access-help is available, and every endpoint independently enforces the same capability.

[Full-size editable wireframe](./wireframes/S10.svg) · [Open in screen browser](./wireframes.html#S10)

### Exact illustrated content

**Need to contribute?** (notice)

Request a role change from FSS. Only designated reviewers can accept work.


## E01 · Your update is ready.

**Audience:** Client. **Navigation:** Notifications.

**Proposed location:** `email/review-requested`.

**Purpose:** Email preview · Review requested

**Primary action:** Review the update.

**Required behaviour and acceptance:** Include a concise public change summary, request/version, review action and authenticated deep link. Recheck recipient entitlement before dispatch. Plain-text alternative required. Expired/superseded review links resolve safely and never submit a decision from an email GET.

[Full-size editable wireframe](./wireframes/E01.svg) · [Open in screen browser](./wireframes.html#E01)

### Exact illustrated content

**Ready for your review: Booking flow** (document)

Hello Alex,

The booking flow now shows the correct local time and clearer appointment details.

Please review version 3 and check the time, studio address and booking reference.

Your target review date is 18 September. Tell us if you need more time.

Jean-Fidele
Faithful Software Solutions


## E02 · All done.

**Audience:** Client. **Navigation:** Notifications.

**Proposed location:** `email/work-completed`.

**Purpose:** Email preview · Work completed

**Primary action:** View completed work.

**Required behaviour and acceptance:** State whether completion was client acceptance or FSS closure. Include final work link and next support action. Use the current entitlement model; do not attach private deliverables to broadly forwarded email by default. Plain-text alternative required.

[Full-size editable wireframe](./wireframes/E02.svg) · [Open in screen browser](./wireframes.html#E02)

### Exact illustrated content

**Completed: Booking confirmation email** (document)

Hello Alex,

Version 3 was accepted by Alex Morgan on 15 September.

The final deliverable and review history are ready in your workspace.

Thank you for your feedback.

Jean-Fidele
Faithful Software Solutions


## F33 · Build the client checklist

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/journeys/templates/:template/tasks`.

**Purpose:** Tasks can be reordered within their dependencies.

**Primary action:** Save checklist.

**Required behaviour and acceptance:** Add, edit, reorder and remove checklist tasks in a labelled task editor. Fields: title, instructions, type, owner role, required flag, dependency, relative due rule and completion evidence. Types: profile, upload, read/acknowledge, sign, booking and custom confirmation. Validate cycles and missing targets; preview client task sheets before publishing a new template version.

[Full-size editable wireframe](./wireframes/F33.svg) · [Open in screen browser](./wireframes.html#F33)

### Exact illustrated content

**Client tasks** (timeline)

- 1 — Confirm details — Required · client owner

- 2 — Sign agreement — Required · designated signer · verified evidence

- 3 — Pay agreed deposit — Required if contracted · billing contact

- 4 — Share brand assets — Required · owner or contributor

- 5 — Confirm kickoff — Required · client owner · after signature

**Selected task: Share brand assets** (fields)

- Task title — Share brand assets

- Instructions — Upload your logo, brand guide and approved copy.

- Owner role — Owner or contributor  ⌄

- Due target — 3 business days after access

- Required — Yes  ⌄

**Add a task** (notice)

Choose profile, upload, review, scheduling or preparation. Payment and signing tasks complete only from verified records.


## F34 · Record a signed agreement

**Audience:** Founder. **Navigation:** Agreements.

**Proposed location:** `/growth/operations/clients/:org/agreements/:agreement/record-signature`.

**Purpose:** Manual evidence record · founder only

**Primary action:** Review signed evidence.

**Required behaviour and acceptance:** Retain the signed file and explicit evidence for every required party. Compute its fingerprint automatically. Record source, actor, signature dates and review confirmation. Manual evidence must remain distinguishable from a provider-verified signature; missing evidence cannot mark an agreement signed.

[Full-size editable wireframe](./wireframes/F34.svg) · [Open in screen browser](./wireframes.html#F34)

### Exact illustrated content

**Evidence** (fields)

- Source agreement — Website & booking · revision 2

- Signed document — Choose a retained signed PDF

- Required signers — Alex Morgan and Jean-Fidele

- Completed on — 15 September 2026

- Evidence provenance — Manually reviewed external signature

**Fingerprints are automatic** (notice)

Source and signed documents have separate system-calculated fingerprints. Record evidence you have reviewed; this does not verify a cryptographic signature.


## M01 · Good morning, Alex.

**Audience:** Client. **Navigation:** Home.

**Proposed location:** `/portal?organisationId=:org`.

**Purpose:** Here is where things stand with Northstar Studio.

**Primary action:** New request.

**Required behaviour and acceptance:** Responsive C01: prioritise the next action, stack cards, wrap content, and keep request creation reachable. No horizontal page scroll at 320 px.

[Full-size editable wireframe](./wireframes/M01.svg) · [Open in screen browser](./wireframes.html#M01)

### Exact illustrated content

**Your booking flow is ready.** (hero)

Review the updated prototype and tell us whether it meets the agreed outcome.

Action: **Review the update**.

- 1 — Waiting for you

- 3 — In delivery

- 24 Sep — Next milestone

**Your next steps** (rows)

- Review booking flow · v3 — Ready for review · Alex Morgan · requested today — Open review

- Upload your approved brand assets — Needed before development · due 18 Sep — Add assets

**Your project** (rows)

- Website & booking experience — Design phase · Jean-Fidele · next update Friday — View project

- Latest update — The booking journey is ready for your review. Development starts after approval. — Read update


## M02 · Let’s get you ready.

**Audience:** Client. **Navigation:** Getting started.

**Proposed location:** `/portal/getting-started`.

**Purpose:** Three of six steps complete. Your progress is saved as you go.

**Primary action:** Continue setup.

**Required behaviour and acceptance:** Responsive C02: stack checklist tasks and open task editors as full-width sheets. Preserve labels, ownership, required status and return focus.

[Full-size editable wireframe](./wireframes/M02.svg) · [Open in screen browser](./wireframes.html#M02)

### Exact illustrated content

**Next: share your brand assets.** (hero)

Add your approved logo, brand guide and final copy so we can prepare your project.

Action: **Upload assets**.

**Your launch checklist** (timeline)

- ✓ — Confirm your details — Completed · 12 Sep

- ✓ — Review and sign your agreement — Signed · revision 2

- ✓ — Set up billing — Deposit paid · £1,200

- 4 — Share brand assets — Your action · logo, brand guide and approved copy

- 5 — Confirm kickoff — Choose from the times offered by FSS

- 6 — Ready to begin — FSS confirms the start after all prerequisites are met


## M03 · Requests & feedback

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests`.

**Purpose:** A shared view of what is coming, moving and ready for you.

**Primary action:** New request.

**Required behaviour and acceptance:** Responsive C05: use readable list cards and explicit state/filter controls. Move to and review use sheets; do not squeeze six lanes into the viewport.

[Full-size editable wireframe](./wireframes/M03.svg) · [Open in screen browser](./wireframes.html#M03)

### Exact illustrated content

**Request state** (choices)

- All

- For review

- In progress

**Your requests** (rows)

- Booking flow v3 — Ready for review · Alex Morgan — Review

- Confirmation email — In progress · Jean-Fidele — Open

- Customer account area — New · Scope assessment — Open


## M04 · Report a problem

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests/new?type=bug`.

**Purpose:** Tell us what happened so we can reproduce it.

**Primary action:** Submit bug report.

**Required behaviour and acceptance:** Responsive C07: stack all labelled fields, use suitable keyboards and preserve input across upload/error states. Keep submit reachable without overlaying the last field.

[Full-size editable wireframe](./wireframes/M04.svg) · [Open in screen browser](./wireframes.html#M04)

### Exact illustrated content

**Request type** (choices)

- New work

- Change

- Bug report

- Help

**The problem** (fields)

- Project — Website & booking experience  ⌄

- Short title — Booking confirmation shows the wrong time

- Steps to reproduce — 1. Choose a 10:00 slot.
2. Complete a test booking.
3. Open the confirmation email.

- What you expected — The email should show 10:00 Europe/London.

- What happened instead — The email shows 09:00.

**Impact & environment** (fields)

- Impact — Incorrect appointment time for customers

- Page URL · optional — https://northstar.example/book

- Browser / device · optional — Safari · iPhone


## M05 · Ready for your review

**Audience:** Client. **Navigation:** Requests.

**Proposed location:** `/portal/requests/:request/review`.

**Purpose:** NS-014 · Booking confirmation email · Version 3

**Primary action:** Open preview.

**Required behaviour and acceptance:** Responsive C09: version and review instructions precede decisions. Acceptance/changes controls remain 44 px targets and never obscure deliverable content.

[Full-size editable wireframe](./wireframes/M05.svg) · [Open in screen browser](./wireframes.html#M05)

### Exact illustrated content

**Does this meet the agreed outcome?** (hero)

Check the time, studio address and booking reference in the preview. Your decision applies to version 3.

Action: **Open preview**.

**What changed** (rows)

- Correct local time — Bookings now display Europe/London time.

- Clearer appointment details — The confirmation includes the address, date and booking reference.

**Your decision** (notice)

Accept this version when you are happy with the agreed work, or request changes with specific feedback.

**Review version 3** (review)

I confirm this deliverable meets the agreed requirements.

Actions: Accept version 3; Request changes.


## M06 · Your agreement, clearly explained.

**Audience:** Client. **Navigation:** Agreements.

**Proposed location:** `/portal/agreements/:agreement`.

**Purpose:** Website & booking experience · Revision 2

**Primary action:** Continue to signing.

**Required behaviour and acceptance:** Responsive C15: summaries stack above the document; offer readable full-screen preview/download. Signing retains the same exact-version safeguards.

[Full-size editable wireframe](./wireframes/M06.svg) · [Open in screen browser](./wireframes.html#M06)

### Exact illustrated content

- £4,800 — One-off total

- £1,200 — Initial deposit

- 4 — Delivery milestones

**At a glance** (rows)

- What we will deliver — Five content pages, booking workflow, confirmation email and handover.

- What you provide — Approved brand assets, website copy and one authorised reviewer.

- Payment schedule — £1,200 deposit + 3 milestone payments of £1,200. Tax follows the agreement.

- Support & changes — Agreed defect support and a separate quote for additional scope.

**Full agreement** (document)

Scope, fees, delivery assumptions, responsibilities, support and terms.


## M07 · Your studio, in focus.

**Audience:** Founder. **Navigation:** Overview.

**Proposed location:** `/growth/operations`.

**Purpose:** Tuesday, 15 September · All clients

**Primary action:** View delivery.

**Required behaviour and acceptance:** Responsive F01: prioritise exceptions and next actions. Founder navigation uses Overview, Clients, Delivery and More; never reuse client-only navigation labels.

[Full-size editable wireframe](./wireframes/M07.svg) · [Open in screen browser](./wireframes.html#M07)

### Exact illustrated content

**Three decisions will move work forward.** (hero)

One request needs assessment, one agreement needs review and one welcome step needs attention.

Action: **Open action queue**.

- 3 / 3 — Delivery capacity

- 2 — Client reviews open

- £2,400 — Invoices overdue

**Needs your attention** (rows)

- Northstar · Review booking scope — New request · acknowledgement target today — Assess request

- Harbour · Finish agreement — Missing engagement link — Continue agreement

- Northstar · Welcome email — Delivery outcome unknown · reconcile before retry — Resolve delivery

**This week** (rows)

- Northstar · Website & booking — Design review 17 Sep · next action with client — View client

- Harbour · Membership portal — Kickoff pending agreement and assets — View client


## M08 · Ready when you are.

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/clients/:org/journey/new?step=activate`.

**Purpose:** Step 5 · Review exactly what starting will do.

**Primary action:** Start journey.

**Required behaviour and acceptance:** Responsive F23: show each preflight result in order, preserve repair links, and put the final activation action after the complete review. A disabled button always has an adjacent reason.

[Full-size editable wireframe](./wireframes/M08.svg) · [Open in screen browser](./wireframes.html#M08)

### Exact illustrated content

**Preflight** (timeline)

- ✓ — Client and contacts — Northstar Studio · Alex Morgan

- ✓ — Welcome email and guide — Approved content · accessible version ready

- ✓ — Proposal and signers — Revision 2 · Alex and Jean-Fidele

- ✓ — Billing and portal roles — First obligation selected · existing access reused

- ✓ — Delivery settings — Sender verified · provider and worker ready

**Start this journey** (notice)

Queues the reviewed welcome email to Alex now. The proposal follows its timing and approval gates. Later invoice and access steps wait for verified signatures.

**Final previews** (rows)

- Welcome · proposal · thank-you · activation emails — Exact recipients and content retained — Open previews


## C26 · Tell us about your team

**Audience:** Client. **Navigation:** Getting started.

**Proposed location:** `/portal/onboarding/tasks/:task`.

**Purpose:** Getting started · Task 1 of 6

**Primary action:** Save profile.

**Required behaviour and acceptance:** Validate labelled profile fields and approved contact references. Save only the task/profile data the member may edit; role selection cannot grant access. Mark the task complete from a persisted valid profile, retaining the completion actor and time.

[Full-size editable wireframe](./wireframes/C26.svg) · [Open in screen browser](./wireframes.html#C26)

### Exact illustrated content

**Your working details** (fields)

- Preferred name — Alex Morgan

- Role — Operations director

- Decision maker — Alex Morgan ▾

- Billing contact — Morgan Lee ▾

- Best way to contact you — Email ▾

**Used to support your project** (notice)

These details help us contact the right people. Changing a contact does not grant portal access.


## C27 · Bring your brand with you

**Audience:** Client. **Navigation:** Getting started.

**Proposed location:** `/portal/onboarding/tasks/:task/upload`.

**Purpose:** Getting started · Upload approved project assets

**Primary action:** Submit assets.

**Required behaviour and acceptance:** Use the same secure upload pipeline as documents. Validate file type, size and task requirements. Submit remains unavailable while required files are uploading/quarantined. Replacing/removing a file preserves audit history and updates completion evidence.

[Full-size editable wireframe](./wireframes/C27.svg) · [Open in screen browser](./wireframes.html#C27)

### Exact illustrated content

**Add your files** (fields)

- Files — Choose files or drop them here — Accepted formats and size limit come from the project upload policy.

- What are these files? — Approved logo and brand guidelines

- Notes for FSS — Use the teal logo on light backgrounds.

**Upload status** (rows)

- Northstar-logo.svg — Uploaded · Safety checks passed — Remove

- Brand-guidelines.pdf — Checking file · 2.4 MB — Cancel upload

**One file is still being checked** (notice)

You can leave this page. Submit assets becomes available when all included files pass the checks.


## C28 · Let’s plan the kickoff

**Audience:** Client. **Navigation:** Getting started.

**Proposed location:** `/portal/onboarding/tasks/:task/booking`.

**Purpose:** Getting started · Meet your delivery lead

**Primary action:** Choose a time.

**Required behaviour and acceptance:** Open the configured trusted booking destination with correct timezone context. Mark complete only through a verified booking event or explicit founder confirmation with evidence. Cancellation/reschedule updates the task and next action.

[Full-size editable wireframe](./wireframes/C28.svg) · [Open in screen browser](./wireframes.html#C28)

### Exact illustrated content

**A clear start, together.** (hero)

A 30-minute session to confirm priorities, dependencies and what success looks like. Your delivery lead is Jean-Fidele.

Action: **Choose a time**.

**Before we meet** (rows)

- Your goals — Bring your top three outcomes and any fixed deadlines.

- The right people — Invite anyone responsible for content, decisions or access.

- Booking status — No confirmed time yet. We will show it here once the booking is verified.

**Times shown in Europe/London** (notice)

The booking service shows available times. Opening the calendar does not mark this task complete.


## C29 · You’re ready for the next step.

**Audience:** Client. **Navigation:** Getting started.

**Proposed location:** `/portal/onboarding?state=complete`.

**Purpose:** Your required setup tasks are complete.

**Primary action:** View your project.

**Required behaviour and acceptance:** Display only after every required task has valid evidence. Optional incomplete tasks remain accessible. The primary action opens the real project; future service-start gates still apply independently.

[Full-size editable wireframe](./wireframes/C29.svg) · [Open in screen browser](./wireframes.html#C29)

### Exact illustrated content

**Everything is in place.** (hero)

Your team details, agreement and assets are ready. Your next milestone is the kickoff.

Action: **View your project**.

**Your setup** (timeline)

- ✓ — Team details confirmed — Alex Morgan · 15 September

- ✓ — Agreement signed — Version 2 · all required parties

- ✓ — Approved assets received — 3 files retained

- ✓ — Kickoff confirmed — 18 September · 10:00 Europe/London

**Need to update something?** (notice)

Your completed checklist stays available. You can contact FSS if your people, assets or requirements change.


## C30 · Signed. A clear beginning.

**Audience:** Client. **Navigation:** Agreements.

**Proposed location:** `/portal/agreements/:agreement?state=signed`.

**Purpose:** Your agreement signature has been recorded.

**Primary action:** Continue setup.

**Required behaviour and acceptance:** Display all-parties signed only when verified evidence exists for every required signer. A partial result instead says Your signature is recorded, awaiting other signers. Link the immutable retained copy and remaining setup tasks.

[Full-size editable wireframe](./wireframes/C30.svg) · [Open in screen browser](./wireframes.html#C30)

### Exact illustrated content

**Your signed agreement is ready.** (hero)

Website & booking experience · Version 2. All required parties have signed this agreement.

Action: **Download signed agreement**.

**Your record** (rows)

- Alex Morgan — Signed 15 September 2026 · 11:24 Europe/London

- FSS authorised signer — Signed 15 September 2026 · 11:25 Europe/London

- Retained copy — The signed version stays available in Agreements. — View agreement

**What happens next** (notice)

Return to getting started for your remaining setup tasks. Billing and access steps follow the approved welcome sequence.


## F35 · Create a useful next step

**Audience:** Founder. **Navigation:** Welcome journeys.

**Proposed location:** `/growth/operations/journeys/templates/:template/tasks/:task`.

**Purpose:** Welcome checklist · Task editor

**Primary action:** Save task.

**Required behaviour and acceptance:** Validate each field against the selected task type. Require a valid destination or evidence rule; reject circular dependencies and unsupported due rules. Save a draft task; publishing a new template version is separate and never rewrites active journeys.

[Full-size editable wireframe](./wireframes/F35.svg) · [Open in screen browser](./wireframes.html#F35)

### Exact illustrated content

**Task details** (fields)

- Task title — Upload approved brand assets

- Task type — File upload ▾

- Instructions — Upload your approved logo and brand guidelines.

- Responsible role — Client owner ▾

- Required to finish setup — Yes ▾

- Depends on — Confirm team details ▾

- Due rule — 3 calendar days after activation

- Completion evidence — All required files safely retained ▾

**Client preview** (notice)

Upload approved brand assets · Required · Due 18 September. Opens a labelled upload task with progress and safety checks.


## F36 · Create work for a client

**Audience:** Founder. **Navigation:** Delivery.

**Proposed location:** `/growth/operations/requests/new`.

**Purpose:** Choose the right client and project before creating a request.

**Primary action:** Create request.

**Required behaviour and acceptance:** Require authorised client/project context and existing request command validation. Bug type reveals C07 reproduction fields. Save creates the authoritative request; never mark scope approved by default. Notify only according to configured public event policy.

[Full-size editable wireframe](./wireframes/F36.svg) · [Open in screen browser](./wireframes.html#F36)

### Exact illustrated content

**Request details** (fields)

- Client — Northstar Studio ▾

- Project — Website & booking experience ▾

- Type — Work request ▾

- Title — Add customer contact preferences

- Description — Let customers select how they want to hear from the team.

- Desired outcome — Customers can save and update their contact preference.

- Scope — Assessment pending ▾

- Owner — Jean-Fidele ▾

- Internal priority — Normal ▾

**Public and internal details stay separate** (notice)

The client sees the request and its public updates. Internal priority and founder notes remain in operations.


## F37 · Signing request prepared

**Audience:** Founder. **Navigation:** Agreements.

**Proposed location:** `/growth/operations/clients/:org/agreements/:agreement?state=awaiting-signature`.

**Purpose:** The approved agreement is awaiting signatures.

**Primary action:** View signing status.

**Required behaviour and acceptance:** Show real delivery state separately from signing state. Queue acceptance is not email delivery and is not signature. Retry or reconcile failed/unknown sends through F29/F25 without duplicating the signing request.

[Full-size editable wireframe](./wireframes/F37.svg) · [Open in screen browser](./wireframes.html#F37)

### Exact illustrated content

**Ready for the named signers.** (hero)

Version 2 is approved and retained. The signing request has been queued; no signature is recorded yet.

**Delivery and signing** (rows)

- Alex Morgan — Signing email queued · Signature pending

- FSS authorised signer — Signature pending

- Document — Website & booking experience · Version 2 — Preview agreement

**Approval is not signature** (notice)

This agreement becomes signed only after verified evidence for every required party. Failed delivery appears in the operations queue.


## F38–F43 · Active FSS Studio registers

The route register now includes client-scoped agreements, requests, and signing status, plus the cross-client project register, project creation form, and project document register. Each screen uses the current `/portal/admin` route family, permission boundary, and matching desktop/mobile visual case.

## Welcome and operations implementation contract · 2026-10-01

- **F19–F23:** one persistent five-stage composer (Setup, Content, Access, Schedule, Review). Published packet selection applies content and checklist together. Saved packet edits, recipient, permission, invoice choice and stage restore from the scoped draft. Review uses the generated email and exact PDF, and rechecks agreement, settings revision, contact and checklist provenance at the server boundary.
- **F26:** a cover-card library for Website Build, Website + SEO and Systems Portal. Editing opens inside the chosen packet, with desktop editing beside preview and explicit mobile Edit/Preview controls. Email, Packet and Checklist previews are available. Designed editions enter the existing save/publish process; existing published packs and edited drafts are preserved.
- **F28:** aggregate access cards count the complete authorised dataset independently of filters and pagination. Clients, FSS staff and Invitations views contain identity cards. Invitations and removals use focused dialogs with retained errors, pending dismissal protection and restored focus. Verified founder capability gates staff administration on the server.
- **F30:** active Identity, Communication, Timezone and Delivery cards expose contextual edits with Save and apply. Conflicting revisions retain edits until the administrator reviews current values. Availability reports deployment configuration, rather than provider health. Historical drafts do not apply automatically.
- **Client Getting started:** the approved welcome packet appears before progress and the next available task, with an equivalent semantic reading view and tenant-authorised download of the retained PDF.
- **Compatibility:** legacy five-section packs and approved bytes remain readable and valid. New ten-page approvals retain renderer version, resolved content, active settings revision and PDF hash. Welcome scheduling remains 09:00 Europe/London regardless of display timezone.
