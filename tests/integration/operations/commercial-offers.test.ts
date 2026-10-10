import { createBillingSchedule } from "../../../lib/operations/billing/schedules";
import { executeAgreementCommand } from "../../../lib/operations/agreements/service";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { type TestContext } from "node:test";
import {
  deleteAgreementNotifications,
  signingFixture,
} from "./signing-fixtures";
import { claimStaffInvitationForVerifiedEmail } from "../../../lib/operations/auth/staff-invitations";
import { requireFssAdmin } from "../../../lib/operations/auth/require-admin";
import {
  publishStaffCommercialOffer,
  executePortalCommercialOfferCommand,
  executeStaffCommercialOfferCommand,
  listPortalCommercialOffers,
} from "../../../lib/operations/agreements/commercial-service";
import { getPortalSigning } from "../../../lib/operations/agreements/signing-service";
import { commercialOfferSpecSchema } from "../../../lib/operations/agreements/commercial-types";
import {
  saveStaffAgreementBuilderDraft,
  AgreementBuilderDraftConflict,
} from "../../../lib/operations/agreements/builder-draft-service";
import { updateStaffClientCurrency } from "../../../lib/operations/organisations/staff-service";
import { withFssAdminTransaction } from "../../../lib/operations/auth/staff-transaction";
import { withPortalTransaction } from "../../../lib/operations/db/portal-client";
import { AgreementConflict } from "../../../lib/operations/agreements/types";
async function fixture(t: TestContext) {
  const f = await signingFixture(t, 1);
  const identity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true as const,
  };
  const invitationId = randomUUID();
  await f.founderDb.begin(async (tx) => {
    await tx`select set_config('operations.actor_id',${f.founder.actorId},true)`;
    await tx`select * from operations.issue_staff_invitation(${invitationId},'Offer administrator',${identity.email},'commercial-offer-test',${f.correlationId})`;
  });
  await claimStaffInvitationForVerifiedEmail(
    f.portal,
    identity,
    f.correlationId,
  );
  const staff = await requireFssAdmin(f.portal, identity, f.correlationId);
  const draft = {
    ...f.draft,
    lines: [
      ...f.draft.lines,
      {
        ...f.draft.lines[0],
        serviceCode: "retainer",
        recurrenceMonths: 1 as const,
        unitPence: "5000",
        discountPence: "0",
        taxPence: "0",
      },
    ],
  };
  const additionalInvitations: string[] = [];
  const reviewer = async () => {
    const nextIdentity = {
      userId: randomUUID(),
      email: `${randomUUID()}@example.test`,
      emailVerified: true as const,
    };
    const id = randomUUID();
    additionalInvitations.push(id);
    await f.founderDb.begin(async (tx) => {
      await tx`select set_config('operations.actor_id',${f.founder.actorId},true)`;
      await tx`select * from operations.issue_staff_invitation(${id},'Offer reviewer',${nextIdentity.email},'commercial-offer-review-test',${f.correlationId})`;
    });
    await claimStaffInvitationForVerifiedEmail(
      f.portal,
      nextIdentity,
      f.correlationId,
    );
    return requireFssAdmin(f.portal, nextIdentity, f.correlationId);
  };
  const publish = (spec: unknown) =>
    publishStaffCommercialOffer(
      f.founderDb,
      staff,
      f.organisationId,
      {
        engagementId: f.engagement.engagementId,
        draft,
        spec: commercialOfferSpecSchema.parse(spec),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
      f.correlationId,
    );
  const select = (offerId: string, expectedVersion: number, extra: object) =>
    executePortalCommercialOfferCommand(
      f.portal,
      f.identities[0],
      f.organisationId,
      { action: "select", offerId, expectedVersion, ...extra },
      f.correlationId,
    );
  const cleanup = async () => {
    await deleteAgreementNotifications(f.admin, f.organisationId);
    await f.admin`delete from operations.commercial_offer_branches where offer_id in(select id from operations.commercial_offers where organisation_id=${f.organisationId})`;
    await f.admin`delete from operations.commercial_offer_events where organisation_id=${f.organisationId}`;
    await f.admin`delete from operations.commercial_offers where organisation_id=${f.organisationId}`;
    for (const id of additionalInvitations) {
      await f.admin`delete from operations.staff_invitation_audit where invitation_id=${id}`;
      await f.admin`delete from operations.staff_memberships where invitation_id=${id}`;
      await f.admin`delete from operations.pending_staff_invitations where id=${id}`;
    }
    await f.admin`delete from operations.staff_invitation_audit where invitation_id=${invitationId}`;
    await f.admin`delete from operations.staff_memberships where invitation_id=${invitationId}`;
    await f.admin`delete from operations.pending_staff_invitations where id=${invitationId}`;
  };
  return { ...f, staff, draft, publish, select, cleanup, reviewer };
}
const share = {
  mode: "fixed",
  percentageBps: 2500,
  revenueSource: "Sales",
  calculationBasis: "Receipts excluding refunds",
  duration: "12 months",
  reportingRequirements: "Monthly",
  paymentTerms: "14 days",
};
test("fixed selection atomically copies the retained PDF and creates signable agreement; stale and unauthorized selection fail", async (t) => {
  const f = await fixture(t);
  try {
    const offer = await f.publish({
      cash: { mode: "fixed" },
      revenueShare: share,
    });
    const [branch] = await f.admin<
      { source_pdf: Buffer }[]
    >`select source_pdf from operations.commercial_offer_branches where offer_id=${offer.id} and option='revenue_share'`;
    const documents = await withPortalTransaction(
      f.portal,
      f.identities[0],
      f.organisationId,
      f.correlationId,
      (tx) =>
        tx<
          { bytes: Buffer; hash: string }[]
        >`select * from operations.read_commercial_offer_document(${f.organisationId},${offer.id},${"revenue_share"})`,
    );
    assert.deepEqual(documents[0].bytes, branch.source_pdf);
    const unavailable = await withPortalTransaction(
      f.portal,
      f.identities[0],
      f.organisationId,
      f.correlationId,
      (tx) =>
        tx`select * from operations.read_commercial_offer_document(${randomUUID()},${offer.id},${"revenue_share"})`,
    );
    assert.equal(unavailable.length, 0);
    const results = await Promise.allSettled([
      f.select(offer.id, 1, { option: "revenue_share" }),
      f.select(offer.id, 1, { option: "cash" }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const selected = results.find((r) => r.status === "fulfilled");
    assert.ok(selected?.status === "fulfilled");
    assert.equal(selected.value.status, "selected");
    assert.ok(selected.value.approvalId);
    const approval = await getPortalSigning(
      f.portal,
      f.identities[0],
      f.organisationId,
      selected.value.approvalId,
      f.correlationId,
    );
    assert.equal(approval?.status, "approved");
    if (approval?.draft.revenueShare) {
      const [retained] = await f.admin<
        { source_pdf: Buffer }[]
      >`select source_pdf from operations.signing_approvals where id=${approval.id}`;
      assert.deepEqual(retained.source_pdf, branch.source_pdf);
      assert.equal(approval.draft.lines[1].unitPence, "0");
    }
    await assert.rejects(
      f.select(offer.id, 1, { option: "cash" }),
      AgreementConflict,
    );
    await assert.rejects(
      f.portal`insert into operations.agreements(organisation_id,engagement_id,current_revision,created_by) values(${f.organisationId},${f.engagement.engagementId},1,${f.staff.actorId})`,
    );
    await f.admin`update operations.memberships set revoked_at=now() where organisation_id=${f.organisationId}`;
    await assert.rejects(
      listPortalCommercialOffers(
        f.portal,
        f.identities[0],
        f.organisationId,
        f.correlationId,
      ),
    );
  } finally {
    await f.cleanup();
  }
});
test("custom proposal is reviewed with exact allocations; rejection permits resubmission", async (t) => {
  const f = await fixture(t);
  try {
    const offer = await f.publish({
      cash: { mode: "client_proposed" },
      revenueShare: null,
    });
    const proposed = await f.select(offer.id, 1, {
      option: "cash",
      recurringAmountMinor: "2000",
    });
    assert.equal(proposed.status, "proposed");
    assert.equal(proposed.approvalId, null);
    const rejected = await executeStaffCommercialOfferCommand(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        action: "reject",
        offerId: offer.id,
        expectedVersion: proposed.version,
        reason: "Please revise the retainer amount.",
      },
      f.correlationId,
    );
    const resubmitted = await f.select(offer.id, rejected.version, {
      option: "cash",
      recurringAmountMinor: "3000",
    });
    await assert.rejects(
      executeStaffCommercialOfferCommand(
        f.founderDb,
        f.staff,
        f.organisationId,
        {
          action: "approve",
          offerId: offer.id,
          expectedVersion: resubmitted.version,
          draft: f.draft,
        },
        f.correlationId,
      ),
    );
    const allocated = {
      ...f.draft,
      lines: f.draft.lines.map((line) =>
        line.recurrenceMonths ? { ...line, unitPence: "3000" } : line,
      ),
    };
    const selected = await executeStaffCommercialOfferCommand(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        action: "approve",
        offerId: offer.id,
        expectedVersion: resubmitted.version,
        draft: allocated,
      },
      f.correlationId,
    );
    assert.equal(selected.status, "selected");
    const approval = await getPortalSigning(
      f.portal,
      f.identities[0],
      f.organisationId,
      selected.approvalId ?? "",
      f.correlationId,
    );
    assert.equal(approval?.draft.lines[1].unitPence, "3000");
  } finally {
    await f.cleanup();
  }
});

test("withdrawn offers and revoked staff grants cannot publish or select", async (t) => {
  const f = await fixture(t);
  try {
    const offer = await f.publish({
      cash: { mode: "fixed" },
      revenueShare: null,
    });
    const withdrawn = await executeStaffCommercialOfferCommand(
      f.founderDb,
      f.staff,
      f.organisationId,
      { action: "withdraw", offerId: offer.id, expectedVersion: offer.version },
      f.correlationId,
    );
    assert.equal(withdrawn.status, "withdrawn");
    await assert.rejects(
      f.select(offer.id, withdrawn.version, { option: "cash" }),
      AgreementConflict,
    );
    await f.admin`update operations.staff_memberships set revoked_at=now() where id=${f.staff.membershipId}`;
    await assert.rejects(
      f.publish({ cash: { mode: "fixed" }, revenueShare: null }),
    );
  } finally {
    await f.cleanup();
  }
});

test("custom approval preserves published scope and revenue proposals retain exact percent", async (t) => {
  const f = await fixture(t);
  try {
    const cash = await f.publish({
      cash: { mode: "client_proposed" },
      revenueShare: null,
    });
    const proposed = await f.select(cash.id, cash.version, {
      option: "cash",
      recurringAmountMinor: "3000",
    });
    const allocated = {
      ...f.draft,
      scope: "Changed scope",
      lines: f.draft.lines.map((line) =>
        line.recurrenceMonths ? { ...line, unitPence: "3000" } : line,
      ),
    };
    await assert.rejects(
      executeStaffCommercialOfferCommand(
        f.founderDb,
        f.staff,
        f.organisationId,
        {
          action: "approve",
          offerId: cash.id,
          expectedVersion: proposed.version,
          draft: allocated,
        },
        f.correlationId,
      ),
      AgreementConflict,
    );
    const { percentageBps: fixedPercentage, ...terms } = share;
    void fixedPercentage;
    const revenue = await f.publish({
      cash: null,
      revenueShare: { ...terms, mode: "client_proposed" },
    });
    const shareProposal = await f.select(revenue.id, revenue.version, {
      option: "revenue_share",
      percentageBps: 1000,
    });
    const selected = await executeStaffCommercialOfferCommand(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        action: "approve",
        offerId: revenue.id,
        expectedVersion: shareProposal.version,
      },
      f.correlationId,
    );
    assert.ok(selected.approvalId);
    const approval = await getPortalSigning(
      f.portal,
      f.identities[0],
      f.organisationId,
      selected.approvalId,
      f.correlationId,
    );
    assert.equal(approval?.draft.revenueShare?.percentageBps, 1000);
    assert.equal(approval?.draft.lines[1].unitPence, "0");
    assert.deepEqual(approval?.draft.installments, f.draft.installments);
  } finally {
    await f.cleanup();
  }
});

test("expired offers cannot select and read with explicit expired state", async (t) => {
  const f = await fixture(t);
  try {
    const offer = await publishStaffCommercialOffer(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        engagementId: f.engagement.engagementId,
        draft: f.draft,
        spec: { cash: { mode: "client_proposed" }, revenueShare: null },
        expiresAt: new Date(Date.now() + 500).toISOString(),
      },
      f.correlationId,
    );
    await f.admin`select pg_sleep(0.6)`;
    await assert.rejects(
      f.select(offer.id, offer.version, {
        option: "cash",
        recurringAmountMinor: "2000",
      }),
      AgreementConflict,
    );
    const offers = await listPortalCommercialOffers(
      f.portal,
      f.identities[0],
      f.organisationId,
      f.correlationId,
    );
    assert.equal(
      offers.find((record) => record.id === offer.id)?.status,
      "expired",
    );
  } finally {
    await f.cleanup();
  }
});

test("direct granted commands reject null versions and retain the actual custom reviewer", async (t) => {
  const f = await fixture(t);
  try {
    const offer = await f.publish({
      cash: { mode: "client_proposed" },
      revenueShare: null,
    });
    await assert.rejects(
      withPortalTransaction(
        f.portal,
        f.identities[0],
        f.organisationId,
        f.correlationId,
        (tx) =>
          tx`select operations.select_commercial_offer(${f.organisationId},${offer.id},null,'cash','3000',null,${f.correlationId})`,
      ),
    );
    const proposed = await f.select(offer.id, offer.version, {
      option: "cash",
      recurringAmountMinor: "3000",
    });
    await assert.rejects(
      withFssAdminTransaction(
        f.founderDb,
        f.staff,
        (tx) =>
          tx`select operations.review_commercial_offer(${f.organisationId},${offer.id},null,'reject','Reason',${f.correlationId})`,
      ),
    );
    const reviewer = await f.reviewer();
    const allocated = {
      ...f.draft,
      lines: f.draft.lines.map((line) =>
        line.recurrenceMonths ? { ...line, unitPence: "3000" } : line,
      ),
    };
    const selected = await executeStaffCommercialOfferCommand(
      f.founderDb,
      reviewer,
      f.organisationId,
      {
        action: "approve",
        offerId: offer.id,
        expectedVersion: proposed.version,
        draft: allocated,
      },
      f.correlationId,
    );
    const [approval] = await f.admin<
      { created_by: string }[]
    >`select created_by from operations.signing_approvals where id=${selected.approvalId ?? null}`;
    assert.equal(approval.created_by, reviewer.actorId);
    assert.notEqual(approval.created_by, f.staff.actorId);
    const [audit] = await f.admin<
      { actor_id: string }[]
    >`select actor_id from operations.signing_audit_events where approval_id=${selected.approvalId ?? null} and action='approved'`;
    assert.equal(audit.actor_id, reviewer.actorId);
  } finally {
    await f.cleanup();
  }
});

test("builder snapshots currency, prevents finalisation bypass and closes published working drafts", async (t) => {
  const f = await fixture(t);
  try {
    await updateStaffClientCurrency(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        billingCurrency: "USD",
        expectedCurrencyVersion: 1,
        reviewReference: "New USD work",
      },
      f.correlationId,
    );
    const { documentHash, documentReference, ...agreement } = f.draft;
    void documentHash;
    void documentReference;
    const saved = await saveStaffAgreementBuilderDraft(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        action: "save",
        draftId: randomUUID(),
        expectedVersion: 0,
        step: "review",
        content: {
          agreement,
          engagementId: f.engagement.engagementId,
          commercialOffer: {
            spec: { cash: { mode: "client_proposed" }, revenueShare: null },
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        },
      },
      f.correlationId,
    );
    assert.equal(saved.content.agreement?.currency, "USD");
    await updateStaffClientCurrency(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        billingCurrency: "EUR",
        expectedCurrencyVersion: 2,
        reviewReference: "Future EUR work",
      },
      f.correlationId,
    );
    const updated = await saveStaffAgreementBuilderDraft(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        action: "save",
        draftId: saved.id,
        expectedVersion: saved.version,
        step: "review",
        content: {
          ...saved.content,
          agreement: { ...saved.content.agreement, currency: "EUR" },
        },
      },
      f.correlationId,
    );
    assert.equal(updated.content.agreement?.currency, "USD");
    await assert.rejects(
      saveStaffAgreementBuilderDraft(
        f.founderDb,
        f.staff,
        f.organisationId,
        {
          action: "finalise",
          draftId: updated.id,
          expectedVersion: updated.version,
        },
        f.correlationId,
      ),
      AgreementBuilderDraftConflict,
    );
    const offer = await saveStaffAgreementBuilderDraft(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        action: "publish",
        draftId: updated.id,
        expectedVersion: updated.version,
      },
      f.correlationId,
    );
    assert.ok("spec" in offer);
    assert.equal(offer.draft.currency, "USD");
    const [closed] = await f.admin<
      { published_offer_id: string; finalised_at: string }[]
    >`select published_offer_id,finalised_at::text from operations.agreement_builder_drafts where id=${updated.id}`;
    assert.equal(closed.published_offer_id, offer.id);
    assert.ok(closed.finalised_at);
    await assert.rejects(
      saveStaffAgreementBuilderDraft(
        f.founderDb,
        f.staff,
        f.organisationId,
        {
          action: "save",
          draftId: updated.id,
          expectedVersion: updated.version,
          step: "review",
          content: updated.content,
        },
        f.correlationId,
      ),
      AgreementBuilderDraftConflict,
    );
    // Clear the FK before the shared offer fixture cleanup.
    await f.admin`delete from operations.agreement_builder_drafts where id=${updated.id}`;
  } finally {
    await f.admin`delete from operations.agreement_builder_drafts where organisation_id=${f.organisationId}`;
    await f.cleanup();
  }
});

test("selected revenue share signs, activates ongoing service and bills retained setup installments only", async (t) => {
  const f = await fixture(t);
  try {
    const offer = await f.publish({ cash: null, revenueShare: share });
    const selected = await f.select(offer.id, offer.version, {
      option: "revenue_share",
    });
    assert.ok(selected.approvalId);
    assert.ok(selected.agreementId);
    const approval = await getPortalSigning(
      f.portal,
      f.identities[0],
      f.organisationId,
      selected.approvalId,
      f.correlationId,
    );
    assert.ok(approval);
    await f.sign(approval);
    assert.equal(
      await completeAgreementSigning(f.worker, approval.id, f.correlationId),
      true,
    );
    const [record] = await f.admin<
      { version: number }[]
    >`select version from operations.agreements where id=${selected.agreementId}`;
    const [dates] = await f.admin<
      { today: string }[]
    >`select current_date::text as today`;
    const activated = await executeAgreementCommand(
      f.founderDb,
      f.founder,
      f.organisationId,
      {
        action: "activate",
        agreementId: selected.agreementId,
        expectedVersion: record.version,
        lineNumber: 2,
        evidence: {
          effectiveDate: dates.today,
          assetsReady: true,
          deposit: {
            amountPence: f.draft.requiredDepositPence,
            verifiedDate: dates.today,
            reference: "Verified setup deposit",
          },
        },
      },
      f.correlationId,
    );
    assert.ok(activated.services.some((service) => service.lineNumber === 2));
    const ids = await createBillingSchedule(
      f.founderDb,
      f.founder,
      {
        organisationId: f.organisationId,
        accountId: "acct_commercialTest",
        mode: "test",
      },
      selected.agreementId,
      1,
      f.correlationId,
    );
    assert.equal(ids.length, f.draft.installments.length);
    const schedules = await f.admin<
      { owner: string; amount: string; currency: string }[]
    >`select owner,amount_pence::text as amount,currency from operations.billing_schedules where agreement_id=${selected.agreementId} order by due_date`;
    assert.ok(schedules.every((item) => item.owner === "invoice"));
    assert.deepEqual(
      schedules.map((item) => item.amount),
      f.draft.installments.map((item) => item.amountPence),
    );
  } finally {
    await f.admin`delete from operations.billing_schedules where organisation_id=${f.organisationId}`;
    await f.admin`delete from operations.service_instances where organisation_id=${f.organisationId}`;
    await f.cleanup();
  }
});

test("commercial event history retains actors, correlations and rejected proposal terms across resubmission", async (t) => {
  const f = await fixture(t);
  type Event = {
    action: string;
    status: string;
    offer_version: number;
    selection: { recurringAmountMinor?: string } | null;
    rejection_reason: string | null;
    actor_kind: string;
    actor_id: string;
    user_id: string;
    correlation_id: string;
    approval_id: string | null;
  };
  try {
    const offer = await f.publish({
      cash: { mode: "client_proposed" },
      revenueShare: null,
    });
    const proposed = await f.select(offer.id, offer.version, {
      option: "cash",
      recurringAmountMinor: "2000",
    });
    const rejectCorrelation = randomUUID();
    const rejected = await executeStaffCommercialOfferCommand(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        action: "reject",
        offerId: offer.id,
        expectedVersion: proposed.version,
        reason: "Please propose 3000 for this scope.",
      },
      rejectCorrelation,
    );
    const resubmitted = await f.select(offer.id, rejected.version, {
      option: "cash",
      recurringAmountMinor: "3000",
    });
    const reviewer = await f.reviewer();
    const approveCorrelation = randomUUID();
    const draft = {
      ...f.draft,
      lines: f.draft.lines.map((line) =>
        line.recurrenceMonths ? { ...line, unitPence: "3000" } : line,
      ),
    };
    const selected = await executeStaffCommercialOfferCommand(
      f.founderDb,
      reviewer,
      f.organisationId,
      {
        action: "approve",
        offerId: offer.id,
        expectedVersion: resubmitted.version,
        draft,
      },
      approveCorrelation,
    );
    const events = await f.admin<
      Event[]
    >`select * from operations.commercial_offer_events where organisation_id=${f.organisationId} and offer_id=${offer.id} order by offer_version`;
    assert.deepEqual(
      events.map((event) => event.action),
      ["published", "proposed", "rejected", "resubmitted", "approved"],
    );
    assert.deepEqual(
      events.map((event) => event.offer_version),
      [1, 2, 3, 4, 5],
    );
    assert.equal(events[0].actor_kind, "staff");
    assert.equal(events[0].actor_id, f.staff.actorId);
    assert.equal(events[1].actor_kind, "portal");
    assert.equal(events[1].actor_id, f.identities[0].userId);
    assert.equal(events[1].selection?.recurringAmountMinor, "2000");
    assert.equal(events[2].selection?.recurringAmountMinor, "2000");
    assert.equal(
      events[2].rejection_reason,
      "Please propose 3000 for this scope.",
    );
    assert.equal(events[2].correlation_id, rejectCorrelation);
    assert.equal(events[3].selection?.recurringAmountMinor, "3000");
    assert.equal(events[3].rejection_reason, null);
    assert.equal(events[4].actor_id, reviewer.actorId);
    assert.equal(events[4].user_id, reviewer.userId);
    assert.equal(events[4].correlation_id, approveCorrelation);
    assert.equal(events[4].approval_id, selected.approvalId);
    const visible = await withPortalTransaction(
      f.portal,
      f.identities[0],
      f.organisationId,
      f.correlationId,
      (tx) =>
        tx<
          Event[]
        >`select * from operations.commercial_offer_events where offer_id=${offer.id} order by offer_version`,
    );
    assert.equal(visible.length, 5);
    for (const role of ["operations_founder", "operations_portal"]) {
      const [privileges] = await f.admin<
        { writable: boolean }[]
      >`select has_table_privilege(${role},'operations.commercial_offer_events','insert,update,delete') as writable`;
      assert.equal(privileges.writable, false);
    }
    const fixed = await f.publish({
      cash: { mode: "fixed" },
      revenueShare: null,
    });
    await withPortalTransaction(
      f.portal,
      f.identities[0],
      f.organisationId,
      f.correlationId,
      async (tx) => {
        // Portal selection must retain its actual client actor even if unrelated
        // staff metadata is present on the scoped database connection.
        await tx`select set_config('operations.actor_id',${f.staff.actorId},true)`;
        await tx`select operations.select_commercial_offer(${f.organisationId},${fixed.id},${fixed.version},'cash',null,null,${f.correlationId})`;
      },
    );
    const fixedEvents = await f.admin<
      Event[]
    >`select * from operations.commercial_offer_events where offer_id=${fixed.id} order by offer_version`;
    assert.deepEqual(
      fixedEvents.map((event) => event.action),
      ["published", "selected"],
    );
    assert.equal(fixedEvents[1].actor_kind, "portal");
    assert.equal(fixedEvents[1].actor_id, f.identities[0].userId);
    const withdrawn = await f.publish({
      cash: { mode: "fixed" },
      revenueShare: null,
    });
    await executeStaffCommercialOfferCommand(
      f.founderDb,
      f.staff,
      f.organisationId,
      {
        action: "withdraw",
        offerId: withdrawn.id,
        expectedVersion: withdrawn.version,
      },
      f.correlationId,
    );
    const [withdrawal] = await f.admin<
      Event[]
    >`select * from operations.commercial_offer_events where offer_id=${withdrawn.id} and action='withdrawn'`;
    assert.equal(withdrawal.actor_id, f.staff.actorId);
    await f.admin`update operations.memberships set revoked_at=clock_timestamp() where organisation_id=${f.organisationId}`;
    await assert.rejects(
      withPortalTransaction(
        f.portal,
        f.identities[0],
        f.organisationId,
        f.correlationId,
        (tx) =>
          tx`select * from operations.commercial_offer_events where offer_id=${offer.id}`,
      ),
    );
  } finally {
    await f.cleanup();
  }
});
