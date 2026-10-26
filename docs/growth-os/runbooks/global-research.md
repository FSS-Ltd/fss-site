# Global research drafts

Global intake uses schema version `2.0` at the existing signed research endpoint. It creates private Growth OS prospects and exact email drafts for review. It does not send email, create Gmail drafts, start sequences, generate website previews, or rewrite copy with sector templates. Existing version 1.0/1.1 runs retain their rules.

## Release order

Apply `20261026100000_growth_global_research.sql` before deploying the application changes. It adds country identity and research-only lawful basis, expands business forms, permits absent names/region, and replaces the registration index with country-scoped uniqueness. Existing rows retain GB. No data is deleted. Application rollback can leave the additive schema in place; do not attempt to remove enum values or coerce global data into the former Kent-only constraints.

## Run a batch

Keep lead data in a private file outside the repository with mode `600`. Use the Node 24 runtime and run:

```sh
node --import tsx scripts/submit-global-research.ts /absolute/private/path/batch.json
```

The helper validates v2 before reading the macOS keychain credential, signs the exact submitted bytes, and reports only run IDs, counts and accepted prospect mappings. It retries transient failures at most three times using the same run identity and body. Never print or copy keychain values into chat or logs.

Use up to ten prospects per batch, distinct stable external run IDs, and ten batches for a daily target of 100. Retrying a completed ID returns its saved result. A duplicate company/domain/Maps listing/email is counted as a duplicate, not a new lead. Global ingestion checks authoritative suppression records and rolls back the entire batch if a contact is suppressed. Remove the suppressed candidate only after recording the exclusion and use a new correction run ID.

## Contract

`lib/growth/research/global-schema.ts` is the contract. Every candidate needs verified business identity, a two-letter country code, contact provenance, source evidence, opportunity and email. Company numbers and personal names may be null. A public business mailbox on Gmail or another provider is supported; publication is not a claim of deliverability or permission to send. The email source URL must appear in first-party evidence. Financial estimates default to zero and display as not estimated, rather than a quote. Keep absent regional names null.

Email requires a subject, safe HTML, matching plain text, an accurate word count up to 2,000 and a clear opt-out in natural wording. Evidence supports observations; do not invent a private operational problem or interpret an absent website link as proof that no website exists. Google Maps records only discovery references.

All v2 contacts initially persist with lawful basis `research_only`. Drafts appear in the Outreach queue and their review pages with citations. A founder can edit the subject and copy through **Edit draft**, save a versioned revision, and select **Approve & send**. Approval requires a recipient permission basis and review note, then confirmation of the displayed recipient and subject. Public contact provenance alone does not approve outreach.

Approval freezes the exact reviewed email, records the founder decision, and immediately dispatches only that message through the existing Gmail connection. It starts no automatic follow-ups. Suppression, permission, recipient identity and prospect state are checked again before delivery. A changed draft or contact requires fresh review. Sent, pending, failed and cancelled outcomes are distinct; use the delivery-status link to inspect failures. No Gmail operation occurs merely by viewing, editing, ingesting, or saving a draft.

Text-only research drafts need no concept visual or concept disclaimer. Legacy drafts with a visual retain a concept disclosure, but its wording may be revised. Copy can be concise and the opt-out can use natural language; unsafe HTML, mismatched HTML/plain text, missing opt-out, invalid headers and excessive content remain blocked.

## Known boundary

Registration deduplication currently uses country plus registration number, not subnational registry jurisdiction. Omit a registration number unless its country-wide identity is established; use website, Maps and email identity for businesses whose registration numbers are only locally unique.
