import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import {
  createPortalContact,
  getPortalContact,
  issuePortalInvite,
  revokePortalMembership,
} from "../../../lib/operations/auth/repository";
import {
  claimPortalInvite,
  hashPortalInviteToken,
} from "../../../lib/operations/auth/invites";
import {
  listPortalMemberships,
  requirePortalMember,
} from "../../../lib/operations/auth/require-member";
import { withPortalTransaction } from "../../../lib/operations/db/portal-client";
import type { VerifiedPortalIdentity } from "../../../lib/operations/auth/types";

import { proveFilePolicyIsolation } from "./portal-fixtures";

const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);

test("real restricted portal role enforces invitation lifecycle, exact identity and tenant isolation", async () => {
  const admin = postgres(url, { max: 1 });
  const founderDb = postgres(url, {
    max: 2,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const concurrentPortal = postgres(url, {
    max: 2,
    connection: { options: "-c role=operations_portal" },
  });
  const founder = { actorId: "a".repeat(64) };
  const organisations = [randomUUID(), randomUUID()];
  const identity: VerifiedPortalIdentity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true,
  };
  const stranger: VerifiedPortalIdentity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true,
  };
  const correlationId = randomUUID();
  const reviewReference = "synthetic-portal-review";
  try {
    for (const organisationId of organisations) {
      await admin`insert into operations.organisations (id, legal_name, display_name, trading_status, timezone, created_by, review_reference)
        values (${organisationId}, 'Synthetic client', 'Synthetic client', 'active', 'Europe/London', ${founder.actorId}, ${reviewReference})`;
    }
    const contact = await createPortalContact(founderDb, founder, {
      organisationId: organisations[0],
      name: "Approved Contact",
      email: identity.email,
      reviewReference,
    });
    const input = {
      organisationId: organisations[0],
      contactId: contact.contactId,
      role: "owner",
      reviewReference,
    };
    assert.equal(
      await getPortalContact(founderDb, founder, {
        organisationId: organisations[1],
        contactId: contact.contactId,
      }),
      null,
    );
    assert.equal(
      (
        await getPortalContact(founderDb, founder, {
          organisationId: organisations[0],
          contactId: contact.contactId,
        })
      )?.email,
      identity.email,
    );
    await assert.rejects(
      issuePortalInvite(founderDb, null, input),
      /Founder authorization/,
    );
    await assert.rejects(
      issuePortalInvite(founderDb, founder, {
        ...input,
        organisationId: organisations[1],
      }),
      /Contact unavailable/,
    );
    await assert.rejects(
      requirePortalMember(portal, identity, organisations[0], correlationId),
      /Portal access/,
    );
    assert.deepEqual(
      await listPortalMemberships(portal, identity, correlationId),
      [],
    );
    const replaced = await issuePortalInvite(founderDb, founder, input);
    const invitation = await issuePortalInvite(founderDb, founder, input);
    assert.ok(
      Math.abs(
        invitation.expiresAt.getTime() - Date.now() - 30 * 24 * 60 * 60 * 1000,
      ) < 10000,
    );
    const [stored] = await admin<
      { token_hash: string }[]
    >`select token_hash from operations.portal_invites where token_hash = ${hashPortalInviteToken(invitation.token)}`;
    assert.notEqual(stored.token_hash, invitation.token);
    await assert.rejects(
      claimPortalInvite(portal, identity, replaced.token, correlationId),
      /Portal access/,
    );
    await assert.rejects(
      claimPortalInvite(portal, stranger, invitation.token, correlationId),
      /Portal access/,
    );
    await assert.rejects(
      claimPortalInvite(portal, null, invitation.token, correlationId),
      /Portal access/,
    );
    await assert.rejects(
      claimPortalInvite(portal, identity, "bad", correlationId),
      /Portal access/,
    );
    const claims = await Promise.allSettled([
      claimPortalInvite(
        concurrentPortal,
        identity,
        invitation.token,
        correlationId,
      ),
      claimPortalInvite(
        concurrentPortal,
        identity,
        invitation.token,
        correlationId,
      ),
    ]);
    assert.equal(
      claims.filter((result) => result.status === "fulfilled").length,
      1,
    );
    await assert.rejects(
      claimPortalInvite(portal, identity, invitation.token, correlationId),
      /Portal access/,
    );
    const otherContact = await createPortalContact(founderDb, founder, {
      organisationId: organisations[1],
      name: "Other Tenant",
      email: stranger.email,
      reviewReference,
    });
    const otherInvite = await issuePortalInvite(founderDb, founder, {
      organisationId: organisations[1],
      contactId: otherContact.contactId,
      role: "viewer",
      reviewReference,
    });
    await claimPortalInvite(portal, stranger, otherInvite.token, randomUUID());
    assert.equal(
      (
        await requirePortalMember(
          portal,
          stranger,
          organisations[1],
          correlationId,
        )
      ).role,
      "viewer",
    );
    await assert.rejects(
      requirePortalMember(portal, stranger, organisations[0], correlationId),
      /Portal access/,
    );
    assert.deepEqual(
      (await listPortalMemberships(portal, stranger, correlationId)).map(
        (membership) => membership.organisationId,
      ),
      [organisations[1]],
    );
    await proveFilePolicyIsolation(
      admin,
      identity.userId,
      organisations[0],
      organisations[1],
    );
    const context = await requirePortalMember(
      portal,
      identity,
      organisations[0],
      correlationId,
    );
    assert.deepEqual(context, {
      userId: identity.userId,
      organisationId: organisations[0],
      role: "owner",
      correlationId,
    });
    assert.deepEqual(
      await listPortalMemberships(portal, identity, correlationId),
      [
        {
          organisationId: organisations[0],
          displayName: "Synthetic client",
          role: "owner",
        },
      ],
    );
    await assert.rejects(
      requirePortalMember(portal, identity, organisations[1], correlationId),
      /Portal access/,
    );
    await assert.rejects(
      requirePortalMember(portal, identity, "guessed", correlationId),
      /Portal access/,
    );
    await assert.rejects(
      requirePortalMember(admin, identity, organisations[0], correlationId),
      /Portal access/,
    );
    await withPortalTransaction(
      portal,
      identity,
      organisations[0],
      correlationId,
      async (tx) => {
        const rows =
          await tx`select id from operations.organisations where id = ${organisations[1]}`;
        assert.equal(rows.length, 0);
        const [count] = await tx<
          { count: number }[]
        >`select count(*)::int as count from operations.portal_organisations where display_name ilike '%Synthetic%'`;
        assert.equal(count.count, 1);
        const [capability] = await tx<
          { allowed: boolean }[]
        >`select operations.portal_has_membership(${organisations[0]}, array['billing_contact']) as allowed`;
        assert.equal(capability.allowed, false);
      },
    );
    await assert.rejects(
      withPortalTransaction(
        portal,
        identity,
        organisations[0],
        correlationId,
        async (tx) =>
          tx`select created_by, review_reference from operations.organisations`,
      ),
      /permission denied/,
    );
    assert.equal(
      (await portal`select id from operations.organisations`).length,
      0,
      "pool identity cannot leak after commit",
    );
    await assert.rejects(
      withPortalTransaction(
        portal,
        identity,
        organisations[0],
        correlationId,
        async () => {
          throw new Error("rollback");
        },
      ),
      /rollback/,
    );
    assert.equal(
      (await portal`select * from operations.memberships`).length,
      0,
      "pool identity cannot leak after rollback",
    );
    await assert.rejects(
      portal`select * from growth.businesses`,
      /permission denied/,
    );
    await assert.rejects(
      portal`select * from operations.contacts`,
      /permission denied/,
    );
    await assert.rejects(
      portal`select * from operations.portal_invites`,
      /permission denied/,
    );
    await assert.rejects(
      portal`update operations.memberships set role = 'owner'`,
      /permission denied/,
    );
    await assert.rejects(
      portal`select operations.issue_portal_invite(${organisations[0]}, ${contact.contactId}, 'owner', ${"0".repeat(64)}, 'forged')`,
      /permission denied/,
    );
    const [member] = await admin<
      { id: string }[]
    >`select id from operations.memberships where user_id = ${identity.userId}`;
    await assert.rejects(
      revokePortalMembership(founderDb, founder, {
        organisationId: organisations[1],
        membershipId: member.id,
        reviewReference,
      }),
      /Membership unavailable/,
    );
    const pending = await issuePortalInvite(founderDb, founder, input);
    await revokePortalMembership(founderDb, founder, {
      organisationId: organisations[0],
      membershipId: member.id,
      reviewReference,
    });
    await assert.rejects(
      requirePortalMember(portal, identity, organisations[0], correlationId),
      /Portal access/,
    );
    await assert.rejects(
      claimPortalInvite(portal, identity, pending.token, correlationId),
      /Portal access/,
    );
    assert.deepEqual(
      await listPortalMemberships(portal, identity, correlationId),
      [],
    );
    const revokedAgain = await issuePortalInvite(founderDb, founder, input);
    await revokePortalMembership(founderDb, founder, {
      organisationId: organisations[0],
      membershipId: member.id,
      reviewReference,
    });
    await assert.rejects(
      claimPortalInvite(portal, identity, revokedAgain.token, correlationId),
      /Portal access/,
    );
    const expired = await issuePortalInvite(founderDb, founder, input);
    await admin`update operations.portal_invites set expires_at = now() - interval '1 second' where token_hash = ${hashPortalInviteToken(expired.token)}`;
    await assert.rejects(
      claimPortalInvite(portal, identity, expired.token, correlationId),
      /Portal access/,
    );
    const approvedAgain = await issuePortalInvite(founderDb, founder, input);
    await assert.rejects(
      claimPortalInvite(
        portal,
        { ...identity, userId: randomUUID() },
        approvedAgain.token,
        correlationId,
      ),
      /Portal access/,
    );
    await claimPortalInvite(
      portal,
      identity,
      approvedAgain.token,
      correlationId,
    );
    await admin`update operations.organisations set lifecycle = 'archived' where id = ${organisations[0]}`;
    await assert.rejects(
      requirePortalMember(portal, identity, organisations[0], correlationId),
      /Portal access/,
    );
    const [audit] = await admin<
      { count: number }[]
    >`select count(*)::int as count from operations.audit_events where organisation_id = ${organisations[0]} and action = 'invite.claimed' and correlation_id = ${correlationId}`;
    assert.equal(audit.count, 2);
  } finally {
    for (const organisationId of organisations) {
      await admin`delete from operations.portal_invites where organisation_id = ${organisationId}`;
      await admin`delete from operations.memberships where organisation_id = ${organisationId}`;
      await admin`delete from operations.contacts where organisation_id = ${organisationId}`;
      await admin`delete from operations.audit_events where organisation_id = ${organisationId}`;
      await admin`delete from operations.organisations where id = ${organisationId}`;
    }
    await Promise.all([
      admin.end(),
      founderDb.end(),
      portal.end(),
      concurrentPortal.end(),
    ]);
  }
});

test("database portal boundaries exclude browser and Growth roles and force RLS", async () => {
  const db = postgres(url, { max: 1 });
  try {
    const [role] = await db<
      { rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean }[]
    >`select rolsuper, rolbypassrls, rolcreaterole from pg_roles where rolname = 'operations_portal'`;
    assert.deepEqual(role, {
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: false,
    });
    for (const name of [
      "anon",
      "authenticated",
      "service_role",
      "growth_app",
    ]) {
      const [access] = await db<
        { allowed: boolean }[]
      >`select has_schema_privilege(${name}, 'operations', 'usage') as allowed`;
      assert.equal(access.allowed, false);
    }
    const tables = await db<
      {
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }[]
    >`
      select relname, relrowsecurity, relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'operations' and c.relkind = 'r'
    `;
    for (const table of tables) {
      assert.equal(table.relrowsecurity, true, table.relname);
      assert.equal(table.relforcerowsecurity, true, table.relname);
    }
  } finally {
    await db.end();
  }
});

test("durable auth rate limit admits only its fixed atomic allowance", async () => {
  const admin = postgres(url, { max: 1 });
  const portal = postgres(url, {
    max: 8,
    connection: { options: "-c role=operations_portal" },
  });
  const bucketHash = hashPortalInviteToken(randomUUID());
  try {
    const attempts = await Promise.all(
      Array.from({ length: 12 }, async () => {
        const [result] = await portal<
          { allowed: boolean }[]
        >`select operations.consume_portal_auth_limit(${bucketHash}, 'email') as allowed`;
        return result.allowed;
      }),
    );
    assert.equal(attempts.filter(Boolean).length, 5);
    const [invalid] = await portal<
      { allowed: boolean }[]
    >`select operations.consume_portal_auth_limit('raw@example.test', 'email') as allowed`;
    assert.equal(invalid.allowed, false);
    const [kind] = await portal<
      { allowed: boolean }[]
    >`select operations.consume_portal_auth_limit(${bucketHash}, 'arbitrary') as allowed`;
    assert.equal(kind.allowed, false);
    await assert.rejects(
      portal`select * from operations.portal_auth_limits`,
      /permission denied/,
    );
  } finally {
    await admin`delete from operations.portal_auth_limits where bucket_hash = ${bucketHash}`;
    await Promise.all([admin.end(), portal.end()]);
  }
});
