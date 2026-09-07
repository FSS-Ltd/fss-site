import { withAgreementTransaction } from "../../../lib/operations/agreements/repository";
import { executeDocumentCommand } from "../../../lib/operations/documents/service";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import {
  createPortalRequest,
  executePortalRequestCommand,
  executeFounderRequestCommand,
} from "../../../lib/operations/requests/service";
import {
  getPortalRequest,
  getFounderRequest,
} from "../../../lib/operations/requests/repository";
import { consumeRequestRateLimit } from "../../../lib/operations/requests/rate-limit";
import { withPortalTransaction } from "../../../lib/operations/db/portal-client";
import { deliveryFounder } from "./project-document-fixtures";
import {
  activateRequestAgreement,
  newRequest,
  requestFixture,
  removeRequestFixture,
} from "./request-fixtures";
const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);
test("designated contributors need live scope; viewer and billing membership cannot edit; allowance history is immutable", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const f = await requestFixture(admin, founder);
  const command = (raw: unknown) =>
    executeFounderRequestCommand(
      founder,
      deliveryFounder,
      f.organisationId,
      raw,
      f.correlationId,
    );
  try {
    await activateRequestAgreement(founder, f);
    const r = await createPortalRequest(
      portal,
      f.identity,
      f.organisationId,
      newRequest(f.projectId),
      f.correlationId,
    );
    await command({
      action: "acknowledge",
      requestId: r.id,
      expectedVersion: 1,
      ownerDisplay: "FSS",
      scope: "assessment_pending",
    });
    await assert.rejects(() =>
      command({
        action: "plan",
        requestId: r.id,
        expectedVersion: 2,
        nextAction: "Build",
      }),
    );
    await command({
      action: "classify_scope",
      requestId: r.id,
      expectedVersion: 2,
      scope: "included",
    });
    await command({
      action: "allowance",
      requestId: r.id,
      expectedVersion: 3,
      unit: "hours",
      amount: 5,
      reason: "Contractual allowance",
      approvalReference: "signed-agreement:scope",
    });
    await command({
      action: "allowance",
      requestId: r.id,
      expectedVersion: 4,
      unit: "hours",
      amount: -1,
      reason: "Approved reduction",
      approvalReference: "approved-change:1",
    });
    await assert.rejects(() =>
      command({
        action: "allowance",
        requestId: r.id,
        expectedVersion: 5,
        unit: "tasks",
        amount: 1,
        reason: "Wrong unit",
        approvalReference: "invalid",
      }),
    );
    await command({
      action: "plan",
      requestId: r.id,
      expectedVersion: 5,
      nextAction: "Build",
    });
    await command({ action: "start", requestId: r.id, expectedVersion: 6 });
    await command({
      action: "block",
      requestId: r.id,
      expectedVersion: 7,
      blocked: {
        reason: "Awaiting asset",
        responsibleParty: "Client",
        nextCheckDate: "2026-09-10",
      },
    });
    assert.ok(
      (
        await getPortalRequest(
          portal,
          f.identity,
          f.organisationId,
          r.id,
          f.correlationId,
        )
      )?.blocked,
    );
    await command({
      action: "block",
      requestId: r.id,
      expectedVersion: 8,
      blocked: null,
    });
    const documentId = randomUUID();
    await executeDocumentCommand(
      founder,
      deliveryFounder,
      f.organisationId,
      {
        action: "create",
        documentId,
        metadata: {
          projectId: f.projectId,
          milestoneId: null,
          title: "Approved deliverable",
          kind: "link",
          url: "https://example.test/deliverable",
          visibility: "client",
          expiresAt: null,
        },
        reviewReference: "synthetic",
      },
      f.correlationId,
    );
    await assert.rejects(() =>
      command({
        action: "review",
        requestId: r.id,
        expectedVersion: 9,
        deliverableVersion: "v1",
        reviewInstructions: "Review",
        publicSummary: "Ready",
        documentIds: [randomUUID()],
      }),
    );
    await command({
      action: "review",
      requestId: r.id,
      expectedVersion: 9,
      deliverableVersion: "v1",
      documentIds: [documentId],
      reviewInstructions: "Check outcome",
      publicSummary: "Ready",
    });
    await assert.rejects(() =>
      withAgreementTransaction(founder, deliveryFounder, async (tx) => {
        await tx`select set_config('operations.correlation_id',${f.correlationId},true)`;
        await tx`insert into operations.request_reviews(organisation_id,request_id,review_cycle,deliverable_version,decision) values(${f.organisationId},${r.id},1,'v1','accepted')`;
      }),
    );
    await assert.rejects(() =>
      withPortalTransaction(
        portal,
        f.identity,
        f.organisationId,
        f.correlationId,
        (tx) =>
          tx`select operations.portal_request_command(${f.organisationId},${tx.json({ action: "accept", requestId: r.id, deliverableVersion: "v1", reviewCycle: 1 })})`,
      ),
    );
    const detail = await getPortalRequest(
      portal,
      f.identity,
      f.organisationId,
      r.id,
      f.correlationId,
    );
    assert.deepEqual(detail?.reviews[0].documentIds, [documentId]);
    assert.equal(detail?.documents[0].kind, "link");
    assert.equal(detail?.allowance?.total, 4);
    await executeDocumentCommand(
      founder,
      deliveryFounder,
      f.organisationId,
      {
        action: "revoke",
        documentId,
        expectedVersion: 1,
        reviewReference: "synthetic",
      },
      f.correlationId,
    );
    assert.equal(
      (
        await getPortalRequest(
          portal,
          f.identity,
          f.organisationId,
          r.id,
          f.correlationId,
        )
      )?.documents.length,
      0,
    );
    assert.equal(
      (
        await getFounderRequest(
          founder,
          deliveryFounder,
          f.organisationId,
          r.id,
          f.correlationId,
        )
      )?.documents.length,
      0,
    );
    await admin`update operations.memberships set role='contributor' where organisation_id=${f.organisationId}`;
    const accept = {
      action: "accept",
      requestId: r.id,
      expectedVersion: 10,
      reviewCycle: 1,
      deliverableVersion: "v1",
    };
    await assert.rejects(() =>
      executePortalRequestCommand(
        portal,
        f.identity,
        f.organisationId,
        accept,
        f.correlationId,
      ),
    );
    await assert.rejects(() =>
      command({
        action: "designate_reviewer",
        requestId: r.id,
        expectedVersion: 10,
        userId: randomUUID(),
        enabled: true,
      }),
    );
    await command({
      action: "designate_reviewer",
      requestId: r.id,
      expectedVersion: 10,
      userId: f.identity.userId,
      enabled: true,
    });
    assert.equal(
      (
        await getPortalRequest(
          portal,
          f.identity,
          f.organisationId,
          r.id,
          f.correlationId,
        )
      )?.canReview,
      true,
    );
    for (const role of ["viewer", "billing_contact"]) {
      await admin`update operations.memberships set role=${role} where organisation_id=${f.organisationId}`;
      await assert.rejects(() =>
        executePortalRequestCommand(
          portal,
          f.identity,
          f.organisationId,
          { ...accept, expectedVersion: 11 },
          f.correlationId,
        ),
      );
      await assert.rejects(() =>
        createPortalRequest(
          portal,
          f.identity,
          f.organisationId,
          newRequest(f.projectId),
          f.correlationId,
        ),
      );
    }
    await admin`update operations.memberships set role='contributor' where organisation_id=${f.organisationId}`;
    await executePortalRequestCommand(
      portal,
      f.identity,
      f.organisationId,
      { ...accept, expectedVersion: 11 },
      f.correlationId,
    );
    await assert.rejects(() =>
      withPortalTransaction(
        portal,
        f.identity,
        f.organisationId,
        f.correlationId,
        (tx) =>
          tx`update operations.request_reviews set feedback='forged' where request_id=${r.id}`,
      ),
    );
    await admin`update operations.memberships set revoked_at=now() where organisation_id=${f.organisationId}`;
    await assert.rejects(() =>
      getPortalRequest(
        portal,
        f.identity,
        f.organisationId,
        r.id,
        f.correlationId,
      ),
    );
  } finally {
    await removeRequestFixture(admin, f);
    await Promise.all([admin.end(), founder.end(), portal.end()]);
  }
});
test("request mutation rate budget is durable and identity scoped", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const f = await requestFixture(admin, founder);
  try {
    for (let i = 0; i < 30; i++)
      assert.equal(
        await consumeRequestRateLimit(
          portal,
          f.identity,
          f.organisationId,
          f.correlationId,
        ),
        true,
      );
    assert.equal(
      await consumeRequestRateLimit(
        portal,
        f.identity,
        f.organisationId,
        f.correlationId,
      ),
      false,
    );
  } finally {
    await removeRequestFixture(admin, f);
    await Promise.all([admin.end(), founder.end(), portal.end()]);
  }
});
