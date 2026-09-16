type FixtureDatabase = {
  (parts: TemplateStringsArray, ...values: string[]): PromiseLike<unknown>;
  end(): Promise<void>;
};

export async function cleanupStaffInvitationFixtures(
  db: FixtureDatabase,
  invitationIds: readonly string[],
  client?: { organisationId: string; contactId: string },
): Promise<void> {
  try {
    for (const id of invitationIds) {
      await db`delete from operations.staff_invitation_audit where invitation_id = ${id}`;
      await db`delete from operations.staff_memberships where invitation_id = ${id}`;
      await db`delete from operations.pending_staff_invitations where id = ${id}`;
    }
    if (client) {
      await db`delete from operations.memberships where contact_id = ${client.contactId}`;
      await db`delete from operations.contacts where id = ${client.contactId}`;
      await db`delete from operations.audit_events where organisation_id = ${client.organisationId}`;
      await db`delete from operations.organisations where id = ${client.organisationId}`;
    }
  } finally {
    await db.end();
  }
}
