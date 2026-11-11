# Google Business Profile: Faithful Software Solutions

Fill-in-and-paste guide for creating the Google Business Profile for Faithful Software Solutions Ltd. Every value below matches the website and the schema data in `lib/seo/organisation.ts`. Where the site does not publish a value, the field says **TO FILL** and the list in section 7 names who supplies it.

## 1. Before you start

- Only the founder can do this. An agent cannot create the profile, verify it, or receive the verification code.
- Use the founder's Google account. Use a Google account that the business will keep access to, not a personal account shared with others.
- Verification is by video call, phone or postcard, as Google offers for the account. Postcard verification takes days to arrive, so start it first.
- Keep the profile name and category exactly as set out below. Google reviews edits to the name, and keyword stuffing in the name can suspend the profile.

## 2. Core details

| Field | Enter this |
|---|---|
| Business name | Faithful Software Solutions |
| Primary category | Software company |
| Additional categories | Computer consultant; Business management consultant. These are suggestions. Check each against Google's current category list before saving. |
| Website category note | Do not add "Website designer". Website design is not one of the nine services. Add it only if the site starts offering it. |
| Business model | Service-area business. Hide the address. Service area: United Kingdom. Choose a different setting only if the founder has a staffed office open to visitors. |
| Registered office (not for the profile) | 51 Hurst Road, Kennington, Ashford, England, TN24 9RS. This is published on `/privacy` as the registered office. It is not a trading address, so do not enter it as the profile address. |
| Website | https://faithfulsoftware.dev |
| Email | hello@faithfulsoftware.dev |
| Phone | TO FILL: founder |
| Opening hours | TO FILL: founder |
| Opening date | TO FILL: incorporation date, company number 16682725 |

Name note: the site header reads "Faithful Software Solutions". The footer and privacy page use the legal name "Faithful Software Solutions Ltd". The profile uses the header form. Add "Ltd" only if the founder wants the legal name on the profile, and then change it on the site as well.

## 3. Business description

Paste this into the description field. Limit: 750 characters. This text is 681 characters, counted with spaces and punctuation.

> Faithful Software Solutions is a UK software studio. We build AI integration, workflow automation and custom software for businesses of any size. Each project starts with a defined problem: a task that takes too long, a tool that no longer fits, or a decision that needs better information. We agree the scope, the first release and the points where a person approves the output before any build begins. Our services include AI agents, AI receptionists for small businesses, AI readiness audits and private AI planning for organisations that must keep their data in-house. We also build client portals and modernise existing systems. We work with clients across the United Kingdom.

If the text changes, count it again before pasting. Google truncates anything over 750 characters.

## 4. Services

Enter each as a service in the profile. Names and descriptions follow the site. Descriptions are 300 characters or fewer and contain no prices.

The first five rows are on the site today. The four AI rows come from PR B of the AI-led SEO design (`docs/superpowers/specs/2026-11-11-ai-led-seo-lead-growth-design.md`) and are not live yet. Their names and descriptions are provisional until PR B merges. Re-check all nine rows after PR B, because the reframed pages change their titles and descriptions.

| # | Service name (as on the site) | Description (300 characters or fewer) | Page URL |
|---|---|---|---|
| 1 | AI integration (provisional, TO FILL: exact name after PR B) | Connect AI models to the tools and data your business already uses. We agree the scope, the data involved and where a person approves the output before any build begins. | https://faithfulsoftware.dev/services/ai-integration |
| 2 | AI agents (provisional, TO FILL: exact name after PR B) | AI agents that carry out defined steps in a business process. We set the limits on what each agent can do, the records it can read and the decisions a person must approve. | https://faithfulsoftware.dev/services/ai-agents |
| 3 | AI receptionist (provisional, TO FILL: exact name after PR B) | An AI receptionist for small businesses, set up to answer defined enquiries. We agree the questions it handles, when it hands over to staff and what customer data it keeps. | https://faithfulsoftware.dev/services/ai-receptionist |
| 4 | AI readiness audit (provisional, TO FILL: exact name after PR B) | A structured review of where AI would help your business, which data and systems each option depends on, and which project is worth starting first. | https://faithfulsoftware.dev/services/ai-readiness-audit |
| 5 | Workflow automation | Connect operational tools and reduce repeated data entry with FSS. Scope workflow automation with human review, exception handling and clear ownership. | https://faithfulsoftware.dev/services/workflow-automation |
| 6 | Private AI | Assess private, local or self-hosted AI with FSS. Define data boundaries, hardware needs, evaluation and human oversight before committing to deployment. | https://faithfulsoftware.dev/services/private-ai |
| 7 | Custom software development | Bespoke operational software for businesses when off-the-shelf tools cannot support how the team works. We plan workflows, permissions, integrations and a first release before build begins. | https://faithfulsoftware.dev/services/custom-software-development |
| 8 | Portal development | Plan and build customer, member and staff portals. We define onboarding, role-based access and the workflows people use once they sign in. | https://faithfulsoftware.dev/services/portal-development |
| 9 | Software modernisation | Assess and modernise existing business software. We plan data migration, integrations, testing and handover before any replacement is built. | https://faithfulsoftware.dev/services/software-modernisation |

Rows 5 and 6 are live and their descriptions are the current site copy, so they can be pasted now. Rows 7 to 9 are live, but their current descriptions name UK charities and faith organisations, which PR B removes. The descriptions shown for rows 7 to 9 are the replacements PR B will publish. Paste them only after PR B is live, or the profile will describe a different page from the one it links to.

## 5. Consistency checklist

Check each item before verification and again after each site change. The profile must match the website and the public record.

- [ ] **Name.** Profile: "Faithful Software Solutions". Site header: "Faithful Software Solutions". Footer and `/privacy`: "Faithful Software Solutions Ltd".
- [ ] **Website URL.** Profile: https://faithfulsoftware.dev. Matches `url` in `lib/seo/organisation.ts`.
- [ ] **Email.** Profile: hello@faithfulsoftware.dev. Matches `email` in `lib/seo/organisation.ts`, the contact page and `/privacy`.
- [ ] **Phone.** Use the number the founder supplies in section 2. It is not published on the site footer or in the schema today. If it is added to the profile, add it to the footer and to the schema at the same time, or the two will disagree.
- [ ] **Address.** Profile address hidden. The registered office on `/privacy` (51 Hurst Road, Kennington, Ashford, England, TN24 9RS) matches Companies House. Do not show it as a trading address unless the founder has a staffed office.
- [ ] **Company number.** 16682725 on the site (`companyNumber` in `lib/seo/organisation.ts` and the privacy page) and in Companies House.
- [ ] **Services.** The nine services in section 4 match the live service pages, once PR B is merged.
- [ ] **Reply times.** The contact page says the team will reply but states no time. Do not write a reply time into the profile unless the site states one first.
- [ ] **sameAs.** After the profile is live and its URL is confirmed, add the profile URL to `sameAs` in the Organization schema in `lib/seo/schema.ts`, beside `organisation.linkedin`. Add it to `lib/seo/organisation.ts` first if the profile URL needs its own field. This is a code change, so it goes through a normal branch and PR.

## 6. After verification

- **Logo and cover image.** Logo: the site logo at `/FSS.png`, which the schema already points to. Cover image: TO FILL (see section 7).
- **Photos.** Five photos, real and current. Use the founder's own workspace, the team, or screenshots of real delivered work with client details removed. No stock images. The five photos are TO FILL (see section 7).
- **First three posts.** Suggested topics, each tied to a service:
  1. Which business tasks suit AI and which do not. Links to AI readiness audit.
  2. What a human approval step looks like inside an automated workflow. Links to workflow automation.
  3. Questions to answer before commissioning a portal or custom software build. Links to portal development and custom software development.
- **Q&A.** Seed the Q&A from the FAQ answers already on each live service page. Copy the question and the answer the page gives, word for word. Do not write new answers that the site does not give. Add the four AI pages' FAQs only after PR B is live.
- **Reviews.** After a piece of work is complete, send the client the profile's review link and ask them to share their experience. Google does not allow incentives for reviews, including discounts, gifts or free work for a review. Do not ask only clients you know are happy. Do not write reviews yourself, and do not ask staff or friends to write them as clients.
- **Posting cadence.** One post a month at minimum, each linking to a service page. Update the profile when a service, a phone number or the opening hours change.

## 7. Unknowns to fill

Each item below is listed once. Nothing in this guide invents these values.

1. **Phone number.** Supplied by: founder. Needed in section 2.
2. **Opening hours.** Supplied by: founder. Needed in section 2.
3. **Opening date.** Supplied by: founder, from the incorporation date on the Companies House record for company number 16682725. Needed in section 2.
4. **Staffed office or not.** Decided by: founder. Default is a service-area business with the address hidden. A staffed office changes the address setting in section 2.
5. **Cover image.** Supplied by: founder. Needed in section 6.
6. **Five photos.** Supplied by: founder. Needed in section 6.
7. **Exact names and descriptions for the four AI services (rows 1 to 4).** Supplied by: whoever merges PR B, once the page H1 and meta description are final. Needed in section 4.
8. **Reframed service names and descriptions (rows 5 to 9).** Re-check after PR B. Needed in section 4.
