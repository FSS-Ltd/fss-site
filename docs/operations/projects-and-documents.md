# Projects, milestones and private documents

Projects belong to an organisation and agreement. Clients see only explicitly shared outcomes, summaries, deliverables, delivery contacts, target dates and milestone evidence. Missing dates remain unconfirmed; the portal never invents progress percentages. Internal notes, estimates and review references are excluded by database column grants and response DTOs.

The owner, contributor and viewer roles can access projects and documents. Billing contacts cannot. Every repository query rechecks live membership using the restricted portal role and transaction-local organisation. Composite foreign keys prevent cross-organisation agreement, project and milestone links. Lists return at most 100 records; pagination must be added before an organisation exceeds that launch bound.

## Reviewed founder updates

Use the existing founder connection and owner configuration described in [client identity](client-identity.md). Prepare one reviewed JSON operation in a private, unsynced location, then validate it without writes:

```sh
pnpm exec tsx scripts/manage-operations-projects.ts /private/path/reviewed.json
pnpm exec tsx scripts/manage-operations-projects.ts /private/path/reviewed.json --apply --reviewed-by j.ntagengwa@faithfulsoftware.dev
```

The envelope contains `target` (`project` or `document`), `organisationId` and `command`. The command schema is exported from `lib/operations/projects/service.ts` or `lib/operations/documents/validation.ts`. Unknown fields are rejected. Output contains only the saved record ID and version. Updates require the current version and a review reference; stale updates fail without overwriting another change. Writes record founder identity and correlation ID in audit events.

Example project creation:

```json
{
  "target": "project",
  "organisationId": "11111111-1111-4111-8111-111111111111",
  "command": {
    "action": "create",
    "reviewReference": "approved-project-scope",
    "metadata": {
      "agreementId": "22222222-2222-4222-8222-222222222222",
      "title": "Website delivery",
      "summary": "The agreed website and enquiry journey.",
      "outcome": "Customers can understand the services and request a conversation.",
      "deliverables": ["Accessible website", "Handover guide"],
      "status": "planned",
      "ownerDisplay": "Your FSS team",
      "targetDate": null,
      "scheduleDependencies": ["Approved content"],
      "scheduleEvidence": null,
      "internalNotes": "",
      "internalEstimateMinutes": null,
      "visibility": "client"
    }
  }
}
```

Milestone commands use `action: "milestone"`, the parent `projectId` and `expectedVersion`, a nullable `milestoneId` (null creates one), public metadata and `reviewReference`. Changes increment the parent version. Document commands support create, update and revoke. Revoked documents cannot be restored by updating metadata.

## Document access and storage

Approved links must use HTTPS without embedded credentials. Private files require a dedicated private Vercel Blob store and server-only `OPERATIONS_BLOB_READ_WRITE_TOKEN`. The adapter never falls back to the existing Growth asset store or general Blob credentials. Configure a separate store/token at the release gate; no production Operations store was provisioned by this task.

The immutable object key is `operations/<organisation UUID>/<document UUID>/<SHA256>`. Display filenames are separate and cannot contain paths or control characters. File metadata includes MIME type, exact size, content hash, scan status, scan evidence and scan content hash. Cleared metadata requires evidence and a scan hash matching the content hash. This records reviewed evidence for existing deliverables; it does not claim an automated scanning service is installed.

Downloads use a same-origin authenticated route. Each request checks membership, project visibility, document visibility, expiry, revocation and scan clearance. It reads the private object with cache disabled, buffers at most 10 MB, and verifies actual size, SHA256 and file signature/content type. It then rechecks live authorisation before returning the bytes. Responses are attachments with private/no-store, no-referrer, nosniff and sandbox headers. Private object keys and provider credentials never appear in document list responses. Refreshing a project and retrying a download obtains fresh authorisation; no reusable public file URL is issued.

Allowed types are PDF, PNG, JPEG and UTF-8 plain text. Type checks reject mismatched signatures, invalid UTF-8, binary controls and executable/HTML/SVG content masquerading as text. These checks complement the required scan evidence and do not replace malware scanning.

## Upload gate

Client uploads remain disabled. No environment flag can bypass the absent scanner implementation. The intended limits are 10 MB per attachment and five attachments per request, with quarantine before access. Until a scanner is approved and integrated, use reviewed existing deliverables and the agreed secure transfer process. Do not put passwords or API keys in project documents or requests.

## Verification and release

Actual restricted PostgreSQL roles verify internal-column rejection, tenant boundaries, parent foreign keys, null dates, quarantine, expiry, revocation, pooled connections and audit evidence. A temporary private Vercel store containing only synthetic text verified anonymous rejection, successful authorised download, cross-tenant rejection before storage, and revoked-membership rejection. The synthetic object, store and empty test project were removed afterward.

Desktop and mobile screenshots of the actual components were inspected, including missing schedules, milestone evidence and shared documents. Mobile has no horizontal overflow, document controls are at least 44 px, keyboard focus is visible and 200% text reflows. Production credentials, scanner installation and full hosted multi-step journeys remain part of Task 14.

The next PR also fixes the Growth 500 regression: lazy Auth.js returns a promise from `auth(callback)`. The combined proxy now invokes `auth(request, event)` directly. An exported-handler test exercises the real Auth.js runtime for anonymous redirects, login, an authenticated founder session and portal routing.
