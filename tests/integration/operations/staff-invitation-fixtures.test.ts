import assert from "node:assert/strict";
import test from "node:test";
import { cleanupStaffInvitationFixtures } from "./staff-invitation-fixtures";

test("staff fixtures remove their audit references before deleting the client organisation", async () => {
  const client = {
    organisationId: "fixture-organisation",
    contactId: "fixture-contact",
  };
  const auditOrganisations = new Set([
    client.organisationId,
    "unrelated-organisation",
  ]);
  const organisations = new Set(auditOrganisations);
  let closed = false;
  const db = Object.assign(
    async (parts: TemplateStringsArray, ...values: string[]) => {
      const sql = parts.join("?");
      if (sql.startsWith("delete from operations.audit_events ")) {
        assert.equal(
          sql,
          "delete from operations.audit_events where organisation_id = ?",
        );
        auditOrganisations.delete(values[0]);
      }
      if (sql.startsWith("delete from operations.organisations ")) {
        assert.equal(sql, "delete from operations.organisations where id = ?");
        assert.equal(
          auditOrganisations.has(values[0]),
          false,
          "audit_events ON DELETE RESTRICT still references the fixture",
        );
        organisations.delete(values[0]);
      }
    },
    {
      end: async () => {
        closed = true;
      },
    },
  );

  await cleanupStaffInvitationFixtures(db, [], client);
  assert.deepEqual([...organisations], ["unrelated-organisation"]);
  assert.deepEqual([...auditOrganisations], ["unrelated-organisation"]);
  assert.equal(closed, true);
});

test("staff fixture cleanup closes the connection even when a deletion fails", async () => {
  const failure = new Error("fixture deletion failed");
  let closed = false;
  const db = Object.assign(
    async () => {
      throw failure;
    },
    {
      end: async () => {
        closed = true;
      },
    },
  );
  await assert.rejects(
    cleanupStaffInvitationFixtures(db, ["fixture-invitation"]),
    (error) => error === failure,
  );
  assert.equal(closed, true);
});
