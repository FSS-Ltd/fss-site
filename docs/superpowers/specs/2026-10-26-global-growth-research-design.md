# Global Growth research intake

## Intent and scope

Accept verified businesses worldwide, including sole traders, into Growth OS for internal draft review. The user explicitly requested removing geographic and corporate intake blockers and researching 100 leads. Existing 1.0/1.1 intake and sending authorization remain intact. No deployment or production migration is part of implementation.

## Approaches

Broadly relaxing the existing schema would weaken established Kent campaign contracts and force website previews onto AI and portal opportunities. A separate unrelated lead store would duplicate Growth OS. The selected approach is a versioned 2.0 intake at the existing authenticated endpoint, using the existing businesses, contacts, prospects, evidence and agent-task tables with an internal research-only email snapshot.

## Contract and persistence

Version 2.0 accepts business identity, ISO country, optional registration and names, public contact provenance, opportunity evidence and short email copy. Registration is optional; country scopes registration identity. Company forms include sole traders, partnerships, nonprofits, other and unknown. No invented personal name, registration, financial estimate, website assessment or image is required. Optional estimates default to zero and are not quotes. Every contact uses the new research_only lawful-basis enum, irrespective of corporate form. Draft snapshots use schemaVersion 2.0 and cannot pass legacy approval parsers.

Add country_code with a GB backfill, remove the Kent county check, scope the registration unique index by country, and permit null contact names. Preserve source provenance, audit events, idempotent run IDs, transaction boundaries and suppression checks. Serialize candidate identity locks consistently with registration, Maps ID, normalized official website domain and email duplicate checks. Shared social/provider domains are not business identity keys.

## Review and safety

Growth OS displays exact supplied safe HTML/text and citations with a research-only status. It does not generate previews, replace copy with a sector template, expose revision/send/Gmail actions, or enroll sequences. Existing send/draft routes remain unchanged and reject v2 snapshots. No public research fact is inferred merely from a missing website link. Unknown contact or legal details remain null/unknown.

## Verification

Prove global intake, public-provider mailboxes, absent registration/names, safe HTML parity, provenance, duplicate registration across countries, overlapping identity locks, suppression, replay, no preview generation and no send eligibility. Run focused tests, typecheck, lint, migration checks and available database integration tests. Preserve legacy regression tests.
