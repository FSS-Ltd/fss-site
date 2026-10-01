# Active Studio settings

Studio settings apply one reviewed section at a time. Each apply appends an active revision and a before/after audit entry in the same staff-authorized transaction. An audit failure rolls back the active revision. Expected revisions serialize concurrent edits; a stale edit returns HTTP 409 with the applied settings for explicit review before retrying.

Historical `operations.studio_settings_drafts` remain separate. Migration `20261001150000_operations_active_studio_settings.sql` does not promote any draft. Revision zero defaults are Faithful Software Solutions, no reply-to, Europe/London, 48 response hours, and standard capacity.

The server-only, nonsecret deployment setting `OPERATIONS_STUDIO_APPROVED_REPLY_TO_ADDRESSES` is a comma-separated email allowlist. It defaults to no approved addresses. Values are trimmed, lowercased, deduplicated, and validated; malformed entries are excluded. A non-null reply-to must match this allowlist before a database transaction starts. Sender credentials and provider flags remain deployment-owned.

Identity changes Studio branding and newly prepared welcome materials. Communication changes new welcome reply-to envelopes and response guidance. Timezone changes Studio timestamp displays and defaults in both new-client entry points. Delivery capacity appears in the Studio operational identity. Existing agreements and approved content retain their frozen facts; post-signature scheduling remains 09:00 Europe/London.

`loadActiveStudioSettings(db, admin)` and `readActiveStudioSettings(tx)` expose the full typed active revision only in staff-authorized transactions. `readPortalStudioPresentationSettings(tx, organisationId)` calls a tenant-authorized SQL function and returns only revision, display name, timezone, and response expectation. Portal and worker roles have no active/audit table grants. Workers receive prepared, frozen content through the existing journey contracts.

Apply the additive migration through the established reviewed release process before enabling the new code. No provider health probes or deployment controls are exposed by the settings dashboard. A rollback to the earlier application retains historical drafts and active audit data; apply a new reviewed section revision to restore a previous setting rather than altering history.

Verification: targeted unit/SSR/reducer tests, `tests/integration/operations/studio-settings.test.ts` against an explicitly local migrated test database, and `tests/e2e/studio-settings.spec.ts` against the visual fixtures. The database test injects a synthetic audit failure, exercises a concurrent apply race, verifies cross-organisation denial and revoked staff denial, and checks worker/raw-table restrictions.
