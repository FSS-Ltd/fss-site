import assert from "node:assert/strict";
import type { OperationsDb } from "../../../lib/operations/db/client";

// Test-only stand-ins prove later file/view policies use the existing tenant gate.
// The transaction drops its fixtures before commit; no Task 4 tables are installed.
export async function proveFilePolicyIsolation(
  db: OperationsDb,
  userId: string,
  organisationId: string,
  otherOrganisationId: string,
): Promise<void> {
  await db.begin(async (tx) => {
    await tx`create table operations.portal_file_policy_fixture (organisation_id uuid not null, name text not null)`;
    await tx`alter table operations.portal_file_policy_fixture enable row level security`;
    await tx`alter table operations.portal_file_policy_fixture force row level security`;
    await tx`create policy scoped_read on operations.portal_file_policy_fixture for select to operations_portal using (operations.portal_has_membership(organisation_id, array['owner','contributor','viewer']))`;
    await tx`grant select on operations.portal_file_policy_fixture to operations_portal`;
    await tx`create view operations.portal_file_view_fixture with (security_invoker = true) as select * from operations.portal_file_policy_fixture`;
    await tx`grant select on operations.portal_file_view_fixture to operations_portal`;
    await tx`insert into operations.portal_file_policy_fixture values (${organisationId}, 'public file'), (${otherOrganisationId}, 'private file')`;
    await tx`set local role operations_portal`;
    await tx`select set_config('operations.user_id', ${userId}, true), set_config('operations.organisation_id', ${organisationId}, true)`;
    assert.equal(
      (
        await tx`select * from operations.portal_file_view_fixture where organisation_id = ${otherOrganisationId}`
      ).length,
      0,
    );
    const [count] = await tx<
      { count: number }[]
    >`select count(*)::int as count from operations.portal_file_view_fixture where name ilike '%file%'`;
    assert.equal(count.count, 1);
    await tx`reset role`;
    await tx`drop view operations.portal_file_view_fixture`;
    await tx`drop table operations.portal_file_policy_fixture`;
  });
}
