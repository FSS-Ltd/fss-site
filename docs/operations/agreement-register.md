# Agreement register

The founder agreement register is Task 2 of the Operations plan. It remains behind `OPERATIONS_ENABLED=true` and uses the separate `OPERATIONS_DATABASE_URL` runtime role described in [client-register.md](client-register.md).

Open an organisation from `/growth/operations/clients`, select a reviewed engagement, and enter the agreed scope, responsibilities, billing contact, signatories and private source-document reference. Enter prices in GBP; the boundary converts them to exact integer pence. One-off installments must allocate the full one-off total including tax. Recurring prices retain their monthly, quarterly or annual interval and are not included in one-off installments.

Each edit appends an immutable draft revision. Concurrent changes return a conflict and require reloading. Recording a signature requires an explicit manual founder confirmation, the exact source SHA-256, a separate signed-document SHA-256, all required signatories, a private signed artifact reference and the completion date. A separate certificate reference is optional for manual signing. These references identify previously reviewed private artifacts; this step does not upload documents or verify cryptographic signatures. Managed provider evidence arrives in Task 9.

Signing locks the revision. Use a new agreement for changed signed terms. Each service activates independently within its contractual dates, on or after signing, and no later than today. The founder must confirm required assets and sufficient cleared deposit evidence. The required deposit is a signed condition independent of installment allocation, including recurring-only agreements. Activation records manual readiness, not a payment transaction or a billing collection.

The private database enforces organisation/engagement relationships, append-only evidence, exact typed service lines, complete lines before signing, required activation policies, canonical deposit amounts, and signed dates. Writes append actor and correlation evidence in the same transaction. The runtime cannot update or delete revision, signature, service or audit history, or access Growth tables. Agreement lists are bounded to 50 per page and engagement choices to 100, with an explicit notice when further choices exist.

## Release and rollback

The CLI-generated migration is staged in `supabase/operations/migrations/20260906220831_operations_agreements.sql`. CI applies staged migrations only to disposable test databases. Production promotion belongs to Task 14. Do not run this staged migration against production as part of merging Task 2. Disable Operations to withdraw access without deleting evidence; preserve all signed records and audit history.

## Verification

Run `pnpm test:coverage:operations` with `OPERATIONS_TEST_DATABASE_URL` pointing to the named disposable loopback database. Tests execute with the real restricted `operations_founder` role, including concurrent revisions, signature locking, monetary totals, per-line readiness, invalid direct SQL and Growth-history preservation. API tests cover authorization, origin, payload limits, conflicts and redacted error responses. Browser verification uses synthetic data and responses; authenticated deployed end-to-end verification is deferred to the release gate.
