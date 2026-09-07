# Requests and versioned review

Task 5 adds the client request workspace and founder controls. Operations stays disabled until the release configuration is approved. Its migration is staged in `supabase/operations/migrations`, outside automatic production migration execution.

## Access and workflow

Clients open Requests from their organisation workspace. Owners and contributors can create plain-text requests and comment. Viewers have read access; billing-only contacts cannot read delivery requests. A client owner or an explicitly designated active contributor can review the exact deliverable version and review cycle. A stale request version produces a conflict rather than accepting a newer deliverable.

Founder controls are available from each organisation in the client register. They follow the state machine in [plan 04](../superpowers/plans/fss-operations-station/04-client-portal-and-requests.md). Acknowledgement confirms an owner and scope classification. Planning needs included or approved scope and a next action. Work starts only when the agreement service gates and capacity checks pass. Review requires a version, instructions and public summary. Acceptance is distinct from an administrative “Closed by FSS” record. Cancellation and reopening require reasons; records are preserved.

At launch, the founder is the only delivery owner. A stable owner identifier is shared across organisations so the proposed maximum of three items in progress applies to all client work. An explicit reason records a capacity override. Further staff identities require a separate role and owner-registry design.

The founder sets low, normal, high or urgent operational priority separately from the client’s reported impact. This internal field is excluded from portal projections and does not generate an ordinary status notification. Overdue acknowledgement/review deadlines remain first in the founder queue, followed by priority within the remaining open work.

A blocker records its start, reason, responsible party and next check date while preserving the workflow state. Scope assessment can be updated explicitly; acknowledging a quote-required request does not approve the quote or charge a payment method. Approved allowance adjustments retain their contractual unit and evidence.

Public and internal comments have separate projections. Public notification events are recorded transactionally with changes. No request route sends email or accepts an arbitrary recipient. Notification delivery and founder recovery controls are connected in their later plan tasks.

## Review and documents

Review history is append-only and records the exact deliverable version and review cycle. A client contributor without a current designation can comment but cannot accept work. Revoked membership or designation is checked again on each operation.

Approved document references reuse Task 4 access rules. Expired, revoked, internal or quarantined records do not become client-visible through a request. File uploads remain disabled pending the scanner gate. Clients are told to use the agreed secure credential-sharing process instead of putting passwords or keys into requests.

## Business clock

One business day means eight working hours, Monday–Friday 09:00–17:00 Europe/London. Acknowledgement targets use one business day and review reminders use three. They are internal targets, not a promise of round-the-clock support or automatic completion after silence.

The configured England/Wales calendar is a reviewed snapshot of the [GOV.UK bank-holiday feed](https://www.gov.uk/bank-holidays.json), retrieved 7 September 2026, covering 2024–2028. The version is `england-wales-2026-09-07`. Existing targets remain recorded; calculations fail closed outside the snapshot's year coverage. Review the source quarterly, before the final configured year ends, and after an announced exceptional bank holiday. Update `lib/operations/bank-holidays.json` through a reviewed PR, rerun calendar tests and document how any affected open targets should be recalculated. Runtime requests do not depend on a live holiday API.

## Reviewed operator command

The founder UI handles daily workflow changes. The reviewed command also supports reviewer designation and allowance adjustments. It validates without changes by default:

```sh
pnpm exec tsx scripts/manage-operations-requests.ts /path/to/reviewed-request.json
pnpm exec tsx scripts/manage-operations-requests.ts /path/to/reviewed-request.json --apply --reviewed-by "$GROWTH_OS_OWNER_EMAIL"
```

The file binds an organisation, request and expected version. Example shape (replace identifiers with reviewed records):

```json
{
  "organisationId": "10000000-0000-4000-8000-000000000001",
  "command": {
    "action": "designate_reviewer",
    "requestId": "20000000-0000-4000-8000-000000000001",
    "expectedVersion": 3,
    "userId": "30000000-0000-4000-8000-000000000001",
    "enabled": true
  }
}
```

The command accepts at most 64 KB. It uses the existing founder configuration and database guard, reports only the saved identifier/version and never sends a client message directly. A conflict requires reading the current record and reviewing the intended operation again.

## Collection bounds

The initial board shows up to 100 recent requests and filters that displayed set. The founder queue prioritises open work and overdue action deadlines within its 100-row result. Detail pages show the latest 200 comments, review entries and allowance adjustments in chronological order; allowance totals aggregate the full history. Limits are stated in the interface. Full records remain stored, and exact request URLs remain authorised independently of list visibility. Pagination is a follow-up before clients exceed these operational bounds.

## Verification

Calendar tests cover weekends, holidays, opening/closing boundaries, both daylight-saving transitions, year coverage and invalid inputs. HTTP guard tests cover verified identity, route-bound IDs, cross-origin rejection, input size/media type, rate limits, private errors and optimistic conflicts. Real restricted-role database tests also cover concurrent create/update, stale deliverables, version-labelled documents, administrative reopen, priority, capacity, review designation and audit integrity. Browser checks use actual components with synthetic requests and mocked mutations; they cover mobile reflow, keyboard controls and failed-submit recovery. Full hosted authentication-to-request end-to-end testing and a dedicated screen-reader session remain part of release verification. See [implementation progress](implementation-progress.md) for the final suite/build results.
