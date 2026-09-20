import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";

test("a concurrent legacy claim cannot let a new scoped invitation replace its principal", async () => {
  const url = requireOperationsTestDatabaseUrl(
    process.env.OPERATIONS_TEST_DATABASE_URL,
  );
  const admin = postgres(url, { max: 1 });
  const legacy = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const scoped = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const organisationId = randomUUID();
  const invitationId = randomUUID();
  const email = `${randomUUID()}@example.test`;
  const firstUser = randomUUID();
  const secondUser = randomUUID();
  const actor = "a".repeat(64);
  let releaseLegacy: () => void = () => undefined;
  let legacyHasClaimed: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    releaseLegacy = resolve;
  });
  const claimed = new Promise<void>((resolve) => {
    legacyHasClaimed = resolve;
  });
  let legacyClaim: Promise<unknown> | undefined;
  let scopedClaim: Promise<unknown> | undefined;
  try {
    await admin`insert into operations.organisations(id,legal_name,display_name,trading_status,timezone,created_by,review_reference) values (${organisationId},'Race fixture','Race fixture','unknown','UTC',${actor},'Fixture')`;
    await admin`insert into operations.contacts(organisation_id,name,email,created_by,review_reference) values (${organisationId},'Original',${email},${actor},'Fixture')`;
    await admin`insert into operations.pending_portal_invitations(id,name,email,role,target_organisation_id,created_by,review_reference,correlation_id) values (${invitationId},'New recipient',${email},'viewer',${organisationId},${actor},'Fixture',${randomUUID()})`;
    const [{ pid }] = await scoped<
      { pid: number }[]
    >`select pg_backend_pid() as pid`;
    legacyClaim = legacy.begin(async (tx) => {
      await tx`select set_config('operations.user_id',${firstUser},true),set_config('operations.verified_email',${email},true),set_config('operations.correlation_id',${randomUUID()},true)`;
      await tx`select operations.claim_clerk_portal_invitation(${organisationId},'Original',${email},'owner','Fixture',${actor})`;
      legacyHasClaimed();
      await held;
    });
    await Promise.race([claimed, legacyClaim]);
    scopedClaim = scoped.begin(async (tx) => {
      await tx`select set_config('operations.user_id',${secondUser},true),set_config('operations.verified_email',${email},true),set_config('operations.correlation_id',${randomUUID()},true)`;
      const [row] =
        await tx`select operations.claim_pending_portal_invitation(${invitationId}) as destination`;
      return row.destination;
    });
    let blocked = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const [row] =
        await admin`select cardinality(pg_blocking_pids(${pid})) > 0 as blocked`;
      if (row.blocked) {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(
      blocked,
      true,
      "The scoped claim must wait on the legacy contact lock",
    );
    releaseLegacy();
    await legacyClaim;
    assert.equal(await scopedClaim, null);
    const [membership] =
      await admin`select user_id,role from operations.memberships where organisation_id=${organisationId}`;
    assert.equal(membership.user_id, firstUser);
    assert.equal(membership.role, "owner");
  } finally {
    releaseLegacy();
    await Promise.allSettled([legacyClaim, scopedClaim]);
    await admin`delete from operations.portal_invitation_audit where invitation_id=${invitationId}`;
    await admin`delete from operations.pending_portal_invitations where id=${invitationId}`;
    await admin`delete from operations.memberships where organisation_id=${organisationId}`;
    await admin`delete from operations.contacts where organisation_id=${organisationId}`;
    await admin`delete from operations.audit_events where organisation_id=${organisationId}`;
    await admin`delete from operations.organisations where id=${organisationId}`;
    await admin`delete from operations.user_profiles where user_id in (${firstUser},${secondUser})`;
    await Promise.all([admin.end(), legacy.end(), scoped.end()]);
  }
});
