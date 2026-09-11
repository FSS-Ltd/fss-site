import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { applyPortalOperation } from "../../../lib/operations/auth/operator";
import { claimPortalInviteForVerifiedEmail } from "../../../lib/operations/auth/invites";
import { requirePortalMember } from "../../../lib/operations/auth/require-member";

test("reviewed operator scopes provisioning, creates claimable invitations and revokes live membership", async () => {
  const url = requireOperationsTestDatabaseUrl(
    process.env.OPERATIONS_TEST_DATABASE_URL,
  );
  const admin = postgres(url, { max: 1 });
  const founderDb = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const founder = { actorId: "a".repeat(64) };
  const organisationId = randomUUID();
  const email = `${randomUUID()}@example.test`;
  const reviewReference = "synthetic-operator-review";
  const provisioned: { email: string; redirectUrl: string }[] = [];
  const provision = async (provisionedEmail: string, redirectUrl: string) => {
    provisioned.push({ email: provisionedEmail, redirectUrl });
  };
  try {
    await admin`insert into operations.organisations (id,legal_name,display_name,trading_status,timezone,created_by,review_reference) values (${organisationId},'Synthetic','Synthetic','active','Europe/London',${founder.actorId},${reviewReference})`;
    const created = await applyPortalOperation(
      founderDb,
      founder,
      {
        action: "create_contact",
        organisationId,
        name: "Synthetic Contact",
        email,
        reviewReference,
      },
      "https://portal.example.test",
    );
    assert.equal(created.action, "create_contact");
    if (created.action !== "create_contact")
      throw new Error("Unexpected operation result");
    await assert.rejects(
      applyPortalOperation(
        founderDb,
        founder,
        {
          action: "issue_invite",
          organisationId: randomUUID(),
          contactId: created.contactId,
          role: "viewer",
          reviewReference,
        },
        "https://portal.example.test",
      ),
      /contact was not found/,
    );
    assert.equal(provisioned.length, 0);
    const issued = await applyPortalOperation(
      founderDb,
      founder,
      {
        action: "issue_invite",
        organisationId,
        contactId: created.contactId,
        role: "viewer",
        reviewReference,
      },
      "https://portal.example.test",
      provision,
    );
    assert.equal(issued.action, "issue_invite");
    if (issued.action !== "issue_invite")
      throw new Error("Unexpected operation result");
    assert.deepEqual(provisioned, [
      { email, redirectUrl: "https://portal.example.test/portal/activate" },
    ]);
    const activation = new URL(issued.activationUrl);
    assert.equal(activation.origin, "https://portal.example.test");
    assert.equal(activation.pathname, "/portal/activate");
    assert.equal(activation.search, "");
    assert.equal(activation.hash, "");
    const identity = {
      userId: randomUUID(),
      email,
      emailVerified: true as const,
    };
    assert.equal(
      await claimPortalInviteForVerifiedEmail(portal, identity, randomUUID()),
      true,
    );
    assert.equal(
      (
        await requirePortalMember(
          portal,
          identity,
          organisationId,
          randomUUID(),
        )
      ).role,
      "viewer",
    );
    const [member] = await admin<
      { id: string }[]
    >`select id from operations.memberships where organisation_id=${organisationId}`;
    await applyPortalOperation(
      founderDb,
      founder,
      {
        action: "revoke_membership",
        organisationId,
        membershipId: member.id,
        reviewReference,
      },
      "https://portal.example.test",
    );
    await assert.rejects(
      requirePortalMember(portal, identity, organisationId, randomUUID()),
      /Portal access/,
    );
  } finally {
    await admin`delete from operations.portal_invites where organisation_id=${organisationId}`;
    await admin`delete from operations.memberships where organisation_id=${organisationId}`;
    await admin`delete from operations.contacts where organisation_id=${organisationId}`;
    await admin`delete from operations.audit_events where organisation_id=${organisationId}`;
    await admin`delete from operations.organisations where id=${organisationId}`;
    await Promise.all([admin.end(), founderDb.end(), portal.end()]);
  }
});
