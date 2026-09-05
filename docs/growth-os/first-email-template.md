# First Email Template

Status: Canonical sector-example copy for unstarted outreach

The application renders this at research ingestion and again after a private
concept is approved. Existing published concept links are retained alongside
sector examples. The founder still reviews and approves every external draft
or send. Started outreach is never rewritten by the template refresh.

Subject: `{{approvedSubject}}`

```text
I work with local service firms that need their website to turn interest into a
useful first conversation. A clear offer and an enquiry route that gathers the
right details can make that next step easier for customers and the team.

Your site already has a useful starting point: {{verifiedStrength}}.

The opportunity is to make the next step more useful:
{{journeyImprovementOne}}. {{journeyImprovementTwo}}.

I’ve built four interactive examples for your sector using fictional companies.
Each takes a different design approach to clear services and a useful enquiry:

{{exampleOneName}} ({{exampleSector}}): {{exampleOneUrl}}
{{exampleTwoName}} ({{exampleSector}}): {{exampleTwoUrl}}
{{exampleThreeName}} ({{exampleSector}}): {{exampleThreeUrl}}
{{exampleFourName}} ({{exampleSector}}): {{exampleFourUrl}}

[When a published bespoke concept exists:]
Your existing private concept is also available: {{previewUrl}}

These are demonstrations, not client results. The design and journey would be
adapted to your business.

{{conceptDisclaimer}}

{{optOutSentence}}

Would a short call to explore this be useful?
```

The renderer uses the catalog in `lib/sector-examples/catalog.ts`. Business names disambiguate researched broad sector labels. Unsupported
sectors receive the collection link with wording that explicitly says
these examples are from other sectors. It never claims that a fictional example
was built specifically for the recipient. URLs are clickable in HTML and remain
visible in plain text. The existing 140–220 word, opt-out, disclaimer and safe
HTML rules remain enforced.

See `docs/sector-examples/implementation.md` for the dry-run refresh and release
sequence. Deploy the examples before refreshing stored live drafts.
