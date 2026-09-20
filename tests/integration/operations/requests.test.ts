import { randomUUID } from "node:crypto";
import { executeDocumentCommand } from "../../../lib/operations/documents/service";
import assert from "node:assert/strict";
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
  listPortalRequests,
} from "../../../lib/operations/requests/repository";
import {
  RequestConflict,
  RequestValidationError,
} from "../../../lib/operations/requests/types";
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
test("request lifecycle: scoped identity, concurrent idempotency, evidence, version conflicts, privacy and explicit review", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_portal" },
  });
  const f = await requestFixture(admin, founder);
  const b = await requestFixture(admin, founder);
  const create = (raw: unknown) =>
    createPortalRequest(
      portal,
      f.identity,
      f.organisationId,
      raw,
      f.correlationId,
    );
  const read = (id: string) =>
    getPortalRequest(portal, f.identity, f.organisationId, id, f.correlationId);
  const command = (raw: unknown) =>
    executeFounderRequestCommand(
      founder,
      deliveryFounder,
      f.organisationId,
      raw,
      f.correlationId,
    );
  try {
    const payload = newRequest(f.projectId);
    const [a, duplicate] = await Promise.all([
      create(payload),
      create(payload),
    ]);
    assert.equal(a.id, duplicate.id);
    assert.equal(a.status, "new");
    assert.equal(
      (
        await listPortalRequests(
          portal,
          f.identity,
          f.organisationId,
          f.correlationId,
        )
      ).items.length,
      1,
    );
    await assert.rejects(() => create({ ...newRequest(b.projectId) }));
    await assert.rejects(() =>
      getPortalRequest(
        portal,
        f.identity,
        b.organisationId,
        a.id,
        f.correlationId,
      ),
    );
    const results = await Promise.allSettled([
      command({
        action: "acknowledge",
        requestId: a.id,
        expectedVersion: 1,
        ownerDisplay: "FSS",
        scope: "included",
      }),
      command({
        action: "acknowledge",
        requestId: a.id,
        expectedVersion: 1,
        ownerDisplay: "FSS",
        scope: "included",
      }),
    ]);
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    assert.ok(
      results.some(
        (x) => x.status === "rejected" && x.reason instanceof RequestConflict,
      ),
    );
    await command({
      action: "plan",
      requestId: a.id,
      expectedVersion: 2,
      nextAction: "Build it",
    });
    await assert.rejects(
      () => command({ action: "start", requestId: a.id, expectedVersion: 3 }),
      RequestValidationError,
    );
    await activateRequestAgreement(founder, f);
    await command({ action: "start", requestId: a.id, expectedVersion: 3 });
    await command({
      action: "comment",
      requestId: a.id,
      expectedVersion: 4,
      body: "INTERNAL SECRET",
      visibility: "internal",
    });
    await command({
      action: "comment",
      requestId: a.id,
      expectedVersion: 5,
      body: "Public progress",
      visibility: "client",
    });
    assert.equal((await read(a.id))?.comments.length, 1);
    assert.doesNotMatch(JSON.stringify(await read(a.id)), /INTERNAL SECRET/);
    assert.equal(
      (
        await getFounderRequest(
          founder,
          deliveryFounder,
          f.organisationId,
          a.id,
          f.correlationId,
        )
      )?.internalComments.length,
      1,
    );
    await withPortalTransaction(
      portal,
      f.identity,
      f.organisationId,
      f.correlationId,
      async (tx) => {
        const rows =
          await tx`select body from operations.request_comments where request_id=${a.id}`;
        assert.equal(rows.length, 1);
      },
    );
    await assert.rejects(() =>
      withPortalTransaction(
        portal,
        f.identity,
        f.organisationId,
        f.correlationId,
        (tx) => tx`select capacity_override_reason from operations.requests`,
      ),
    );
    const versionOneDocument = randomUUID();
    await executeDocumentCommand(
      founder,
      deliveryFounder,
      f.organisationId,
      {
        action: "create",
        documentId: versionOneDocument,
        metadata: {
          projectId: f.projectId,
          milestoneId: null,
          title: "Version one",
          kind: "link",
          url: "https://example.test/v1",
          visibility: "client",
          expiresAt: null,
        },
        reviewReference: "synthetic",
      },
      f.correlationId,
    );
    await command({
      action: "review",
      requestId: a.id,
      expectedVersion: 6,
      deliverableVersion: "v1",
      documentIds: [versionOneDocument],
      reviewInstructions: "Review changes",
      publicSummary: "Ready",
    });
    const review = {
      requestId: a.id,
      expectedVersion: 7,
      reviewCycle: 1,
      deliverableVersion: "v1",
    };
    await assert.rejects(
      () =>
        executePortalRequestCommand(
          portal,
          f.identity,
          f.organisationId,
          { ...review, action: "accept", deliverableVersion: "v0" },
          f.correlationId,
        ),
      RequestConflict,
    );
    await executePortalRequestCommand(
      portal,
      f.identity,
      f.organisationId,
      { ...review, action: "request_changes", feedback: "Change heading" },
      f.correlationId,
    );
    await command({
      action: "revise",
      requestId: a.id,
      expectedVersion: 8,
      revisionDecision: "included",
      reason: "Included revision",
    });
    await command({
      action: "review",
      requestId: a.id,
      expectedVersion: 9,
      deliverableVersion: "v2",
      reviewInstructions: "Review v2",
      publicSummary: "Updated",
    });
    await assert.rejects(
      () =>
        executePortalRequestCommand(
          portal,
          f.identity,
          f.organisationId,
          { ...review, expectedVersion: 10, action: "accept" },
          f.correlationId,
        ),
      RequestConflict,
    );
    await executePortalRequestCommand(
      portal,
      f.identity,
      f.organisationId,
      {
        ...review,
        expectedVersion: 10,
        deliverableVersion: "v2",
        action: "accept",
      },
      f.correlationId,
    );
    const currentReview = await read(a.id);
    assert.deepEqual(currentReview?.documents, []);
    assert.equal(currentReview?.reviews[0].documents[0].id, versionOneDocument);
    const done = await read(a.id);
    assert.equal(done?.closureLabel, "Accepted by client");
    assert.equal(done?.reviews.length, 4);
    await command({
      action: "reopen",
      requestId: a.id,
      expectedVersion: 11,
      reason: "New scoped cycle",
    });
    assert.equal((await read(a.id))?.reviewCycle, 2);
    await command({
      action: "close",
      requestId: a.id,
      expectedVersion: 12,
      reason: "Administrative closure",
    });
    assert.equal((await read(a.id))?.closureLabel, "Closed by FSS");
    const closedNew = await create(newRequest(f.projectId));
    await command({
      action: "close",
      requestId: closedNew.id,
      expectedVersion: 1,
      reason: "Administrative duplicate",
    });
    await command({
      action: "reopen",
      requestId: closedNew.id,
      expectedVersion: 2,
      reason: "Reconsidered",
    });
    assert.equal((await read(closedNew.id))?.ownerDisplay, "FSS");
    assert.equal((await read(closedNew.id))?.status, "acknowledged");
    const events =
      await admin`select kind from operations.request_notification_outbox where request_id=${a.id}`;
    assert.equal(events.filter((x) => x.kind === "public_comment").length, 1);
    await admin`update operations.memberships set revoked_at=now() where organisation_id=${f.organisationId}`;
    await assert.rejects(() => read(a.id));
  } finally {
    await removeRequestFixture(admin, f);
    await removeRequestFixture(admin, b);
    await Promise.all([admin.end(), founder.end(), portal.end()]);
  }
});

test("global owner WIP admission serializes concurrent starts and requires explicit override", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 4,
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
    const requests = [];
    for (let i = 0; i < 4; i++) {
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
        scope: "included",
      });
      await command({
        action: "plan",
        requestId: r.id,
        expectedVersion: 2,
        nextAction: "Build",
      });
      requests.push(r);
    }
    const result = await Promise.allSettled(
      requests.map((r) =>
        command({ action: "start", requestId: r.id, expectedVersion: 3 }),
      ),
    );
    assert.equal(result.filter((x) => x.status === "fulfilled").length, 3);
    const blocked = requests[result.findIndex((x) => x.status === "rejected")];
    assert.ok(blocked);
    await command({
      action: "start",
      requestId: blocked.id,
      expectedVersion: 3,
      capacityOverrideReason: "Approved temporary overflow",
    });
  } finally {
    await removeRequestFixture(admin, f);
    await Promise.all([admin.end(), founder.end(), portal.end()]);
  }
});
