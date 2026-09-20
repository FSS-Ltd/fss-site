import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { applyPortalOperation } from "../../../lib/operations/auth/operator";
import {
  claimClerkPortalInvitation,
  claimPortalInviteForVerifiedEmail,
} from "../../../lib/operations/auth/invites";
import type { PortalInvitationMetadata } from "../../../lib/operations/auth/clerk-invitation";
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
  const provisioned: {
    email: string;
    redirectUrl: string;
    metadata?: PortalInvitationMetadata;
  }[] = [];
  const provision = async (
    provisionedEmail: string,
    redirectUrl: string,
    metadata: (typeof provisioned)[number]["metadata"],
  ) => {
    provisioned.push({
      email: provisionedEmail,
      redirectUrl,
      ...(metadata ? { metadata } : {}),
    });
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
    const retryEmail = `${randomUUID()}@example.test`;
    await assert.rejects(
      applyPortalOperation(
        founderDb,
        founder,
        {
          action: "grant_access",
          organisationId,
          name: "Retry Contact",
          email: retryEmail,
          role: "viewer",
          reviewReference,
        },
        "https://portal.example.test",
        async () => {
          throw new Error("provider failed");
        },
      ),
      /provider failed/,
    );
    const retried = await applyPortalOperation(
      founderDb,
      founder,
      {
        action: "grant_access",
        organisationId,
        name: "Retry Contact",
        email: retryEmail,
        role: "viewer",
        reviewReference,
      },
      "https://portal.example.test",
      provision,
    );
    assert.equal(retried.action, "grant_access");
    const retryProvision = provisioned.at(-1);
    assert.equal(retryProvision?.email, retryEmail);
    assert.equal(new URL(retryProvision?.redirectUrl).pathname, "/activate");
    assert.equal(
      new URL(retryProvision?.redirectUrl).searchParams.get("name"),
      "Retry Contact",
    );
    assert.equal(
      new URL(retryProvision?.redirectUrl).searchParams.get("email"),
      retryEmail,
    );
    assert.equal(retryProvision?.metadata?.email, retryEmail);
    const [retriedContact] = await admin<{ count: number }[]>`
      select count(*)::integer as count
      from operations.contacts
      where organisation_id=${organisationId} and email=${retryEmail}
    `;
    assert.equal(retriedContact.count, 0);
    const acceptedIdentity = {
      userId: randomUUID(),
      email: retryEmail,
      emailVerified: true as const,
    };
    assert.equal(
      await claimClerkPortalInvitation(
        portal,
        retryProvision?.metadata
          ? {
              clerkUserId: "user_2zClientExample",
              identity: acceptedIdentity,
              invitation: retryProvision.metadata,
            }
          : null,
        randomUUID(),
      ),
      true,
    );
    const [acceptedContact] = await admin<{ count: number }[]>`
      select count(*)::integer as count
      from operations.contacts
      where organisation_id=${organisationId} and email=${retryEmail}
    `;
    assert.equal(acceptedContact.count, 1);
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
      {
        email: retryEmail,
        redirectUrl: `https://portal.example.test/activate?name=Retry+Contact&email=${encodeURIComponent(retryEmail)}`,
        metadata: retryProvision?.metadata,
      },
      { email, redirectUrl: "https://portal.example.test/activate" },
    ]);
    const activation = new URL(issued.activationUrl);
    assert.equal(activation.origin, "https://portal.example.test");
    assert.equal(activation.pathname, "/activate");
    assert.equal(activation.search, "");
    assert.equal(activation.hash, "");
    const legacyIdentity = {
      userId: randomUUID(),
      email,
      emailVerified: true as const,
    };
    assert.equal(
      await claimPortalInviteForVerifiedEmail(
        portal,
        legacyIdentity,
        randomUUID(),
      ),
      true,
    );
    assert.equal(
      (
        await requirePortalMember(
          portal,
          legacyIdentity,
          organisationId,
          randomUUID(),
        )
      ).role,
      "viewer",
    );
    const [member] = await admin<{ id: string }[]>`
      select m.id
      from operations.memberships m
      join operations.contacts c on c.id = m.contact_id
      where m.organisation_id=${organisationId} and c.email=${email}
    `;
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
      requirePortalMember(portal, legacyIdentity, organisationId, randomUUID()),
      /Portal access/,
    );
  } finally {
    await admin`delete from operations.portal_invitation_audit where invitation_id in (select id from operations.pending_portal_invitations where target_organisation_id=${organisationId})`;
    await admin`delete from operations.pending_portal_invitations where target_organisation_id=${organisationId}`;
    await admin`delete from operations.portal_invites where organisation_id=${organisationId}`;
    await admin`delete from operations.memberships where organisation_id=${organisationId}`;
    await admin`delete from operations.contacts where organisation_id=${organisationId}`;
    await admin`delete from operations.audit_events where organisation_id=${organisationId}`;
    await admin`delete from operations.organisations where id=${organisationId}`;
    await Promise.all([admin.end(), founderDb.end(), portal.end()]);
  }
});
