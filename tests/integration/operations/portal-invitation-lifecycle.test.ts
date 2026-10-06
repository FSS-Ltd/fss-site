import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";

test("decline and deletion keep invitation history and reject expired or accepted links", async () => {
  const url = requireOperationsTestDatabaseUrl(
    process.env.OPERATIONS_TEST_DATABASE_URL,
  );
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const actor = "a".repeat(64);
  const invitationIds = [randomUUID(), randomUUID(), randomUUID()];
  const tokens = invitationIds.map((id) =>
    createHash("sha256").update(id).digest("hex"),
  );
  try {
    for (const [index, id] of invitationIds.entries()) {
      await admin`
        insert into operations.pending_portal_invitations (
          id, name, email, role, created_by, review_reference,
          correlation_id, decline_token_hash
        ) values (
          ${id}, 'Lifecycle recipient', ${`${id}@example.test`}, 'owner',
          ${actor}, 'lifecycle-test', ${randomUUID()}, ${tokens[index]}
        )
      `;
    }
    await admin`
      update operations.pending_portal_invitations
      set expires_at = now() - interval '1 minute'
      where id = ${invitationIds[1]}
    `;
    await admin`
      update operations.pending_portal_invitations
      set state = 'accepted', accepted_at = now(), claimed_user_id = ${randomUUID()}
      where id = ${invitationIds[2]}
    `;

    const decline = (token: string) => portal<
      { invitationId: string }[]
    >`select invitation_id as "invitationId"
      from operations.decline_portal_invitation(${token}, ${randomUUID()})`;
    assert.equal((await decline("f".repeat(64))).length, 0);
    assert.equal((await decline(tokens[1])).length, 0);
    assert.equal((await decline(tokens[2])).length, 0);
    assert.equal((await decline(tokens[0]))[0]?.invitationId, invitationIds[0]);

    const [declined] = await admin<
      { state: string; dismissedAt: Date | null; auditCount: number }[]
    >`
      select state, dismissed_at as "dismissedAt",
        (select count(*)::integer from operations.portal_invitation_audit
          where invitation_id = ${invitationIds[0]} and action = 'declined') as "auditCount"
      from operations.pending_portal_invitations where id = ${invitationIds[0]}
    `;
    assert.deepEqual(declined, {
      state: "declined",
      dismissedAt: null,
      auditCount: 1,
    });

    await portal`select operations.complete_portal_invitation_decline(${tokens[0]})`;
    assert.equal((await decline(tokens[0])).length, 0);

    const prepare = (id: string) =>
      founder.begin(async (tx) => {
        await tx`select set_config('operations.actor_id', ${actor}, true)`;
        return tx<
          { invitationEmail: string }[]
        >`select invitation_email as "invitationEmail"
        from operations.prepare_access_invitation_delete('client', ${id}, 'lifecycle-test', ${randomUUID()})`;
      });
    await assert.rejects(prepare(invitationIds[2]), { code: "P0002" });
    assert.equal((await prepare(invitationIds[0])).length, 1);
    const [stillVisible] = await admin<{ dismissedAt: Date | null }[]>`
      select dismissed_at as "dismissedAt"
      from operations.pending_portal_invitations where id = ${invitationIds[0]}
    `;
    assert.equal(stillVisible.dismissedAt, null);
    await founder.begin(async (tx) => {
      await tx`select set_config('operations.actor_id', ${actor}, true)`;
      await tx`select operations.finish_access_invitation_delete(
        'client', ${invitationIds[0]}, 'lifecycle-test', ${randomUUID()}
      )`;
    });
    const [hidden] = await admin<{ dismissedAt: Date; auditCount: number }[]>`
      select dismissed_at as "dismissedAt",
        (select count(*)::integer from operations.portal_invitation_audit
          where invitation_id = ${invitationIds[0]} and action = 'dismissed') as "auditCount"
      from operations.pending_portal_invitations where id = ${invitationIds[0]}
    `;
    assert.ok(hidden.dismissedAt);
    assert.equal(hidden.auditCount, 1);
  } finally {
    await admin`delete from operations.portal_invitation_audit where invitation_id in ${admin(invitationIds)}`;
    await admin`delete from operations.pending_portal_invitations where id in ${admin(invitationIds)}`;
    await Promise.all([admin.end(), founder.end(), portal.end()]);
  }
});
