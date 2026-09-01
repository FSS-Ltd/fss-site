# FSS Growth OS Email Content And Image Standard

Status: Approved
Applies to: Gmail cold outreach, Resend site emails, newsletter emails, and dashboard previews

## Channel Rule

| Message                       | Provider         | Consent position                                          | Visual treatment                                            |
| ----------------------------- | ---------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| Personalised first cold email | Gmail API        | Verified corporate subscriber and documented lawful basis | Text-first, one prospect-specific or approved sector visual |
| Day 5, 11, and 14 follow-ups  | Gmail API        | Same approved corporate sequence                          | Text-only in the original thread                            |
| Direct replies                | Founder in Gmail | Human conversation                                        | Manual only                                                 |
| Site enquiry acknowledgement  | Resend           | Requested transactional message                           | Full FSS template and generated editorial visual            |
| Resource delivery             | Resend           | Requested transactional message                           | Full FSS template and relevant generated visual             |
| Client delivery thank-you     | Resend           | Existing client relationship                              | Full FSS template and optional newsletter opt-in invitation |
| Newsletter welcome            | Resend           | Explicit opt-in                                           | Full FSS template and generated editorial visual            |
| Newsletter issue              | Resend           | Active opt-in                                             | Full FSS editorial layout and generated visual              |

Resend must never receive a cold prospect as a marketing recipient.

## FSS Voice

- Open with a position or a real problem.
- Use specific operational language.
- Explain why the recommendation matters.
- Keep the founder visible as a person, not a campaign persona.
- Close with a short direct question or next step.
- Use British English.
- Do not use em dashes, inflated claims, false urgency, corporate filler, or exclamation marks.
- Do not claim an outcome that FSS has not delivered.

## First Cold Email Structure

Target length: 140 to 220 words.
Maximum links: one ordinary FSS link plus the required privacy or opt-out link if used.
Image: one visual, 1200 by 630 source, displayed no wider than 560px, at most 180 KB.

Required blocks:

1. Personal greeting
2. Position-led opener
3. Specific verified observation
4. Practical FSS recommendation
5. Reason the change would help
6. Low-friction question
7. Founder signature
8. Direct opt-out sentence
9. Concept-image disclaimer

### Approved Example

Subject: `A simpler way to capture plumbing enquiries after hours`

```text
Hi Daniel,

Strong local firms should not lose a good enquiry simply because it arrived after the phone stopped ringing.

I found Smith & Sons while researching established plumbing companies serving Maidstone. Your public company record and local presence are clear, but I could not find a straightforward online route for a customer to explain the job, location and urgency before speaking to you.

The concept above shows the system I would build: a focused website that turns an after-hours problem into a structured call-back request, without replacing the personal service your customers expect.

Faithful Software Solutions designs practical websites and enquiry systems for local service businesses. The aim is simple: fewer missed opportunities, better information before the first call, and less time spent chasing incomplete enquiries.

Would a 15-minute conversation next week be useful?

Jean-Fidele
Faithful Software Solutions

If this is not relevant, reply no thanks and I will not contact you again.
```

Caption: `Concept visual prepared for Smith & Sons. It does not represent an existing system.`

## Follow-Up Templates

Templates are complete copy, even though they are shorter than the first email. Merge fields are limited to verified values.

### Day 5

Subject: same as the first message.

```text
Hi {{firstName}},

I wanted to bring this back to the top of your inbox.

The practical starting point for {{businessName}} would be a focused enquiry journey, not a large website project. It would collect the details your team needs before the first call and keep the response personal.

Would it be useful if I outlined the smallest version worth building?

Jean-Fidele
```

### Day 11

Day 11 is no longer a shared template. Once the Day 5 follow-up has been sent
without a reply, the daily audit agent may prepare an individual SEO and AEO
audit from public sources. The application generates a PDF with practical steps
the business can complete without a developer, then creates a draft email
linking to that report.

Every Day 11 audit email requires founder approval before it enters the Gmail
queue. The shared template system must never send a generic substitute.

### Day 14

```text
Hi {{firstName}},

I will close the loop after this message.

I contacted you because I saw a practical opportunity to make enquiries easier for customers and clearer for the team at {{businessName}}. If that becomes a priority later, you are welcome to reply to this thread.

Jean-Fidele
Faithful Software Solutions
```

No follow-up is sent if any required merge field is missing.

## Site Enquiry Thank-You

Subject: `We received your request`

Preview: `Your request is with FSS. Here is what happens next.`

```text
Hi {{firstName}},

Thank you for telling us about the enquiry process at {{businessName}}.

I will review what you shared and look for the point where the current process creates the most unnecessary work. You will receive a personal response within two working days.

What happens next

1. I read your answers and check the current journey.
2. I identify the smallest useful improvement.
3. If FSS can help, I will suggest a short conversation with a clear agenda.

There is nothing else you need to prepare. If another detail would help, reply directly to this email.

Jean-Fidele
Faithful Software Solutions
```

The transactional footer explains why the person received the message. It does not include an unsubscribe link unless the message also contains marketing content. It does not infer newsletter consent.

## Resource Delivery

Subject: `Your FSS practical guide is ready`

Preview: `Download the resource you requested and choose one useful next step.`

```text
Hi {{firstName}},

Your copy of {{resourceTitle}} is ready.

This guide is designed to help you find the part of a process that creates repeated work, missing information or avoidable delay. You do not need to change the whole system to make progress. Start with the one handoff that costs the team the most time.

Download your guide:
{{resourceUrl}}

As you work through it, write down:

1. where information first enters the process;
2. who has to retype, chase or correct it;
3. what a cleaner handoff would make possible.

If the guide exposes a problem that needs a practical software decision, reply to this email. I will tell you whether FSS is likely to be useful.

Jean-Fidele
Faithful Software Solutions
```

The primary HTML button repeats the verified `resourceUrl`. The plain-text version includes the full URL and the same explanation. Resource delivery does not create newsletter consent.

## Client Delivery Thank-You And Opt-In Invitation

Subject: `Thank you for trusting FSS with {{engagementName}}`

Preview: `Your handover is complete. Here is how to keep the work useful.`

```text
Hi {{firstName}},

Thank you for trusting Faithful Software Solutions with {{engagementName}}.

The handover marks the end of the build, but the useful result is what happens next. Keep the owner clear, review the process while it is still familiar, and tell me early if the system stops matching the way the team works.

Three things are worth keeping:

1. one named owner for the process;
2. a short review after the first month;
3. a direct route for reporting friction before it becomes a workaround.

You can reply to this email whenever a practical question appears. I would rather help you protect a useful system than let a small problem become repeated work.

If you would like occasional notes on software, automation and better operating systems, you can choose to join FSS Field Notes here:
{{newsletterOptInUrl}}

The newsletter is optional. This email has not subscribed you.

Jean-Fidele
Faithful Software Solutions
```

The founder reviews this message before its first MVP send. The opt-in URL records consent only after the client intentionally completes the subscription action. If the recipient is already subscribed or the invitation is not appropriate, render the thank-you without the invitation block.

## Newsletter Welcome

Subject: `Welcome to FSS Field Notes`

Preview: `Practical notes on software, automation and better operating systems.`

```text
Hi {{firstName}},

You are now subscribed to FSS Field Notes.

This is a practical email for founders and teams who need their systems to carry more of the work. Each issue takes one operational problem and explains the smallest useful way to improve it.

You can expect:

1. clear examples of where a process breaks;
2. grounded uses of software and automation;
3. direct advice on what not to build yet.

The aim is not to add another tool. It is to help you decide where a better system would remove repeated work, protect service quality and give the team a clearer view of what happens next.

If there is one process you want me to examine in a future issue, reply and tell me where it breaks. I read every response.

Jean-Fidele
Faithful Software Solutions
```

The footer includes the consent source, company identity, postal location, Workspace reply address, and immediate unsubscribe link. The first issue is not bundled into the welcome email.

## Newsletter Issue Pattern

Subject: `The local service website is becoming an operating system`

Preview: `Three practical ways to turn enquiries into better work.`

```text
Most local service websites stop at explaining what the business does. The better opportunity is to help the business handle what happens next.

A practical website can collect the right information before the first call, keep follow-up consistent and give the team a clearer view of work moving through the business.

1. Capture context before the call

Ask for the job type, location, urgency and preferred contact method. The team starts with useful information instead of another missed-call loop.

2. Keep the human response

Automation should prepare the conversation, not replace it. Customers still hear from a person who understands the work.

3. Connect enquiry to delivery

The same information can support quoting, scheduling and handoff. Less retyping means fewer details are lost.

Faithful Software Solutions builds these systems for organisations that need practical improvement without a long transformation programme.
```

CTA: `Read the practical guide`

Founder note:

```text
If one part of your enquiry process is creating unnecessary work, reply and tell me where it breaks. I read every response.

Jean-Fidele
```

Every newsletter contains the company identity, reason for receipt, postal location, reply address, and a frictionless unsubscribe link.

## Generated Image Standard

### Purpose

Images explain a system, journey, service concept, or editorial idea. They do not act as proof.

### Allowed

- Conceptual enquiry journeys
- Website interface concepts
- Abstract service workflow scenes
- FSS editorial system visuals
- Product-neutral diagrams rendered as polished imagery

### Prohibited

- Fabricated prospect employees or customers
- Fabricated premises, vehicles, uniforms, or logos
- Fake reviews, ratings, testimonials, revenue, or conversion results
- Before-and-after claims without real evidence
- Imitation screenshots presented as an existing prospect system
- Stock-style religious symbolism
- Tracking pixels or unique open-tracking URLs
- Text embedded in an image when accessible HTML can carry the message

### Technical Requirements

- Source: 1200 by 630 where possible
- Cold email maximum: 180 KB
- Preferred production format: WebP or JPEG after compatibility testing
- Width attribute and height attribute included
- Descriptive alt text, not a repetition of nearby copy
- Stable public URL with no recipient identifier
- Concept disclaimer immediately below a prospect-specific visual
- Plain-text email remains complete without the image
- Visual review status must be approved or fallback before send

### Cold Email Alt Text Example

`Concept showing a plumbing enquiry moving from an after-hours household problem through a mobile form to a call-back.`

### Newsletter Alt Text Example

`Connected FSS workspace showing an enquiry, team conversation and delivery schedule moving through one organised system.`

## Rendering Checks

Every final draft must pass:

- HTML render is complete
- Plain-text render is complete
- Subject and preview text are present
- Personalisation fallbacks render without blank gaps
- Image URL returns the declared MIME type
- Image has dimensions, alt text, checksum, and approved status
- Copy contains no unsupported claim
- Cold message contains direct opt-out language
- Newsletter recipient has active consent
- Links use the correct FSS domain
- Reply-To is `j.ntagengwa@faithfulsoftware.dev`
- No tracking pixel exists
- Mobile layout remains readable at 320px
- Dark-mode fallback keeps copy visible

## Review Assets

- [Cold outreach plumbing concept](mockups/email-assets/cold-outreach-plumbing-concept.png)
- [Newsletter operating-system concept](mockups/email-assets/newsletter-operating-system.png)
- [Site email thank-you concept](mockups/email-assets/site-email-thank-you.png)
- [First email review mockup](mockups/04-first-email-review-desktop.png)
- [Newsletter review mockup](mockups/08-newsletter-review-desktop.png)
- [Site email review mockup](mockups/09-site-email-review-desktop.png)
