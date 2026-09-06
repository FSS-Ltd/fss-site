# Client register operator guide

Task 1 adds a founder-only, read-only register at `/growth/operations/clients`. Organisations have stable UUIDs across multiple Growth engagements. Existing prospect, deal and delivery history is unchanged. Similar names and email domains never merge automatically.

## Release and credentials

Keep `OPERATIONS_ENABLED` unset until the approved environment is ready. Exact value `true` enables the route and mapping command. `OPERATIONS_DATABASE_URL` must use a dedicated login assigned only the `operations_founder` role. Never reuse the Growth or migration administrator credential. The role can read/create register rows, but cannot edit links, delete history, read Growth records or forge audit events.

The generated SQL is held in `supabase/operations/migrations`. During development apply it only to a dedicated disposable database after the existing Growth migrations. Production promotion and credential provisioning belong to the [release gate](implementation-progress.md#release-boundary).

The audit trigger uses `SECURITY DEFINER` only to append evidence generated from inserted rows. It has an empty search path, fully qualified table names and no executable grant to application roles. Runtime users have read-only audit access. This prevents ordinary mapping commands from modifying audit history.

## Prepare a reviewed mapping

Use synthetic data in development. Obtain existing engagement UUIDs through the approved founder deal workflow. Explicitly review which engagements represent the same legal organisation. Generate one organisation UUID and retain it for all future imports; do not generate a replacement on retries.

Store the reviewed JSON outside Git and the synced vault if it contains client information. Format:

```json
{
  "reviewReference": "approved-mapping-reference",
  "organisations": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "legalName": "Example Limited",
      "displayName": "Example",
      "tradingStatus": "active",
      "timezone": "Europe/London",
      "engagementIds": ["22222222-2222-4222-8222-222222222222"]
    }
  ]
}
```

Trading status is `active`, `inactive` or `unknown`. UUIDs and timezone must be valid. A file is limited to 1 MB, 100 organisations and 100 engagement links per organisation. Duplicate IDs are rejected before writes. Review references identify the approval record; do not put private content or credentials in them.

Validate locally without a database connection:

```bash
node --import tsx scripts/map-operations-organisations.ts /path/to/reviewed.json
```

After reviewing that exact file, use the approved environment's dedicated Operations connection and configured `GROWTH_OS_OWNER_EMAIL`:

```bash
node --import tsx scripts/map-operations-organisations.ts /path/to/reviewed.json \
  --apply --reviewed-by "$GROWTH_OS_OWNER_EMAIL"
```

The email argument records operator acknowledgement. It is not a login mechanism: execution is restricted by possession of the dedicated operator database credential. Do not expose this command through an unauthenticated job or HTTP endpoint.

All entries in one file commit atomically. Repeating identical records creates no duplicate links or audit events. A conflicting organisation identity, engagement reassignment or unknown engagement fails the transaction. Correct the reviewed file and retry; do not edit historical Growth deals to resolve a mapping conflict. No emails, portal invitations, invoices or service activations are produced.
