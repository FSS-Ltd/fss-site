import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { claimStaffInvitationForVerifiedEmail } from "../../../lib/operations/auth/staff-invitations";
import { requireFssAdmin } from "../../../lib/operations/auth/require-admin";
import { executeStaffSigningCommand } from "../../../lib/operations/agreements/signing-commands";
import { listStaffSigning } from "../../../lib/operations/agreements/signing-service";
import { signingFixture } from "./signing-fixtures";

const day = 24 * 60 * 60 * 1000;

test("staff reopen an expired signing request without losing recorded signatures", async (t) => {
  const fixture = await signingFixture(t, 2);
  const identity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true as const,
  };
  const invitationId = randomUUID();
  await fixture.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
    await tx`select * from operations.issue_staff_invitation(${invitationId}, 'Signing Administrator', ${identity.email}, 'signing-extension-test', ${fixture.correlationId})`;
  });
  assert.ok(
    await claimStaffInvitationForVerifiedEmail(
      fixture.portal,
      identity,
      fixture.correlationId,
    ),
  );
  const admin = await requireFssAdmin(
    fixture.portal,
    identity,
    fixture.correlationId,
  );
  const extend = (approvalId: string, days = 14) =>
    executeStaffSigningCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      { action: "extend", approvalId, days },
      randomUUID(),
    );

  try {
    const approved = await fixture.approve(await fixture.prepare());
    await fixture.sign(approved, 0);

    await assert.rejects(
      extend(approved.id),
      /no longer available/,
      "an open request cannot be extended",
    );

    await fixture.admin`update operations.signing_approvals set expires_at=clock_timestamp()-interval '1 minute' where id=${approved.id}`;
    const [expired] = (
      await listStaffSigning(
        fixture.founderDb,
        admin,
        fixture.organisationId,
        randomUUID(),
      )
    ).filter((approval) => approval.id === approved.id);
    assert.equal(expired?.status, "expired");
    await assert.rejects(
      fixture.sign(approved, 1),
      "an expired request refuses new signatures",
    );

    await assert.rejects(
      extend(approved.id, 91),
      /within 90 days/,
    );

    const before = Date.now();
    const reopened = await extend(approved.id);
    assert.equal(reopened.status, "approved");
    assert.equal(reopened.approvalHash, approved.approvalHash);
    assert.ok(
      Date.parse(reopened.expiresAt ?? "") >= before + 14 * day - 60_000,
      "the server sets the new deadline from the chosen window",
    );
    assert.deepEqual(
      reopened.signatures.map((signature) => signature.email),
      [fixture.identities[0].email],
    );
    const [audit] = await fixture.admin<
      { previous: Date | null; next: Date | null }[]
    >`select previous_expires_at as previous, expires_at as next from operations.signing_audit_events where approval_id=${approved.id} and action='deadline_extended'`;
    assert.ok(audit?.previous && audit.next && audit.next > audit.previous);

    const signed = await fixture.sign(reopened, 1);
    assert.equal(signed.signatures.length, 2);
    await fixture.admin`update operations.signing_approvals set expires_at=clock_timestamp()-interval '1 minute' where id=${approved.id}`;
    await assert.rejects(
      extend(approved.id),
      /no longer available/,
      "a fully signed request cannot be extended",
    );
  } finally {
    await fixture.admin`delete from operations.staff_invitation_audit where invitation_id=${invitationId}`;
    await fixture.admin`delete from operations.staff_memberships where id=${admin.membershipId}`;
    await fixture.admin`delete from operations.pending_staff_invitations where id=${invitationId}`;
  }
});
