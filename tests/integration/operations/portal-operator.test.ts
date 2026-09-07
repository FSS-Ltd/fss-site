import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { applyPortalOperation } from "../../../lib/operations/auth/operator";
import { claimPortalInvite } from "../../../lib/operations/auth/invites";
import { requirePortalMember } from "../../../lib/operations/auth/require-member";

test("reviewed operator scopes provisioning, creates claimable invitations and revokes live membership", async (t) => {
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
  const environment = {
    OPERATIONS_ENABLED: "true",
    OPERATIONS_SUPABASE_URL: "https://synthetic.example.test",
    OPERATIONS_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    OPERATIONS_SUPABASE_SECRET_KEY: "sb_secret_test",
  };
  const previous = new Map(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, environment);
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const providerInputs: unknown[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: unknown, init?: RequestInit) => {
      providerInputs.push(JSON.parse(String(init?.body)));
      return Response.json({
        id: randomUUID(),
        email,
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      });
    },
  );
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
    assert.equal(providerInputs.length, 0);
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
    );
    assert.equal(issued.action, "issue_invite");
    if (issued.action !== "issue_invite")
      throw new Error("Unexpected operation result");
    assert.deepEqual(providerInputs, [{ email, email_confirm: true }]);
    const activation = new URL(issued.activationUrl);
    assert.equal(activation.origin, "https://portal.example.test");
    assert.equal(activation.pathname, "/portal/activate");
    assert.equal(activation.search, "");
    const token = new URLSearchParams(activation.hash.slice(1)).get("invite");
    assert.ok(token);
    const identity = {
      userId: randomUUID(),
      email,
      emailVerified: true as const,
    };
    await claimPortalInvite(portal, identity, token, randomUUID());
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
