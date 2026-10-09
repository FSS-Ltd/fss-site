# Operations electronic signing

Status: Task 9 implementation. User approved the in-house direction on 8 September 2026. Production activation remains behind the Task 14 release gate.

## Scope and decision

FSS owns the electronic signing flow for ordinary service agreements. Signers use the existing verified portal login and active organisation membership. Each signer must also match an email frozen in the agreement's required signers. Founder approval is separate from signing. If an FSS representative is a required signer, that person needs their own designated, verified portal access too.

This slice excludes deeds, witnessed execution and qualified signatures. Review the actual contract templates and applicable execution requirements before production activation. The [Law Commission's electronic execution guidance](https://lawcom.gov.uk/project/electronic-execution-of-documents/) explains the relevance of authenticating intention and required formalities; this implementation does not promise universal enforceability.

## Approval and evidence

Preparing a document creates a new immutable agreement revision, generates and retains its PDF, and binds the source hash and signer set into an approval hash. The founder reviews the frozen document, confirms it is an ordinary service agreement and chooses a signing deadline. Editing a draft or replacing a signing request invalidates the old approval while signatures remain outstanding. Once every required signer has signed, cancellation and revision are blocked even while document processing is pending. Existing manually recorded evidence retains its original provenance.

A signer explicitly supplies their name and confirms authority and consent. The server obtains their verified identity from authentication, checks active organisation access and designated signer membership, and records consent for that exact approval. Browser redirects, email links and client-supplied identity do not complete signatures.

Source PDFs, signed PDFs and audit records remain private in bounded database artifacts. Each artifact is limited to 1 MiB. The bundled PDF font supports Western European characters; unsupported names or terms are rejected before approval or consent, with a manual-workflow alternative. Full Unicode font embedding is a later extension. The signed document includes the original source PDF and audit record as attachments. Download handlers authenticate every request and return private, non-cacheable attachments. The database enforces append-only evidence and immutable revisions, independently of UI controls.

New source and signed PDFs use the FSS portal colours and monogram, numbered agreement sections, structured fees and a separate execution record. All agreement text remains selectable. A signed PDF still embeds the exact source bytes each signer approved, so already retained approvals keep their original source even if a later signing uses the updated presentation.

## Completion and Growth

Every required signature must exist before the dedicated signing worker retains final evidence and atomically marks the agreement signed. A five-minute authenticated cron retries document completion and processes the durable Growth outbox. The portal shows signatures recorded while final documents are pending.

Growth receives an explicit `operations-signing` system actor, restricted to the signed-agreement commercial transition. Only negotiation may advance to won. The existing transition service records the event and stops outreach atomically. Retries do not create another event. Existing won history is preserved; lost deals and other stages enter review rather than being overwritten or advanced through invented intermediate stages.

The immutable financial snapshot is the approved agreement. Growth's legacy whole-pence projection excludes tax and normalises recurring net values by recurrence months. Fractional monthly pence, zero totals and amounts beyond safe integer range enter `invalid_financials` review. No silent rounding changes the approved values. Operations retains all exact amounts.

## Configuration and release

- `OPERATIONS_ENABLED=true` and `OPERATIONS_SIGNING_ENABLED=true` must both be exact matches.
- `OPERATIONS_SIGNING_DATABASE_URL` connects using the dedicated `operations_signing_worker` role. Never put this connection in browser code.
- Existing founder and portal database connections retain their separate roles.
- `CRON_SECRET` protects `/api/cron/operations-signing`; the deployment schedule runs every five minutes.
- Apply the staged Operations migration only through the Task 14 release procedure. Do not promote it with routine Growth migrations.

No external signing provider account, paid subscription or sending credential is required. No automatic outbound signing notification is sent by this slice; designated signers find approved agreements in their portal.

## Recovery and rollback

Monitor cron completion/failure counts and `operations.signing_completion_outbox`. `growth_unavailable` retries after five minutes with a lease; an interrupted worker can be reclaimed after lease expiry. The outbox's immutable signed timestamp and financial snapshot survive retries. Investigate repeated artifact-generation failures before increasing worker throughput.

Review reasons are `engagement_missing`, `engagement_terminal`, `engagement_not_ready` and `invalid_financials`. A founder must resolve commercial discrepancies through the existing Growth workflow; never edit immutable signed evidence. After an authorized resolution, a privileged operator can requeue a review row by setting only its state, next attempt and failure fields. Completed rows cannot be rewritten.

For rollback, disable `OPERATIONS_SIGNING_ENABLED`. Preserve all completed signatures, artifacts and outbox records. Do not drop signing tables as a rollback method. Backups and restoration verification are required before production activation.
