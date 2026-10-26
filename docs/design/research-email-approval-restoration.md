# Research email editing and approval

Status: Implemented and verified locally; production release pending approval.
Owner: Technical Agent. Updated: 2026-10-26.

The reported screen is a version 2 research-only first-email review, not the
legacy sequence queue repaired by PR 314. Its UI and server deliberately reject
editing and approval. The founder now requests editing, flexible copy and sending
the exact reviewed message immediately.

Use the existing revision and founder-authorized request boundaries. Persist
versioned edits and immutable approved content before delivery. For research
emails, require an explicit recipient permission basis and review note because
intake leaves contact classification unverified. Do not infer permission from
public contact information or change ingestion defaults.

Create a single-email enrollment through the existing transactional repository,
then wake the existing dispatcher for exactly the approved message. Preserve
suppression checks, stale-version rejection, auditing, idempotent provider
reconciliation, leases and error feedback. Record a manual-only follow-up policy
in existing enrollment JSON. Keep the conversation active after sending so replies
and Started talks continue through the existing workflow. No automatic follow-ups are authorized by this
single-email approval. No migration or dependency is required.

Support concise copy and natural opt-out phrasing. Keep safe HTML/plain-text
parity, content size limits, accurate word counts, a direct opt-out, and a concept
disclosure only for drafts that include a generated visual. Avoid verbatim
matching against the previous revision's wording.

Verification on Node 24.21.0 and the frozen dependency lock passed:

- 2,342 unit tests and 41 Growth database integrations on a new PostgreSQL cluster
  with all current migrations. Nine preview-contract checks skipped because no
  configured running preview was supplied.
- Ten desktop/mobile browser checks exercise the actual research review
  component, editor, confirmation, conflict, pending and permanent failure UI.
- Database flow verifies saved edits, exact approved HTML/text, one targeted
  provider call, no follow-ups, a second queued email left untouched, and replay
  rejection. A subsequent reply is recorded through the normal Gmail sync flow.
  Provider calls are mocked; no real recipient received an email.
- Type checking, production build, formatting and dependency audit pass. Lint has
  no errors and one existing `react-hooks/incompatible-library` warning in
  `components/forms/contact-form.tsx`.
- Independent review findings about opt-out false positives and terminal delivery
  feedback were fixed and regression-tested; final review has no open findings.

No production data, credentials, migrations or release settings were changed.
The application rollback is a revert of this repair; keep existing approved
message snapshots and audit records. Production release requires the normal
reviewed PR and deployment gates. A new build will expose controls on the exact
research draft page reported by the founder. Live verification must inspect
those controls without sending to a real recipient.
