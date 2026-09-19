import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  claimStaffInvitationForVerifiedEmail,
  revokeStaffMembership,
} from "../../../lib/operations/auth/staff-invitations";
import { requireFssAdmin } from "../../../lib/operations/auth/require-admin";
import type { FssAdminContext } from "../../../lib/operations/auth/staff-types";
import { listStaffAgreementRegister } from "../../../lib/operations/agreements/repository";
import { executeStaffAgreementCommand } from "../../../lib/operations/agreements/staff-service";
import { executeStaffSigningCommand } from "../../../lib/operations/agreements/signing-commands";
import { signingFixture } from "./signing-fixtures";

async function staffAdminFixture(
  fixture: Awaited<ReturnType<typeof signingFixture>>,
): Promise<{ admin: FssAdminContext; invitationId: string }> {
  const identity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true as const,
  };
  const invitationId = randomUUID();
  await fixture.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
    await tx`select * from operations.issue_staff_invitation(${invitationId}, 'Agreement Administrator', ${identity.email}, 'staff-agreement-test', ${fixture.correlationId})`;
  });
  assert.ok(
    await claimStaffInvitationForVerifiedEmail(
      fixture.portal,
      identity,
      fixture.correlationId,
    ),
  );
  return {
    admin: await requireFssAdmin(
      fixture.portal,
      identity,
      fixture.correlationId,
    ),
    invitationId,
  };
}

test("staff agreements recheck access, retain named engagements, and preserve immutable signing", async (t) => {
  const fixture = await signingFixture(t, 1);
  const { admin, invitationId } = await staffAdminFixture(fixture);
  try {
    const register = await listStaffAgreementRegister(
      fixture.founderDb,
      admin,
      fixture.organisationId,
    );
    assert.ok(register);
    assert.ok(
      register.engagementChoices?.some(
        (engagement) => engagement.id === fixture.engagement.engagementId,
      ),
    );

    const revised = await executeStaffAgreementCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      {
        action: "revise",
        agreementId: fixture.record.id,
        expectedVersion: fixture.record.version,
        draft: { ...fixture.draft, title: "Staff-reviewed terms" },
      },
      fixture.correlationId,
    );
    assert.equal(revised.version, fixture.record.version + 1);
    const [revision] = await fixture.admin<
      { createdBy: string }[]
    >`select created_by as "createdBy" from operations.agreement_revisions where organisation_id=${fixture.organisationId} and agreement_id=${fixture.record.id} and revision=${revised.revision}`;
    assert.equal(revision.createdBy, admin.actorId);

    const approval = await executeStaffSigningCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      {
        action: "prepare",
        agreementId: revised.id,
        expectedVersion: revised.version,
      },
      fixture.correlationId,
    );
    assert.equal(approval.status, "prepared");
    const approved = await executeStaffSigningCommand(
      fixture.founderDb,
      admin,
      fixture.organisationId,
      {
        action: "approve",
        approvalId: approval.id,
        approvalHash: approval.approvalHash,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
      fixture.correlationId,
    );
    assert.equal(approved.status, "approved");

    await revokeStaffMembership(
      fixture.founderDb,
      fixture.founder,
      {
        staffMembershipId: admin.membershipId,
        reviewReference: "staff-agreement-revoke-test",
      },
      randomUUID(),
    );
    await assert.rejects(
      executeStaffAgreementCommand(
        fixture.founderDb,
        admin,
        fixture.organisationId,
        {
          action: "revise",
          agreementId: revised.id,
          expectedVersion: revised.version,
          draft: fixture.draft,
        },
        fixture.correlationId,
      ),
    );
  } finally {
    await fixture.admin`delete from operations.staff_invitation_audit where invitation_id=${invitationId}`;
    await fixture.admin`delete from operations.staff_memberships where id=${admin.membershipId}`;
    await fixture.admin`delete from operations.pending_staff_invitations where id=${invitationId}`;
  }
});
