import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { type TestContext } from "node:test";
import { claimStaffInvitationForVerifiedEmail } from "../../../lib/operations/auth/staff-invitations";
import { requireFssAdmin } from "../../../lib/operations/auth/require-admin";
import {
  AgreementBuilderDraftConflict,
  AgreementBuilderDraftValidationError,
  loadStaffAgreementBuilderDraft,
  saveStaffAgreementBuilderDraft,
} from "../../../lib/operations/agreements/builder-draft-service";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { signingFixture } from "./signing-fixtures";

async function builderFixture(t: TestContext) {
  const fixture = await signingFixture(t, 1);
  const identity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true as const,
  };
  const invitationId = randomUUID();
  await fixture.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${fixture.founder.actorId}, true)`;
    await tx`select * from operations.issue_staff_invitation(${invitationId}, 'Builder Administrator', ${identity.email}, 'builder-finalisation-test', ${fixture.correlationId})`;
  });
  assert.ok(
    await claimStaffInvitationForVerifiedEmail(
      fixture.portal,
      identity,
      fixture.correlationId,
    ),
  );
  const staff = await requireFssAdmin(
    fixture.portal,
    identity,
    fixture.correlationId,
  );
  t.after(async () => {
    // The fixture closes its own connections; use a fresh cleanup connection.
    const { default: postgres } = await import("postgres");
    const db = postgres(
      requireOperationsTestDatabaseUrl(
        process.env.OPERATIONS_TEST_DATABASE_URL,
      ),
      { max: 1 },
    );
    try {
      await db`delete from operations.staff_invitation_audit where invitation_id=${invitationId}`;
      await db`delete from operations.staff_memberships where invitation_id=${invitationId}`;
      await db`delete from operations.pending_staff_invitations where id=${invitationId}`;
    } finally {
      await db.end();
    }
  });
  const { documentHash, documentReference, ...agreement } = fixture.draft;
  assert.ok(documentHash && documentReference);
  const saved = await saveStaffAgreementBuilderDraft(
    fixture.founderDb,
    staff,
    fixture.organisationId,
    {
      action: "save",
      draftId: randomUUID(),
      expectedVersion: 0,
      step: "review",
      content: { agreement, engagementId: fixture.engagement.engagementId },
    },
    fixture.correlationId,
  );
  const finalise = (expectedVersion = saved.version) =>
    saveStaffAgreementBuilderDraft(
      fixture.founderDb,
      staff,
      fixture.organisationId,
      { action: "finalise", draftId: saved.id, expectedVersion },
      fixture.correlationId,
    );
  const agreementCount = async () =>
    (
      await fixture.admin<{ count: number }[]>`
    select count(*)::int as count from operations.agreements where organisation_id=${fixture.organisationId}
  `
    )[0].count;
  return { ...fixture, saved, staff, finalise, agreementCount };
}

test("complete builder finalisation succeeds without UPDATE permission on engagement links", async (t) => {
  const f = await builderFixture(t);
  const [privilege] = await f.admin<{ canUpdate: boolean }[]>`
    select has_any_column_privilege('operations_founder', 'operations.engagement_links', 'UPDATE') as "canUpdate"
  `;
  assert.equal(privilege.canUpdate, false);
  const agreement = await f.finalise();
  assert.equal(agreement.engagementId, f.engagement.engagementId);
  assert.equal(agreement.draft.scope, f.saved.content.agreement?.scope);
  assert.equal(await f.agreementCount(), 2);
  const [closed] = await f.admin<{ agreementId: string; finalised: boolean }[]>`
    select finalised_agreement_id as "agreementId", finalised_at is not null as finalised
    from operations.agreement_builder_drafts where id=${f.saved.id}
  `;
  assert.equal(closed.agreementId, agreement.id);
  assert.equal(closed.finalised, true);
});

test("stale builder versions never create an agreement", async (t) => {
  const f = await builderFixture(t);
  await assert.rejects(
    f.finalise(f.saved.version + 1),
    AgreementBuilderDraftConflict,
  );
  assert.equal(await f.agreementCount(), 1);
});

test("a missing organisation engagement link prevents finalisation", async (t) => {
  const f = await builderFixture(t);
  // The engagement still exists, but its linked organisation no longer matches.
  const wrongOrganisation = randomUUID();
  await f.admin`insert into operations.organisations(id,legal_name,display_name,trading_status,timezone,created_by,review_reference) values(${wrongOrganisation},'Other Test','Other Test','active','Europe/London',${f.founder.actorId},'builder-link-test')`;
  try {
    await f.admin`update operations.agreement_builder_drafts set organisation_id=${wrongOrganisation} where id=${f.saved.id}`;
    await assert.rejects(
      saveStaffAgreementBuilderDraft(
        f.founderDb,
        f.staff,
        wrongOrganisation,
        {
          action: "finalise",
          draftId: f.saved.id,
          expectedVersion: f.saved.version,
        },
        f.correlationId,
      ),
      /reviewed engagement is no longer available/i,
    );
    assert.equal(await f.agreementCount(), 1);
  } finally {
    await f.admin`update operations.agreement_builder_drafts set organisation_id=${f.organisationId} where id=${f.saved.id}`;
    await f.admin`delete from operations.audit_events where organisation_id=${wrongOrganisation}`;
    await f.admin`delete from operations.organisations where id=${wrongOrganisation}`;
  }
});

test("a failure after revision insertion rolls back creation and retains the draft", async (t) => {
  const f = await builderFixture(t);
  await f.admin`revoke insert on operations.agreement_lines from operations_founder`;
  try {
    await assert.rejects(
      f.finalise(),
      /permission denied for table agreement_lines/,
    );
    assert.equal(await f.agreementCount(), 1);
    const draft = await loadStaffAgreementBuilderDraft(
      f.founderDb,
      f.staff,
      f.organisationId,
      f.saved.id,
    );
    assert.equal(draft?.version, f.saved.version);
    const [revision] = await f.admin<
      { count: number }[]
    >`select count(*)::int as count from operations.agreement_revisions where organisation_id=${f.organisationId}`;
    assert.equal(revision.count, 1);
  } finally {
    await f.admin`grant insert on operations.agreement_lines to operations_founder`;
  }
});

test("invalid client-proposed offers retain the saved draft and explain the missing recurring work", async (t) => {
  const f = await builderFixture(t);
  const saved = await saveStaffAgreementBuilderDraft(
    f.founderDb,
    f.staff,
    f.organisationId,
    {
      action: "save",
      draftId: f.saved.id,
      expectedVersion: f.saved.version,
      step: "review",
      content: {
        ...f.saved.content,
        commercialOffer: {
          spec: { cash: { mode: "client_proposed" }, revenueShare: null },
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      },
    },
    f.correlationId,
  );
  await assert.rejects(
    saveStaffAgreementBuilderDraft(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        action: "publish",
        draftId: saved.id,
        expectedVersion: saved.version,
      },
      f.correlationId,
    ),
    (error: unknown) =>
      error instanceof AgreementBuilderDraftValidationError &&
      error.issues.some(
        (issue) =>
          issue.step === "fees" &&
          issue.message.includes("Add a recurring service"),
      ),
  );
  const retained = await loadStaffAgreementBuilderDraft(
    f.founderDb,
    f.staff,
    f.organisationId,
    saved.id,
  );
  assert.deepEqual(retained?.content, saved.content);
  assert.equal(retained?.version, saved.version);
  const [offers] = await f.admin<
    { count: number }[]
  >`select count(*)::int as count from operations.commercial_offers where organisation_id=${f.organisationId}`;
  assert.equal(offers.count, 0);
  assert.equal(await f.agreementCount(), 1);
});
