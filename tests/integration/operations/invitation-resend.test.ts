import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";

const actor = "a".repeat(64);

test("new invitation defaults are 30 days and a reviewed resend replaces only its selected row", async () => {
  const db = postgres(
    requireOperationsTestDatabaseUrl(process.env.OPERATIONS_TEST_DATABASE_URL),
    { max: 1 },
  );
  const rollback = new Error("Roll back invitation resend fixture");
  try {
    await db.begin(async (tx) => {
      const organisationId = randomUUID();
      const contactId = randomUUID();
      const clientId = randomUUID();
      const staffId = randomUUID();
      const legacyHash = "b".repeat(64);
      const email = `${randomUUID()}@example.test`;
      const staffEmail = `${randomUUID()}@example.test`;
      await tx`insert into operations.organisations(id,legal_name,display_name,trading_status,timezone,created_by,review_reference) values(${organisationId},'Test client','Test client','unknown','UTC',${actor},'Fixture')`;
      await tx`insert into operations.contacts(id,organisation_id,name,email,created_by,review_reference) values(${contactId},${organisationId},'Client',${email},${actor},'Fixture')`;
      await tx`insert into operations.pending_portal_invitations(id,name,email,role,target_organisation_id,created_by,review_reference,correlation_id) values(${clientId},'Client',${email},'viewer',${organisationId},${actor},'Fixture',${randomUUID()})`;
      await tx`insert into operations.pending_staff_invitations(id,name,email,created_by,review_reference,correlation_id) values(${staffId},'Staff',${staffEmail},${actor},'Fixture',${randomUUID()})`;
      await tx`insert into operations.portal_invites(organisation_id,contact_id,role,token_hash,created_by,review_reference) values(${organisationId},${contactId},'viewer',${legacyHash},${actor},'Fixture')`;

      const [defaults] = await tx<
        {
          clientDays: number;
          staffDays: number;
          legacyDays: number;
        }[]
      >`
        select
          extract(epoch from (p.expires_at - p.created_at)) / 86400 as "clientDays",
          extract(epoch from (s.expires_at - s.created_at)) / 86400 as "staffDays",
          extract(epoch from (l.expires_at - l.created_at)) / 86400 as "legacyDays"
        from operations.pending_portal_invitations p
        cross join operations.pending_staff_invitations s
        cross join operations.portal_invites l
        where p.id = ${clientId} and s.id = ${staffId} and l.token_hash = ${legacyHash}
      `;
      assert.equal(Number(defaults.clientDays), 30);
      assert.equal(Number(defaults.staffDays), 30);
      assert.equal(Number(defaults.legacyDays), 30);

      const replacementId = randomUUID();
      const correlationId = randomUUID();
      await tx`select set_config('operations.actor_id', ${actor}, true)`;
      await tx`set local role operations_founder`;
      const [recipient] = await tx<
        { invitation_name: string; invitation_email: string }[]
      >`
        select * from operations.resend_portal_invitation(
          ${clientId}, ${replacementId}, 'review-42', ${correlationId}, ${"c".repeat(64)}
        )
      `;
      assert.deepEqual(recipient, {
        invitation_name: "Client",
        invitation_email: email,
      });
      await assert.rejects(
        tx.savepoint(async (savepoint) => {
          await savepoint`select * from operations.resend_portal_invitation(
            ${clientId}, ${randomUUID()}, 'review-43', ${randomUUID()}, ${"d".repeat(64)}
          )`;
        }),
        /Invitation unavailable/,
      );
      await tx`reset role`;
      const [oldRow] = await tx<
        { state: string }[]
      >`select state from operations.pending_portal_invitations where id=${clientId}`;
      const [newRow] = await tx<
        {
          state: string;
          expiresAt: Date;
          createdAt: Date;
          declineHash: string;
        }[]
      >`
        select state, expires_at as "expiresAt", created_at as "createdAt", decline_token_hash as "declineHash"
        from operations.pending_portal_invitations where id=${replacementId}
      `;
      const actions = await tx<{ action: string }[]>`
        select action from operations.portal_invitation_audit
        where invitation_id=${clientId} and correlation_id=${correlationId}
      `;
      assert.equal(oldRow.state, "revoked");
      assert.equal(newRow.state, "pending");
      assert.equal(
        (newRow.expiresAt.getTime() - newRow.createdAt.getTime()) / 86400000,
        30,
      );
      assert.equal(newRow.declineHash, "c".repeat(64));
      assert.deepEqual(
        actions.map((row) => row.action),
        ["revoked"],
      );

      const newStaffId = randomUUID();
      const staffCorrelationId = randomUUID();
      await tx`set local role operations_founder`;
      const [staffRecipient] = await tx<
        { invitation_name: string; invitation_email: string }[]
      >`
        select * from operations.resend_staff_invitation(
          ${staffId}, ${newStaffId}, 'review-staff', ${staffCorrelationId}
        )
      `;
      await tx`reset role`;
      assert.deepEqual(staffRecipient, {
        invitation_name: "Staff",
        invitation_email: staffEmail,
      });
      const [oldStaff] = await tx<{ state: string }[]>`
        select state from operations.pending_staff_invitations where id=${staffId}
      `;
      const staffActions = await tx<{ action: string }[]>`
        select action from operations.staff_invitation_audit
        where invitation_id=${staffId} and correlation_id=${staffCorrelationId}
      `;
      assert.equal(oldStaff.state, "revoked");
      assert.deepEqual(
        staffActions.map((row) => row.action),
        ["revoked"],
      );
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await db.end();
  }
});
